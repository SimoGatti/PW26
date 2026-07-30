#!/usr/bin/env python3
"""Bootstrap locale conservativo e multipiattaforma per QUIZZING.

Il bootstrap puo creare cio che manca, ma non elimina, tronca o sovrascrive
dati applicativi. Ogni modifica a PostgreSQL richiede conferma, salvo l'uso
esplicito di --yes. Gli stati non riparabili in modo additivo causano un arresto
con una diagnosi.
"""

from __future__ import annotations

import argparse
import getpass
import os
import platform
import re
import secrets
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Iterable

import psycopg
from psycopg import sql


PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_DIR / ".env"
INIT_SCHEMA = PROJECT_DIR / "database" / "init_schema.sql"
IMPORT_SCRIPT = PROJECT_DIR / "database" / "import_mysql_dump.py"
INITIAL_DATASET = (
    PROJECT_DIR / "database" / "data" / "quiz_mysql_expanded.sql"
)
MANAGE = PROJECT_DIR / "manage.py"

EXPECTED_COLUMNS = {
    "Utente": {"nomeUtente", "nome", "cognome", "email"},
    "Quiz": {"codice", "creatore", "titolo", "dataInizio", "dataFine"},
    "Domanda": {"quiz", "numero", "testo"},
    "Risposta": {"quiz", "domanda", "numero", "testo", "tipo", "punteggio"},
    "Partecipazione": {"codice", "utente", "quiz", "data"},
    "RispostaUtenteQuiz": {
        "partecipazione",
        "quiz",
        "domanda",
        "risposta",
    },
}
EXPECTED_INDEXES = {
    "quiz_creatore_idx",
    "quiz_date_idx",
    "partecipazione_utente_idx",
    "partecipazione_quiz_idx",
    "partecipazione_data_idx",
    "domanda_quiz_idx",
    "risposta_domanda_idx",
    "ruq_partecipazione_idx",
}
ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class BootstrapError(RuntimeError):
    """Errore spiegabile all'utente senza traceback."""


def print_step(message: str) -> None:
    print(f"\n==> {message}")


def parse_env(path: Path) -> tuple[list[str], dict[str, str]]:
    """Legge ``.env`` conservando righe e ordine per gli aggiornamenti."""
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    values: dict[str, str] = {}
    for number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            raise BootstrapError(
                f"{path}, riga {number}: formato non valido. "
                "Usare NOME=valore."
            )
        name, value = (part.strip() for part in line.split("=", 1))
        if not ENV_NAME.fullmatch(name):
            raise BootstrapError(
                f"{path}, riga {number}: nome di variabile non valido: {name}"
            )
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[name] = value
    return lines, values


def set_env_line(lines: list[str], name: str, value: str) -> None:
    """Sostituisce una variabile esistente o la aggiunge in fondo al file."""
    matcher = re.compile(rf"^\s*(?:export\s+)?{re.escape(name)}\s*=")
    for index, line in enumerate(lines):
        if matcher.match(line):
            lines[index] = f"{name}={value}"
            return
    if lines and lines[-1].strip():
        lines.append("")
    lines.append(f"{name}={value}")


def ensure_environment() -> dict[str, str]:
    """Completa ``.env`` senza sovrascrivere configurazioni personalizzate."""
    print_step(f"Preparazione della configurazione {ENV_FILE}")
    inherited_environment = dict(os.environ)
    if ENV_FILE.exists() and not ENV_FILE.is_file():
        raise BootstrapError(f"{ENV_FILE} esiste ma non e un file regolare.")

    lines, values = parse_env(ENV_FILE)
    defaults = {
        "POSTGRES_DB": "quizzing",
        "POSTGRES_USER": "quizzing_app",
        "POSTGRES_HOST": "127.0.0.1",
        "POSTGRES_PORT": "5432",
    }
    changed: list[str] = []
    for name, default in defaults.items():
        if not values.get(name):
            values[name] = default
            set_env_line(lines, name, default)
            changed.append(name)

    # Una password casuale serve al ruolo dedicato creato dal bootstrap.
    # Per ruoli locali personalizzati (es. autenticazione peer via socket)
    # una password vuota puo invece essere intenzionale e viene conservata.
    if "POSTGRES_PASSWORD" not in values:
        values["POSTGRES_PASSWORD"] = (
            secrets.token_urlsafe(24)
            if values["POSTGRES_USER"] == "quizzing_app"
            else ""
        )
        set_env_line(lines, "POSTGRES_PASSWORD", values["POSTGRES_PASSWORD"])
        changed.append("POSTGRES_PASSWORD")
    elif (
        not values["POSTGRES_PASSWORD"]
        and values["POSTGRES_USER"] == "quizzing_app"
    ):
        values["POSTGRES_PASSWORD"] = secrets.token_urlsafe(24)
        set_env_line(lines, "POSTGRES_PASSWORD", values["POSTGRES_PASSWORD"])
        changed.append("POSTGRES_PASSWORD")

    if changed or not ENV_FILE.exists():
        ENV_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
        try:
            ENV_FILE.chmod(0o600)
        except OSError:
            pass
        print("Create o completate: " + ", ".join(changed))
    else:
        print("Configurazione gia completa; nessun valore sovrascritto.")

    try:
        port = int(values["POSTGRES_PORT"])
    except ValueError as exc:
        raise BootstrapError("POSTGRES_PORT deve essere un numero intero.") from exc
    if not 1 <= port <= 65535:
        raise BootstrapError("POSTGRES_PORT deve essere compresa tra 1 e 65535.")

    # Le variabili esportate dal chiamante hanno precedenza solo nel processo
    # corrente; il file resta una configurazione locale riproducibile.
    runtime_values = dict(values)
    for name, value in values.items():
        inherited = inherited_environment.get(name)
        if inherited is not None:
            runtime_values[name] = inherited
        os.environ[name] = runtime_values[name]
    return runtime_values


def app_connection_kwargs(values: dict[str, str]) -> dict[str, object]:
    """Traduce la configurazione applicativa nei parametri di psycopg."""
    return {
        "host": values["POSTGRES_HOST"],
        "port": values["POSTGRES_PORT"],
        "dbname": values["POSTGRES_DB"],
        "user": values["POSTGRES_USER"],
        "password": values["POSTGRES_PASSWORD"],
        "connect_timeout": 4,
    }


def connect_app(values: dict[str, str]) -> psycopg.Connection:
    """Apre una connessione con il ruolo usato dall'applicazione."""
    return psycopg.connect(**app_connection_kwargs(values))


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    answer = input(f"{prompt}{suffix}: ").strip()
    return answer or default


def confirmed(question: str, assume_yes: bool) -> bool:
    """Richiede conferma esplicita prima di una modifica additiva."""
    if assume_yes:
        print(f"{question} si (--yes)")
        return True
    if not sys.stdin.isatty():
        raise BootstrapError(
            "Sono necessarie modifiche, ma il terminale non e interattivo. "
            "Rieseguire interattivamente oppure usare --yes."
        )
    return input(f"{question} [s/N]: ").strip().lower() in {"s", "si", "sì", "y", "yes"}


def admin_connection(
    args: argparse.Namespace,
) -> tuple[psycopg.Connection, dict[str, object]]:
    """Raccoglie le credenziali amministrative senza salvarle in ``.env``."""
    is_windows = platform.system() == "Windows"
    default_user = "postgres" if is_windows else getpass.getuser()
    default_host = "127.0.0.1" if is_windows else "/tmp"

    if not sys.stdin.isatty() and not args.admin_user:
        raise BootstrapError(
            "Servono credenziali amministrative PostgreSQL. "
            "Rieseguire in un terminale interattivo o specificare "
            "--admin-user e QUIZZING_ADMIN_PASSWORD."
        )

    user = args.admin_user or ask("Ruolo amministrativo PostgreSQL", default_user)
    host = args.admin_host or ask("Host amministrativo PostgreSQL", default_host)
    port = args.admin_port or ask(
        "Porta amministrativa PostgreSQL",
        os.environ["POSTGRES_PORT"],
    )
    database = args.admin_database or "postgres"
    password = os.getenv("QUIZZING_ADMIN_PASSWORD")
    if password is None:
        password = getpass.getpass(
            "Password amministrativa PostgreSQL "
            "(Invio se la connessione locale non la richiede): "
        )

    connection_options: dict[str, object] = {
        "host": host,
        "port": port,
        "dbname": database,
        "user": user,
        "password": password,
        "connect_timeout": 5,
        "autocommit": True,
    }
    try:
        connection = psycopg.connect(**connection_options)
    except psycopg.Error as exc:
        raise BootstrapError(
            "Connessione amministrativa PostgreSQL non riuscita.\n"
            f"Dettaglio: {exc}"
        ) from exc
    return connection, connection_options


def scalar(connection: psycopg.Connection, query: str, params=()):
    """Restituisce la prima colonna della prima riga di una query."""
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
    return row[0] if row else None


def provision_database(
    values: dict[str, str],
    args: argparse.Namespace,
    original_error: psycopg.Error,
) -> None:
    """Crea o autorizza ruolo e database senza rimuovere oggetti esistenti."""
    print("\nLa connessione applicativa non e disponibile.")
    print(f"Dettaglio: {original_error}")
    print("Verranno controllati ruolo e database senza cancellare nulla.")

    admin, admin_options = admin_connection(args)
    app_user = values["POSTGRES_USER"]
    database = values["POSTGRES_DB"]
    try:
        role_exists = bool(
            scalar(admin, "SELECT 1 FROM pg_roles WHERE rolname=%s", (app_user,))
        )
        database_exists = bool(
            scalar(admin, "SELECT 1 FROM pg_database WHERE datname=%s", (database,))
        )
        actions: list[str] = []
        if not role_exists:
            actions.append(f"creare il ruolo applicativo {app_user!r}")
        elif app_user == "quizzing_app":
            actions.append(
                "sincronizzare la password del ruolo dedicato quizzing_app "
                "con il valore locale in .env"
            )
        if not database_exists:
            actions.append(f"creare il database {database!r}")
        else:
            actions.append(
                f"garantire al ruolo {app_user!r} l'accesso al database esistente"
            )

        # Una password di un ruolo scelto dall'utente non viene mai modificata
        # automaticamente: potrebbe essere condivisa con altri progetti.
        if role_exists and app_user != "quizzing_app" and database_exists:
            raise BootstrapError(
                "Il ruolo e il database esistono, ma le credenziali applicative "
                "non funzionano. Per sicurezza il bootstrap non cambia la "
                f"password del ruolo personalizzato {app_user!r}. Correggere "
                "POSTGRES_PASSWORD o usare il ruolo dedicato quizzing_app."
            )

        print("\nOperazioni PostgreSQL proposte:")
        for action in actions:
            print(f"  - {action}")
        if not confirmed("Procedere con queste operazioni additive?", args.yes):
            raise BootstrapError("Inizializzazione PostgreSQL annullata.")

        if not role_exists:
            with admin.cursor() as cursor:
                cursor.execute(
                    sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                        sql.Identifier(app_user),
                        sql.Literal(values["POSTGRES_PASSWORD"]),
                    )
                )
        elif app_user == "quizzing_app":
            with admin.cursor() as cursor:
                cursor.execute(
                    sql.SQL("ALTER ROLE {} PASSWORD {}").format(
                        sql.Identifier(app_user),
                        sql.Literal(values["POSTGRES_PASSWORD"]),
                    )
                )

        if not database_exists:
            with admin.cursor() as cursor:
                cursor.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(database),
                        sql.Identifier(app_user),
                    )
                )
        else:
            with admin.cursor() as cursor:
                cursor.execute(
                    sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                        sql.Identifier(database),
                        sql.Identifier(app_user),
                    )
                )

            target_kwargs = dict(admin_options)
            target_kwargs["dbname"] = database
            with psycopg.connect(**target_kwargs) as target:
                with target.cursor() as cursor:
                    cursor.execute(
                        sql.SQL("GRANT USAGE, CREATE ON SCHEMA public TO {}").format(
                            sql.Identifier(app_user)
                        )
                    )
                    cursor.execute(
                        sql.SQL(
                            "GRANT ALL PRIVILEGES ON ALL TABLES "
                            "IN SCHEMA public TO {}"
                        ).format(sql.Identifier(app_user))
                    )
                    cursor.execute(
                        sql.SQL(
                            "GRANT ALL PRIVILEGES ON ALL SEQUENCES "
                            "IN SCHEMA public TO {}"
                        ).format(sql.Identifier(app_user))
                    )
    except psycopg.Error as exc:
        raise BootstrapError(
            "Creazione o autorizzazione di ruolo/database non riuscita.\n"
            f"Dettaglio: {exc}"
        ) from exc
    finally:
        admin.close()


def table_names(connection: psycopg.Connection) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        )
        return {row[0] for row in cursor.fetchall()}


def index_names(connection: psycopg.Connection) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexname FROM pg_indexes WHERE schemaname='public'"
        )
        return {row[0] for row in cursor.fetchall()}


def validate_domain_columns(connection: psycopg.Connection) -> None:
    """Rifiuta schemi parziali che richiederebbero una migrazione distruttiva."""
    problems: list[str] = []
    with connection.cursor() as cursor:
        for table, expected in EXPECTED_COLUMNS.items():
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name=%s",
                (table,),
            )
            actual = {row[0] for row in cursor.fetchall()}
            missing = expected - actual
            if missing:
                problems.append(f"{table}: colonne mancanti {sorted(missing)}")
    if problems:
        raise BootstrapError(
            "Lo schema esistente e incompatibile e non puo essere corretto "
            "senza una migrazione dati esplicita. Nessun dato e stato rimosso.\n"
            + "\n".join(f"  - {problem}" for problem in problems)
        )


def domain_counts(connection: psycopg.Connection) -> dict[str, int]:
    """Conta le righe per decidere se proporre il dataset iniziale."""
    counts: dict[str, int] = {}
    with connection.cursor() as cursor:
        for table in EXPECTED_COLUMNS:
            cursor.execute(
                sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
            )
            counts[table] = cursor.fetchone()[0]
    return counts


def run_manage(arguments: Iterable[str], *, check: bool = True) -> int:
    """Esegue un comando Django con interprete e ambiente correnti."""
    command = [sys.executable, str(MANAGE), *arguments]
    print("    " + " ".join(command))
    completed = subprocess.run(
        command,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        check=False,
    )
    if check and completed.returncode:
        raise BootstrapError(
            f"Comando Django fallito con codice {completed.returncode}: "
            + " ".join(command)
        )
    return completed.returncode


def run_python_script(script: Path, arguments: Iterable[str]) -> int:
    """Esegue uno script ausiliario e traduce gli errori per l'utente."""
    command = [sys.executable, str(script), *arguments]
    print("    " + " ".join(command))
    completed = subprocess.run(
        command,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        check=False,
    )
    if completed.returncode:
        raise BootstrapError(
            f"Comando Python fallito con codice {completed.returncode}: "
            + " ".join(command)
        )
    return completed.returncode


def apply_schema(connection: psycopg.Connection) -> None:
    """Applica lo schema additivo in una singola transazione."""
    if not INIT_SCHEMA.is_file():
        raise BootstrapError(f"Schema iniziale non trovato: {INIT_SCHEMA}")
    try:
        with connection.cursor() as cursor:
            cursor.execute(INIT_SCHEMA.read_text(encoding="utf-8"))
        connection.commit()
    except psycopg.Error:
        connection.rollback()
        raise


def initialize_application(
    connection: psycopg.Connection,
    args: argparse.Namespace,
) -> None:
    """Controlla schema, migrazioni e dataset prima dell'avvio."""
    existing_tables = table_names(connection)
    missing_tables = set(EXPECTED_COLUMNS) - existing_tables
    missing_indexes = EXPECTED_INDEXES - index_names(connection)

    # Se esiste già almeno una tabella di dominio, prima di aggiungere oggetti
    # si controlla che le colonne note siano compatibili.
    if not missing_tables:
        validate_domain_columns(connection)
        counts = domain_counts(connection)
    else:
        existing_domain = set(EXPECTED_COLUMNS) & existing_tables
        counts = {}
        if existing_domain:
            with connection.cursor() as cursor:
                for table in existing_domain:
                    cursor.execute(
                        sql.SQL("SELECT COUNT(*) FROM {}").format(
                            sql.Identifier(table)
                        )
                    )
                    counts[table] = cursor.fetchone()[0]

    migration_needed = run_manage(["migrate", "--check"], check=False) != 0
    essential_actions: list[str] = []
    if missing_tables or missing_indexes:
        essential_actions.append(
            "applicare lo schema additivo (solo tabelle/indici mancanti)"
        )
    if migration_needed:
        essential_actions.append("applicare le migrazioni Django mancanti")

    if args.check_only:
        if essential_actions:
            raise BootstrapError(
                "Controllo completato: sono richieste queste operazioni:\n"
                + "\n".join(f"  - {action}" for action in essential_actions)
            )
        print("Schema applicativo e migrazioni risultano completi.")
        return

    if essential_actions:
        print("\nOperazioni applicative proposte:")
        for action in essential_actions:
            print(f"  - {action}")
        print("Nessuna operazione elimina o sostituisce dati esistenti.")
        if not confirmed("Procedere?", args.yes):
            raise BootstrapError(
                "Inizializzazione annullata; l'app non viene avviata "
                "in uno stato incompleto."
            )

        if missing_tables or missing_indexes:
            try:
                apply_schema(connection)
            except psycopg.Error as exc:
                raise BootstrapError(
                    "Applicazione dello schema additivo non riuscita. "
                    "La transazione e stata annullata.\n"
                    f"Dettaglio: {exc}"
                ) from exc
            validate_domain_columns(connection)

        if migration_needed:
            run_manage(["migrate"])

    counts = domain_counts(connection)
    total_rows = sum(counts.values())
    if total_rows == 0 and not args.no_data:
        should_import = confirmed(
            "Le tabelle applicative sono vuote. "
            "Importare il dataset completo iniziale?",
            args.yes,
        )
        if should_import:
            if not INITIAL_DATASET.is_file():
                raise BootstrapError(
                    f"Dataset iniziale non trovato: {INITIAL_DATASET}"
                )
            run_python_script(
                IMPORT_SCRIPT,
                [str(INITIAL_DATASET)],
            )
    elif total_rows:
        print(
            "Dati applicativi esistenti rilevati; importazione ignorata: "
            + ", ".join(f"{table}={count}" for table, count in counts.items())
        )


def parse_args() -> argparse.Namespace:
    """Definisce le sole opzioni supportate dal bootstrap condiviso."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--yes",
        action="store_true",
        help="conferma le sole operazioni additive proposte",
    )
    parser.add_argument(
        "--no-data",
        dest="no_data",
        action="store_true",
        help="non propone il dataset iniziale anche se le tabelle sono vuote",
    )
    parser.add_argument(
        "--no-seed",
        dest="no_data",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="diagnostica senza modificare PostgreSQL e senza avviare Django",
    )
    parser.add_argument(
        "--runserver",
        action="store_true",
        help="avvia Django dopo il bootstrap",
    )
    parser.add_argument("--host")
    parser.add_argument("--port")
    parser.add_argument("--admin-user")
    parser.add_argument("--admin-host")
    parser.add_argument("--admin-port")
    parser.add_argument("--admin-database", default="postgres")
    return parser.parse_args()


def main() -> int:
    """Coordina configurazione, PostgreSQL, controlli Django e avvio."""
    args = parse_args()
    values = ensure_environment()
    try:
        connection = connect_app(values)
    except psycopg.Error as initial_error:
        if args.check_only:
            raise BootstrapError(
                "Connessione applicativa non riuscita e --check-only vieta "
                f"correzioni.\nDettaglio: {initial_error}"
            ) from initial_error
        provision_database(values, args, initial_error)
        try:
            connection = connect_app(values)
        except psycopg.Error as exc:
            raise BootstrapError(
                "PostgreSQL e stato preparato, ma la connessione applicativa "
                f"continua a non riuscire.\nDettaglio: {exc}"
            ) from exc

    with connection:
        initialize_application(connection, args)

    print_step("Controllo finale Django")
    run_manage(["check"])

    if args.runserver and not args.check_only:
        host = args.host or os.getenv("QUIZZING_HOST", "127.0.0.1")
        port_text = args.port or os.getenv("QUIZZING_PORT", "8000")
        try:
            port = int(port_text)
        except ValueError as exc:
            raise BootstrapError("QUIZZING_PORT non e numerica.") from exc
        if not 1 <= port <= 65535:
            raise BootstrapError("QUIZZING_PORT deve essere tra 1 e 65535.")
        print(f"\nAvvio QUIZZING su http://{host}:{port}/")
        print("Interrompere il server con Ctrl+C.")
        return run_manage(["runserver", f"{host}:{port}"], check=False)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nOperazione interrotta dall'utente.", file=sys.stderr)
        raise SystemExit(130)
    except BootstrapError as exc:
        print(f"\nERRORE: {exc}", file=sys.stderr)
        raise SystemExit(1)
    except psycopg.Error as exc:
        print(
            "\nERRORE PostgreSQL: operazione annullata senza cancellare dati.\n"
            f"Dettaglio: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1)
    except Exception as exc:
        print(
            "\nERRORE INATTESO: avvio interrotto. "
            "Il bootstrap non esegue rollback distruttivi.\n"
            f"Tipo: {type(exc).__name__}\nDettaglio: {exc}\n"
            "Traceback tecnico:",
            file=sys.stderr,
        )
        traceback.print_exc()
        raise SystemExit(1)

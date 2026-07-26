#!/usr/bin/env python3
"""Carica un dataset riproducibile esclusivamente su tabelle vuote.

Il comando non cancella e non sostituisce mai dati esistenti. Se almeno una
tabella applicativa contiene righe, termina prima di inserire qualsiasi dato.
"""

from __future__ import annotations

import argparse
import os
import random
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg
from psycopg import sql

try:
    from .import_mysql_dump import split_values, statements
except ImportError:  # Esecuzione diretta: ``python database/seed.py``.
    from import_mysql_dump import split_values, statements


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "database" / "data" / "quiz_mysql_expanded.sql"
TABLES = (
    "Utente",
    "Quiz",
    "Domanda",
    "Risposta",
    "Partecipazione",
    "RispostaUtenteQuiz",
)
PROFILES = {
    "quick": (60, 120, 2_500),
    "load": (500, 270, 30_000),
}


def load_question_source() -> list[dict[str, object]]:
    """Ricostruisce un corpus di domande dal dump incluso in Homework-2."""
    parsed = statements(SOURCE)
    questions: dict[tuple[int, int], dict[str, object]] = {}

    for columns, source_rows in parsed["Domanda"]:
        for source_row in source_rows:
            item = dict(zip(columns, split_values(source_row)))
            questions[(item["quiz"], item["numero"])] = {
                "domanda": item["testo"],
                "risposta_corretta": None,
                "risposte_errate": [],
            }

    for columns, source_rows in parsed["Risposta"]:
        for source_row in source_rows:
            item = dict(zip(columns, split_values(source_row)))
            question = questions[(item["quiz"], item["domanda"])]
            if item["tipo"] == "Corretta" and question["risposta_corretta"] is None:
                question["risposta_corretta"] = item["testo"]
            elif item["tipo"] == "Sbagliata":
                question["risposte_errate"].append(item["testo"])

    return [
        question
        for question in questions.values()
        if question["risposta_corretta"] and len(question["risposte_errate"]) >= 3
    ]


def connection_kwargs() -> dict[str, str]:
    """Restituisce la configurazione PostgreSQL letta dall'ambiente."""
    return {
        "host": os.getenv("POSTGRES_HOST", "127.0.0.1"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "dbname": os.getenv("POSTGRES_DB", "quizzing"),
        "user": os.getenv("POSTGRES_USER", "quizzing_app"),
        "password": os.getenv("POSTGRES_PASSWORD", ""),
    }


def assert_tables_empty(cursor: psycopg.Cursor) -> None:
    """Interrompe il seed prima di qualsiasi scrittura se esistono dati."""
    counts: dict[str, int] = {}
    for table in TABLES:
        cursor.execute(
            sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
        )
        counts[table] = cursor.fetchone()[0]

    populated = {table: count for table, count in counts.items() if count}
    if populated:
        details = ", ".join(
            f"{table}={count}" for table, count in populated.items()
        )
        raise RuntimeError(
            "Seed annullato: sono presenti dati applicativi "
            f"({details}). Nessuna riga e stata modificata."
        )


def seed(profile: str, reference_date: date, random_seed: int) -> None:
    """Genera il profilo richiesto dentro un'unica transazione psycopg."""
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Sorgente dati non trovata: {SOURCE}")

    rng = random.Random(random_seed)
    user_count, quiz_count, participation_count = PROFILES[profile]
    source = load_question_source()

    with psycopg.connect(**connection_kwargs()) as connection:
        with connection.cursor() as cursor:
            assert_tables_empty(cursor)

            users = [
                (
                    f"utente.{index:04d}",
                    f"Nome{index}",
                    f"Cognome{index}",
                    f"utente.{index:04d}@quiz.local",
                )
                for index in range(1, user_count + 1)
            ]
            cursor.executemany(
                'INSERT INTO "Utente" '
                '("nomeUtente", nome, cognome, email) VALUES (%s, %s, %s, %s)',
                users,
            )

            quizzes: list[int] = []
            for code in range(1, quiz_count + 1):
                if code % 3 == 0:
                    start = reference_date + timedelta(days=7)
                    end = reference_date + timedelta(days=30)
                elif code % 3 == 1:
                    start = reference_date - timedelta(days=10)
                    end = reference_date + timedelta(days=10)
                else:
                    start = reference_date - timedelta(days=30)
                    end = reference_date - timedelta(days=2)

                creator = users[(code - 1) % len(users)][0]
                cursor.execute(
                    'INSERT INTO "Quiz" '
                    '(creatore, titolo, "dataInizio", "dataFine") '
                    "VALUES (%s, %s, %s, %s) RETURNING codice",
                    (creator, f"Quiz {code}", start, end),
                )
                quiz = cursor.fetchone()[0]

                for number, item in enumerate(
                    rng.sample(source, min(10, len(source))),
                    start=1,
                ):
                    cursor.execute(
                        'INSERT INTO "Domanda" (quiz, numero, testo) '
                        "VALUES (%s, %s, %s)",
                        (quiz, number, item["domanda"][:1000]),
                    )
                    cursor.execute(
                        'INSERT INTO "Risposta" '
                        "(quiz, domanda, numero, testo, tipo, punteggio) "
                        "VALUES (%s, %s, 1, %s, 'Corretta', 2)",
                        (quiz, number, item["risposta_corretta"][:1000]),
                    )

                    multiple = number % 5 == 0
                    if multiple:
                        cursor.execute(
                            'INSERT INTO "Risposta" '
                            "(quiz, domanda, numero, testo, tipo, punteggio) "
                            "VALUES (%s, %s, 2, %s, 'Corretta', 1)",
                            (quiz, number, item["risposte_errate"][0][:1000]),
                        )

                    wrong_answers = (
                        item["risposte_errate"][1:]
                        if multiple
                        else item["risposte_errate"]
                    )
                    first_number = 3 if multiple else 2
                    for answer_number, text in enumerate(
                        wrong_answers,
                        start=first_number,
                    ):
                        cursor.execute(
                            'INSERT INTO "Risposta" '
                            "(quiz, domanda, numero, testo, tipo, punteggio) "
                            "VALUES (%s, %s, %s, %s, 'Sbagliata', NULL)",
                            (quiz, number, answer_number, text[:1000]),
                        )
                quizzes.append(quiz)

            eligible = [quiz for quiz in quizzes if quiz % 3 != 0]
            for _ in range(participation_count):
                quiz = rng.choice(eligible)
                username = rng.choice(users)[0]
                cursor.execute(
                    'INSERT INTO "Partecipazione" '
                    "(utente, quiz, data) VALUES (%s, %s, %s) "
                    "RETURNING codice",
                    (username, quiz, reference_date),
                )
                participation = cursor.fetchone()[0]
                cursor.execute(
                    'SELECT domanda, numero FROM "Risposta" '
                    "WHERE quiz=%s ORDER BY domanda, numero",
                    (quiz,),
                )
                by_question: dict[int, list[int]] = {}
                for question, answer in cursor.fetchall():
                    by_question.setdefault(question, []).append(answer)
                for question, answers in by_question.items():
                    cursor.execute(
                        'INSERT INTO "RispostaUtenteQuiz" '
                        "(partecipazione, quiz, domanda, risposta) "
                        "VALUES (%s, %s, %s, %s)",
                        (
                            participation,
                            quiz,
                            question,
                            rng.choice(answers),
                        ),
                    )

    print(
        "Creati: "
        f"{user_count} utenti, {quiz_count} quiz, "
        f"{participation_count} partecipazioni ({profile})."
    )


def main() -> None:
    """Legge le opzioni CLI e avvia il profilo sintetico selezionato."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=PROFILES, default="quick")
    parser.add_argument("--reference-date", default=date.today().isoformat())
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    reference_date = datetime.strptime(args.reference_date, "%Y-%m-%d").date()
    seed(args.profile, reference_date, args.seed)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, psycopg.Error) as exc:
        print(f"ERRORE: {exc}", file=os.sys.stderr)
        raise SystemExit(1)

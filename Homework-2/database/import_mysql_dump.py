#!/usr/bin/env python3
"""Importa i soli dati applicativi di un dump MySQL nello schema PostgreSQL P2.

Il dump sorgente conserva ``Attivo`` nella definizione MySQL: la colonna non viene
importata perché il modello P2 usa cancellazione fisica e non soft delete.
"""
import argparse
import os
import re
from datetime import date
from pathlib import Path

import psycopg
from psycopg import sql

TABLES = ("Utente", "Quiz", "Domanda", "Risposta", "Partecipazione", "RispostaUtenteQuiz")
INSERT_HEADER_RE = re.compile(r"INSERT INTO `(?P<table>\w+)` \((?P<columns>[^)]*)\) VALUES\s*", re.DOTALL)
STATUS_COVERAGE_START = date(2026, 7, 30)
STATUS_COVERAGE_END = date(2026, 9, 30)
STATUS_QUIZ_COUNT = 12
OPEN_START = date(2026, 7, 1)
OPEN_END = date(2026, 10, 15)
FUTURE_START = date(2026, 10, 1)
FUTURE_END = date(2026, 12, 1)


def split_rows(values):
    """Restituisce le tuple VALUES senza interpretare virgole nei testi SQL."""
    rows, start, depth, quoted, escaped = [], None, 0, False, False
    for index, char in enumerate(values):
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "'":
                quoted = False
            continue
        if char == "'":
            quoted = True
        elif char == "(":
            if depth == 0:
                start = index + 1
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0 and start is not None:
                rows.append(values[start:index])
    if depth or quoted:
        raise ValueError("VALUES MySQL non bilanciato")
    return rows


def split_values(row):
    """Converte una tupla MySQL rispettando stringhe, escape e valori NULL."""
    values, current, quoted, escaped, atom_quoted = [], [], False, False, False

    def flush():
        """Chiude il valore corrente e prepara il buffer per il successivo."""
        nonlocal current, atom_quoted
        value = "".join(current).strip()
        values.append(value if atom_quoted else parse_atom(value))
        current, atom_quoted = [], False

    for char in row:
        if quoted:
            if escaped:
                current.append({"n": "\n", "r": "\r", "t": "\t"}.get(char, char))
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "'":
                quoted = False
            else:
                current.append(char)
        elif char == "'":
            quoted = True
            atom_quoted = True
        elif char == ",":
            flush()
        else:
            current.append(char)
    if quoted:
        raise ValueError("stringa MySQL non chiusa")
    flush()
    return values


def parse_atom(value):
    """Converte gli atomi non quotati lasciando intatti gli altri valori."""
    if value.upper() == "NULL":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return value


def statements(path):
    """Estrae gli INSERT delle sei tabelle senza caricare un parser MySQL."""
    source = Path(path).read_text(encoding="utf-8")
    found = {table: [] for table in TABLES}
    for header in INSERT_HEADER_RE.finditer(source):
        table = header.group("table")
        if table not in found:
            continue
        quoted = escaped = False
        end = header.end()
        # Il punto e virgola chiude l'INSERT soltanto fuori da una stringa.
        while end < len(source):
            char = source[end]
            if quoted:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == "'":
                    quoted = False
            elif char == "'":
                quoted = True
            elif char == ";":
                break
            end += 1
        if end == len(source):
            raise ValueError(f"INSERT senza terminatore per {table}")
        columns = [column.strip().strip("`") for column in header.group("columns").split(",")]
        found[table].append((columns, split_rows(source[header.end():end])))
    missing = [table for table in TABLES if not found[table]]
    if missing:
        raise ValueError(f"Dump incompleto, tabelle senza INSERT: {', '.join(missing)}")
    return found


def connection_string():
    """Costruisce la DSN PostgreSQL dalla stessa configurazione di Django."""
    return "host={host} port={port} dbname={database} user={user} password={password}".format(
        host=os.getenv("POSTGRES_HOST", "127.0.0.1"),
        port=os.getenv("POSTGRES_PORT", "5432"),
        database=os.getenv("POSTGRES_DB", "quizzing"),
        user=os.getenv("POSTGRES_USER", "quizzing_app"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def assert_tables_empty(cursor):
    """Impedisce qualsiasi importazione sopra dati applicativi esistenti."""
    counts = {}
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
            "Importazione annullata: sono presenti dati applicativi "
            f"({details}). Nessuna riga e stata modificata."
        )


def import_dump(parsed):
    """Importa il dump in una transazione e riallinea le sequenze identity."""
    counts = {table: 0 for table in TABLES}
    with psycopg.connect(connection_string()) as connection, connection.cursor() as cursor:
        assert_tables_empty(cursor)
        for table in TABLES:
            for source_columns, source_rows in parsed[table]:
                columns = [column for column in source_columns if column != "Attivo"]
                # ``Attivo`` apparteneva alla soft delete del Progetto 1.
                indices = [source_columns.index(column) for column in columns]
                placeholders = ", ".join(["%s"] * len(columns))
                quoted_columns = ", ".join(f'"{column}"' for column in columns)
                query = f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({placeholders})'
                batch = [tuple(split_values(row)[index] for index in indices) for row in source_rows]
                cursor.executemany(query, batch)
                counts[table] += len(batch)
        cursor.execute('SELECT setval(pg_get_serial_sequence(\'"Quiz"\', \'codice\'), COALESCE((SELECT MAX(codice) FROM "Quiz"), 1), true)')
        cursor.execute('SELECT setval(pg_get_serial_sequence(\'"Partecipazione"\', \'codice\'), COALESCE((SELECT MAX(codice) FROM "Partecipazione"), 1), true)')
        retime_status_quizzes(cursor)
    return counts


def retime_status_quizzes(cursor):
    """Sposta alcuni quiz storici per coprire gli stati richiesti nel 2026.

    I quiz futuri non possono conservare tentativi precedenti al loro inizio;
    vengono scelti quelli con meno partecipazioni e rimossi i soli tentativi
    sintetici collegati. Per i quiz aperti le date dei tentativi vengono
    riallineate al nuovo periodo.
    """
    cursor.execute(
        '''
        SELECT q.codice
        FROM "Quiz" q
        LEFT JOIN "Partecipazione" p ON p.quiz = q.codice
        GROUP BY q.codice
        ORDER BY COUNT(p.codice), q.codice
        LIMIT %s
        ''',
        [STATUS_QUIZ_COUNT],
    )
    future_codes = [row[0] for row in cursor.fetchall()]
    cursor.execute(
        '''
        SELECT codice
        FROM "Quiz"
        WHERE NOT (codice = ANY(%s))
        ORDER BY codice DESC
        LIMIT %s
        ''',
        [future_codes, STATUS_QUIZ_COUNT],
    )
    open_codes = [row[0] for row in cursor.fetchall()]

    cursor.execute(
        'DELETE FROM "RispostaUtenteQuiz" '
        'WHERE partecipazione IN ('
        'SELECT codice FROM "Partecipazione" WHERE quiz = ANY(%s))',
        [future_codes],
    )
    cursor.execute(
        'DELETE FROM "Partecipazione" WHERE quiz = ANY(%s)',
        [future_codes],
    )

    for offset, quiz_code in enumerate(open_codes):
        start_date = OPEN_START.replace(day=OPEN_START.day + offset)
        end_date = OPEN_END.replace(day=OPEN_END.day + offset)
        cursor.execute(
            'UPDATE "Quiz" SET "dataInizio"=%s, "dataFine"=%s '
            'WHERE codice=%s',
            [start_date, end_date, quiz_code],
        )
        cursor.execute(
            'UPDATE "Partecipazione" SET data=%s + MOD(codice, 45) '
            'WHERE quiz=%s',
            [STATUS_COVERAGE_START, quiz_code],
        )

    for offset, quiz_code in enumerate(future_codes):
        start_date = FUTURE_START.replace(day=FUTURE_START.day + offset)
        end_date = FUTURE_END.replace(day=FUTURE_END.day + offset)
        cursor.execute(
            'UPDATE "Quiz" SET "dataInizio"=%s, "dataFine"=%s '
            'WHERE codice=%s',
            [start_date, end_date, quiz_code],
        )

    enable_multiple_choice_question(cursor, open_codes[0])


def enable_multiple_choice_question(cursor, quiz_code):
    """Rende multipla una domanda esistente senza aggiungere nuove righe."""
    cursor.execute(
        '''
        UPDATE "Risposta"
        SET tipo='Corretta', punteggio=1
        WHERE (quiz, domanda, numero) = (
            SELECT quiz, domanda, numero
            FROM "Risposta"
            WHERE quiz=%s AND tipo='Sbagliata'
            ORDER BY domanda, numero
            LIMIT 1
        )
        ''',
        [quiz_code],
    )


def main():
    """Valida gli argomenti e avvia analisi o importazione effettiva."""
    parser = argparse.ArgumentParser()
    parser.add_argument("dump", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="analizza soltanto il dump")
    args = parser.parse_args()
    parsed = statements(args.dump)
    counts = {table: sum(len(rows) for _, rows in parsed[table]) for table in TABLES}
    if args.dry_run:
        print("Dump valido: " + ", ".join(f"{table}={count}" for table, count in counts.items()))
        return
    imported = import_dump(parsed)
    print("Import completato: " + ", ".join(f"{table}={count}" for table, count in imported.items()))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, psycopg.Error) as exc:
        print(f"ERRORE: {exc}", file=os.sys.stderr)
        raise SystemExit(1)

#!/usr/bin/env python3
"""Importa i soli dati applicativi di un dump MySQL nello schema PostgreSQL P2.

Il dump sorgente conserva ``Attivo`` nella definizione MySQL: la colonna non viene
importata perché il modello P2 usa cancellazione fisica e non soft delete.
"""
import argparse
import os
import re
from pathlib import Path

import psycopg
from psycopg import sql

TABLES = ("Utente", "Quiz", "Domanda", "Risposta", "Partecipazione", "RispostaUtenteQuiz")
INSERT_HEADER_RE = re.compile(r"INSERT INTO `(?P<table>\w+)` \((?P<columns>[^)]*)\) VALUES\s*", re.DOTALL)


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
    values, current, quoted, escaped, atom_quoted = [], [], False, False, False

    def flush():
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
    if value.upper() == "NULL":
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    return value


def statements(path):
    source = Path(path).read_text(encoding="utf-8")
    found = {table: [] for table in TABLES}
    for header in INSERT_HEADER_RE.finditer(source):
        table = header.group("table")
        if table not in found:
            continue
        quoted = escaped = False
        end = header.end()
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
    counts = {table: 0 for table in TABLES}
    with psycopg.connect(connection_string()) as connection, connection.cursor() as cursor:
        assert_tables_empty(cursor)
        for table in TABLES:
            for source_columns, source_rows in parsed[table]:
                columns = [column for column in source_columns if column != "Attivo"]
                indices = [source_columns.index(column) for column in columns]
                placeholders = ", ".join(["%s"] * len(columns))
                quoted_columns = ", ".join(f'"{column}"' for column in columns)
                query = f'INSERT INTO "{table}" ({quoted_columns}) VALUES ({placeholders})'
                batch = [tuple(split_values(row)[index] for index in indices) for row in source_rows]
                cursor.executemany(query, batch)
                counts[table] += len(batch)
        cursor.execute('SELECT setval(pg_get_serial_sequence(\'"Quiz"\', \'codice\'), COALESCE((SELECT MAX(codice) FROM "Quiz"), 1), true)')
        cursor.execute('SELECT setval(pg_get_serial_sequence(\'"Partecipazione"\', \'codice\'), COALESCE((SELECT MAX(codice) FROM "Partecipazione"), 1), true)')
        add_status_fixtures(cursor)
    return counts


def add_status_fixtures(cursor):
    """Aggiunge fixture senza partecipazioni, senza alterare il dump storico.

    Il dump sorgente colloca tutti i quiz nel 2024. Per soddisfare DATA-03
    vengono clonate 24 domande/risposte in quiz aperti e 24 futuri, senza
    spostare date di partecipazioni esistenti fuori dal periodo del quiz.
    """
    cursor.execute('SELECT codice, creatore, titolo FROM "Quiz" ORDER BY codice LIMIT 24')
    sources = cursor.fetchall()
    for label, start_sql, end_sql in (
        ("aperto", "CURRENT_DATE - 14", "CURRENT_DATE + 45"),
        ("futuro", "CURRENT_DATE + 7", "CURRENT_DATE + 60"),
    ):
        for source_code, creator, title in sources:
            cursor.execute(
                f'INSERT INTO "Quiz" (creatore, titolo, "dataInizio", "dataFine") '
                f'VALUES (%s, %s, {start_sql}, {end_sql}) RETURNING codice',
                [creator, f"{title} — demo {label}"],
            )
            fixture_code = cursor.fetchone()[0]
            cursor.execute(
                'INSERT INTO "Domanda" (quiz, numero, testo) '
                'SELECT %s, numero, testo FROM "Domanda" WHERE quiz=%s',
                [fixture_code, source_code],
            )
            cursor.execute(
                'INSERT INTO "Risposta" (quiz, domanda, numero, testo, tipo, punteggio) '
                'SELECT %s, domanda, numero, testo, tipo, punteggio FROM "Risposta" WHERE quiz=%s',
                [fixture_code, source_code],
            )


def main():
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

"""Query SQL relative a utenti, relazioni e anteprima di cancellazione."""

from django.db import connection

from .common import one, rows


def stats():
    """Restituisce i conteggi mostrati nella pagina iniziale."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                (SELECT count(*) FROM "Utente"),
                (SELECT count(*) FROM "Quiz"),
                (SELECT count(*) FROM "Domanda")
            """
        )
        result = cursor.fetchone()
    return {
        "users": result[0],
        "quizzes": result[1],
        "questions": result[2],
    }


def get(username):
    """Carica i dati modificabili di un singolo utente."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT "nomeUtente", nome, cognome, email
            FROM "Utente"
            WHERE "nomeUtente" = %s
            """,
            [username],
        )
        return one(cursor)


def username_suggestions(query, limit=12):
    """Cerca username e nomi dando priorità agli username con lo stesso prefisso."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT "nomeUtente" AS username, nome, cognome
            FROM "Utente"
            WHERE
                "nomeUtente" ILIKE %s
                OR nome ILIKE %s
                OR cognome ILIKE %s
            ORDER BY
                CASE WHEN "nomeUtente" ILIKE %s THEN 0 ELSE 1 END,
                "nomeUtente"
            LIMIT %s
            """,
            [
                f"%{query}%",
                f"%{query}%",
                f"%{query}%",
                f"{query}%",
                limit,
            ],
        )
        return rows(cursor)


def search(filters, state):
    """Applica filtri testuali e aggregati alla lista utenti paginata."""
    clauses = []
    params = []
    text_filters = [
        ("username", 'u."nomeUtente"'),
        ("nome", "u.nome"),
        ("cognome", "u.cognome"),
        ("email", "u.email"),
    ]
    for field, column in text_filters:
        if filters.get(field):
            clauses.append(f"{column} ILIKE %s")
            params.append(f"%{filters[field]}%")

    aggregate_filters = [
        ("created_min", "COUNT(DISTINCT q.codice) >= %s"),
        ("created_max", "COUNT(DISTINCT q.codice) <= %s"),
        ("participations_min", "COUNT(DISTINCT p.codice) >= %s"),
        ("participations_max", "COUNT(DISTINCT p.codice) <= %s"),
    ]
    for field, expression in aggregate_filters:
        if not filters.get(field):
            continue
        try:
            value = int(filters[field])
        except ValueError:
            continue
        clauses.append(expression)
        params.append(value)

    having = " HAVING " + " AND ".join(clauses) if clauses else ""
    base_query = """
        FROM "Utente" u
        LEFT JOIN "Quiz" q ON q.creatore = u."nomeUtente"
        LEFT JOIN "Partecipazione" p ON p.utente = u."nomeUtente"
        GROUP BY u."nomeUtente", u.nome, u.cognome, u.email
    """
    # La colonna dinamica proviene solo dalla whitelist validata in list_state.
    sort_column = {
        "username": 'u."nomeUtente"',
        "nome": "u.nome",
        "cognome": "u.cognome",
        "created": "created",
        "participations": "participations",
    }[state.sort]

    count_query = "SELECT count(*) FROM (SELECT 1" + base_query + having + ") x"
    data_query = (
        """
        SELECT
            u."nomeUtente" AS username,
            u.nome,
            u.cognome,
            u.email,
            COUNT(DISTINCT q.codice) AS created,
            COUNT(DISTINCT p.codice) AS participations
        """
        + base_query
        + having
        + f"""
        ORDER BY {sort_column} {state.direction}, u."nomeUtente" ASC
        LIMIT %s OFFSET %s
        """
    )

    with connection.cursor() as cursor:
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]
        cursor.execute(
            data_query,
            params + [state.size, state.offset],
        )
        result = rows(cursor)
    return result, total


def bounds():
    """Restituisce gli estremi reali usati dai controlli numerici."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COALESCE(MIN(created), 0) AS created_min,
                COALESCE(MAX(created), 0) AS created_max,
                COALESCE(MIN(participations), 0) AS participations_min,
                COALESCE(MAX(participations), 0) AS participations_max
            FROM (
                SELECT
                    u."nomeUtente",
                    COUNT(DISTINCT q.codice) AS created,
                    COUNT(DISTINCT p.codice) AS participations
                FROM "Utente" u
                LEFT JOIN "Quiz" q ON q.creatore = u."nomeUtente"
                LEFT JOIN "Partecipazione" p
                    ON p.utente = u."nomeUtente"
                GROUP BY u."nomeUtente"
            ) aggregates
            """
        )
        return one(cursor)


def detail(username):
    """Carica il profilo con quiz creati e partecipazioni effettuate."""
    user = get(username)
    if not user:
        return None

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT codice, titolo
            FROM "Quiz"
            WHERE creatore = %s
            ORDER BY codice
            """,
            [username],
        )
        user["quizzes"] = rows(cursor)
        cursor.execute(
            """
            SELECT
                p.codice,
                q.codice AS quiz_code,
                q.titolo,
                p.data
            FROM "Partecipazione" p
            JOIN "Quiz" q ON q.codice = p.quiz
            WHERE p.utente = %s
            ORDER BY p.codice DESC
            """,
            [username],
        )
        user["participation_list"] = rows(cursor)
    return user


def create(data):
    """Inserisce un nuovo utente con valori già validati dal form."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO "Utente" ("nomeUtente", nome, cognome, email)
            VALUES (%s, %s, %s, %s)
            """,
            [
                data["nomeUtente"],
                data["nome"],
                data["cognome"],
                data["email"],
            ],
        )


def update(username, data):
    """Aggiorna i dati anagrafici conservando lo username."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE "Utente"
            SET nome = %s, cognome = %s, email = %s
            WHERE "nomeUtente" = %s
            """,
            [data["nome"], data["cognome"], data["email"], username],
        )


def deletion_preview(username):
    """Conta le dipendenze e segnala il vincolo che blocca l'eliminazione."""
    with connection.cursor() as cursor:
        cursor.execute(
            'SELECT count(*) FROM "Partecipazione" WHERE utente = %s',
            [username],
        )
        participation_count = cursor.fetchone()[0]
        cursor.execute(
            'SELECT count(*) FROM "Quiz" WHERE creatore = %s',
            [username],
        )
        quiz_count = cursor.fetchone()[0]
        cursor.execute(
            """
            SELECT count(*)
            FROM "Partecipazione" p
            JOIN "Quiz" q ON q.codice = p.quiz
            WHERE q.creatore = %s
            """,
            [username],
        )
        blocking_count = cursor.fetchone()[0]
    return {
        "participations": participation_count,
        "quizzes": quiz_count,
        "blocking": blocking_count,
        "allowed": blocking_count == 0,
    }

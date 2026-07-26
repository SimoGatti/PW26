from django.db import connection
from .common import one, rows

def stats():
    with connection.cursor() as c:
        c.execute('SELECT (SELECT count(*) FROM "Utente"), (SELECT count(*) FROM "Quiz"), (SELECT count(*) FROM "Domanda")')
        row = c.fetchone()
    return {"users": row[0], "quizzes": row[1], "questions": row[2]}

def get(username):
    with connection.cursor() as c:
        c.execute('SELECT "nomeUtente", nome, cognome, email FROM "Utente" WHERE "nomeUtente"=%s', [username]); return one(c)

def username_suggestions(query, limit=12):
    with connection.cursor() as c:
        c.execute(
            '''
            SELECT "nomeUtente" AS username, nome, cognome
            FROM "Utente"
            WHERE "nomeUtente" ILIKE %s OR nome ILIKE %s OR cognome ILIKE %s
            ORDER BY
                CASE WHEN "nomeUtente" ILIKE %s THEN 0 ELSE 1 END,
                "nomeUtente"
            LIMIT %s
            ''',
            [f"%{query}%", f"%{query}%", f"%{query}%", f"{query}%", limit],
        )
        return rows(c)

def search(filters, state):
    clauses, params = [], []
    for field, column in [("username", 'u."nomeUtente"'), ("nome", "u.nome"), ("cognome", "u.cognome"), ("email", "u.email")]:
        if filters.get(field): clauses.append(f"{column} ILIKE %s"); params.append(f"%{filters[field]}%")
    for field, expr in [("created_min", "COUNT(DISTINCT q.codice) >= %s"), ("created_max", "COUNT(DISTINCT q.codice) <= %s"), ("participations_min", "COUNT(DISTINCT p.codice) >= %s"), ("participations_max", "COUNT(DISTINCT p.codice) <= %s")]:
        if filters.get(field):
            try: params.append(int(filters[field])); clauses.append(expr)
            except ValueError: pass
    having = " HAVING " + " AND ".join(clauses) if clauses else ""
    base = ' FROM "Utente" u LEFT JOIN "Quiz" q ON q.creatore=u."nomeUtente" LEFT JOIN "Partecipazione" p ON p.utente=u."nomeUtente" GROUP BY u."nomeUtente", u.nome, u.cognome, u.email'
    sort = {"username": 'u."nomeUtente"', "nome": "u.nome", "cognome": "u.cognome", "created": "created", "participations": "participations"}[state.sort]
    with connection.cursor() as c:
        c.execute("SELECT count(*) FROM (SELECT 1" + base + having + ") x", params); total = c.fetchone()[0]
        c.execute('SELECT u."nomeUtente" AS username, u.nome, u.cognome, u.email, COUNT(DISTINCT q.codice) AS created, COUNT(DISTINCT p.codice) AS participations' + base + having + f' ORDER BY {sort} {state.direction}, u."nomeUtente" ASC LIMIT %s OFFSET %s', params + [state.size, state.offset]); result = rows(c)
    return result, total

def bounds():
    """Return the real aggregate limits used by the numeric search controls."""
    with connection.cursor() as c:
        c.execute(
            '''
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
                LEFT JOIN "Partecipazione" p ON p.utente = u."nomeUtente"
                GROUP BY u."nomeUtente"
            ) aggregates
            '''
        )
        return one(c)

def detail(username):
    user = get(username)
    if not user: return None
    with connection.cursor() as c:
        c.execute('SELECT codice, titolo FROM "Quiz" WHERE creatore=%s ORDER BY codice', [username]); user["quizzes"] = rows(c)
        c.execute('SELECT p.codice, q.codice AS quiz_code, q.titolo, p.data FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz WHERE p.utente=%s ORDER BY p.codice DESC', [username]); user["participation_list"] = rows(c)
    return user

def create(data):
    with connection.cursor() as c: c.execute('INSERT INTO "Utente" ("nomeUtente", nome, cognome, email) VALUES (%s,%s,%s,%s)', [data["nomeUtente"], data["nome"], data["cognome"], data["email"]])

def update(username, data):
    with connection.cursor() as c: c.execute('UPDATE "Utente" SET nome=%s, cognome=%s, email=%s WHERE "nomeUtente"=%s', [data["nome"], data["cognome"], data["email"], username])

def deletion_preview(username):
    with connection.cursor() as c:
        c.execute('SELECT count(*) FROM "Partecipazione" WHERE utente=%s', [username]); participations=c.fetchone()[0]
        c.execute('SELECT count(*) FROM "Quiz" WHERE creatore=%s', [username]); quizzes=c.fetchone()[0]
        c.execute('SELECT count(*) FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz WHERE q.creatore=%s', [username]); blocking=c.fetchone()[0]
    return {"participations": participations, "quizzes": quizzes, "blocking": blocking, "allowed": blocking == 0}

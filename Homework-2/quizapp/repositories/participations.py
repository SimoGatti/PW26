"""Query SQL per ricerca e riepilogo delle partecipazioni concluse."""

from datetime import date
from django.db import connection
from .common import one, rows


ATTEMPT_SCORES_SQL = '''
    SELECT
        p.codice,
        p.utente AS username,
        p.data,
        COALESCE(
            SUM(
                CASE
                    WHEN r.tipo = 'Corretta' THEN r.punteggio
                    ELSE 0
                END
            ),
            0
        ) AS score
    FROM "Partecipazione" p
    LEFT JOIN "RispostaUtenteQuiz" ruq
        ON ruq.partecipazione = p.codice
    LEFT JOIN "Risposta" r
        ON (r.quiz, r.domanda, r.numero) =
           (ruq.quiz, ruq.domanda, ruq.risposta)
    WHERE p.quiz = %s
    GROUP BY p.codice, p.utente, p.data
'''


def quiz_statistics(quiz_code):
    """Calcola riepilogo e migliori partecipanti di uno stesso quiz."""
    with connection.cursor() as cursor:
        cursor.execute(
            f'''
            SELECT
                COUNT(*) AS attempts,
                COALESCE(ROUND(AVG(score), 1), 0) AS average_score,
                COALESCE(MAX(score), 0) AS best_score
            FROM ({ATTEMPT_SCORES_SQL}) quiz_attempts
            ''',
            [quiz_code],
        )
        summary = one(cursor)
        cursor.execute(
            f'''
            WITH attempt_scores AS ({ATTEMPT_SCORES_SQL}),
            participant_bests AS (
                SELECT DISTINCT ON (username)
                    codice,
                    username,
                    score
                FROM attempt_scores
                ORDER BY username, score DESC, data DESC, codice DESC
            )
            SELECT codice, username, score
            FROM participant_bests
            ORDER BY score DESC, username ASC
            LIMIT 3
            ''',
            [quiz_code],
        )
        return summary, rows(cursor)


def search(filters,state):
    """Applica filtri, punteggio derivato e paginazione lato database."""
    clauses,params=[],[]
    for f,col in [("code","p.codice::text"),("username","p.utente"),("quiz","q.titolo")]:
        if filters.get(f): clauses.append(f"{col} ILIKE %s");params.append(f"%{filters[f]}%")
    for field, column, operator in [
        ("date_from", "p.data", ">="),
        ("date_to", "p.data", "<="),
    ]:
        if filters.get(field):
            clauses.append(f"{column} {operator} %s")
            params.append(filters[field])
    where=" WHERE "+" AND ".join(clauses) if clauses else ""
    # Il punteggio è derivato dalle risposte; non esiste una copia denormalizzata
    # che rischierebbe di diventare incoerente.
    score='COALESCE(SUM(CASE WHEN r.tipo=\'Corretta\' THEN r.punteggio ELSE 0 END),0)'
    aggregate_filters = []
    for field, expression in [
        ("answers_min", "COUNT(ruq.risposta) >= %s"),
        ("answers_max", "COUNT(ruq.risposta) <= %s"),
        ("score_min", score + " >= %s"),
        ("score_max", score + " <= %s"),
    ]:
        if filters.get(field):
            try:
                params.append(int(filters[field]))
                aggregate_filters.append(expression)
            except ValueError:
                pass
    having = " HAVING " + " AND ".join(aggregate_filters) if aggregate_filters else ""
    base=' FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz LEFT JOIN "RispostaUtenteQuiz" ruq ON ruq.partecipazione=p.codice LEFT JOIN "Risposta" r ON (r.quiz,r.domanda,r.numero)=(ruq.quiz,ruq.domanda,ruq.risposta)'+where+' GROUP BY p.codice,p.utente,p.quiz,p.data,q.titolo'+having
    # Solo le espressioni della whitelist possono entrare nell'ORDER BY.
    sort={"code":"p.codice","username":"p.utente","quiz":"q.titolo","date":"p.data","answers":"answers","score":"score"}[state.sort]
    with connection.cursor() as c:
        c.execute("SELECT count(*) FROM (SELECT 1"+base+") x",params);total=c.fetchone()[0]
        c.execute('SELECT p.codice,p.utente,p.quiz,q.titolo,p.data,COUNT(ruq.risposta) AS answers,'+score+' AS score'+base+f' ORDER BY {sort} {state.direction},p.codice ASC LIMIT %s OFFSET %s',params+[state.size,state.offset]);result=rows(c)
    return result,total

def bounds():
    """Calcola gli estremi effettivi di risposte e punteggio."""
    score = "COALESCE(SUM(CASE WHEN r.tipo='Corretta' THEN r.punteggio ELSE 0 END),0)"
    with connection.cursor() as c:
        c.execute(
            f'''
            SELECT
                COALESCE(MIN(answers), 0) AS answers_min,
                COALESCE(MAX(answers), 0) AS answers_max,
                COALESCE(MIN(score), 0) AS score_min,
                COALESCE(MAX(score), 0) AS score_max
            FROM (
                SELECT
                    p.codice,
                    COUNT(ruq.risposta) AS answers,
                    {score} AS score
                FROM "Partecipazione" p
                LEFT JOIN "RispostaUtenteQuiz" ruq
                    ON ruq.partecipazione = p.codice
                LEFT JOIN "Risposta" r
                    ON (r.quiz, r.domanda, r.numero) =
                       (ruq.quiz, ruq.domanda, ruq.risposta)
                GROUP BY p.codice
            ) aggregates
            '''
        )
        return one(c)

def detail(code):
    """Ricostruisce domande, selezioni e punteggio della partecipazione."""
    with connection.cursor() as c:
        c.execute('SELECT p.codice,p.utente,p.quiz,p.data,q.titolo,q."dataInizio" AS start_date,q."dataFine" AS end_date FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz WHERE p.codice=%s',[code]); participation=one(c)
        if not participation:return None
        c.execute('SELECT d.numero AS question_number,d.testo AS question_text,r.numero AS answer_number,r.testo AS answer_text,r.tipo,r.punteggio, (ruq.risposta IS NOT NULL) AS selected FROM "Domanda" d JOIN "Risposta" r ON (r.quiz,r.domanda)=(d.quiz,d.numero) LEFT JOIN "RispostaUtenteQuiz" ruq ON (ruq.partecipazione,ruq.quiz,ruq.domanda,ruq.risposta)=(%s,r.quiz,r.domanda,r.numero) WHERE d.quiz=%s ORDER BY d.numero,r.numero',[code,participation["quiz"]]); data=rows(c)
    participation["quiz_stats"], participation["top_participants"] = (
        quiz_statistics(participation["quiz"])
    )
    grouped={};score=0;max_score=0
    for answer in data:
        q=grouped.setdefault(answer["question_number"],{"number":answer["question_number"],"text":answer["question_text"],"answers":[]})
        q["answers"].append(answer)
        if answer["tipo"]=="Corretta":
            max_score+=answer["punteggio"]
            if answer["selected"]:score+=answer["punteggio"]
    for question in grouped.values():
        selected = {a["answer_number"] for a in question["answers"] if a["selected"]}
        correct = {a["answer_number"] for a in question["answers"] if a["tipo"]=="Corretta"}
        question["is_correct"] = selected == correct
    today = date.today()
    participation["quiz_status"] = "future" if participation["start_date"] > today else "closed" if participation["end_date"] < today else "open"
    participation["questions"]=list(grouped.values());participation["score"]=score;participation["max_score"]=max_score
    return participation

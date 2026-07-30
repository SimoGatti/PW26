"""Query SQL per ricerca, dettaglio e disponibilità dei quiz."""

from datetime import date
from django.db import connection
from .common import one, rows

def search(filters, state):
    """Cerca quiz senza caricare dataset completi e mantiene count e dati coerenti."""
    clauses, params = [], []
    for field, column in [("code", "q.codice::text"), ("title", "q.titolo"), ("creator", "q.creatore")]:
        if filters.get(field): clauses.append(f"{column} ILIKE %s"); params.append(f"%{filters[field]}%")
    if filters.get("status") in {"future", "open", "closed"}:
        status = filters["status"]
        clauses.append({"future": 'q."dataInizio" > CURRENT_DATE', "open": 'q."dataInizio" <= CURRENT_DATE AND q."dataFine" >= CURRENT_DATE', "closed": 'q."dataFine" < CURRENT_DATE'}[status])
    for f, col, op in [("start_from", 'q."dataInizio"', ">="), ("start_to", 'q."dataInizio"', "<="), ("end_from", 'q."dataFine"', ">="), ("end_to", 'q."dataFine"', "<=")]:
        if filters.get(f): clauses.append(f"{col} {op} %s"); params.append(filters[f])
    aggregate_filters = []
    for field, expression in [
        ("questions_min", "COUNT(DISTINCT d.numero) >= %s"),
        ("questions_max", "COUNT(DISTINCT d.numero) <= %s"),
        ("participations_min", "COUNT(DISTINCT p.codice) >= %s"),
        ("participations_max", "COUNT(DISTINCT p.codice) <= %s"),
    ]:
        if filters.get(field):
            try:
                params.append(int(filters[field]))
                aggregate_filters.append(expression)
            except ValueError:
                pass
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    having = " HAVING " + " AND ".join(aggregate_filters) if aggregate_filters else ""
    base = ' FROM "Quiz" q LEFT JOIN "Domanda" d ON d.quiz=q.codice LEFT JOIN "Partecipazione" p ON p.quiz=q.codice' + where + ' GROUP BY q.codice, q.creatore, q.titolo, q."dataInizio", q."dataFine"' + having
    # Il frammento ORDER BY non proviene mai direttamente dalla query string:
    # ``list_state`` lo valida e questa mappa lo traduce in SQL noto.
    sort={
        "code":"q.codice",
        "title":"q.titolo",
        "creator":"q.creatore",
        "start":'q."dataInizio"',
        "end":'q."dataFine"',
        "questions":"questions",
        "participations":"participations",
        "status":(
            'CASE '
            'WHEN q."dataInizio" > CURRENT_DATE THEN 1 '
            'WHEN q."dataFine" < CURRENT_DATE THEN 3 '
            'ELSE 2 END'
        ),
    }[state.sort]
    with connection.cursor() as c:
        # Totale e pagina riusano la stessa base SQL, inclusi i filtri HAVING.
        c.execute("SELECT count(*) FROM (SELECT 1"+base+") x", params); total=c.fetchone()[0]
        c.execute('SELECT q.codice, q.creatore, q.titolo, q."dataInizio" AS start_date, q."dataFine" AS end_date, COUNT(DISTINCT d.numero) AS questions, COUNT(DISTINCT p.codice) AS participations'+base+f' ORDER BY {sort} {state.direction}, q.codice ASC LIMIT %s OFFSET %s',params+[state.size,state.offset]); result=rows(c)
    for q in result: q["status"] = status_for(q["start_date"], q["end_date"])
    return result,total

def bounds():
    """Calcola gli estremi reali per domande e partecipazioni."""
    with connection.cursor() as c:
        c.execute(
            '''
            SELECT
                COALESCE(MIN(questions), 0) AS questions_min,
                COALESCE(MAX(questions), 0) AS questions_max,
                COALESCE(MIN(participations), 0) AS participations_min,
                COALESCE(MAX(participations), 0) AS participations_max
            FROM (
                SELECT
                    q.codice,
                    COUNT(DISTINCT d.numero) AS questions,
                    COUNT(DISTINCT p.codice) AS participations
                FROM "Quiz" q
                LEFT JOIN "Domanda" d ON d.quiz = q.codice
                LEFT JOIN "Partecipazione" p ON p.quiz = q.codice
                GROUP BY q.codice
            ) aggregates
            '''
        )
        return one(c)

def status_for(start, end):
    """Deriva lo stato del quiz rispetto alla data locale corrente."""
    today=date.today()
    return "future" if start > today else "closed" if end < today else "open"

def detail(code):
    """Carica metadati, risposte e partecipazioni del quiz richiesto."""
    with connection.cursor() as c:
        c.execute('SELECT q.codice, q.creatore, q.titolo, q."dataInizio" AS start_date, q."dataFine" AS end_date, COUNT(DISTINCT d.numero) AS questions, COUNT(DISTINCT p.codice) AS participations FROM "Quiz" q LEFT JOIN "Domanda" d ON d.quiz=q.codice LEFT JOIN "Partecipazione" p ON p.quiz=q.codice WHERE q.codice=%s GROUP BY q.codice,q.creatore,q.titolo,q."dataInizio",q."dataFine"',[code]); quiz=one(c)
        if not quiz:return None
        c.execute('SELECT d.numero AS question_number,d.testo AS question_text,r.numero AS answer_number,r.testo AS answer_text,r.tipo,r.punteggio FROM "Domanda" d JOIN "Risposta" r ON r.quiz=d.quiz AND r.domanda=d.numero WHERE d.quiz=%s ORDER BY d.numero,r.numero',[code]); answer_rows=rows(c)
        c.execute('SELECT p.codice,p.utente,p.data FROM "Partecipazione" p WHERE p.quiz=%s ORDER BY p.codice DESC',[code]); quiz["participation_list"]=rows(c)
    grouped={}
    for item in answer_rows: grouped.setdefault(item["question_number"], {"number":item["question_number"],"text":item["question_text"],"answers":[]})["answers"].append(item)
    quiz["question_list"]=list(grouped.values()); quiz["status"]=status_for(quiz["start_date"],quiz["end_date"])
    return quiz

def attempt_data(code):
    """Espone i dati di svolgimento soltanto quando il quiz è aperto."""
    quiz=detail(code)
    if not quiz or quiz["status"] != "open": return None
    return quiz

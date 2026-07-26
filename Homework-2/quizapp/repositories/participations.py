from datetime import date
from django.db import connection
from .common import one, rows

def search(filters,state):
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
    sort={"code":"p.codice","username":"p.utente","quiz":"q.titolo","date":"p.data","answers":"answers","score":"score"}[state.sort]
    with connection.cursor() as c:
        c.execute("SELECT count(*) FROM (SELECT 1"+base+") x",params);total=c.fetchone()[0]
        c.execute('SELECT p.codice,p.utente,p.quiz,q.titolo,p.data,COUNT(ruq.risposta) AS answers,'+score+' AS score'+base+f' ORDER BY {sort} {state.direction},p.codice ASC LIMIT %s OFFSET %s',params+[state.size,state.offset]);result=rows(c)
    return result,total

def bounds():
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
    with connection.cursor() as c:
        c.execute('SELECT p.codice,p.utente,p.quiz,p.data,q.titolo,q."dataInizio" AS start_date,q."dataFine" AS end_date FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz WHERE p.codice=%s',[code]); participation=one(c)
        if not participation:return None
        c.execute('SELECT d.numero AS question_number,d.testo AS question_text,r.numero AS answer_number,r.testo AS answer_text,r.tipo,r.punteggio, (ruq.risposta IS NOT NULL) AS selected FROM "Domanda" d JOIN "Risposta" r ON (r.quiz,r.domanda)=(d.quiz,d.numero) LEFT JOIN "RispostaUtenteQuiz" ruq ON (ruq.partecipazione,ruq.quiz,ruq.domanda,ruq.risposta)=(%s,r.quiz,r.domanda,r.numero) WHERE d.quiz=%s ORDER BY d.numero,r.numero',[code,participation["quiz"]]); data=rows(c)
    grouped={};score=0
    for answer in data:
        q=grouped.setdefault(answer["question_number"],{"number":answer["question_number"],"text":answer["question_text"],"answers":[]})
        q["answers"].append(answer)
        if answer["selected"] and answer["tipo"]=="Corretta":score+=answer["punteggio"]
    today = date.today()
    participation["quiz_status"] = "future" if participation["start_date"] > today else "closed" if participation["end_date"] < today else "open"
    participation["questions"]=list(grouped.values());participation["score"]=score
    return participation

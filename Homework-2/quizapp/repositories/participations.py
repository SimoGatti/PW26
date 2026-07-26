from django.db import connection
from .common import one, rows

def search(filters,state):
    clauses,params=[],[]
    for f,col in [("code","p.codice::text"),("username","p.utente"),("quiz","q.titolo")]:
        if filters.get(f): clauses.append(f"{col} ILIKE %s");params.append(f"%{filters[f]}%")
    where=" WHERE "+" AND ".join(clauses) if clauses else ""
    score='COALESCE(SUM(CASE WHEN r.tipo=\'Corretta\' THEN r.punteggio ELSE 0 END),0)'
    base=' FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz LEFT JOIN "RispostaUtenteQuiz" ruq ON ruq.partecipazione=p.codice LEFT JOIN "Risposta" r ON (r.quiz,r.domanda,r.numero)=(ruq.quiz,ruq.domanda,ruq.risposta)'+where+' GROUP BY p.codice,p.utente,p.quiz,p.data,q.titolo'
    sort={"code":"p.codice","username":"p.utente","quiz":"q.titolo","date":"p.data","answers":"answers","score":"score"}[state.sort]
    with connection.cursor() as c:
        c.execute("SELECT count(*) FROM (SELECT 1"+base+") x",params);total=c.fetchone()[0]
        c.execute('SELECT p.codice,p.utente,p.quiz,q.titolo,p.data,COUNT(ruq.risposta) AS answers,'+score+' AS score'+base+f' ORDER BY {sort} {state.direction},p.codice ASC LIMIT %s OFFSET %s',params+[state.size,state.offset]);result=rows(c)
    return result,total

def detail(code):
    with connection.cursor() as c:
        c.execute('SELECT p.codice,p.utente,p.quiz,p.data,q.titolo FROM "Partecipazione" p JOIN "Quiz" q ON q.codice=p.quiz WHERE p.codice=%s',[code]); participation=one(c)
        if not participation:return None
        c.execute('SELECT d.numero AS question_number,d.testo AS question_text,r.numero AS answer_number,r.testo AS answer_text,r.tipo,r.punteggio, (ruq.risposta IS NOT NULL) AS selected FROM "Domanda" d JOIN "Risposta" r ON (r.quiz,r.domanda)=(d.quiz,d.numero) LEFT JOIN "RispostaUtenteQuiz" ruq ON (ruq.partecipazione,ruq.quiz,ruq.domanda,ruq.risposta)=(%s,r.quiz,r.domanda,r.numero) WHERE d.quiz=%s ORDER BY d.numero,r.numero',[code,participation["quiz"]]); data=rows(c)
    grouped={};score=0
    for answer in data:
        q=grouped.setdefault(answer["question_number"],{"number":answer["question_number"],"text":answer["question_text"],"answers":[]})
        q["answers"].append(answer)
        if answer["selected"] and answer["tipo"]=="Corretta":score+=answer["punteggio"]
    participation["questions"]=list(grouped.values());participation["score"]=score
    return participation

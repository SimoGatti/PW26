"""Regole transazionali del tentativo conservato prima in sessione."""

import secrets
from datetime import date
from django.db import connection, transaction

SESSION_KEY="quiz_attempt"

def start(session, quiz, username):
    """Crea token e ordine casuale stabile senza scrivere dati applicativi."""
    ordered={str(q["number"]): [a["answer_number"] for a in q["answers"] for _ in [0]] for q in quiz["question_list"]}
    for values in ordered.values():
        secrets.SystemRandom().shuffle(values)
    session[SESSION_KEY]={"token":secrets.token_urlsafe(32),"quiz_code":quiz["codice"],"username":username,"order":ordered,"selected":{}}
    session.modified=True

def save_choices(session, post):
    """Salva nella bozza solo valori numerici associati alle domande."""
    attempt=session.get(SESSION_KEY)
    if not attempt: return None
    selected={}
    for key in post:
        if key.startswith("q_"): selected[key[2:]]=[int(x) for x in post.getlist(key) if x.isdigit()]
    attempt["selected"]=selected;session[SESSION_KEY]=attempt;session.modified=True
    return attempt

def validate_and_submit(session, token):
    """Valida nuovamente il tentativo e persiste tutto in una transazione."""
    attempt=session.get(SESSION_KEY)
    if not attempt or not secrets.compare_digest(attempt["token"], token): raise ValueError("Tentativo non valido o già inviato.")
    quiz_code, username=attempt["quiz_code"],attempt["username"]
    with transaction.atomic(), connection.cursor() as c:
        c.execute('SELECT 1 FROM "Utente" WHERE "nomeUtente"=%s',[username])
        if not c.fetchone(): raise ValueError("Utente non più disponibile.")
        c.execute('SELECT 1 FROM "Quiz" WHERE codice=%s AND "dataInizio"<=CURRENT_DATE AND "dataFine">=CURRENT_DATE',[quiz_code])
        if not c.fetchone(): raise ValueError("Il quiz non è più aperto.")
        c.execute('SELECT numero FROM "Domanda" WHERE quiz=%s ORDER BY numero',[quiz_code]); questions=[r[0] for r in c.fetchall()]
        missing=[q for q in questions if not attempt["selected"].get(str(q))]
        if missing: raise ValueError("Rispondi a tutte le domande prima di inviare.")
        for question in questions:
            answers=attempt["selected"].get(str(question),[])
            c.execute('SELECT numero FROM "Risposta" WHERE quiz=%s AND domanda=%s AND numero=ANY(%s)',[quiz_code,question,answers])
            if len(c.fetchall()) != len(set(answers)): raise ValueError("Una risposta non appartiene al quiz.")
        c.execute('INSERT INTO "Partecipazione" (utente,quiz,data) VALUES (%s,%s,%s) RETURNING codice',[username,quiz_code,date.today()]); participation=c.fetchone()[0]
        for question, answers in attempt["selected"].items():
            for answer in answers: c.execute('INSERT INTO "RispostaUtenteQuiz" (partecipazione,quiz,domanda,risposta) VALUES (%s,%s,%s,%s)',[participation,quiz_code,int(question),answer])
    session.pop(SESSION_KEY,None);session.modified=True
    return participation

#!/usr/bin/env python3
"""Carica un dataset PostgreSQL riproducibile da database_quiz_ITA.json.

Uso: python database/seed.py --profile quick --reference-date 2026-07-22
Il database deve già contenere database/schema.sql e le tabelle Django.
"""
import argparse, json, os, random
from datetime import date, datetime, timedelta
import psycopg

ROOT = os.path.dirname(os.path.dirname(__file__))
SOURCE = os.path.join(ROOT, "..", "Homework-1", "data", "database_quiz_ITA.json")
PROFILES = {"quick": (60, 120, 2500), "load": (500, 270, 30000)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--profile",choices=PROFILES,default="quick");parser.add_argument("--reference-date",default=date.today().isoformat());parser.add_argument("--seed",type=int,default=42);args=parser.parse_args()
    rng=random.Random(args.seed);today=datetime.strptime(args.reference_date,"%Y-%m-%d").date();user_count,quiz_count,participation_count=PROFILES[args.profile]
    with open(SOURCE,encoding="utf-8") as fh: source=json.load(fh)
    conninfo="host={host} port={port} dbname={db} user={user} password={password}".format(host=os.getenv("POSTGRES_HOST","127.0.0.1"),port=os.getenv("POSTGRES_PORT","5432"),db=os.getenv("POSTGRES_DB","quizzing"),user=os.getenv("POSTGRES_USER","quizzing"),password=os.getenv("POSTGRES_PASSWORD",""))
    with psycopg.connect(conninfo) as conn,conn.cursor() as cur:
        cur.execute('TRUNCATE "RispostaUtenteQuiz", "Partecipazione", "Risposta", "Domanda", "Quiz", "Utente" RESTART IDENTITY')
        users=[(f"utente.{i:04d}",f"Nome{i}",f"Cognome{i}",f"utente.{i:04d}@quiz.local") for i in range(1,user_count+1)]
        cur.executemany('INSERT INTO "Utente" ("nomeUtente",nome,cognome,email) VALUES (%s,%s,%s,%s)',users)
        questions=[]
        for code in range(1,quiz_count+1):
            if code%3==0: start,end=today+timedelta(days=7),today+timedelta(days=30)
            elif code%3==1: start,end=today-timedelta(days=10),today+timedelta(days=10)
            else: start,end=today-timedelta(days=30),today-timedelta(days=2)
            creator=users[(code-1)%len(users)][0];cur.execute('INSERT INTO "Quiz" (creatore,titolo,"dataInizio","dataFine") VALUES (%s,%s,%s,%s) RETURNING codice',[creator,f"Quiz {code}",start,end]);quiz=cur.fetchone()[0]
            for number,item in enumerate(rng.sample(source,min(10,len(source))),1):
                cur.execute('INSERT INTO "Domanda" (quiz,numero,testo) VALUES (%s,%s,%s)',[quiz,number,item["domanda"][:1000]])
                # Ogni quinta domanda è multipla, così entrambi i controlli sono esercitati.
                cur.execute('INSERT INTO "Risposta" VALUES (%s,%s,1,%s,\'Corretta\',2)',[quiz,number,item["risposta_corretta"][:1000]])
                if number%5==0: cur.execute('INSERT INTO "Risposta" VALUES (%s,%s,2,%s,\'Corretta\',1)',[quiz,number,item["risposte_errate"][0][:1000]])
                for n,text in enumerate(item["risposte_errate"][1 if number%5==0 else 0:],2 if number%5 else 3):cur.execute('INSERT INTO "Risposta" VALUES (%s,%s,%s,%s,\'Sbagliata\',NULL)',[quiz,number,n,text[:1000]])
            questions.append(quiz)
        eligible=[q for q in questions if q%3!=0]
        for _ in range(participation_count):
            quiz=rng.choice(eligible);username=rng.choice(users)[0];cur.execute('INSERT INTO "Partecipazione" (utente,quiz,data) VALUES (%s,%s,%s) RETURNING codice',[username,quiz,today]);p=cur.fetchone()[0]
            cur.execute('SELECT domanda,numero FROM "Risposta" WHERE quiz=%s ORDER BY domanda,numero',[quiz]);by_question={}
            for question,answer in cur.fetchall():by_question.setdefault(question,[]).append(answer)
            for question,answers in by_question.items():cur.execute('INSERT INTO "RispostaUtenteQuiz" VALUES (%s,%s,%s,%s)',[p,quiz,question,rng.choice(answers)])
    print(f"Creati: {user_count} utenti, {quiz_count} quiz, {participation_count} partecipazioni ({args.profile}).")
if __name__=="__main__":main()

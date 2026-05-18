#!/usr/bin/env python3
"""
init_db.py
Inizializza un database SQLite con lo schema del file db.sql e lo popola
con i dati provenienti da database_quiz_ITA.json, completando i campi
mancanti con dati generati in modo coerente.
"""

import json
import sqlite3
import random
import os
from datetime import date, timedelta

# ---------------------------------------------------------------------------
# 0. Configurazione
# ---------------------------------------------------------------------------
DB_PATH   = "quiz.db"
JSON_PATH = "database_quiz_ITA.json"

random.seed(42)   # riproducibilità

# ---------------------------------------------------------------------------
# 1. Mappa di normalizzazione delle categorie
# ---------------------------------------------------------------------------
CAT_MAP = {
    "Conoscenze Generali":                         "Cultura Generale",
    "Conoscenza Generale":                         "Cultura Generale",
    "Conoscenze generali":                         "Cultura Generale",
    "Intrattenimento: Anime & Manga Giapponesi":   "Intrattenimento: Anime e Manga Giapponesi",
    "Intrattenimento: Anime e Manga giapponesi":   "Intrattenimento: Anime e Manga Giapponesi",
    "Intrattenimento: Cartoni & Animazioni":       "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni Animati":            "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni Animati & Animazioni":"Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni animati e Animazioni":"Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni e Animazioni":       "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Giochi da tavolo":           "Intrattenimento: Giochi da Tavolo",
    "Intrattenimento: Musical & Teatri":           "Intrattenimento: Musical e Teatri",
    "Scienza & Natura":                            "Scienza e Natura",
    "Scienza: Gadget":                             "Scienza: Informatica",
}

# ---------------------------------------------------------------------------
# 2. Dati sintetici per Utente
# ---------------------------------------------------------------------------
UTENTI_RAW = [
    ("mario.rossi",    "Mario",    "Rossi",      "mario.rossi@quizapp.it"),
    ("giulia.bianchi", "Giulia",   "Bianchi",    "giulia.bianchi@quizapp.it"),
    ("luca.ferrari",   "Luca",     "Ferrari",    "luca.ferrari@quizapp.it"),
    ("sara.conti",     "Sara",     "Conti",      "sara.conti@quizapp.it"),
    ("marco.ricci",    "Marco",    "Ricci",      "marco.ricci@quizapp.it"),
    ("elena.greco",    "Elena",    "Greco",      "elena.greco@quizapp.it"),
    ("paolo.lombardi", "Paolo",    "Lombardi",   "paolo.lombardi@quizapp.it"),
    ("anna.martini",   "Anna",     "Martini",    "anna.martini@quizapp.it"),
    ("davide.esposito","Davide",   "Esposito",   "davide.esposito@quizapp.it"),
    ("chiara.romano",  "Chiara",   "Romano",     "chiara.romano@quizapp.it"),
]

# ---------------------------------------------------------------------------
# 3. Helper: data casuale in un intervallo
# ---------------------------------------------------------------------------
def rand_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))

def date_str(d: date) -> str:
    return d.isoformat()

# ---------------------------------------------------------------------------
# 4. Carica JSON
# ---------------------------------------------------------------------------
print(f"[1/7] Caricamento {JSON_PATH} …")
with open(JSON_PATH, "r", encoding="utf-8") as f:
    raw_data = json.load(f)
print(f"      {len(raw_data)} record trovati.")

# Normalizza categoria
for item in raw_data:
    item["categoria_norm"] = CAT_MAP.get(item["categoria"], item["categoria"])

# ---------------------------------------------------------------------------
# 5. Inizializza DB
# ---------------------------------------------------------------------------
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
    print(f"[2/7] DB precedente rimosso.")

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
cur  = conn.cursor()
print(f"[2/7] DB '{DB_PATH}' creato.")

# ---------------------------------------------------------------------------
# 6. Crea tabelle (SQLite-compatible DDL)
# ---------------------------------------------------------------------------
print("[3/7] Creazione tabelle …")

cur.executescript("""
CREATE TABLE IF NOT EXISTS Utente (
    nomeUtente VARCHAR(255) PRIMARY KEY,
    nome       VARCHAR(255) NOT NULL,
    cognome    VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS Quiz (
    codice     INTEGER PRIMARY KEY AUTOINCREMENT,
    creatore   VARCHAR(255) NOT NULL REFERENCES Utente(nomeUtente),
    titolo     VARCHAR(255) NOT NULL,
    dataInizio DATE NOT NULL,
    dataFine   DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS Domanda (
    quiz   INTEGER NOT NULL REFERENCES Quiz(codice),
    numero INTEGER NOT NULL,
    testo  VARCHAR(1000) NOT NULL,
    PRIMARY KEY (quiz, numero)
);

CREATE TABLE IF NOT EXISTS Risposta (
    quiz     INTEGER NOT NULL REFERENCES Quiz(codice),
    domanda  INTEGER NOT NULL,
    numero   INTEGER NOT NULL,
    testo    VARCHAR(1000) NOT NULL,
    tipo     VARCHAR(50) NOT NULL CHECK (tipo IN ('Corretta','Sbagliata')),
    punteggio INTEGER,
    PRIMARY KEY (quiz, domanda, numero),
    CONSTRAINT chk_risposta_tipo
        CHECK (
            (tipo = 'Corretta' AND punteggio IS NOT NULL) OR
            (tipo = 'Sbagliata' AND punteggio IS NULL)
        ),
    FOREIGN KEY (quiz, domanda) REFERENCES Domanda(quiz, numero)
);

CREATE TABLE IF NOT EXISTS Partecipazione (
    codice INTEGER PRIMARY KEY AUTOINCREMENT,
    utente VARCHAR(255) NOT NULL REFERENCES Utente(nomeUtente),
    quiz   INTEGER NOT NULL REFERENCES Quiz(codice),
    data   DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS RispostaUtenteQuiz (
    partecipazione INTEGER NOT NULL REFERENCES Partecipazione(codice),
    quiz           INTEGER NOT NULL REFERENCES Quiz(codice),
    domanda        INTEGER NOT NULL,
    risposta       INTEGER NOT NULL,
    PRIMARY KEY (partecipazione, quiz, domanda, risposta),
    FOREIGN KEY (quiz, domanda) REFERENCES Domanda(quiz, numero),
    FOREIGN KEY (quiz, domanda, risposta) REFERENCES Risposta(quiz, domanda, numero)
);
""")
conn.commit()
print("      Tabelle create.")

# ---------------------------------------------------------------------------
# 7. INSERT Utente
# ---------------------------------------------------------------------------
print("[4/7] Inserimento Utenti …")
cur.executemany(
    "INSERT INTO Utente (nomeUtente, nome, cognome, email) VALUES (?,?,?,?)",
    UTENTI_RAW
)
conn.commit()
print(f"      {len(UTENTI_RAW)} utenti inseriti.")

utenti_nomi = [u[0] for u in UTENTI_RAW]

# ---------------------------------------------------------------------------
# 8. Raggruppa domande per categoria → un Quiz per categoria
# ---------------------------------------------------------------------------
print("[5/7] Inserimento Quiz, Domande e Risposte …")

from collections import defaultdict
cat_domande: dict[str, list] = defaultdict(list)
for item in raw_data:
    cat_domande[item["categoria_norm"]].append(item)

# Date base per i quiz (uno al mese a partire da gennaio 2024)
base_start = date(2024, 1, 1)

quiz_codice_map: dict[str, int] = {}   # categoria → quiz.codice
quiz_date_map:   dict[int, tuple] = {} # quiz.codice → (dataInizio, dataFine)

domande_rows  = []   # (quiz, numero, testo)
risposte_rows = []   # (quiz, domanda, numero, testo, tipo, punteggio)

quiz_counter = 0
for cat_idx, (cat, domande_list) in enumerate(sorted(cat_domande.items())):
    # --- Quiz ---
    creatore    = utenti_nomi[cat_idx % len(utenti_nomi)]
    data_inizio = base_start + timedelta(days=cat_idx * 14)
    data_fine   = data_inizio + timedelta(days=60)
    titolo      = f"Quiz: {cat}"

    cur.execute(
        "INSERT INTO Quiz (creatore, titolo, dataInizio, dataFine) VALUES (?,?,?,?)",
        (creatore, titolo, date_str(data_inizio), date_str(data_fine))
    )
    quiz_id = cur.lastrowid
    quiz_codice_map[cat] = quiz_id
    quiz_date_map[quiz_id] = (data_inizio, data_fine)
    quiz_counter += 1

    # --- Domande e Risposte ---
    for dom_idx, item in enumerate(domande_list, start=1):
        testo_domanda = item["domanda"][:999]   # trunca se > 999 chars (raro)

        domande_rows.append((quiz_id, dom_idx, testo_domanda))

        # Risposta corretta (numero 1) - punteggio tra 1 e 3 in base a difficoltà
        diff = item.get("difficolta", "medio").lower()
        if diff in ("easy", "facile"):
            punti = 1
        elif diff in ("hard", "difficile"):
            punti = 3
        else:
            punti = 2

        risposte_rows.append((quiz_id, dom_idx, 1,
                              item["risposta_corretta"][:999],
                              "Corretta", punti))

        # Risposte errate (numeri 2,3,4 …)
        for err_idx, testo_err in enumerate(item["risposte_errate"], start=2):
            risposte_rows.append((quiz_id, dom_idx, err_idx,
                                  testo_err[:999],
                                  "Sbagliata", None))

# Batch insert
cur.executemany(
    "INSERT INTO Domanda (quiz, numero, testo) VALUES (?,?,?)",
    domande_rows
)
cur.executemany(
    "INSERT INTO Risposta (quiz, domanda, numero, testo, tipo, punteggio) VALUES (?,?,?,?,?,?)",
    risposte_rows
)
conn.commit()

print(f"      {quiz_counter} quiz inseriti.")
print(f"      {len(domande_rows)} domande inserite.")
print(f"      {len(risposte_rows)} risposte inserite.")

# ---------------------------------------------------------------------------
# 9. INSERT Partecipazione e RispostaUtenteQuiz
#    Ogni utente partecipa ad almeno 3 quiz; per ogni partecipazione
#    risponde a tutte le domande del quiz scegliendo una risposta casuale
# ---------------------------------------------------------------------------
print("[6/7] Inserimento Partecipazioni e RisposteUtenteQuiz …")

all_quiz_ids = list(quiz_date_map.keys())   # tutti i quiz.codice

part_rows  = []   # (utente, quiz, data)
ruq_rows   = []   # (partecipazione, quiz, domanda, risposta)

# Struttura di lookup: (quiz_id, dom_numero) → lista di risposta.numero
risposta_index: dict[tuple, list[int]] = defaultdict(list)
for (q, d, r, *_rest) in risposte_rows:
    risposta_index[(q, d)].append(r)

# Ogni utente partecipa a un sottoinsieme di quiz
for utente in utenti_nomi:
    # Campiona da 3 a 8 quiz per utente
    num_quiz = random.randint(3, min(8, len(all_quiz_ids)))
    quiz_campionati = random.sample(all_quiz_ids, num_quiz)

    for quiz_id in quiz_campionati:
        data_inizio, data_fine = quiz_date_map[quiz_id]
        # Data partecipazione: durante il periodo del quiz o entro 7gg dopo
        part_data = rand_date(data_inizio, data_fine + timedelta(days=7))

        part_rows.append((utente, quiz_id, date_str(part_data)))

# Insert partecipazioni e recupera i codici
cur.executemany(
    "INSERT INTO Partecipazione (utente, quiz, data) VALUES (?,?,?)",
    part_rows
)
conn.commit()

# Recupera tutti i codici delle partecipazioni appena inserite
cur.execute("SELECT codice, utente, quiz FROM Partecipazione ORDER BY codice")
partecipazioni = cur.fetchall()
print(f"      {len(partecipazioni)} partecipazioni inserite.")

# Per ogni partecipazione inserisci una risposta per ogni domanda del quiz
for (part_codice, utente, quiz_id) in partecipazioni:
    # Domande di questo quiz
    dom_numeri = sorted({d for (q, d, *_) in domande_rows if q == quiz_id})

    for dom_num in dom_numeri:
        chiave = (quiz_id, dom_num)
        opzioni = risposta_index.get(chiave, [])
        if not opzioni:
            continue
        # Scelta casuale (bias verso la risposta corretta = num 1)
        pesi = [0.4 if r == 1 else (0.6 / (len(opzioni) - 1)) for r in opzioni]
        scelta = random.choices(opzioni, weights=pesi, k=1)[0]
        ruq_rows.append((part_codice, quiz_id, dom_num, scelta))

cur.executemany(
    "INSERT INTO RispostaUtenteQuiz (partecipazione, quiz, domanda, risposta) VALUES (?,?,?,?)",
    ruq_rows
)
conn.commit()
print(f"      {len(ruq_rows)} risposte utente inserite.")

# ---------------------------------------------------------------------------
# 10. Verifica finale
# ---------------------------------------------------------------------------
print("[7/7] Verifica conteggi finali …")
tables = ["Utente", "Quiz", "Domanda", "Risposta", "Partecipazione", "RispostaUtenteQuiz"]
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    n = cur.fetchone()[0]
    print(f"      {t}: {n} righe")

conn.close()
print(f"\n✅  Database '{DB_PATH}' inizializzato con successo!")

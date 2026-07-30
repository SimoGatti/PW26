#!/usr/bin/env python3
"""Utility storica per rigenerare il dump durante lo sviluppo.

Lo script non viene importato dall'applicazione e non viene eseguito dal
bootstrap. L'uso manuale richiede facoltativamente il pacchetto OpenAI e
credenziali proprie; installazione e verifica di QUIZZING non lo richiedono.
"""

import os
import json
import random
import time
from datetime import date, timedelta
from collections import defaultdict
from openai import OpenAI

# ==============================================================================
# CONFIGURAZIONE
# ==============================================================================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY_HERE") 

JSON_BASE_PATH   = "database_quiz_ITA.json"
CACHE_PATH       = "cache_domande.json"
OUT_SQL_PATH     = "quiz_mysql_expanded.sql"
DB_NAME          = "my_namenotfound"

TARGET_QUESTIONS = 10000
TARGET_USERS     = 2500 
TARGET_SESSIONS  = 10000
MAX_DOMANDE_QUIZ = 20
TODAY            = date(2026, 7, 20) 

# Categorie per l'IA
CATEGORIE_AI = [
    "Cultura Generale", "Storia", "Geografia", "Scienza e Natura", 
    "Scienza: Informatica", "Scienza: Matematica", "Intrattenimento: Film",
    "Intrattenimento: Musica", "Intrattenimento: Videogiochi", 
    "Intrattenimento: Anime e Manga Giapponesi", "Sport", "Arte", "Mitologia", "Veicoli"
]

random.seed(42)

# ==============================================================================
# FUNZIONI DI SUPPORTO
# ==============================================================================
def esc(val):
    """Converte un valore Python in un letterale compatibile col dump MySQL."""
    if val is None:
        return "NULL"
    if isinstance(val, int):
        return str(val)
    return "'" + str(val).replace("\\", "\\\\").replace("'", "\\'") + "'"

def rand_date(start: date, end: date) -> date:
    """Estrae una data nell'intervallo, includendo gli estremi validi."""
    if start >= end:
        return start
    return start + timedelta(days=random.randint(0, (end - start).days))

# ==============================================================================
# 1. GENERATORE NOMI UTENTE SINTETICI (2.500 Utenti)
# ==============================================================================
def generate_users(count):
    """Genera utenti univoci partendo da un piccolo nucleo riconoscibile."""
    print(f"[1/5] Generazione di {count} utenti sintetici...")
    
    base_users = [
        ("mario.rossi", "Mario", "Rossi", "mario.rossi@quizapp.it"),
        ("giulia.bianchi", "Giulia", "Bianchi", "giulia.bianchi@quizapp.it"),
        ("luca.ferrari", "Luca", "Ferrari", "luca.ferrari@quizapp.it"),
        ("sara.conti", "Sara", "Conti", "sara.conti@quizapp.it"),
        ("marco.ricci", "Marco", "Ricci", "marco.ricci@quizapp.it"),
        ("elena.greco", "Elena", "Greco", "elena.greco@quizapp.it"),
        ("paolo.lombardi", "Paolo", "Lombardi", "paolo.lombardi@quizapp.it"),
        ("anna.martini", "Anna", "Martini", "anna.martini@quizapp.it"),
        ("davide.esposito", "Davide", "Esposito", "davide.esposito@quizapp.it"),
        ("chiara.romano", "Chiara", "Romano", "chiara.romano@quizapp.it"),
    ]
    
    nomes = ["Alessandro", "Sofia", "Francesco", "Aurora", "Lorenzo", "Giulia", "Mattia", "Ginevra", 
             "Davide", "Alice", "Gabriele", "Emma", "Tommaso", "Giorgia", "Edoardo", "Beatrice",
             "Riccardo", "Greta", "Federico", "Vittoria", "Leonardo", "Camilla", "Matteo", "Chiara"]
    cognomes = ["Ferrari", "Russo", "Rossi", "Bianchi", "Esposito", "Colombo", "Romano", "Ricci",
                "Gallo", "Greco", "Conti", "Bruno", "De Luca", "Mancini", "Costa", "Giordano",
                "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi"]
    
    users = list(base_users)
    used_usernames = {u[0] for u in users}
    
    idx = 1
    while len(users) < count:
        n = random.choice(nomes)
        c = random.choice(cognomes)
        username = f"{n.lower()}.{c.lower()}{idx}"
        if username not in used_usernames:
            used_usernames.add(username)
            email = f"{username}@quizapp.it"
            users.append((username, n, c, email))
        idx += 1
        
    return users

# ==============================================================================
# 2. GENERAZIONE DOMANDE TRAMITE OPENAI (gpt-4o-mini)
# ==============================================================================
def fetch_ai_questions(client, category, batch_size=15):
    """Richiede un lotto JSON e scarta risposte API non interpretabili."""
    prompt = f"""Genera esattamente {batch_size} domande a risposta multipla per un quiz in lingua ITALIANA.
Categoria: '{category}'.
Ogni domanda deve avere 4 opzioni di risposta: 1 corretta e 3 errate.

Rispondi ESCLUSIVAMENTE con un oggetto JSON avente la seguente struttura:
{{
  "domande": [
    {{
      "categoria": "{category}",
      "tipo": "multiple",
      "difficolta": "medium",
      "domanda": "Testo della domanda?",
      "risposta_corretta": "Risposta Esatta",
      "risposte_errate": ["Errata 1", "Errata 2", "Errata 3"]
    }}
  ]
}}
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=30
        )
        content = response.choices[0].message.content.strip()
        
        # Pulizia eventuale sintassi Markdown ```json ... ```
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()
            
        data = json.loads(content)
        if isinstance(data, dict) and "domande" in data:
            return data["domande"]
        elif isinstance(data, list):
            return data
        return []
    except Exception as e:
        print(f"      ⚠️ Errore durante la chiamata API ({category}): {e}")
        return []

def get_all_questions():
    """Riprende la cache locale e completa il corpus fino al target."""
    print("[2/5] Caricamento domande ed eventuale ripristino da Cache locale...")
    
    all_questions = []
    
    # 1. Ripristina da Cache se già esistente
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            all_questions = json.load(f)
        print(f"      📂 Ripristinate {len(all_questions)} domande salvate in '{CACHE_PATH}'.")
    else:
        # 2. Carica domande iniziali dal file JSON
        if os.path.exists(JSON_BASE_PATH):
            with open(JSON_BASE_PATH, "r", encoding="utf-8") as f:
                base = json.load(f)
            for q in base:
                if len(q.get("risposte_errate", [])) == 3:
                    all_questions.append(q)
                elif len(q.get("risposte_errate", [])) == 1:
                    q["risposte_errate"].extend(["Non specificato", "Nessuna delle precedenti"])
                    all_questions.append(q)
            print(f"      Caricate {len(all_questions)} domande base dal file JSON.")

    needed = TARGET_QUESTIONS - len(all_questions)
    
    if needed <= 0:
        print("      Target di 10.000 domande già raggiunto!")
        return all_questions[:TARGET_QUESTIONS]

    print(f"      Mancano {needed} domande. Avvio generazione con OpenAI...")
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    while len(all_questions) < TARGET_QUESTIONS:
        cat = random.choice(CATEGORIE_AI)
        batch_needed = min(15, TARGET_QUESTIONS - len(all_questions))
        print(f"      Raggiunte {len(all_questions)}/{TARGET_QUESTIONS} domande. Richiesta batch ({batch_needed}) per '{cat}'...")
        
        new_batch = fetch_ai_questions(client, cat, batch_size=batch_needed)
        valid_items = [
            q for q in new_batch 
            if isinstance(q, dict) and "domanda" in q and "risposta_corretta" in q and len(q.get("risposte_errate", [])) == 3
        ]
        
        if valid_items:
            all_questions.extend(valid_items)
            # 💾 Salva il progresso ad OGNI batch su disco
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(all_questions, f, ensure_ascii=False, indent=2)
        else:
            time.sleep(1) # Piccola pausa in caso di errore prima di riprovare
            
    return all_questions[:TARGET_QUESTIONS]

# ==============================================================================
# 3. GENERAZIONE STRUTTURA DB & PARTECIPAZIONI
# ==============================================================================
def build_database_structures(users, questions):
    """Costruisce record coerenti e partecipazioni comprese nel periodo quiz."""
    print("[3/5] Organizzazione Quiz, Domande, Risposte e Sessioni...") 
    
    utenti_nomi = [u[0] for u in users] 
    
    cat_map = defaultdict(list)
    for q in questions:
        cat = q.get("categoria", "Cultura Generale")
        cat_map[cat].append(q)
        
    quiz_list = []
    domande_list = []
    risposte_list = []
    
    quiz_id = 0
    quiz_date_map = {}
    risposta_index = defaultdict(list)
    
    base_start = date(2024, 1, 1)
    
    for cat, q_items in cat_map.items():
        chunks = [q_items[i:i + MAX_DOMANDE_QUIZ] for i in range(0, len(q_items), MAX_DOMANDE_QUIZ)]
        
        for chunk_n, chunk in enumerate(chunks, start=1):
            quiz_id += 1
            creatore = random.choice(utenti_nomi)
            
            data_inizio = base_start + timedelta(days=(quiz_id % 700))
            data_fine = data_inizio + timedelta(days=random.randint(30, 90))
            
            titolo_cat = cat.replace(":", "-").replace(" ", "")
            titolo = f"{titolo_cat}-{chunk_n}"
            
            quiz_list.append((quiz_id, creatore, titolo, data_inizio.isoformat(), data_fine.isoformat()))
            quiz_date_map[quiz_id] = (data_inizio, data_fine)
            
            for dom_idx, item in enumerate(chunk, start=1):
                domande_list.append((quiz_id, dom_idx, item["domanda"][:999]))
                
                diff = item.get("difficolta", "medium").lower()
                punti = 1 if diff in ("easy", "facile") else 3 if diff in ("hard", "difficile") else 2
                
                # Risposta corretta (numero 1)
                risposte_list.append((quiz_id, dom_idx, 1, item["risposta_corretta"][:999], "Corretta", punti))
                risposta_index[(quiz_id, dom_idx)].append(1)
                
                # Risposte errate (numero 2, 3, 4)
                for err_i, testo_err in enumerate(item["risposte_errate"][:3], start=2):
                    risposte_list.append((quiz_id, dom_idx, err_i, testo_err[:999], "Sbagliata", None)) 
                    risposta_index[(quiz_id, dom_idx)].append(err_i)

    print(f"[4/5] Generazione di {TARGET_SESSIONS} sessioni di partecipazione...")
    part_list = []
    ruq_list = []
    
    all_quiz_ids = list(quiz_date_map.keys())
    
    for part_id in range(1, TARGET_SESSIONS + 1):
        utente = random.choice(utenti_nomi)
        qid = random.choice(all_quiz_ids)
        di, df = quiz_date_map[qid]
        
        data_p = rand_date(di, min(df, TODAY))
        part_list.append((part_id, utente, qid, data_p.isoformat()))
        
        dom_numeri = [d[1] for d in domande_list if d[0] == qid]
        for dom_num in dom_numeri:
            opzioni = risposta_index.get((qid, dom_num), [1, 2, 3, 4])
            pesi = [0.6 if r == 1 else 0.4 / (len(opzioni) - 1) for r in opzioni]
            scelta = random.choices(opzioni, weights=pesi, k=1)[0]
            ruq_list.append((part_id, qid, dom_num, scelta))
            
    return quiz_list, domande_list, risposte_list, part_list, ruq_list

# ==============================================================================
# 4. SCRITTURA DUMP SQL
# ==============================================================================
def write_sql_dump(users, quiz_list, domande_list, risposte_list, part_list, ruq_list):
    """Scrive schema e INSERT a blocchi per contenere la memoria del client."""
    print(f"[5/5] Scrittura file SQL finale ({OUT_SQL_PATH})...")
    
    BATCH = 500
    L = []
    def ln(s=""): L.append(s)

    ln("-- MySQL Dump Popolato con AI (Expanded)")
    ln(f"-- Database: {DB_NAME}")
    ln("SET NAMES utf8mb4;")
    ln("SET CHARACTER SET utf8mb4;")
    ln(f"USE `{DB_NAME}`;")
    ln("SET foreign_key_checks = 0;\n")

    for t in ["RispostaUtenteQuiz", "Partecipazione", "Risposta", "Domanda", "Quiz", "Utente"]:
        ln(f"DROP TABLE IF EXISTS `{t}`;")
    ln()

    ln("""CREATE TABLE `Utente` (
    `nomeUtente` VARCHAR(255) NOT NULL,
    `nome`       VARCHAR(255) NOT NULL,
    `cognome`    VARCHAR(255) NOT NULL,
    `email`      VARCHAR(255) NOT NULL,
    `Attivo`     TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`nomeUtente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Quiz` (
    `codice`     INT          NOT NULL AUTO_INCREMENT,
    `creatore`   VARCHAR(255) NOT NULL,
    `titolo`     VARCHAR(255) NOT NULL,
    `dataInizio` DATE         NOT NULL,
    `dataFine`   DATE         NOT NULL,
    PRIMARY KEY (`codice`),
    CONSTRAINT `fk_quiz_utente` FOREIGN KEY (`creatore`) REFERENCES `Utente`(`nomeUtente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Domanda` (
    `quiz`   INT           NOT NULL,
    `numero` INT           NOT NULL,
    `testo`  VARCHAR(1000) NOT NULL,
    PRIMARY KEY (`quiz`, `numero`),
    CONSTRAINT `fk_domanda_quiz` FOREIGN KEY (`quiz`) REFERENCES `Quiz`(`codice`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Risposta` (
    `quiz`      INT           NOT NULL,
    `domanda`   INT           NOT NULL,
    `numero`    INT           NOT NULL,
    `testo`     VARCHAR(1000) NOT NULL,
    `tipo`      VARCHAR(50)   NOT NULL,
    `punteggio` INT           DEFAULT NULL,
    PRIMARY KEY (`quiz`, `domanda`, `numero`),
    CONSTRAINT `chk_risposta_tipo` CHECK (
        (`tipo` = 'Corretta'  AND `punteggio` IS NOT NULL) OR
        (`tipo` = 'Sbagliata' AND `punteggio` IS NULL)
    ),
    CONSTRAINT `fk_risposta_quiz`    FOREIGN KEY (`quiz`)            REFERENCES `Quiz`(`codice`),
    CONSTRAINT `fk_risposta_domanda` FOREIGN KEY (`quiz`, `domanda`) REFERENCES `Domanda`(`quiz`, `numero`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `Partecipazione` (
    `codice` INT          NOT NULL AUTO_INCREMENT,
    `utente` VARCHAR(255) NOT NULL,
    `quiz`   INT          NOT NULL,
    `data`   DATE         NOT NULL,
    PRIMARY KEY (`codice`),
    CONSTRAINT `fk_part_utente` FOREIGN KEY (`utente`) REFERENCES `Utente`(`nomeUtente`),
    CONSTRAINT `fk_part_quiz`   FOREIGN KEY (`quiz`)   REFERENCES `Quiz`(`codice`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `RispostaUtenteQuiz` (
    `partecipazione` INT NOT NULL,
    `quiz`           INT NOT NULL,
    `domanda`        INT NOT NULL,
    `risposta`       INT NOT NULL,
    PRIMARY KEY (`partecipazione`, `quiz`, `domanda`, `risposta`),
    CONSTRAINT `fk_ruq_part`     FOREIGN KEY (`partecipazione`)             REFERENCES `Partecipazione`(`codice`),
    CONSTRAINT `fk_ruq_quiz`     FOREIGN KEY (`quiz`)                       REFERENCES `Quiz`(`codice`),
    CONSTRAINT `fk_ruq_domanda`  FOREIGN KEY (`quiz`, `domanda`)            REFERENCES `Domanda`(`quiz`, `numero`),
    CONSTRAINT `fk_ruq_risposta` FOREIGN KEY (`quiz`, `domanda`, `risposta`) REFERENCES `Risposta`(`quiz`, `domanda`, `numero`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

    def insert_block(table, cols, rows):
        """Aggiunge gli INSERT di una tabella in lotti da 500 righe."""
        if not rows: return
        col_str = ", ".join(f"`{c}`" for c in cols)
        ln(f"-- {table}: {len(rows)} righe")
        for i in range(0, len(rows), BATCH):
            batch = rows[i:i+BATCH]
            vals  = ",\n    ".join("(" + ", ".join(esc(v) for v in r) + ")" for r in batch)
            ln(f"INSERT INTO `{table}` ({col_str}) VALUES\n    {vals};")
        ln()

    insert_block("Utente", ["nomeUtente","nome","cognome","email"], users)
    insert_block("Quiz", ["codice","creatore","titolo","dataInizio","dataFine"], quiz_list)
    insert_block("Domanda", ["quiz","numero","testo"], domande_list)
    insert_block("Risposta", ["quiz","domanda","numero","testo","tipo","punteggio"], risposte_list)
    insert_block("Partecipazione", ["codice","utente","quiz","data"], part_list)
    insert_block("RispostaUtenteQuiz", ["partecipazione","quiz","domanda","risposta"], ruq_list)

    ln("SET foreign_key_checks = 1;")

    with open(OUT_SQL_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(L))

    size_mb = os.path.getsize(OUT_SQL_PATH) / (1024 * 1024)
    print(f"\n✅ COMPLETATO CON SUCCESSO! File generato: '{OUT_SQL_PATH}' ({size_mb:.2f} MB)")

# ==============================================================================
# MAIN
# ==============================================================================
if __name__ == "__main__":
    users = generate_users(TARGET_USERS)
    questions = get_all_questions()
    quiz_list, domande_list, risposte_list, part_list, ruq_list = build_database_structures(users, questions)
    write_sql_dump(users, quiz_list, domande_list, risposte_list, part_list, ruq_list)

#!/usr/bin/env python3
"""
generate_mysql.py
Legge database_quiz_ITA.json e genera:
  - quiz_mysql.sql  (MySQL-compatible, identico a prima)
  - quiz_data.ods   (OpenDocument Spreadsheet, un foglio per tabella)

Ogni quiz contiene al massimo MAX_DOMANDE domande (campionate casualmente).
"""

import json
import random
from collections import defaultdict
from datetime import date, timedelta

# ---------------------------------------------------------------------------
# Configurazione
# ---------------------------------------------------------------------------
JSON_PATH    = "database_quiz_ITA.json"
OUT_SQL      = "quiz_mysql.sql"
OUT_ODS      = "quiz_data.ods"
DB_NAME      = "my_namenotfound"
MAX_DOMANDE  = 20          # vincolo: max domande per quiz
random.seed(42)

# ---------------------------------------------------------------------------
# Normalizzazione categorie
# ---------------------------------------------------------------------------
CAT_MAP = {
    "Conoscenze Generali":                          "Cultura Generale",
    "Conoscenza Generale":                          "Cultura Generale",
    "Conoscenze generali":                          "Cultura Generale",
    "Intrattenimento: Anime & Manga Giapponesi":    "Intrattenimento: Anime e Manga Giapponesi",
    "Intrattenimento: Anime e Manga giapponesi":    "Intrattenimento: Anime e Manga Giapponesi",
    "Intrattenimento: Cartoni & Animazioni":        "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni Animati":             "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni Animati & Animazioni":"Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni animati e Animazioni":"Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Cartoni e Animazioni":        "Intrattenimento: Cartoni Animati e Animazioni",
    "Intrattenimento: Giochi da tavolo":            "Intrattenimento: Giochi da Tavolo",
    "Intrattenimento: Musical & Teatri":            "Intrattenimento: Musical e Teatri",
    "Scienza & Natura":                             "Scienza e Natura",
    "Scienza: Gadget":                              "Scienza: Informatica",
}

# ---------------------------------------------------------------------------
# Utenti sintetici
# ---------------------------------------------------------------------------
UTENTI = [
    ("mario.rossi",     "Mario",   "Rossi",     "mario.rossi@quizapp.it"),
    ("giulia.bianchi",  "Giulia",  "Bianchi",   "giulia.bianchi@quizapp.it"),
    ("luca.ferrari",    "Luca",    "Ferrari",   "luca.ferrari@quizapp.it"),
    ("sara.conti",      "Sara",    "Conti",     "sara.conti@quizapp.it"),
    ("marco.ricci",     "Marco",   "Ricci",     "marco.ricci@quizapp.it"),
    ("elena.greco",     "Elena",   "Greco",     "elena.greco@quizapp.it"),
    ("paolo.lombardi",  "Paolo",   "Lombardi",  "paolo.lombardi@quizapp.it"),
    ("anna.martini",    "Anna",    "Martini",   "anna.martini@quizapp.it"),
    ("davide.esposito", "Davide",  "Esposito",  "davide.esposito@quizapp.it"),
    ("chiara.romano",   "Chiara",  "Romano",    "chiara.romano@quizapp.it"),
]

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def esc(val):
    if val is None:
        return "NULL"
    if isinstance(val, int):
        return str(val)
    return "'" + str(val).replace("\\", "\\\\").replace("'", "\\'") + "'"

def rand_date(start: date, end: date) -> date:
    return start + timedelta(days=random.randint(0, (end - start).days))

# ---------------------------------------------------------------------------
# Carica e raggruppa JSON
# ---------------------------------------------------------------------------
print(f"[1/5] Caricamento {JSON_PATH} …")
with open(JSON_PATH, "r", encoding="utf-8") as f:
    raw = json.load(f)

cat_domande: dict[str, list] = defaultdict(list)
for item in raw:
    cat = CAT_MAP.get(item["categoria"], item["categoria"])
    item["_cat"] = cat
    cat_domande[cat].append(item)

print(f"      {len(raw)} record, {len(cat_domande)} categorie.")

def titolo_quiz(cat: str, n: int) -> str:
    """Es: 'Intrattenimento: Videogiochi' + 2 → 'Intrattenimento-Videogiochi-2'."""
    parti = [p.strip() for p in cat.split(":", 1)]
    return "-".join(parti + [str(n)])

# ---------------------------------------------------------------------------
# Costruzione strutture dati
# ---------------------------------------------------------------------------
print(f"[2/5] Costruzione dati (max {MAX_DOMANDE} domande/quiz) …")

utenti_nomi = [u[0] for u in UTENTI]
base_start  = date(2024, 1, 1)

quiz_list       = []   # (codice, creatore, titolo, dataInizio, dataFine)
domande_list    = []   # (quiz, numero, testo)
risposte_list   = []   # (quiz, domanda, numero, testo, tipo, punteggio)
part_list       = []   # (codice, utente, quiz, data)
ruq_list        = []   # (partecipazione, quiz, domanda, risposta)

quiz_date_map   = {}   # quiz_id → (dataInizio, dataFine)
risposta_index  = defaultdict(list)  # (quiz_id, dom_num) → [risposta.numero, ...]

quiz_id      = 0
creatore_idx = 0

for cat in sorted(cat_domande.keys()):
    items = cat_domande[cat]
    random.shuffle(items)   # ordine casuale prima di chunking

    # Suddividi in chunk da MAX_DOMANDE
    chunks = [items[i:i+MAX_DOMANDE] for i in range(0, len(items), MAX_DOMANDE)]

    for chunk_n, chunk in enumerate(chunks, start=1):
        quiz_id     += 1
        creatore     = utenti_nomi[creatore_idx % len(utenti_nomi)]
        creatore_idx += 1

        # Date: scaglionate di 7 giorni tra quiz consecutivi
        data_inizio = base_start + timedelta(days=(quiz_id - 1) * 7)
        data_fine   = data_inizio + timedelta(days=60)

        titolo = titolo_quiz(cat, chunk_n)
        quiz_list.append((quiz_id, creatore, titolo,
                          data_inizio.isoformat(), data_fine.isoformat()))
        quiz_date_map[quiz_id] = (data_inizio, data_fine)

        for dom_idx, item in enumerate(chunk, start=1):
            testo = item["domanda"][:999]
            domande_list.append((quiz_id, dom_idx, testo))

            diff  = item.get("difficolta", "medio").lower()
            punti = 1 if diff in ("easy", "facile") else 3 if diff in ("hard", "difficile") else 2

            risposte_list.append((quiz_id, dom_idx, 1,
                                  item["risposta_corretta"][:999], "Corretta", punti))
            risposta_index[(quiz_id, dom_idx)].append(1)

            for err_i, testo_err in enumerate(item["risposte_errate"], start=2):
                risposte_list.append((quiz_id, dom_idx, err_i,
                                      testo_err[:999], "Sbagliata", None))
                risposta_index[(quiz_id, dom_idx)].append(err_i)

all_quiz_ids = list(quiz_date_map.keys())

# Partecipazioni
part_id = 0
for utente in utenti_nomi:
    campionati = random.sample(all_quiz_ids, random.randint(3, min(8, len(all_quiz_ids))))
    for qid in campionati:
        part_id += 1
        di, df = quiz_date_map[qid]
        data_p = rand_date(di, df + timedelta(days=7))
        part_list.append((part_id, utente, qid, data_p.isoformat()))

        # RispostaUtenteQuiz: risponde ad ogni domanda del quiz
        dom_numeri = [d for (q, d, *_) in domande_list if q == qid]
        for dom_num in dom_numeri:
            opzioni = risposta_index.get((qid, dom_num), [])
            if not opzioni:
                continue
            pesi  = [0.4 if r == 1 else 0.6 / (len(opzioni) - 1) for r in opzioni]
            scelta = random.choices(opzioni, weights=pesi, k=1)[0]
            ruq_list.append((part_id, qid, dom_num, scelta))

print(f"      {len(quiz_list)} quiz, {len(domande_list)} domande, "
      f"{len(risposte_list)} risposte, {len(part_list)} partecipazioni, "
      f"{len(ruq_list)} risposte utente.")

# ---------------------------------------------------------------------------
# Generazione SQL  (identico alla versione precedente)
# ---------------------------------------------------------------------------
print(f"[3/5] Generazione SQL → {OUT_SQL} …")

BATCH = 500
L = []

def ln(s=""): L.append(s)

ln("-- MySQL dump generato da generate_mysql.py")
ln(f"-- Database: {DB_NAME}")
ln()
ln("SET NAMES utf8mb4;")
ln("SET CHARACTER SET utf8mb4;")
ln(f"USE `{DB_NAME}`;")
ln("SET foreign_key_checks = 0;")
ln()

# --- DROP ---
for t in ["RispostaUtenteQuiz","Partecipazione","Risposta","Domanda","Quiz","Utente"]:
    ln(f"DROP TABLE IF EXISTS `{t}`;")
# TRIGGER rimosso: AlterVista shared hosting non concede il privilegio TRIGGER.
# Il vincolo max-20 domande/quiz è garantito dallo script di generazione.
ln()

# --- CREATE TABLE ---
ln("""CREATE TABLE `Utente` (
    `nomeUtente` VARCHAR(255) NOT NULL,
    `nome`       VARCHAR(255) NOT NULL,
    `cognome`    VARCHAR(255) NOT NULL,
    `email`      VARCHAR(255) NOT NULL,
    `Attivo`     TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`nomeUtente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

ln("""CREATE TABLE `Quiz` (
    `codice`     INT          NOT NULL AUTO_INCREMENT,
    `creatore`   VARCHAR(255) NOT NULL,
    `titolo`     VARCHAR(255) NOT NULL,
    `dataInizio` DATE         NOT NULL,
    `dataFine`   DATE         NOT NULL,
    PRIMARY KEY (`codice`),
    CONSTRAINT `fk_quiz_utente` FOREIGN KEY (`creatore`) REFERENCES `Utente`(`nomeUtente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

ln("""CREATE TABLE `Domanda` (
    `quiz`   INT           NOT NULL,
    `numero` INT           NOT NULL,
    `testo`  VARCHAR(1000) NOT NULL,
    PRIMARY KEY (`quiz`, `numero`),
    CONSTRAINT `fk_domanda_quiz` FOREIGN KEY (`quiz`) REFERENCES `Quiz`(`codice`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

ln("""CREATE TABLE `Risposta` (
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
""")

ln("""CREATE TABLE `Partecipazione` (
    `codice` INT          NOT NULL AUTO_INCREMENT,
    `utente` VARCHAR(255) NOT NULL,
    `quiz`   INT          NOT NULL,
    `data`   DATE         NOT NULL,
    PRIMARY KEY (`codice`),
    CONSTRAINT `fk_part_utente` FOREIGN KEY (`utente`) REFERENCES `Utente`(`nomeUtente`),
    CONSTRAINT `fk_part_quiz`   FOREIGN KEY (`quiz`)   REFERENCES `Quiz`(`codice`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""")

ln("""CREATE TABLE `RispostaUtenteQuiz` (
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

# (TRIGGER non incluso: privilegio non disponibile su AlterVista shared hosting)

# --- INSERT DATA ---
def insert_block(table, cols, rows):
    if not rows:
        return
    col_str = ", ".join(f"`{c}`" for c in cols)
    ln(f"-- {table}: {len(rows)} righe")
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        vals  = ",\n    ".join("(" + ", ".join(esc(v) for v in r) + ")" for r in batch)
        ln(f"INSERT INTO `{table}` ({col_str}) VALUES")
        ln(f"    {vals};")
    ln()

insert_block("Utente",           ["nomeUtente","nome","cognome","email"],                    UTENTI)
insert_block("Quiz",             ["codice","creatore","titolo","dataInizio","dataFine"],     quiz_list)
insert_block("Domanda",          ["quiz","numero","testo"],                                  domande_list)
insert_block("Risposta",         ["quiz","domanda","numero","testo","tipo","punteggio"],     risposte_list)
insert_block("Partecipazione",   ["codice","utente","quiz","data"],                          part_list)
insert_block("RispostaUtenteQuiz",["partecipazione","quiz","domanda","risposta"],            ruq_list)

ln("SET foreign_key_checks = 1;")
ln()

with open(OUT_SQL, "w", encoding="utf-8") as f:
    f.write("\n".join(L))

import os
size_kb = os.path.getsize(OUT_SQL) / 1024
print(f"      Scritto '{OUT_SQL}' ({size_kb:.0f} KB)")

# ---------------------------------------------------------------------------
# Generazione ODS
# ---------------------------------------------------------------------------
print(f"[4/5] Generazione ODS → {OUT_ODS} …")

try:
    # pyrefly: ignore [missing-import]
    from odf.opendocument import OpenDocumentSpreadsheet
    # pyrefly: ignore [missing-import]
    from odf.style import Style, TextProperties, 
    # pyrefly: ignore [missing-import]
    from odf.table import Table, TableRow, TableCell, TableColumn
    # pyrefly: ignore [missing-import]
    from odf.text import P
    # pyrefly: ignore [missing-import]   
    from odf import style as odfstyle
except ImportError:
    print("      ⚠️  Libreria 'odfpy' non trovata. Installala con:")
    print("         pip install odfpy")
    print("      Il file SQL è stato comunque generato correttamente.")
    raise SystemExit(1)

doc = OpenDocumentSpreadsheet()

# --- Stili ---
# Intestazione: grassetto
header_style = Style(name="Header", family="table-cell")
header_style.addElement(TextProperties(fontweight="bold"))
doc.automaticstyles.addElement(header_style)

# Cella normale
cell_style = Style(name="Default", family="table-cell")
doc.automaticstyles.addElement(cell_style)

def make_cell(value, style_name="Default"):
    """Crea una TableCell con testo."""
    tc = TableCell(stylename=style_name)
    tc.addElement(P(text=str(value) if value is not None else ""))
    return tc

def add_sheet(doc, sheet_name, headers, rows):
    """Aggiunge un foglio al documento ODS."""
    table = Table(name=sheet_name)

    # Riga di intestazione
    header_row = TableRow()
    for h in headers:
        header_row.addElement(make_cell(h, style_name="Header"))
    table.addElement(header_row)

    # Righe dati
    for row in rows:
        tr = TableRow()
        for val in row:
            tr.addElement(make_cell(val))
        table.addElement(tr)

    doc.spreadsheet.addElement(table)
    print(f"      Foglio '{sheet_name}': {len(rows)} righe")

# Un foglio per ogni tabella, stesso ordine dell'SQL
add_sheet(doc, "Utente",
    headers=["nomeUtente", "nome", "cognome", "email"],
    rows=UTENTI)

add_sheet(doc, "Quiz",
    headers=["codice", "creatore", "titolo", "dataInizio", "dataFine"],
    rows=quiz_list)

add_sheet(doc, "Domanda",
    headers=["quiz", "numero", "testo"],
    rows=domande_list)

add_sheet(doc, "Risposta",
    headers=["quiz", "domanda", "numero", "testo", "tipo", "punteggio"],
    rows=risposte_list)

add_sheet(doc, "Partecipazione",
    headers=["codice", "utente", "quiz", "data"],
    rows=part_list)

add_sheet(doc, "RispostaUtenteQuiz",
    headers=["partecipazione", "quiz", "domanda", "risposta"],
    rows=ruq_list)

doc.save(OUT_ODS)
size_ods_kb = os.path.getsize(OUT_ODS) / 1024
print(f"      Scritto '{OUT_ODS}' ({size_ods_kb:.0f} KB)")

# ---------------------------------------------------------------------------
# Riepilogo finale
# ---------------------------------------------------------------------------
print(f"\n[5/5] Completato.")
print()
print("Riepilogo:")
print(f"  Utente:            {len(UTENTI)}")
print(f"  Quiz:              {len(quiz_list)}")
print(f"  Domanda:           {len(domande_list)}  (max {MAX_DOMANDE}/quiz)")
print(f"  Risposta:          {len(risposte_list)}")
print(f"  Partecipazione:    {len(part_list)}")
print(f"  RispostaUtenteQuiz:{len(ruq_list)}")
print()
print(f"✅  {OUT_SQL} pronto per AlterVista/MySQL!")
print(f"✅  {OUT_ODS} pronto per LibreOffice / Excel!")

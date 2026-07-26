# QUIZZING 2

Ristrutturazione server-side del Progetto 1: Django Templates, PostgreSQL e SQL esplicito nei repository. `Homework-1` è solo la sorgente dei dati e non viene modificato.

## Prerequisiti

- Python 3.12 (il target della consegna); PostgreSQL locale; nessun IDE o collegamento CDN.
- Un database e un utente PostgreSQL, ad esempio `quizzing` / `quizzing`.

## Prima installazione da terminale

Eseguire questa procedura soltanto su una copia nuova del progetto o quando si
vuole intenzionalmente ricreare il database. PostgreSQL deve essere già avviato:
la consegna non richiede né usa un IDE.

1. Creare e attivare il virtual environment: `python3.12 -m venv .venv` e `source .venv/bin/activate`.
2. Installare le dipendenze: `pip install -r requirements.txt`.
3. Copiare `.env.example` in `.env` ed esportare le variabili PostgreSQL nell’ambiente della shell.
4. Creare lo schema applicativo: `psql "$DATABASE_URL" -f database/schema.sql`.
5. Creare le tabelle Django: `python manage.py migrate`.
6. Caricare dati rapidi: `python database/seed.py --profile quick --reference-date 2026-07-22`, oppure importare un dump MySQL validato: `python database/import_mysql_dump.py /percorso/quiz_mysql_expanded.sql`.
7. Avviare: `python manage.py runserver` e aprire `http://127.0.0.1:8000/`.

`database/schema.sql` contiene i `DROP TABLE`: non eseguirlo per l'avvio
ordinario, perché ricrea le tabelle applicative e cancella i dati.

## Avvio ordinario dopo un riavvio

Il database PostgreSQL conserva dati e tabelle sul disco. Dopo un riavvio del
computer occorre solo verificare che il servizio PostgreSQL sia avviato, poi
eseguire dalla cartella `Homework-2`:

```bash
./scripts/run-local.sh
```

Lo script usa `.venv` e, se presente, carica `.env`; esegue `manage.py check`
e una verifica non mutante di connessione/migrazioni, quindi avvia Django su
`http://127.0.0.1:8000/`. Non installa pacchetti, non applica `migrate`, non
crea tabelle e non importa dati. Interrompere con `Ctrl+C`.

Per cambiare indirizzo o porta, senza cambiare file:

```bash
QUIZZING_HOST=0.0.0.0 QUIZZING_PORT=8001 ./scripts/run-local.sh
```

Se compare un errore di connessione al database, avviare PostgreSQL con il
gestore del sistema operativo o con il comando previsto dalla sua installazione,
poi ripetere lo script. Non lanciare `schema.sql` o l'import del dump come
tentativo di risolvere un errore di connessione.

Usare `--profile load` per 30.000 partecipazioni, destinato a test di paginazione e query. Il seed è riproducibile con `--seed`.

## Controlli

`python manage.py check` esegue i controlli Django; `python manage.py test tests` esegue i test senza database. Il test integrato richiede PostgreSQL configurato e lo schema caricato.

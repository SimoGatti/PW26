# QUIZZING 2

Ristrutturazione server-side del Progetto 1 basata su Python 3.12 o successivo, Django
Templates, PostgreSQL, SQL esplicito e Bootstrap locale.

`Homework-1` resta soltanto un riferimento funzionale: QUIZZING 2 include nel
proprio albero sia lo schema sia il dataset iniziale e non dipende da file del
primo progetto.

## Avvio rapido

PostgreSQL deve essere installato e il relativo servizio deve essere attivo.
Poi, dalla cartella `Homework-2`, usare un solo comando.

macOS/Linux:

```bash
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

Windows PowerShell (consigliato):

```powershell
.\scripts\run-local.ps1
```

Se l'esecuzione degli script è bloccata:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-local.ps1
```

Windows CMD:

```cmd
scripts\run-local.cmd
```

Al termine l'applicazione è disponibile su:

```text
http://127.0.0.1:8000/
```

Interrompere Django con `Ctrl+C`.

## Guida utente

La barra di navigazione contiene quattro aree:

- **Home** riassume lo scopo dell'applicazione e mostra i dati principali;
- **Utenti** permette di cercare i profili e aprirne il dettaglio;
- **Quiz** permette di esplorare quiz futuri, aperti e chiusi;
- **Partecipazioni** mostra i tentativi conclusi e il relativo punteggio.

Nelle pagine di ricerca i filtri aggiornano i risultati durante la
digitazione. **Pulisci filtri** ripristina l'elenco completo. Un click sul nome
di una colonna ordina i dati; la freccia evidenziata mostra se l'ordine è
crescente o decrescente. Le viste **Compatta** ed **Estesa** cambiano soltanto
la quantità di informazioni mostrate. Sopra e sotto la tabella si può cambiare
pagina oppure digitare direttamente il numero desiderato.

Per svolgere un quiz:

1. aprire **Quiz** e scegliere un quiz con stato **Aperto**;
2. premere **Partecipa** e cercare l'utente con username, nome o cognome;
3. rispondere a ogni domanda: i cerchi indicano una sola risposta possibile,
   i quadrati consentono più selezioni;
4. premere **Invia risposte** per salvare definitivamente il tentativo;
5. usare **Abbandona quiz** per uscire senza salvare, confermando nella
   finestra interna all'applicazione.

Dal dettaglio di un utente si raggiungono i quiz creati e le partecipazioni
effettuate. Le icone in alto consentono di modificare o eliminare l'utente.
Prima dell'eliminazione viene mostrato un riepilogo; l'operazione è bloccata se
esistono partecipazioni ai quiz creati da quel profilo.

## Prerequisiti

- Python **3.12 o successivo** disponibile come `python3.12`, `python3`,
  `python` oppure, su Windows, tramite `py -3.12` o `py -3`;
- PostgreSQL locale già installato e avviato;
- accesso amministrativo a PostgreSQL soltanto durante l'eventuale prima
  inizializzazione;
- nessun IDE, Node.js, server web esterno o collegamento CDN.

Gli script creano `.venv` e installano automaticamente le dipendenze elencate
in `requirements.txt`.

## Cosa fanno gli entrypoint

I tre entrypoint usano la stessa logica centrale:

```text
scripts/bootstrap-local.py
```

Il flusso è:

1. verificare la presenza di Python 3.12 o successivo e `requirements.txt`;
2. creare `.venv` quando manca;
3. installare o allineare le dipendenze con `pip`;
4. creare o completare `.env`;
5. provare la connessione applicativa;
6. controllare ruolo, database, schema, indici, migrazioni e dati;
7. mostrare le sole operazioni mancanti;
8. chiedere conferma prima di modificare PostgreSQL;
9. eseguire soltanto operazioni additive;
10. avviare Django.

Agli avvii successivi, quando tutto è già pronto, nessuna conferma è richiesta
e nessun dato viene modificato.

## Garanzie di sicurezza

Gli entrypoint ordinari non eseguono mai:

- `DROP`;
- `TRUNCATE`;
- `DELETE`;
- sostituzione o reimportazione di dati esistenti;
- ricreazione di un database esistente;
- importazione o seed su tabelle che contengono anche una sola riga.

Se trova uno schema esistente incompatibile, il bootstrap si ferma e descrive
le colonne mancanti. Non tenta una riparazione che possa compromettere i dati.

Le modifiche consentite, sempre mostrate prima e confermate dall'utente, sono:

- creazione del ruolo applicativo se assente;
- creazione del database se assente;
- concessione dei privilegi necessari al ruolo applicativo;
- creazione di tabelle e indici mancanti;
- applicazione delle migrazioni Django mancanti;
- importazione del dataset completo incluso nel progetto soltanto quando tutte
  le tabelle applicative sono vuote.

L'importazione può essere rifiutata: l'applicazione può essere avviata con
tabelle vuote. Se si rifiuta invece un'operazione essenziale, l'avvio si
interrompe per evitare un'applicazione parzialmente inizializzata.

## Configurazione `.env`

Il file locale è:

```text
Homework-2/.env
```

È escluso da Git. Se manca, il bootstrap lo crea; se esiste, conserva tutti i
valori non vuoti e aggiunge o completa soltanto le variabili richieste.

Valori predefiniti:

```dotenv
POSTGRES_DB=quizzing
POSTGRES_USER=quizzing_app
POSTGRES_PASSWORD=<generata casualmente sul dispositivo>
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

Nome del database e ruolo applicativo sono uniformi. La password è invece
diversa su ogni computer e non viene versionata.

Variabili facoltative:

```dotenv
DJANGO_SECRET_KEY=replace-me-with-a-random-value
DJANGO_DEBUG=true
QUIZZING_HOST=127.0.0.1
QUIZZING_PORT=8000
```

Un `.env` esistente che usa credenziali funzionanti differenti, per esempio un
ruolo locale macOS e il socket `/tmp`, non viene sovrascritto:

```dotenv
POSTGRES_DB=quizzing
POSTGRES_USER=gatti
POSTGRES_PASSWORD=
POSTGRES_HOST=/tmp
POSTGRES_PORT=5432
```

## Prima inizializzazione PostgreSQL

Se `quizzing_app` o `quizzing` non esistono, il bootstrap chiede credenziali
amministrative temporanee.

Su macOS/Homebrew i valori proposti sono normalmente:

```text
ruolo amministrativo: nome dell'utente macOS
host amministrativo:  /tmp
database:              postgres
```

Su Windows sono normalmente:

```text
ruolo amministrativo: postgres
host amministrativo:  127.0.0.1
database:              postgres
```

La password amministrativa è letta con input nascosto, usata soltanto dal
processo corrente e non salvata nel `.env`. Prima di procedere viene mostrato
un riepilogo simile a:

```text
Operazioni PostgreSQL proposte:
  - creare il ruolo applicativo 'quizzing_app'
  - creare il database 'quizzing'

Procedere con queste operazioni additive? [s/N]
```

Il ruolo `quizzing_app` non è superutente e non riceve il permesso di creare
altri ruoli o database.

## Schema SQL

Sono presenti tre file con scopi distinti:

```text
database/init_schema.sql
database/schema.sql
database/reset_schema.sql
```

`init_schema.sql` è quello usato dal bootstrap. Contiene soltanto
`CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.

`schema.sql` è mantenuto come alias di compatibilità non distruttivo, così
vecchie istruzioni che lo citano non cancellano dati.

`reset_schema.sql` contiene i `DROP TABLE`, non è richiamato da alcun
entrypoint e richiede di digitare una frase esplicita. Va usato soltanto quando
si desidera intenzionalmente eliminare tutti i dati applicativi:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -f database/reset_schema.sql
```

Il reset non elimina le tabelle interne di Django.

## Dataset iniziale sicuro

La fonte dati ufficiale è inclusa in:

```text
database/data/quiz_mysql_expanded.sql
```

Contiene:

```text
2500 utenti
516 quiz
10000 domande
40000 risposte
10000 partecipazioni
193788 risposte degli utenti
```

Il bootstrap usa `database/import_mysql_dump.py` per leggere esclusivamente gli
`INSERT` del dump. Le istruzioni MySQL `DROP TABLE` e `CREATE TABLE` presenti
nel file non vengono eseguite.

L'importatore aggiunge inoltre quiz aperti e futuri con date relative al giorno
di installazione, senza modificare i quiz storici del dump. Ogni quiz demo
aperto include anche una domanda con due risposte corrette, così il flusso
esercita realmente sia i radio button sia le checkbox.

L'importazione viene proposta soltanto se tutte e sei le tabelle applicative
sono vuote. Anche l'esecuzione manuale è protetta:

```bash
python database/import_mysql_dump.py \
  database/data/quiz_mysql_expanded.sql
```

Se esiste qualunque dato, l'importatore termina prima di inserire righe e
mostra i conteggi rilevati. L'intera importazione usa una transazione: un errore
intermedio annulla tutti gli inserimenti di quel tentativo.

Per validare il dump senza collegarsi a PostgreSQL:

```bash
python database/import_mysql_dump.py \
  database/data/quiz_mysql_expanded.sql \
  --dry-run
```

`database/seed.py` resta disponibile come generatore sintetico alternativo per
test specifici, ma non è più usato automaticamente dagli entrypoint. Anche
questo comando rifiuta di lavorare su tabelle non vuote:

```bash
python database/seed.py --profile quick --seed 42
```

## Opzioni degli entrypoint

Le opzioni aggiuntive vengono inoltrate a `bootstrap-local.py`.

Saltare la proposta di importazione:

```bash
./scripts/run-local.sh --no-data
```

`--no-seed` rimane accettato come alias per compatibilità con le versioni
precedenti degli script.

Confermare automaticamente le sole operazioni additive:

```bash
./scripts/run-local.sh --yes
```

Usare `--yes` soltanto dopo aver letto questo README. Non abilita reset o
cancellazioni.

Diagnosi senza modificare PostgreSQL e senza avviare Django:

```bash
.venv/bin/python scripts/bootstrap-local.py --check-only
```

Su Windows:

```powershell
.\.venv\Scripts\python.exe scripts\bootstrap-local.py --check-only
```

Cambiare indirizzo o porta del server:

```bash
QUIZZING_HOST=0.0.0.0 QUIZZING_PORT=8001 ./scripts/run-local.sh
```

PowerShell:

```powershell
$env:QUIZZING_HOST = "0.0.0.0"
$env:QUIZZING_PORT = "8001"
.\scripts\run-local.ps1
```

CMD:

```cmd
set QUIZZING_HOST=0.0.0.0
set QUIZZING_PORT=8001
scripts\run-local.cmd
```

## Avvio di PostgreSQL

macOS con Homebrew:

```bash
brew services start postgresql@16
pg_isready
```

Su Windows, avviare il servizio PostgreSQL da Gestione servizi oppure con il
comando previsto dall'installazione.

Se PostgreSQL non è raggiungibile, il bootstrap mostra sia l'errore della
connessione applicativa sia quello dell'eventuale connessione amministrativa.
Non eseguire reset, seed o import per risolvere un errore di connessione.

## Errori comuni

`fe_sendauth: no password supplied`

: La connessione TCP richiede una password. Verificare
  `POSTGRES_PASSWORD` in `.env`.

`role "..." does not exist`

: Il bootstrap propone la creazione del ruolo dedicato. Servono credenziali
  amministrative PostgreSQL.

`database "..." does not exist`

: Il bootstrap propone la creazione del database, senza toccare gli altri
  database.

`connection refused`

: PostgreSQL è spento oppure host/porta non sono corretti.

`schema esistente incompatibile`

: Alcune tabelle esistono ma non hanno le colonne attese. Il bootstrap si
  arresta senza modificare dati; serve una migrazione progettata per quello
  specifico stato.

`Importazione annullata: sono presenti dati applicativi`

: È il comportamento previsto. I dati esistenti sono stati preservati.

## Controlli manuali

Controlli Django:

```bash
python manage.py check
```

Test senza database:

```bash
python manage.py test tests
```

Controllo completo non mutante:

```bash
python scripts/bootstrap-local.py --check-only
```

## Nota per la consegna

Gli entrypoint sono pensati per l'installazione e la verifica da terminale.
Prima della consegna va eseguita una prova cronometrata su un computer pulito,
verificando separatamente macOS/Linux e Windows. Il server `runserver` è
destinato alla verifica locale, non a un deployment di produzione.

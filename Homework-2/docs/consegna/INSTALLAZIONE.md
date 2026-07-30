# QUIZZING

## Installazione e avvio

## 1. Cosa viene installato

La procedura prepara:

- un ambiente virtuale Python nella cartella `.venv`;
- Django e il driver PostgreSQL indicati in `requirements.txt`;
- le tabelle interne Django;
- il ruolo e il database PostgreSQL, soltanto se mancanti;
- lo schema QUIZZING, soltanto se mancante;
- il dataset incluso, soltanto se tutte le tabelle applicative sono vuote.

Il bootstrap non esegue `DROP`, `TRUNCATE` o `DELETE`. Il bootstrap non
sostituisce dati esistenti.

## 2. Prerequisiti

Preparare:

1. Python 3.12 o successivo;
2. PostgreSQL installato e avviato;
3. un terminale;
4. la cartella completa `Homework-2`;
5. accesso a PyPI per il primo avvio, se Django e psycopg non sono già nella
   cache di `pip`;
6. credenziali amministrative PostgreSQL, soltanto se ruolo o database devono
   essere creati.


Verificare Python:

```bash
python3 --version
```

oppure

```bash
python --version
```

Su Windows usare anche:

```cmd
py -3.12 --version
```

Verificare PostgreSQL:

```bash
pg_isready
```

## 3. Avvio su macOS o Linux

1. Aprire il terminale.
2. Entrare nella cartella `Homework-2`.
3. Rendere eseguibile lo script.
4. Avviare la procedura.

```bash
cd /percorso/del/progetto/Homework-2
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

## 4. Avvio su Windows PowerShell

1. Aprire PowerShell.
2. Entrare nella cartella `Homework-2`.
3. Avviare la procedura.

```powershell
cd C:\percorso\del\progetto\Homework-2
.\scripts\run-local.ps1
```

Se PowerShell blocca lo script, applicare la deroga al solo processo corrente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\run-local.ps1
```

## 5. Avvio su Windows CMD

1. Aprire il Prompt dei comandi.
2. Entrare nella cartella `Homework-2`.
3. Avviare la procedura.

```cmd
cd C:\percorso\del\progetto\Homework-2
scripts\run-local.cmd
```

## 6. Prima configurazione

Leggere l'elenco delle operazioni proposte. Confermare soltanto dopo la
verifica.

Se il ruolo o il database mancano, inserire:

- ruolo amministrativo PostgreSQL;
- host amministrativo;
- database amministrativo;
- password amministrativa.

La password amministrativa resta nel processo corrente e non viene salvata.
Su macOS con Homebrew usare normalmente il nome dell'utente macOS, host
`/tmp` e database `postgres`. Su Windows usare normalmente ruolo `postgres`,
host `127.0.0.1` e database `postgres`.

Al termine aprire:

```text
http://127.0.0.1:8000/
```

Premere `Ctrl+C` nel terminale per arrestare Django.

## 7. Configurazione

Il bootstrap crea o completa `.env` senza sovrascrivere valori non vuoti.

Valori principali:

```dotenv
POSTGRES_DB=quizzing
POSTGRES_USER=quizzing_app
POSTGRES_PASSWORD=<password locale>
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

Valori facoltativi:

```dotenv
DJANGO_SECRET_KEY=<chiave locale>
DJANGO_DEBUG=true
QUIZZING_HOST=127.0.0.1
QUIZZING_PORT=8000
```

Per cambiare porta:

```bash
QUIZZING_PORT=8001 ./scripts/run-local.sh
```

PowerShell:

```powershell
$env:QUIZZING_PORT = "8001"
.\scripts\run-local.ps1
```

## 8. Controllo senza modifiche

Eseguire la diagnosi senza avviare Django:

```bash
.venv/bin/python scripts/bootstrap-local.py --check-only
```

Su Windows:

```powershell
.\.venv\Scripts\python.exe scripts\bootstrap-local.py --check-only
```

## 9. Reset completo e ricaricamento del dataset

Il bootstrap non offre un flag per sovrascrivere i dati esistenti. Anche
`--yes` conferma soltanto operazioni additive. Per ripartire dal dataset
incluso bisogna prima eseguire intenzionalmente `database/reset_schema.sql`.

Questa procedura elimina definitivamente utenti, quiz, domande, risposte e
partecipazioni. Le tabelle interne di Django vengono conservate. Arrestare
prima il server con `Ctrl+C` e usare il reset soltanto se i dati applicativi
non devono essere recuperati.

### macOS o Linux

Dalla cartella `Homework-2`, caricare la configurazione locale:

```bash
set -a
source .env
set +a
```

Eseguire quindi il reset:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -f database/reset_schema.sql
```

### Windows PowerShell

Dalla cartella `Homework-2`, caricare `.env` nel processo corrente:

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable(
            $matches[1].Trim(),
            $matches[2],
            "Process"
        )
    }
}
```

Eseguire quindi il reset:

```powershell
$env:PGPASSWORD = $env:POSTGRES_PASSWORD
psql `
  -h $env:POSTGRES_HOST `
  -p $env:POSTGRES_PORT `
  -U $env:POSTGRES_USER `
  -d $env:POSTGRES_DB `
  -f database/reset_schema.sql
Remove-Item Env:PGPASSWORD
```

### Windows CMD

Dalla cartella `Homework-2`, caricare `.env` nel processo corrente:

```cmd
for /f "usebackq eol=# tokens=1,* delims==" %A in (".env") do @set "%A=%B"
```

Eseguire quindi il reset:

```cmd
set "PGPASSWORD=%POSTGRES_PASSWORD%"
psql ^
  -h "%POSTGRES_HOST%" ^
  -p "%POSTGRES_PORT%" ^
  -U "%POSTGRES_USER%" ^
  -d "%POSTGRES_DB%" ^
  -f database/reset_schema.sql
set "PGPASSWORD="
```

Su tutti i sistemi, lo script chiede di digitare esattamente:

```text
RESET QUIZZING
```

Una conferma diversa interrompe il reset senza cancellare dati. Dopo un reset
completato, ricaricare il dataset e avviare QUIZZING.

macOS o Linux:

```bash
./scripts/run-local.sh --yes
```

Windows PowerShell:

```powershell
.\scripts\run-local.ps1 --yes
```

Windows CMD:

```cmd
scripts\run-local.cmd --yes
```

## 10. Risoluzione dei problemi

### `connection refused`

Avviare PostgreSQL. Controllare host e porta nel file `.env`. Ripetere
`pg_isready`.

### `fe_sendauth: no password supplied`

Inserire la password corretta in `POSTGRES_PASSWORD`. Controllare il metodo di
autenticazione configurato in PostgreSQL.

### `role "..." does not exist`

Ripetere il bootstrap e fornire credenziali amministrative. In alternativa,
correggere `POSTGRES_USER` con un ruolo esistente.

### `database "..." does not exist`

Ripetere il bootstrap e autorizzare la creazione additiva del database.

### `schema esistente incompatibile`

Non eseguire reset. Leggere l'elenco delle colonne mancanti. Preparare una
migrazione specifica oppure usare un database vuoto dedicato.

### `Importazione annullata: sono presenti dati applicativi`

Non intervenire: il controllo protegge dati esistenti. Usare il database già
popolato oppure configurare un database vuoto.

### Errore durante `pip install`

Controllare la connessione a PyPI. Ripetere il comando. Se la macchina non ha
accesso alla rete, preparare in anticipo la cache `pip` compatibile con sistema
operativo e Python 3.12.

### Porta 8000 occupata

Impostare `QUIZZING_PORT=8001` e ripetere l'avvio.

@echo off
rem Avvia QUIZZING 2 usando esclusivamente l'ambiente virtuale locale esistente.
rem Non crea, non migra e non reimporta il database.
rem Queste operazioni appartengono soltanto alla prima installazione documentata
rem nel README.

setlocal EnableExtensions DisableDelayedExpansion

rem Lo script si trova in Homework-2\scripts.
rem La cartella del progetto è quindi la cartella superiore.
for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"

set "PYTHON=%PROJECT_DIR%\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
    echo Ambiente virtuale non trovato: %PROJECT_DIR%\.venv 1>&2
    echo Esegui una sola volta i passi di prima installazione nel README. 1>&2
    exit /b 1
)

rem .env non viene versionato.
rem Sono supportate righe nel formato NOME=valore.
rem Le righe vuote e quelle che iniziano con # vengono ignorate.
if exist "%PROJECT_DIR%\.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%PROJECT_DIR%\.env") do (
        set "%%A=%%B"
    )
)

pushd "%PROJECT_DIR%" || (
    echo Impossibile accedere alla cartella del progetto. 1>&2
    exit /b 1
)

"%PYTHON%" manage.py check
if errorlevel 1 (
    popd
    exit /b 1
)

rem --check verifica la connessione e la presenza delle migrazioni previste,
rem ma non applica e non modifica alcuna migrazione.
"%PYTHON%" manage.py migrate --check >nul 2>&1
if errorlevel 1 (
    echo Impossibile usare il database configurato. 1>&2
    echo Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, 1>&2
    echo POSTGRES_HOST e POSTGRES_PORT nel file .env. 1>&2
    echo. 1>&2
    echo Se PostgreSQL non e' avviato, avvialo. 1>&2
    echo Se si tratta della prima installazione, segui il README. 1>&2
    popd
    exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=8000"

if defined QUIZZING_HOST set "HOST=%QUIZZING_HOST%"
if defined QUIZZING_PORT set "PORT=%QUIZZING_PORT%"

echo Avvio QUIZZING 2 su http://%HOST%:%PORT%/
echo Interrompi il server con Ctrl+C.
echo Il database non viene modificato all'avvio.

"%PYTHON%" manage.py runserver "%HOST%:%PORT%"
set "EXIT_CODE=%ERRORLEVEL%"

popd
exit /b %EXIT_CODE%
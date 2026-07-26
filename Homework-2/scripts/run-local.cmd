@echo off

rem Avvia QUIZZING 2 usando l'ambiente virtuale locale.
rem
rem Se .venv non esiste:
rem - lo crea;
rem - installa le dipendenze da requirements.txt.
rem
rem Se .venv esiste:
rem - verifica/allinea le dipendenze tramite requirements.txt.
rem
rem Non crea, non migra e non reimporta il database.

setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"

set "VENV_DIR=%PROJECT_DIR%\.venv"
set "REQUIREMENTS=%PROJECT_DIR%\requirements.txt"
set "PYTHON=%VENV_DIR%\Scripts\python.exe"
set "ACTIVATE=%VENV_DIR%\Scripts\activate.bat"

if not exist "%REQUIREMENTS%" (
    echo File requirements.txt non trovato: %REQUIREMENTS% 1>&2
    exit /b 1
)

if not exist "%PYTHON%" (
    echo Ambiente virtuale non trovato.
    echo Creazione di: %VENV_DIR%

    call :find_python
    if errorlevel 1 (
        echo Python 3.12 o successivo non trovato. 1>&2
        echo Installa Python 3.12 e assicurati che py.exe o python.exe 1>&2
        echo siano disponibili nel PATH. 1>&2
        exit /b 1
    )

    echo Interprete selezionato: %SYSTEM_PYTHON_DESCRIPTION%

    call %SYSTEM_PYTHON_COMMAND% -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Creazione dell'ambiente virtuale non riuscita. 1>&2
        exit /b 1
    )
)

if not exist "%ACTIVATE%" (
    echo Script di attivazione non trovato: %ACTIVATE% 1>&2
    exit /b 1
)

rem Attiva il virtual environment nel processo batch corrente.
call "%ACTIVATE%"
if errorlevel 1 (
    echo Attivazione dell'ambiente virtuale non riuscita. 1>&2
    exit /b 1
)

echo Ambiente virtuale attivo: %VIRTUAL_ENV%
"%PYTHON%" --version

echo Verifica delle dipendenze da requirements.txt...
"%PYTHON%" -m pip install --disable-pip-version-check -r "%REQUIREMENTS%"
if errorlevel 1 (
    echo Installazione delle dipendenze non riuscita. 1>&2
    exit /b 1
)

rem Carica il file .env.
rem Formato supportato: NOME=valore.
rem Le righe vuote e quelle che iniziano con # vengono ignorate.
if exist "%PROJECT_DIR%\.env" (
    echo Caricamento configurazione da .env

    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%PROJECT_DIR%\.env") do (
        if not "%%A"=="" set "%%A=%%B"
    )
)

pushd "%PROJECT_DIR%"
if errorlevel 1 (
    echo Impossibile accedere alla cartella del progetto. 1>&2
    exit /b 1
)

echo Controllo configurazione Django...
"%PYTHON%" manage.py check
if errorlevel 1 (
    popd
    exit /b 1
)

rem Verifica connessione e migrazioni senza applicarle.
"%PYTHON%" manage.py migrate --check >nul 2>&1
if errorlevel 1 (
    echo Impossibile usare il database configurato. 1>&2
    echo Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, 1>&2
    echo POSTGRES_HOST e POSTGRES_PORT nel file .env. 1>&2
    echo. 1>&2
    echo Lo script non applica migrazioni e non modifica il database. 1>&2
    echo Per una prima installazione, segui il README. 1>&2

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


:find_python

rem Prima scelta: Python Launcher con Python 3.12.
py -3.12 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,12) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON_COMMAND=py -3.12"
    set "SYSTEM_PYTHON_DESCRIPTION=py -3.12"
    exit /b 0
)

rem Seconda scelta: Python Launcher con il Python 3 predefinito.
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,12) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON_COMMAND=py -3"
    set "SYSTEM_PYTHON_DESCRIPTION=py -3"
    exit /b 0
)

rem Ultima scelta: python.exe nel PATH.
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,12) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON_COMMAND=python"
    set "SYSTEM_PYTHON_DESCRIPTION=python"
    exit /b 0
)

exit /b 1
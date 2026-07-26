@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Entrypoint Windows CMD di QUIZZING 2.
rem Prepara Python e delega ogni controllo PostgreSQL al bootstrap comune.

for %%I in ("%~dp0..") do set "PROJECT_DIR=%%~fI"
set "VENV_DIR=%PROJECT_DIR%\.venv"
set "PYTHON=%VENV_DIR%\Scripts\python.exe"
set "REQUIREMENTS=%PROJECT_DIR%\requirements.txt"
set "BOOTSTRAP=%PROJECT_DIR%\scripts\bootstrap-local.py"

if not exist "%REQUIREMENTS%" (
    echo ERRORE: requirements.txt non trovato: %REQUIREMENTS% 1>&2
    exit /b 1
)

if not exist "%PYTHON%" (
    call :find_python
    if errorlevel 1 (
        echo ERRORE: Python 3.12 o successivo non trovato. 1>&2
        echo Installarlo e rendere disponibile py.exe o python.exe nel PATH. 1>&2
        exit /b 1
    )
    echo.
    echo ==^> Creazione dell'ambiente virtuale
    call %SYSTEM_PYTHON% -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo ERRORE: creazione di .venv non riuscita. 1>&2
        exit /b 1
    )
)

call :run_checked "Verifica di Python 3.12 o successivo" "%PYTHON%" -c "import sys; print(sys.version); raise SystemExit(sys.version_info < (3, 12))"
if errorlevel 1 exit /b %ERRORLEVEL%

call :run_checked "Installazione o allineamento delle dipendenze" "%PYTHON%" -m pip install --disable-pip-version-check -r "%REQUIREMENTS%"
if errorlevel 1 exit /b %ERRORLEVEL%

"%PYTHON%" "%BOOTSTRAP%" --runserver %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo. 1>&2
    echo ERRORE: avvio di QUIZZING 2 interrotto con codice %EXIT_CODE%. 1>&2
)
exit /b %EXIT_CODE%

:run_checked
set "STEP=%~1"
shift
echo.
echo ==^> %STEP%
%*
set "STEP_CODE=%ERRORLEVEL%"
if not "%STEP_CODE%"=="0" (
    echo ERRORE: %STEP% non riuscita con codice %STEP_CODE%. 1>&2
    exit /b %STEP_CODE%
)
exit /b 0

:find_python
py -3.12 -c "import sys; raise SystemExit(sys.version_info < (3, 12))" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON=py -3.12"
    exit /b 0
)
py -3 -c "import sys; raise SystemExit(sys.version_info < (3, 12))" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON=py -3"
    exit /b 0
)
python -c "import sys; raise SystemExit(sys.version_info < (3, 12))" >nul 2>&1
if not errorlevel 1 (
    set "SYSTEM_PYTHON=python"
    exit /b 0
)
exit /b 1

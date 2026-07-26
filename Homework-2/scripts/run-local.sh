#!/usr/bin/env bash

# Avvia QUIZZING 2 usando l'ambiente virtuale locale.
#
# Se .venv non esiste:
# - lo crea;
# - installa le dipendenze da requirements.txt.
#
# Se .venv esiste:
# - verifica/allinea le dipendenze tramite requirements.txt.
#
# Non crea, non migra e non reimporta il database.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VENV_DIR="$PROJECT_DIR/.venv"
REQUIREMENTS="$PROJECT_DIR/requirements.txt"

find_system_python() {
    local candidate

    for candidate in python3.12 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            if "$candidate" -c '
import sys
raise SystemExit(0 if sys.version_info >= (3, 12) else 1)
' >/dev/null 2>&1; then
                command -v "$candidate"
                return 0
            fi
        fi
    done

    return 1
}

if [[ ! -f "$REQUIREMENTS" ]]; then
    echo "File requirements.txt non trovato: $REQUIREMENTS" >&2
    exit 1
fi

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    echo "Ambiente virtuale non trovato. Creazione di: $VENV_DIR"

    SYSTEM_PYTHON="$(find_system_python || true)"

    if [[ -z "$SYSTEM_PYTHON" ]]; then
        echo "Python 3.12 o successivo non trovato." >&2
        echo "Su macOS puoi installarlo con:" >&2
        echo "  brew install python@3.12" >&2
        exit 1
    fi

    echo "Interprete selezionato: $SYSTEM_PYTHON"
    "$SYSTEM_PYTHON" -m venv "$VENV_DIR"
fi

# Attiva il virtual environment per questo processo.
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

PYTHON="$VENV_DIR/bin/python"

echo "Ambiente virtuale attivo: $VIRTUAL_ENV"
echo "Python: $("$PYTHON" --version)"

echo "Verifica delle dipendenze da requirements.txt..."
"$PYTHON" -m pip install --disable-pip-version-check -r "$REQUIREMENTS"

# .env non viene versionato. Se presente, le variabili vengono esportate
# soltanto nel processo corrente e nei suoi processi figli.
if [[ -f "$PROJECT_DIR/.env" ]]; then
    echo "Caricamento configurazione da .env"

    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
fi

cd "$PROJECT_DIR"

echo "Controllo configurazione Django..."
"$PYTHON" manage.py check

# Verifica connessione e stato delle migrazioni senza applicarle.
if ! "$PYTHON" manage.py migrate --check >/dev/null 2>&1; then
    echo "Impossibile usare il database configurato." >&2
    echo "Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD," >&2
    echo "POSTGRES_HOST e POSTGRES_PORT nel file .env." >&2
    echo >&2
    echo "Lo script non applica migrazioni e non modifica il database." >&2
    echo "Per una prima installazione, segui il README." >&2
    exit 1
fi

HOST="${QUIZZING_HOST:-127.0.0.1}"
PORT="${QUIZZING_PORT:-8000}"

echo "Avvio QUIZZING 2 su http://$HOST:$PORT/"
echo "Interrompi il server con Ctrl+C."
echo "Il database non viene modificato all'avvio."

exec "$PYTHON" manage.py runserver "$HOST:$PORT"
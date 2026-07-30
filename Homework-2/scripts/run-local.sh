#!/usr/bin/env bash

# Entrypoint macOS/Linux di QUIZZING.
# Prepara Python e delega ogni controllo PostgreSQL al bootstrap comune.

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"
REQUIREMENTS="$PROJECT_DIR/requirements.txt"

die() {
    printf '\nERRORE: %s\n' "$1" >&2
    exit "${2:-1}"
}

run_checked() {
    local step="$1"
    shift
    printf '\n==> %s\n    ' "$step"
    printf '%q ' "$@"
    printf '\n'
    "$@" || die "$step non riuscita (codice $?)."
}

find_supported_python() {
    local candidate
    for candidate in python3.12 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1 &&
           "$candidate" -c \
             'import sys; raise SystemExit(sys.version_info < (3, 12))' \
             >/dev/null 2>&1; then
            command -v "$candidate"
            return 0
        fi
    done
    return 1
}

[[ -f "$REQUIREMENTS" ]] ||
    die "requirements.txt non trovato: $REQUIREMENTS"

if [[ ! -x "$PYTHON" ]]; then
    SYSTEM_PYTHON="$(find_supported_python || true)"
    [[ -n "$SYSTEM_PYTHON" ]] ||
        die "Python 3.12 o successivo non trovato. Su macOS: brew install python"
    run_checked \
        "Creazione dell'ambiente virtuale" \
        "$SYSTEM_PYTHON" -m venv "$VENV_DIR"
fi

run_checked \
    "Verifica di Python 3.12 o successivo" \
    "$PYTHON" -c \
    'import sys; print(sys.version); raise SystemExit(sys.version_info < (3, 12))'
run_checked \
    "Installazione o allineamento delle dipendenze" \
    "$PYTHON" -m pip install --disable-pip-version-check -r "$REQUIREMENTS"

exec "$PYTHON" "$PROJECT_DIR/scripts/bootstrap-local.py" --runserver "$@"

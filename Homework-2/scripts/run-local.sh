#!/usr/bin/env bash
# Avvia QUIZZING 2 usando esclusivamente l'ambiente virtuale locale esistente.
# Non crea, non migra e non reimporta il database: queste operazioni appartengono
# soltanto alla procedura di prima installazione documentata nel README.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="$PROJECT_DIR/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Ambiente virtuale non trovato: $PROJECT_DIR/.venv" >&2
  echo "Esegui una sola volta i passi di prima installazione nel README." >&2
  exit 1
fi

# .env non viene versionato. Se presente, rende disponibili le variabili
# PostgreSQL solo al processo avviato da questo script.
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

cd "$PROJECT_DIR"
"$PYTHON" manage.py check

# --check verifica sia la connessione sia che le tabelle Django previste dalle
# migrazioni esistano, ma non applica né modifica alcuna migrazione.
if ! "$PYTHON" manage.py migrate --check >/dev/null 2>&1; then
  echo "Impossibile usare il database configurato." >&2
  echo "Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST e POSTGRES_PORT in .env." >&2
  echo "Se PostgreSQL non è avviato, avvialo; se è una prima installazione, segui il README." >&2
  exit 1
fi

HOST="${QUIZZING_HOST:-127.0.0.1}"
PORT="${QUIZZING_PORT:-8000}"
echo "Avvio QUIZZING 2 su http://$HOST:$PORT/"
echo "Interrompi il server con Ctrl+C. Il database non viene modificato all'avvio."
exec "$PYTHON" manage.py runserver "$HOST:$PORT"

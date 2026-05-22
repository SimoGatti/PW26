// =========================================================================
// CONFIGURAZIONE FRONTEND
// =========================================================================
// Un solo parametro da cambiare:
//   - Stringa non vuota → chiama l'api.php su quel server remoto (es. AlterVista)
//   - Stringa vuota ''  → chiama api.php in locale tramite PHP built-in server
//
// Per sviluppo locale con DB AlterVista:
//   1. Carica api.php e .env su AlterVista
//   2. Imposta remoteApiUrl con il tuo indirizzo AlterVista
//   3. Avvia Live Server normalmente
//
// Per sviluppo completamente locale (con 'php -S localhost:8000 -t Homework-1'):
//   1. Imposta remoteApiUrl: ''
//   2. Configura .env con USE_ALTERVISTA_DB=false e credenziali DB locali

const CONFIG = {
    remoteApiUrl: 'https://namenotfound.altervista.org/api.php'
};

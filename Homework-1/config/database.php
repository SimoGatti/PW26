<?php
declare(strict_types=1);

// Abilita CORS per permettere lo sviluppo frontend locale con API remota su AlterVista
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Gestione preflight request per chiamate cross-origin
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// =========================================================================
// CARICATORE FILE D'AMBIENTE (.env)
// Restituisce null se il file non esiste, array altrimenti.
// =========================================================================
function load_env(string $dir): ?array
{
    // Cerca prima in config/, poi in Homework-1/ (directory superiore)
    $candidates = [
        rtrim($dir, '/') . '/.env',
        dirname($dir) . '/.env',
    ];

    $filePath = null;
    foreach ($candidates as $candidate) {
        if (file_exists($candidate)) {
            $filePath = $candidate;
            break;
        }
    }

    if ($filePath === null) {
        return null; // File non trovato
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $config = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Rimuovi virgolette esterne (singole o doppie)
            if (strlen($val) >= 2) {
                $first = $val[0];
                $last  = $val[-1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $val = substr($val, 1, -1);
                }
            }

            $config[$key] = $val;
        }
    }
    return $config;
}

// =========================================================================
// CARICAMENTO E VALIDAZIONE DELLE VARIABILI D'AMBIENTE
// =========================================================================
$env = load_env(__DIR__);

if ($env === null) {
    respond(500, 'error',
        'File .env non trovato. ' .
        'Copia .env.example in .env nella cartella Homework-1 e configura le credenziali.',
        null
    );
}

if (!array_key_exists('USE_ALTERVISTA_DB', $env)) {
    respond(500, 'error',
        'Chiave USE_ALTERVISTA_DB mancante nel file .env. ' .
        'Imposta USE_ALTERVISTA_DB=true (AlterVista) oppure USE_ALTERVISTA_DB=false (locale).',
        null
    );
}

define('USE_ALTERVISTA_DB', filter_var($env['USE_ALTERVISTA_DB'], FILTER_VALIDATE_BOOLEAN));

// Valida le chiavi obbligatorie per la modalità selezionata
if (USE_ALTERVISTA_DB) {
    $requiredKeys = ['DB_ALTERVISTA_HOST', 'DB_ALTERVISTA_NAME', 'DB_ALTERVISTA_USER', 'DB_ALTERVISTA_PASS'];
} else {
    $requiredKeys = ['DB_LOCAL_HOST', 'DB_LOCAL_NAME', 'DB_LOCAL_USER', 'DB_LOCAL_PASS'];
}

$missingKeys = array_filter($requiredKeys, fn($k) => !array_key_exists($k, $env));
if (!empty($missingKeys)) {
    respond(500, 'error',
        'Chiavi mancanti nel file .env per la modalità ' . (USE_ALTERVISTA_DB ? 'ALTERVISTA' : 'LOCAL') . ': ' .
        implode(', ', $missingKeys),
        null
    );
}

// Costruisce le impostazioni di connessione per la modalità attiva
if (USE_ALTERVISTA_DB) {
    $activeDbSettings = [
        'host'     => $env['DB_ALTERVISTA_HOST'],
        'port'     => (int) ($env['DB_ALTERVISTA_PORT'] ?? 3306),
        'dbname'   => $env['DB_ALTERVISTA_NAME'],
        'username' => $env['DB_ALTERVISTA_USER'],
        'password' => $env['DB_ALTERVISTA_PASS'],
        'charset'  => $env['DB_ALTERVISTA_CHARSET'] ?? 'utf8mb4',
    ];
} else {
    $activeDbSettings = [
        'host'     => $env['DB_LOCAL_HOST'],
        'port'     => (int) ($env['DB_LOCAL_PORT'] ?? 3306),
        'dbname'   => $env['DB_LOCAL_NAME'],
        'username' => $env['DB_LOCAL_USER'],
        'password' => $env['DB_LOCAL_PASS'],
        'charset'  => $env['DB_LOCAL_CHARSET'] ?? 'utf8mb4',
    ];
}

// =========================================================================
// GESTORE CONNESSIONE PDO (lancia eccezioni — nessun fallback silenzioso)
// =========================================================================
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $activeDbSettings;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $activeDbSettings['host'],
        $activeDbSettings['port'],
        $activeDbSettings['dbname'],
        $activeDbSettings['charset']
    );

    // Nessun try/catch qui: la PDOException risale al chiamante che gestirà l'errore
    $pdo = new PDO(
        $dsn,
        $activeDbSettings['username'],
        $activeDbSettings['password'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );

    return $pdo;
}

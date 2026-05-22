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
// =========================================================================
function load_env(string $dir): array
{
    $filePath = rtrim($dir, '/') . '/.env';
    if (!file_exists($filePath)) {
        // Cerca anche nella directory superiore (Homework-1/) se lanciato da config/
        $filePath = dirname($dir) . '/.env';
        if (!file_exists($filePath)) {
            return [];
        }
    }

    $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $config = [];
    foreach ($lines as $line) {
        $line = trim($line);
        // Salta i commenti e le righe vuote
        if ($line === '' || strpos($line, '#') === 0 || strpos($line, ';') === 0) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Rimuovi virgolette esterne
            if (
                (strpos($val, '"') === 0 && strrpos($val, '"') === strlen($val) - 1) ||
                (strpos($val, "'") === 0 && strrpos($val, "'") === strlen($val) - 1)
            ) {
                $val = substr($val, 1, -1);
            }

            $config[$key] = $val;
        }
    }
    return $config;
}

// Carica variabili d'ambiente (cerca in config/ o in Homework-1/)
$env = load_env(__DIR__);

// CONFIGURAZIONE CONNESSIONE DATABASE
// =========================================================================
define('USE_ALTERVISTA_DB', isset($env['USE_ALTERVISTA_DB']) ? filter_var($env['USE_ALTERVISTA_DB'], FILTER_VALIDATE_BOOLEAN) : true);

// Impostazioni Database Locale
$databaseSettings = [
    'host' => $env['DB_LOCAL_HOST'],
    'port' => (int) ($env['DB_LOCAL_PORT']),
    'dbname' => $env['DB_LOCAL_NAME'],
    'username' => $env['DB_LOCAL_USER'],
    'password' => $env['DB_LOCAL_PASS'],
    'charset' => $env['DB_LOCAL_CHARSET']
];

// Impostazioni Database AlterVista
$altervistaDatabaseSettings = [
    'host' => $env['DB_ALTERVISTA_HOST'],
    'port' => (int) ($env['DB_ALTERVISTA_PORT']),
    'dbname' => $env['DB_ALTERVISTA_NAME'],
    'username' => $env['DB_ALTERVISTA_USER'],
    'password' => $env['DB_ALTERVISTA_PASS'],
    'charset' => $env['DB_ALTERVISTA_CHARSET']
];

/**
 * Gestore unico della connessione PDO condivisa
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $databaseSettings, $altervistaDatabaseSettings;

    // Seleziona la configurazione in base al flag
    $settings = USE_ALTERVISTA_DB ? $altervistaDatabaseSettings : $databaseSettings;

    if (
        !USE_ALTERVISTA_DB &&
        ($settings['dbname'] === 'CHANGE_ME' || $settings['username'] === 'CHANGE_ME')
    ) {
        respond(500, 'error', 'Inserisci le credenziali MySQL nel file .env (locale).', null);
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $settings['host'],
        (int) $settings['port'],
        $settings['dbname'],
        $settings['charset']
    );

    try {
        $pdo = new PDO(
            $dsn,
            (string) $settings['username'],
            (string) $settings['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
    } catch (PDOException $exception) {
        respond(500, 'error', 'Connessione al database fallita (' . (USE_ALTERVISTA_DB ? 'AlterVista' : 'Locale') . '): ' . $exception->getMessage(), null);
    }

    return $pdo;
}

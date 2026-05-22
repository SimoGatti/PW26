<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$databaseSettings = [
    'host' => 'localhost',
    'port' => 3306,
    'dbname' => 'quiz_db', // Sostituisci con il nome che hai scelto al punto 1, se diverso
    'username' => 'root',  // Su XAMPP l'utente predefinito è sempre 'root'
    'password' => '',      // Su XAMPP la password va lasciata vuota
    'charset' => 'utf8mb4'
];

function respond(int $httpStatus, string $status, string $message, $data = null)
{
    http_response_code($httpStatus);
    echo json_encode(
        [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

function request_data(): array
{
    $json = json_decode((string) file_get_contents('php://input'), true);
    return array_merge($_GET, $_POST, is_array($json) ? $json : []);
}

function param_string(array $data, string $key, string $default = ''): string
{
    return isset($data[$key]) ? trim((string) $data[$key]) : $default;
}

function param_limit(array $data, int $default = 25): int
{
    $limit = isset($data['limit']) ? (int) $data['limit'] : $default;
    return max(1, min($limit, 100));
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $databaseSettings;

    if (
        $databaseSettings['dbname'] === 'CHANGE_ME' ||
        $databaseSettings['username'] === 'CHANGE_ME'
    ) {
        respond(500, 'error', 'Inserisci le credenziali MySQL direttamente in api.php.', null);
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $databaseSettings['host'],
        (int) $databaseSettings['port'],
        $databaseSettings['dbname'],
        $databaseSettings['charset']
    );

    try {
        $pdo = new PDO(
            $dsn,
            (string) $databaseSettings['username'],
            (string) $databaseSettings['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
    } catch (PDOException $exception) {
        respond(500, 'error', 'Connessione al database fallita: ' . $exception->getMessage(), null);
    }

    return $pdo;
}

function fetch_usernames(int $limit): array
{
    $statement = db()->query(
        'SELECT nomeUtente FROM Utente ORDER BY nomeUtente ASC LIMIT ' . $limit
    );

    return $statement->fetchAll();
}

function fetch_users(string $search, int $limit): array
{
    $statement = db()->prepare(
        '
        SELECT nomeUtente, nome, cognome, email
        FROM Utente
        WHERE
            :search = ""
            OR nomeUtente LIKE :searchLike
            OR nome LIKE :searchLike
            OR cognome LIKE :searchLike
            OR email LIKE :searchLike
        ORDER BY cognome ASC, nome ASC
        LIMIT ' . $limit
    );

    $statement->execute([
        'search' => $search,
        'searchLike' => '%' . $search . '%'
    ]);

    return $statement->fetchAll();
}

function fetch_quizzes(string $search, int $limit): array
{
    $statement = db()->prepare(
        '
        SELECT
            q.codice,
            q.titolo,
            q.creatore,
            q.dataInizio,
            q.dataFine,
            COUNT(d.numero) AS numeroDomande
        FROM Quiz q
        LEFT JOIN Domanda d ON d.quiz = q.codice
        WHERE
            :search = ""
            OR q.titolo LIKE :searchLike
            OR q.creatore LIKE :searchLike
            OR CAST(q.codice AS CHAR) LIKE :searchLike
        GROUP BY q.codice, q.titolo, q.creatore, q.dataInizio, q.dataFine
        ORDER BY q.codice DESC
        LIMIT ' . $limit
    );

    $statement->execute([
        'search' => $search,
        'searchLike' => '%' . $search . '%'
    ]);

    return $statement->fetchAll();
}

function fetch_participations(string $search, int $limit): array
{
    $statement = db()->prepare(
        '
        SELECT
            p.codice,
            p.utente,
            p.quiz,
            q.titolo AS titoloQuiz,
            p.data
        FROM Partecipazione p
        INNER JOIN Quiz q ON q.codice = p.quiz
        WHERE
            :search = ""
            OR p.utente LIKE :searchLike
            OR q.titolo LIKE :searchLike
            OR CAST(p.quiz AS CHAR) LIKE :searchLike
        ORDER BY p.data DESC, p.codice DESC
        LIMIT ' . $limit
    );

    $statement->execute([
        'search' => $search,
        'searchLike' => '%' . $search . '%'
    ]);

    return $statement->fetchAll();
}

$requestData = request_data();
$action = param_string($requestData, 'action');

if ($action === '') {
    respond(400, 'error', 'Parametro action mancante.', null);
}

try {
    switch ($action) {
        case 'home':
            respond(200, 'success', 'Sezione Home caricata correttamente.', null);
            break;

        case 'list_usernames':
            $limit = param_limit($requestData, 100);
            respond(
                200,
                'success',
                'Elenco utenti caricato correttamente.',
                ['items' => fetch_usernames($limit)]
            );
            break;

        case 'search_users':
        case 'manage_users':
            $search = param_string($requestData, 'q');
            $limit = param_limit($requestData, 25);
            respond(
                200,
                'success',
                'Utenti caricati correttamente.',
                ['items' => fetch_users($search, $limit)]
            );
            break;

        case 'search_quizzes':
            $search = param_string($requestData, 'q');
            $limit = param_limit($requestData, 25);
            respond(
                200,
                'success',
                'Quiz caricati correttamente.',
                ['items' => fetch_quizzes($search, $limit)]
            );
            break;

        case 'search_participations':
            $search = param_string($requestData, 'q');
            $limit = param_limit($requestData, 25);
            respond(
                200,
                'success',
                'Partecipazioni caricate correttamente.',
                ['items' => fetch_participations($search, $limit)]
            );
            break;

        default:
            respond(400, 'error', 'Azione non valida.', null);
            break;
    }
} catch (PDOException $exception) {
    respond(500, 'error', 'Errore database: ' . $exception->getMessage(), null);
} catch (Throwable $exception) {
    respond(500, 'error', 'Errore interno: ' . $exception->getMessage(), null);
}

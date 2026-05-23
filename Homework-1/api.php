<?php
declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_PORT = 3306;
const DB_NAME = 'my_namenotfound';
const DB_USER = 'namenotfound';
const DB_PASS = 'EG8F728v7eA4';
const DB_CHARSET = 'utf8mb4';

send_default_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function send_default_headers(): void
{
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
}

function respond(int $httpStatus, string $status, string $message, $data = null): void
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

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    $pdo = new PDO(
        $dsn,
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );

    return $pdo;
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

function fetch_home_stats(): array
{
    $pdo = db();

    return [
        'quiz_count'     => (int) $pdo->query('SELECT COUNT(*) FROM `Quiz`')->fetchColumn(),
        'question_count' => (int) $pdo->query('SELECT COUNT(*) FROM `Domanda`')->fetchColumn(),
        'user_count'     => (int) $pdo->query('SELECT COUNT(*) FROM `Utente`')->fetchColumn()
    ];
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

function handle_request(): void
{
    $requestData = request_data();
    $action = param_string($requestData, 'action');

    if ($action === '') {
        respond(400, 'error', 'Parametro action mancante.', null);
    }

    switch ($action) {
        case 'home':
            respond(200, 'success', 'Statistiche caricate.', fetch_home_stats());
            break;

        case 'list_usernames':
            respond(200, 'success', 'Elenco utenti caricato correttamente.', [
                'items' => fetch_usernames(param_limit($requestData, 100))
            ]);
            break;

        case 'search_users':
        case 'manage_users':
            respond(200, 'success', 'Utenti caricati correttamente.', [
                'items' => fetch_users(
                    param_string($requestData, 'q'),
                    param_limit($requestData)
                )
            ]);
            break;

        case 'search_quizzes':
            respond(200, 'success', 'Quiz caricati correttamente.', [
                'items' => fetch_quizzes(
                    param_string($requestData, 'q'),
                    param_limit($requestData)
                )
            ]);
            break;

        case 'search_participations':
            respond(200, 'success', 'Partecipazioni caricate correttamente.', [
                'items' => fetch_participations(
                    param_string($requestData, 'q'),
                    param_limit($requestData)
                )
            ]);
            break;

        default:
            respond(400, 'error', 'Azione non valida.', null);
            break;
    }
}

try {
    handle_request();
} catch (PDOException $exception) {
    respond(500, 'error', 'Errore database: ' . $exception->getMessage(), null);
} catch (Throwable $exception) {
    respond(500, 'error', 'Errore interno: ' . $exception->getMessage(), null);
}

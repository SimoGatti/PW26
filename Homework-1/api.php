<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

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

// Carica la configurazione centralizzata (CORS, ENV e Database Connection)
require_once __DIR__ . '/config/database.php';

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
            try {
                // Tenta di connettersi al database (locale o AlterVista a seconda del flag)
                $pdo = db();
                
                // Raccogliamo i conteggi reali dalle tabelle del database
                $stmtQuiz = $pdo->query("SELECT COUNT(*) as cnt FROM `Quiz`");
                $quizCount = $stmtQuiz ? ($stmtQuiz->fetch()['cnt'] ?? 0) : 0;

                $stmtDomanda = $pdo->query("SELECT COUNT(*) as cnt FROM `Domanda`");
                $questionCount = $stmtDomanda ? ($stmtDomanda->fetch()['cnt'] ?? 0) : 0;

                $stmtUtente = $pdo->query("SELECT COUNT(*) as cnt FROM `Utente`");
                $userCount = $stmtUtente ? ($stmtUtente->fetch()['cnt'] ?? 0) : 0;

                respond(200, 'success', 'Dati reali caricati correttamente.', [
                    'quiz_count' => (int) $quizCount,
                    'question_count' => (int) $questionCount,
                    'user_count' => (int) $userCount,
                    'mode' => USE_ALTERVISTA_DB ? 'ALTERVISTA' : 'LOCAL'
                ]);
            } catch (Throwable $exception) {
                // Fallback elegante su dati Mock se il database non è connesso o le tabelle non sono create
                respond(200, 'success', 'Caricamento da database non disponibile (' . $exception->getMessage() . '). Dati simulati caricati.', [
                    'quiz_count' => 12,
                    'question_count' => 250,
                    'user_count' => 3,
                    'mode' => 'MOCK'
                ]);
            }
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

<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

function send_json_response(int $httpStatus, string $status, string $message, $data = null): never
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

function get_json_input(): array
{
    $rawInput = file_get_contents('php://input');

    if ($rawInput === false || trim($rawInput) === '') {
        return [];
    }

    $decodedInput = json_decode($rawInput, true);

    return is_array($decodedInput) ? $decodedInput : [];
}

$requestData = array_merge($_GET, $_POST, get_json_input());
$action = isset($requestData['action']) ? trim((string) $requestData['action']) : '';

if ($action === '') {
    send_json_response(400, 'error', 'Parametro action mancante.', null);
}

// Qui potrai includere il file di connessione al database, per esempio:
// require_once __DIR__ . '/config/database.php';

switch ($action) {
    case 'home':
        send_json_response(200, 'success', 'Sezione Home caricata correttamente.', null);
        break;

    case 'search_users':
    case 'search_quizzes':
    case 'search_participations':
    case 'manage_users':
    case 'create_user':
    case 'read_user':
    case 'update_user':
    case 'delete_user':
        send_json_response(501, 'error', 'Sezione non ancora implementata.', null);
        break;

    case 'health':
        send_json_response(
            200,
            'success',
            'API raggiungibile.',
            [
                'timestamp' => date(DATE_ATOM),
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN'
            ]
        );
        break;

    default:
        send_json_response(400, 'error', 'Azione non valida.', null);
        break;
}

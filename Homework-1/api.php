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

function param_page(array $data): int
{
    return max(1, isset($data['page']) ? (int) $data['page'] : 1);
}

function param_offset(array $data): int
{
    return max(0, isset($data['offset']) ? (int) $data['offset'] : 0);
}

function param_sort(string $sort, array $whitelist, string $default = ''): string
{
    $sort = trim($sort);
    if ($sort === '' || !in_array($sort, $whitelist, true)) {
        return $default;
    }
    return $sort;
}

function param_direction(string $dir): string
{
    return strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';
}

function paginated_response(string $message, array $items, int $total, int $page, int $limit): void
{
    respond(200, 'success', $message, [
        'items'      => $items,
        'page'       => $page,
        'limit'      => $limit,
        'total'      => $total,
        'totalPages' => (int) ceil($total / max($limit, 1)),
    ]);
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

function fetch_users(string $search, int $limit, int $offset, string $sort = '', string $direction = 'ASC'): array
{
    $sort = param_sort($sort, ['nomeUtente', 'nome', 'cognome', 'numeroQuizCreati', 'numeroPartecipazioni'], 'cognome');
    $dir = param_direction($direction);

    $orderMap = [
        'nomeUtente' => "u.nomeUtente $dir",
        'nome' => "u.nome $dir, u.cognome ASC",
        'cognome' => "u.cognome $dir, u.nome ASC",
        'numeroQuizCreati' => "numeroQuizCreati $dir, u.cognome ASC",
        'numeroPartecipazioni' => "numeroPartecipazioni $dir, u.cognome ASC",
    ];
    $orderClause = $orderMap[$sort] ?? 'u.cognome ASC, u.nome ASC';

    $where = '1 = 1';
    $params = [];

    if ($search !== '') {
        $where = '
            (
                nomeUtente LIKE :searchUsername
                OR nome LIKE :searchNome
                OR cognome LIKE :searchCognome
                OR email LIKE :searchEmail
            )
        ';
        $searchLike = '%' . $search . '%';
        $params = [
            'searchUsername' => $searchLike,
            'searchNome' => $searchLike,
            'searchCognome' => $searchLike,
            'searchEmail' => $searchLike,
        ];
    }

    $total = db()->prepare(
        "
        SELECT COUNT(*)
        FROM Utente
        WHERE $where
        "
    );
    $total->execute($params);
    $totalCount = (int) $total->fetchColumn();

    $where = str_replace(
        ['nomeUtente', 'nome LIKE', 'cognome', 'email'],
        ['u.nomeUtente', 'u.nome LIKE', 'u.cognome', 'u.email'],
        $where
    );

    $stmt = db()->prepare(
        "
        SELECT
            u.nomeUtente, u.nome, u.cognome, u.email,
            (SELECT COUNT(*) FROM Quiz WHERE creatore = u.nomeUtente) AS numeroQuizCreati,
            (SELECT COUNT(*) FROM Partecipazione WHERE utente = u.nomeUtente) AS numeroPartecipazioni
        FROM Utente u
        WHERE $where
        ORDER BY $orderClause
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);

    return [$stmt->fetchAll(), $totalCount];
}

function fetch_quizzes(string $search, int $limit, int $offset, string $sort = '', string $direction = 'ASC', string $creatore = '', string $stato = ''): array
{
    $conditions = [];
    $params = [];

    if ($search !== '') {
        $searchLike = '%' . $search . '%';
        $conditions[] = '
            (
                q.titolo LIKE :searchTitolo
                OR q.creatore LIKE :searchCreatore
                OR CAST(q.codice AS CHAR) LIKE :searchCodice
            )
        ';
        $params['searchTitolo'] = $searchLike;
        $params['searchCreatore'] = $searchLike;
        $params['searchCodice'] = $searchLike;
    }

    if ($creatore !== '') {
        $conditions[] = 'q.creatore = :creatore';
        $params['creatore'] = $creatore;
    }

    if ($stato === 'futuro') {
        $conditions[] = 'q.dataInizio > CURDATE()';
    } elseif ($stato === 'aperto') {
        $conditions[] = 'q.dataInizio <= CURDATE() AND q.dataFine >= CURDATE()';
    } elseif ($stato === 'chiuso') {
        $conditions[] = 'q.dataFine < CURDATE()';
    }

    $where = !empty($conditions) ? implode(' AND ', $conditions) : '1 = 1';

    $sort = param_sort($sort, ['codice', 'titolo', 'dataInizio', 'dataFine', 'numeroDomande', 'numeroPartecipazioni'], 'codice');
    $dir = param_direction($direction);

    $orderMap = [
        'codice' => "q.codice $dir",
        'titolo' => "q.titolo $dir, q.codice DESC",
        'dataInizio' => "q.dataInizio $dir, q.codice DESC",
        'dataFine' => "q.dataFine $dir, q.codice DESC",
        'numeroDomande' => "numeroDomande $dir, q.codice DESC",
        'numeroPartecipazioni' => "numeroPartecipazioni $dir, q.codice DESC",
    ];
    $orderClause = $orderMap[$sort] ?? 'q.codice DESC';

    $total = db()->prepare("SELECT COUNT(*) FROM Quiz q WHERE $where");
    $total->execute($params);
    $totalCount = (int) $total->fetchColumn();

    $stmt = db()->prepare("
        SELECT
            q.codice,
            q.titolo,
            q.creatore,
            q.dataInizio,
            q.dataFine,
            COUNT(DISTINCT d.numero) AS numeroDomande,
            COUNT(DISTINCT p.codice) AS numeroPartecipazioni,
            CASE
                WHEN q.dataInizio > CURDATE() THEN 'futuro'
                WHEN q.dataFine < CURDATE() THEN 'chiuso'
                ELSE 'aperto'
            END AS stato
        FROM Quiz q
        LEFT JOIN Domanda d ON d.quiz = q.codice
        LEFT JOIN Partecipazione p ON p.quiz = q.codice
        WHERE $where
        GROUP BY q.codice, q.titolo, q.creatore, q.dataInizio, q.dataFine
        ORDER BY $orderClause
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);

    return [$stmt->fetchAll(), $totalCount];
}

function fetch_participations(string $search, int $limit, int $offset, string $sort = '', string $direction = 'ASC', string $utente = '', string $quiz = '', string $dateFrom = '', string $dateTo = ''): array
{
    $conditions = [];
    $params = [];

    if ($search !== '') {
        $searchLike = '%' . $search . '%';
        $conditions[] = '
            (
                p.utente LIKE :searchUtente
                OR q.titolo LIKE :searchTitolo
                OR CAST(p.quiz AS CHAR) LIKE :searchQuiz
            )
        ';
        $params['searchUtente'] = $searchLike;
        $params['searchTitolo'] = $searchLike;
        $params['searchQuiz'] = $searchLike;
    }

    if ($utente !== '') {
        $conditions[] = 'p.utente = :p_utente';
        $params['p_utente'] = $utente;
    }

    if ($quiz !== '') {
        $conditions[] = 'p.quiz = :p_quiz';
        $params['p_quiz'] = (int) $quiz;
    }

    if ($dateFrom !== '') {
        $conditions[] = 'p.data >= :dateFrom';
        $params['dateFrom'] = $dateFrom;
    }

    if ($dateTo !== '') {
        $conditions[] = 'p.data <= :dateTo';
        $params['dateTo'] = $dateTo;
    }

    $where = !empty($conditions) ? implode(' AND ', $conditions) : '1 = 1';

    $sort = param_sort($sort, ['data', 'punteggioTotale', 'numeroRisposteDate'], 'data');
    $dir = param_direction($direction);

    $orderMap = [
        'data' => "p.data $dir, p.codice DESC",
        'punteggioTotale' => "punteggioTotale $dir, p.data DESC",
        'numeroRisposteDate' => "numeroRisposteDate $dir, p.data DESC",
    ];
    $orderClause = $orderMap[$sort] ?? 'p.data DESC, p.codice DESC';

    $total = db()->prepare("
        SELECT COUNT(*)
        FROM Partecipazione p
        INNER JOIN Quiz q ON q.codice = p.quiz
        WHERE $where
    ");
    $total->execute($params);
    $totalCount = (int) $total->fetchColumn();

    $stmt = db()->prepare("
        SELECT
            p.codice,
            p.utente,
            p.quiz,
            q.titolo AS titoloQuiz,
            p.data,
            COUNT(DISTINCT ruq.domanda) AS numeroRisposteDate,
            COALESCE(SUM(CASE WHEN r.tipo = 'Corretta' THEN r.punteggio ELSE 0 END), 0) AS punteggioTotale
        FROM Partecipazione p
        INNER JOIN Quiz q ON q.codice = p.quiz
        LEFT JOIN RispostaUtenteQuiz ruq ON ruq.partecipazione = p.codice
        LEFT JOIN Risposta r ON r.quiz = ruq.quiz AND r.domanda = ruq.domanda AND r.numero = ruq.risposta
        WHERE $where
        GROUP BY p.codice, p.utente, p.quiz, q.titolo, p.data
        ORDER BY $orderClause
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);

    return [$stmt->fetchAll(), $totalCount];
}

/* ─── CRUD Utente ───────────────────────────────────── */

function validate_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function create_user(string $nomeUtente, string $nome, string $cognome, string $email): void
{
    if ($nomeUtente === '' || $nome === '' || $cognome === '') {
        respond(400, 'error', 'Tutti i campi obbligatori devono essere compilati.', null);
    }
    if (!validate_email($email)) {
        respond(400, 'error', 'Formato email non valido.', null);
    }

    $pdo = db();

    $check = $pdo->prepare('SELECT COUNT(*) FROM Utente WHERE nomeUtente = :nu');
    $check->execute(['nu' => $nomeUtente]);
    if ((int) $check->fetchColumn() > 0) {
        respond(409, 'error', 'Nome utente già esistente.', null);
    }

    $stmt = $pdo->prepare('
        INSERT INTO Utente (nomeUtente, nome, cognome, email)
        VALUES (:nu, :n, :c, :e)
    ');
    $stmt->execute([
        'nu' => $nomeUtente,
        'n'  => $nome,
        'c'  => $cognome,
        'e'  => $email,
    ]);

    respond(201, 'success', 'Utente creato con successo.', [
        'nomeUtente' => $nomeUtente,
        'nome'       => $nome,
        'cognome'    => $cognome,
        'email'      => $email,
    ]);
}

function get_user(string $nomeUtente): void
{
    if ($nomeUtente === '') {
        respond(400, 'error', 'Nome utente non specificato.', null);
    }

    $stmt = db()->prepare('
        SELECT nomeUtente, nome, cognome, email
        FROM Utente
        WHERE nomeUtente = :nu
    ');
    $stmt->execute(['nu' => $nomeUtente]);
    $user = $stmt->fetch();

    if (!$user) {
        respond(404, 'error', 'Utente non trovato.', null);
    }

    respond(200, 'success', 'Utente caricato.', $user);
}

function update_user(string $nomeUtente, string $nome, string $cognome, string $email): void
{
    if ($nomeUtente === '') {
        respond(400, 'error', 'Nome utente non specificato.', null);
    }
    if ($nome === '' || $cognome === '') {
        respond(400, 'error', 'Nome e cognome sono obbligatori.', null);
    }
    if (!validate_email($email)) {
        respond(400, 'error', 'Formato email non valido.', null);
    }

    $pdo = db();

    $exists = $pdo->prepare('SELECT COUNT(*) FROM Utente WHERE nomeUtente = :nu');
    $exists->execute(['nu' => $nomeUtente]);
    if ((int) $exists->fetchColumn() === 0) {
        respond(404, 'error', 'Utente non trovato.', null);
    }

    $stmt = $pdo->prepare('
        UPDATE Utente SET nome = :n, cognome = :c, email = :e
        WHERE nomeUtente = :nu
    ');
    $stmt->execute([
        'nu' => $nomeUtente,
        'n'  => $nome,
        'c'  => $cognome,
        'e'  => $email,
    ]);

    respond(200, 'success', 'Utente aggiornato con successo.', null);
}

function delete_user(string $nomeUtente): void
{
    if ($nomeUtente === '') {
        respond(400, 'error', 'Nome utente non specificato.', null);
    }

    $pdo = db();

    $stmtQuiz = $pdo->prepare('SELECT COUNT(*) FROM Quiz WHERE creatore = :nu');
    $stmtQuiz->execute(['nu' => $nomeUtente]);
    $quizCount = (int) $stmtQuiz->fetchColumn();

    $stmtPart = $pdo->prepare('SELECT COUNT(*) FROM Partecipazione WHERE utente = :nu');
    $stmtPart->execute(['nu' => $nomeUtente]);
    $partCount = (int) $stmtPart->fetchColumn();

    if ($quizCount > 0 || $partCount > 0) {
        $parts = [];
        if ($quizCount > 0) $parts[] = "$quizCount quiz creati";
        if ($partCount > 0) $parts[] = "$partCount partecipazioni";
        respond(409, 'error', 'Impossibile eliminare: l\'utente ha ' . implode(' e ', $parts) . ' collegati.', [
            'quizCount' => $quizCount,
            'partCount' => $partCount,
        ]);
    }

    $stmt = $pdo->prepare('DELETE FROM Utente WHERE nomeUtente = :nu');
    $stmt->execute(['nu' => $nomeUtente]);

    if ($stmt->rowCount() === 0) {
        respond(404, 'error', 'Utente non trovato.', null);
    }

    respond(200, 'success', 'Utente eliminato con successo.', null);
}

/* ─── Dettaglio quiz ─────────────────────────────────── */

function fetch_quiz_detail(int $codice): void
{
    $pdo = db();

    $quiz = $pdo->prepare('
        SELECT
            q.codice, q.titolo, q.creatore, q.dataInizio, q.dataFine,
            (SELECT COUNT(*) FROM Domanda WHERE quiz = q.codice) AS numeroDomande,
            (SELECT COUNT(*) FROM Partecipazione WHERE quiz = q.codice) AS numeroPartecipazioni
        FROM Quiz q
        WHERE q.codice = :c
    ');
    $quiz->execute(['c' => $codice]);
    $quizData = $quiz->fetch();

    if (!$quizData) {
        respond(404, 'error', 'Quiz non trovato.', null);
    }

    $creatore = $pdo->prepare('
        SELECT nomeUtente, nome, cognome, email FROM Utente WHERE nomeUtente = :nu
    ');
    $creatore->execute(['nu' => $quizData['creatore']]);
    $quizData['creatoreDettaglio'] = $creatore->fetch() ?: null;

    $domande = $pdo->prepare('
        SELECT numero, testo FROM Domanda
        WHERE quiz = :c
        ORDER BY numero ASC
    ');
    $domande->execute(['c' => $codice]);
    $domandeData = $domande->fetchAll();

    $risposteStmt = $pdo->prepare('
        SELECT numero, testo, tipo, punteggio FROM Risposta
        WHERE quiz = :c AND domanda = :d
        ORDER BY numero ASC
    ');

    foreach ($domandeData as &$domanda) {
        $risposteStmt->execute(['c' => $codice, 'd' => $domanda['numero']]);
        $domanda['risposte'] = $risposteStmt->fetchAll();
    }
    unset($domanda);

    $quizData['domande'] = $domandeData;

    respond(200, 'success', 'Dettaglio quiz caricato.', $quizData);
}

/* ─── Dettaglio utente ───────────────────────────────── */

function fetch_user_detail(string $nomeUtente): void
{
    if ($nomeUtente === '') {
        respond(400, 'error', 'Nome utente non specificato.', null);
    }

    $pdo = db();

    $user = $pdo->prepare('
        SELECT nomeUtente, nome, cognome, email FROM Utente WHERE nomeUtente = :nu
    ');
    $user->execute(['nu' => $nomeUtente]);
    $userData = $user->fetch();

    if (!$userData) {
        respond(404, 'error', 'Utente non trovato.', null);
    }

    $quizCreati = $pdo->prepare('
        SELECT codice, titolo, dataInizio, dataFine,
            (SELECT COUNT(*) FROM Domanda WHERE quiz = q.codice) AS numeroDomande
        FROM Quiz q
        WHERE creatore = :nu
        ORDER BY dataInizio DESC
    ');
    $quizCreati->execute(['nu' => $nomeUtente]);

    $partecipazioni = $pdo->prepare('
        SELECT
            p.codice, p.quiz, q.titolo AS titoloQuiz, p.data,
            COUNT(DISTINCT ruq.domanda) AS numeroRisposteDate,
            COALESCE(SUM(CASE WHEN r.tipo = \'Corretta\' THEN r.punteggio ELSE 0 END), 0) AS punteggioTotale
        FROM Partecipazione p
        INNER JOIN Quiz q ON q.codice = p.quiz
        LEFT JOIN RispostaUtenteQuiz ruq ON ruq.partecipazione = p.codice
        LEFT JOIN Risposta r ON r.quiz = ruq.quiz AND r.domanda = ruq.domanda AND r.numero = ruq.risposta
        WHERE p.utente = :nu
        GROUP BY p.codice, p.quiz, q.titolo, p.data
        ORDER BY p.data DESC
    ');
    $partecipazioni->execute(['nu' => $nomeUtente]);

    $userData['quizCreati'] = $quizCreati->fetchAll();
    $userData['partecipazioni'] = $partecipazioni->fetchAll();
    $userData['numeroQuizCreati'] = count($userData['quizCreati']);
    $userData['numeroPartecipazioni'] = count($userData['partecipazioni']);

    respond(200, 'success', 'Dettaglio utente caricato.', $userData);
}

/* ─── Dettaglio partecipazione ───────────────────────── */

function fetch_participation_detail(int $codice): void
{
    $pdo = db();

    $part = $pdo->prepare('
        SELECT
            p.codice, p.utente, p.quiz, p.data,
            q.titolo AS titoloQuiz,
            u.nome, u.cognome, u.email
        FROM Partecipazione p
        INNER JOIN Quiz q ON q.codice = p.quiz
        INNER JOIN Utente u ON u.nomeUtente = p.utente
        WHERE p.codice = :c
    ');
    $part->execute(['c' => $codice]);
    $partData = $part->fetch();

    if (!$partData) {
        respond(404, 'error', 'Partecipazione non trovata.', null);
    }

    $quizCode = (int) $partData['quiz'];

    $domande = $pdo->prepare('
        SELECT numero, testo FROM Domanda
        WHERE quiz = :c
        ORDER BY numero ASC
    ');
    $domande->execute(['c' => $quizCode]);
    $domandeData = $domande->fetchAll();

    $risposteStmt = $pdo->prepare('
        SELECT numero, testo, tipo, punteggio FROM Risposta
        WHERE quiz = :c AND domanda = :d
        ORDER BY numero ASC
    ');

    $scelteStmt = $pdo->prepare('
        SELECT risposta FROM RispostaUtenteQuiz
        WHERE partecipazione = :p AND quiz = :c AND domanda = :d
    ');

    $punteggioTotale = 0;
    $numeroRisposteDate = 0;

    foreach ($domandeData as &$domanda) {
        $domandaNum = (int) $domanda['numero'];

        $risposteStmt->execute(['c' => $quizCode, 'd' => $domandaNum]);
        $risposte = $risposteStmt->fetchAll();

        $scelteStmt->execute(['p' => $codice, 'c' => $quizCode, 'd' => $domandaNum]);
        $scelte = array_column($scelteStmt->fetchAll(), 'risposta');

        foreach ($risposte as &$risp) {
            $risp['selezionata'] = in_array((int) $risp['numero'], $scelte);
            if ($risp['selezionata'] && $risp['tipo'] === 'Corretta') {
                $punteggioTotale += (int) $risp['punteggio'];
            }
        }
        unset($risp);

        $domanda['risposte'] = $risposte;
        $domanda['risposteDate'] = $scelte;

        if (!empty($scelte)) {
            $numeroRisposteDate++;
        }
    }
    unset($domanda);

    $partData['domande'] = $domandeData;
    $partData['punteggioTotale'] = $punteggioTotale;
    $partData['numeroRisposteDate'] = $numeroRisposteDate;

    respond(200, 'success', 'Dettaglio partecipazione caricato.', $partData);
}

/* ─── Svolgimento quiz ───────────────────────────────── */

function start_participation(string $utente, int $quiz): void
{
    if ($utente === '') {
        respond(400, 'error', 'Nessun utente selezionato.', null);
    }

    $pdo = db();

    $userExists = $pdo->prepare('SELECT COUNT(*) FROM Utente WHERE nomeUtente = :u');
    $userExists->execute(['u' => $utente]);
    if ((int) $userExists->fetchColumn() === 0) {
        respond(404, 'error', 'Utente non trovato.', null);
    }

    $quizExists = $pdo->prepare('SELECT COUNT(*) FROM Quiz WHERE codice = :q');
    $quizExists->execute(['q' => $quiz]);
    if ((int) $quizExists->fetchColumn() === 0) {
        respond(404, 'error', 'Quiz non trovato.', null);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('
            INSERT INTO Partecipazione (utente, quiz, data)
            VALUES (:u, :q, CURDATE())
        ');
        $stmt->execute(['u' => $utente, 'q' => $quiz]);
        $codice = (int) $pdo->lastInsertId();
        $pdo->commit();

        respond(201, 'success', 'Partecipazione iniziata con successo.', [
            'codice' => $codice,
            'utente' => $utente,
            'quiz'   => $quiz,
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(500, 'error', 'Errore durante la creazione della partecipazione.', null);
    }
}

function submit_participation_answers(int $partecipazione, array $risposte): void
{
    $pdo = db();

    $partStmt = $pdo->prepare('
        SELECT codice, utente, quiz FROM Partecipazione WHERE codice = :c
    ');
    $partStmt->execute(['c' => $partecipazione]);
    $partData = $partStmt->fetch();

    if (!$partData) {
        respond(404, 'error', 'Partecipazione non trovata.', null);
    }

    $quizCode = (int) $partData['quiz'];

    $pdo->beginTransaction();
    try {
        $insertStmt = $pdo->prepare('
            INSERT IGNORE INTO RispostaUtenteQuiz (partecipazione, quiz, domanda, risposta)
            VALUES (:p, :q, :d, :r)
        ');

        $verificaDomanda = $pdo->prepare('
            SELECT COUNT(*) FROM Domanda WHERE quiz = :q AND numero = :d
        ');
        $verificaRisposta = $pdo->prepare('
            SELECT COUNT(*) FROM Risposta WHERE quiz = :q AND domanda = :d AND numero = :r
        ');

        foreach ($risposte as $r) {
            $domanda = (int) ($r['domanda'] ?? 0);
            $risposta = (int) ($r['risposta'] ?? 0);

            if ($domanda <= 0 || $risposta <= 0) continue;

            $verificaDomanda->execute(['q' => $quizCode, 'd' => $domanda]);
            if ((int) $verificaDomanda->fetchColumn() === 0) {
                throw new InvalidArgumentException("Domanda $domanda non appartiene al quiz $quizCode.");
            }

            $verificaRisposta->execute(['q' => $quizCode, 'd' => $domanda, 'r' => $risposta]);
            if ((int) $verificaRisposta->fetchColumn() === 0) {
                throw new InvalidArgumentException("Risposta $risposta non appartiene alla domanda $domanda.");
            }

            $insertStmt->execute([
                'p' => $partecipazione,
                'q' => $quizCode,
                'd' => $domanda,
                'r' => $risposta,
            ]);
        }

        $pdo->commit();
        respond(200, 'success', 'Risposte salvate con successo.', [
            'partecipazione' => $partecipazione,
        ]);
    } catch (InvalidArgumentException $e) {
        $pdo->rollBack();
        respond(400, 'error', $e->getMessage(), null);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(500, 'error', 'Errore durante il salvataggio delle risposte.', null);
    }
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
            $limit = param_limit($requestData);
            $page = param_page($requestData);
            [$items, $total] = fetch_users(
                param_string($requestData, 'q'),
                $limit,
                ($page - 1) * $limit,
                param_string($requestData, 'sort'),
                param_string($requestData, 'direction')
            );
            paginated_response('Utenti caricati correttamente.', $items, $total, $page, $limit);
            break;

        case 'search_quizzes':
            $limit = param_limit($requestData);
            $page = param_page($requestData);
            [$items, $total] = fetch_quizzes(
                param_string($requestData, 'q'),
                $limit,
                ($page - 1) * $limit,
                param_string($requestData, 'sort'),
                param_string($requestData, 'direction'),
                param_string($requestData, 'creatore'),
                param_string($requestData, 'stato')
            );
            paginated_response('Quiz caricati correttamente.', $items, $total, $page, $limit);
            break;

        case 'search_participations':
            $limit = param_limit($requestData);
            $page = param_page($requestData);
            [$items, $total] = fetch_participations(
                param_string($requestData, 'q'),
                $limit,
                ($page - 1) * $limit,
                param_string($requestData, 'sort'),
                param_string($requestData, 'direction'),
                param_string($requestData, 'utente'),
                param_string($requestData, 'quiz'),
                param_string($requestData, 'dateFrom'),
                param_string($requestData, 'dateTo')
            );
            paginated_response('Partecipazioni caricate correttamente.', $items, $total, $page, $limit);
            break;

        /* ─── CRUD Utente ─────────────────────────── */
        case 'create_user':
            $data = $requestData;
            create_user(
                param_string($data, 'nomeUtente'),
                param_string($data, 'nome'),
                param_string($data, 'cognome'),
                param_string($data, 'email')
            );
            break;

        case 'get_user':
            get_user(param_string($requestData, 'nomeUtente'));
            break;

        case 'update_user':
            update_user(
                param_string($requestData, 'nomeUtente'),
                param_string($requestData, 'nome'),
                param_string($requestData, 'cognome'),
                param_string($requestData, 'email')
            );
            break;

        case 'delete_user':
            delete_user(param_string($requestData, 'nomeUtente'));
            break;

        /* ─── Dettagli ─────────────────────────────── */
        case 'quiz_detail':
            fetch_quiz_detail((int) param_string($requestData, 'codice'));
            break;

        case 'user_detail':
            fetch_user_detail(param_string($requestData, 'nomeUtente'));
            break;

        case 'participation_detail':
            fetch_participation_detail((int) param_string($requestData, 'codice'));
            break;

        /* ─── Svolgimento quiz ─────────────────────── */
        case 'start_participation':
            start_participation(
                param_string($requestData, 'utente'),
                (int) param_string($requestData, 'quiz')
            );
            break;

        case 'submit_participation_answers':
            submit_participation_answers(
                (int) param_string($requestData, 'partecipazione'),
                $requestData['risposte'] ?? []
            );
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

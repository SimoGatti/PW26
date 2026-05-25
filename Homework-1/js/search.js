/* ─── Ricerche ────────────────────────────────────── */

/* Stato sort e paginazione per ogni sezione */
const searchState = {
    users:          { sort: 'cognome',        dir: 'ASC',  page: 1, limit: 25, mode: 'compact' },
    quizzes:        { sort: 'titolo',         dir: 'ASC',  page: 1, limit: 25, mode: 'compact' },
    participations: { sort: 'punteggioTotale',dir: 'DESC', page: 1, limit: 25, mode: 'compact' },
};

/* Aggiorna il container dei risultati senza flashare l'intera pagina */
function updateResultsContainer(newContent) {
    // Cerca il wrapper esistente nel centro; se c'è, aggiorna in-place
    const existing = centerContent.querySelector('.results-container');
    if (existing) {
        existing.replaceChildren(...Array.from(newContent.childNodes));
    } else {
        centerContent.replaceChildren(newContent);
    }
}

/* ─── Ricerca Utenti ──────────────────────────────── */

async function loadUsers(page = 1) {
    const s = searchState.users;
    s.page = page;

    // Mostra loading solo alla prima chiamata (nessun wrapper esistente)
    if (!centerContent.querySelector('.results-container')) renderLoading();

    const filterParams = getUserFilterParams();

    try {
        const result = await apiCall('search_users', {
            ...filterParams,
            limit:     s.limit,
            page:      s.page,
            sort:      s.sort,
            direction: s.dir,
        });
        const { items, total } = result.data;

        const allColumns = [
            { label: 'Username',      sortKey: 'nomeUtente',          render: r => createLink(r.nomeUtente, `?view=user-detail&id=${encodeURIComponent(r.nomeUtente)}`) },
            { label: 'Nome',          sortKey: 'nome',     key: 'nome' },
            { label: 'Cognome',       sortKey: 'cognome',  key: 'cognome' },
            { label: 'Email',                            key: 'email' },
            { label: 'Quiz',          sortKey: 'numeroQuizCreati',     key: 'numeroQuizCreati',     numeric: true },
            { label: 'Partecipazioni',sortKey: 'numeroPartecipazioni', key: 'numeroPartecipazioni', numeric: true },
        ];
        const compactColumns = [
            { label: 'Username', sortKey: 'nomeUtente', render: r => createLink(r.nomeUtente, `?view=user-detail&id=${encodeURIComponent(r.nomeUtente)}`) },
            { label: 'Nome',     sortKey: 'nome',    key: 'nome' },
            { label: 'Cognome',  sortKey: 'cognome', key: 'cognome' },
        ];
        const columns = s.mode === 'compact' ? compactColumns : allColumns;

        const container = document.createElement('div');
        container.className = 'results-container';

        container.appendChild(renderTable({
            columns,
            rows: items,
            emptyMsg: 'Nessun utente trovato.',
            viewToggle: createViewToggle(
                () => { s.mode = 'compact';  renderUserFilters(loadUsers, s.mode); loadUsers(1); },
                () => { s.mode = 'extended'; renderUserFilters(loadUsers, s.mode); loadUsers(1); },
                s.mode
            ),
            sortState: { key: s.sort, dir: s.dir },
            onSort: (key, dir) => { s.sort = key; s.dir = dir; loadUsers(1); },
            pagination: {
                total, page: s.page, limit: s.limit,
                onPage:  p  => loadUsers(p),
                onLimit: lm => { s.limit = lm; loadUsers(1); },
            },
        }));

        updateResultsContainer(container);
    } catch (err) {
        renderError(err.message);
    }
}

/* ─── Ricerca Quiz ────────────────────────────────── */

async function loadQuizzes(page = 1) {
    const s = searchState.quizzes;
    s.page = page;

    if (!centerContent.querySelector('.results-container')) renderLoading();

    const filterParams = getQuizFilterParams();

    try {
        const result = await apiCall('search_quizzes', {
            ...filterParams,
            limit:     s.limit,
            page:      s.page,
            sort:      s.sort,
            direction: s.dir,
        });
        const { items, total } = result.data;

        const allColumns = [
            { label: 'Codice',        sortKey: 'codice',              render: r => createLink(r.codice,   `?view=quiz-detail&id=${r.codice}`),                         numeric: true },
            { label: 'Titolo',        sortKey: 'titolo',              render: r => createLink(r.titolo,   `?view=quiz-detail&id=${r.codice}`) },
            { label: 'Creatore',                                       render: r => createLink(r.creatore, `?view=user-detail&id=${encodeURIComponent(r.creatore)}`) },
            { label: 'Inizio',        sortKey: 'dataInizio',          render: r => document.createTextNode(formatDate(r.dataInizio)),                                  numeric: true },
            { label: 'Fine',          sortKey: 'dataFine',            render: r => document.createTextNode(formatDate(r.dataFine)),                                    numeric: true },
            { label: 'Stato',                                          render: r => createStateBadge(r.stato) },
            { label: 'Domande',       sortKey: 'numeroDomande',       key: 'numeroDomande',       numeric: true },
            { label: 'Partecipazioni',sortKey: 'numeroPartecipazioni',key: 'numeroPartecipazioni',numeric: true },
        ];
        const compactColumns = [
            { label: 'Titolo',  sortKey: 'titolo',        render: r => createLink(r.titolo,   `?view=quiz-detail&id=${r.codice}`) },
            { label: 'Creatore',                           render: r => createLink(r.creatore, `?view=user-detail&id=${encodeURIComponent(r.creatore)}`) },
            { label: 'Stato',                              render: r => createStateBadge(r.stato) },
            { label: 'Domande', sortKey: 'numeroDomande', key: 'numeroDomande', numeric: true },
        ];
        const columns = s.mode === 'compact' ? compactColumns : allColumns;

        const container = document.createElement('div');
        container.className = 'results-container';
        container.appendChild(renderTable({
            columns, rows: items, emptyMsg: 'Nessun quiz trovato.',
            viewToggle: createViewToggle(
                () => { s.mode = 'compact';  renderQuizFilters(loadQuizzes, s.mode); loadQuizzes(1); },
                () => { s.mode = 'extended'; renderQuizFilters(loadQuizzes, s.mode); loadQuizzes(1); },
                s.mode
            ),
            sortState: { key: s.sort, dir: s.dir },
            onSort: (key, dir) => { s.sort = key; s.dir = dir; loadQuizzes(1); },
            pagination: {
                total, page: s.page, limit: s.limit,
                onPage:  p  => loadQuizzes(p),
                onLimit: lm => { s.limit = lm; loadQuizzes(1); },
            },
        }));
        updateResultsContainer(container);
    } catch (err) {
        renderError(err.message);
    }
}

/* ─── Ricerca Partecipazioni ──────────────────────── */

async function loadParticipations(page = 1) {
    const s = searchState.participations;
    s.page = page;

    if (!centerContent.querySelector('.results-container')) renderLoading();

    const filterParams = getParticipationFilterParams();

    try {
        const result = await apiCall('search_participations', {
            ...filterParams,
            limit:     s.limit,
            page:      s.page,
            sort:      s.sort,
            direction: s.dir,
        });
        const { items, total } = result.data;

        // Aggiungiamo _clickRoute a ogni riga per il click-su-riga
        const rowsWithClick = items.map(r => ({
            ...r,
            _clickRoute:  'participation-detail',
            _clickParams: { id: r.codice },
        }));

        const allColumns = [
            { label: 'Codice',    sortKey: 'codice', render: r => createLink(r.codice,    `?view=participation-detail&id=${r.codice}`),                     numeric: true },
            { label: 'Utente',                        render: r => createLink(r.utente,    `?view=user-detail&id=${encodeURIComponent(r.utente)}`) },
            { label: 'Quiz',                          render: r => createLink(r.titoloQuiz,`?view=quiz-detail&id=${r.quiz}`) },
            { label: 'Data',      sortKey: 'data',    render: r => document.createTextNode(formatDate(r.data)),                                              numeric: true },
            { label: 'Risposte',  sortKey: 'numeroRisposteDate', key: 'numeroRisposteDate', numeric: true },
            { label: 'Punteggio', sortKey: 'punteggioTotale',    key: 'punteggioTotale',    numeric: true },
        ];
        const compactColumns = [
            { label: 'Utente',    render: r => createLink(r.utente,    `?view=user-detail&id=${encodeURIComponent(r.utente)}`) },
            { label: 'Quiz',      render: r => createLink(r.titoloQuiz,`?view=quiz-detail&id=${r.quiz}`) },
            { label: 'Risposte',  sortKey: 'numeroRisposteDate', key: 'numeroRisposteDate', numeric: true },
            { label: 'Punteggio', sortKey: 'punteggioTotale',    key: 'punteggioTotale',    numeric: true },
        ];
        const columns = s.mode === 'compact' ? compactColumns : allColumns;

        const container = document.createElement('div');
        container.className = 'results-container';
        container.appendChild(renderTable({
            columns, rows: rowsWithClick, emptyMsg: 'Nessuna partecipazione trovata.',
            viewToggle: createViewToggle(
                () => { s.mode = 'compact';  renderParticipationFilters(loadParticipations, s.mode); loadParticipations(1); },
                () => { s.mode = 'extended'; renderParticipationFilters(loadParticipations, s.mode); loadParticipations(1); },
                s.mode
            ),
            sortState: { key: s.sort, dir: s.dir },
            onSort: (key, dir) => { s.sort = key; s.dir = dir; loadParticipations(1); },
            pagination: {
                total, page: s.page, limit: s.limit,
                onPage:  p  => loadParticipations(p),
                onLimit: lm => { s.limit = lm; loadParticipations(1); },
            },
        }));
        updateResultsContainer(container);
    } catch (err) {
        renderError(err.message);
    }
}

/* ─── Home Stats ──────────────────────────────────── */

async function loadHomeStats() {
    try {
        const result = await apiCall('home');
        const stats = result.data || {};
        const statQuiz      = document.getElementById('stat-quiz');
        const statQuestions = document.getElementById('stat-questions');
        const statUsers     = document.getElementById('stat-users');
        if (statQuiz)      statQuiz.textContent      = stats.quiz_count      ?? '—';
        if (statQuestions) statQuestions.textContent  = stats.question_count  ?? '—';
        if (statUsers)     statUsers.textContent      = stats.user_count      ?? '—';
    } catch (error) {
        console.error('[QUIZZING] Errore caricamento statistiche:', error.message);
    }
}

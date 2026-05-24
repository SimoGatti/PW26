/* ─── Ricerche ────────────────────────────────────── */

async function loadUsers(page = 1) {
    renderLoading();
    const q = getFilterValue('filter-q');
    const limit = parseInt(getFilterValue('filter-limit') || '25');
    const sort = getFilterValue('filter-sort');

    try {
        const result = await apiCall('search_users', { q, limit, page, sort });
        const { items, total } = result.data;

        const columns = [
            { label: 'Username', render: r => createLink(r.nomeUtente, `?view=user-detail&id=${encodeURIComponent(r.nomeUtente)}`) },
            { key: 'nome', label: 'Nome' },
            { key: 'cognome', label: 'Cognome' },
            { key: 'email', label: 'Email' },
            { key: 'numeroQuizCreati', label: 'Quiz creati' },
            { key: 'numeroPartecipazioni', label: 'Partecipazioni' },
        ];

        centerContent.replaceChildren(renderTable({ columns, rows: items, emptyMsg: 'Nessun utente trovato.', pagination: { total, page, limit, onPage: loadUsers } }));
    } catch (err) {
        renderError(err.message);
    }
}

async function loadQuizzes(page = 1) {
    renderLoading();
    const q = getFilterValue('filter-q');
    const limit = parseInt(getFilterValue('filter-limit') || '25');
    const sort = getFilterValue('filter-sort');
    const stato = getFilterValue('filter-stato');

    try {
        const result = await apiCall('search_quizzes', { q, limit, page, sort, stato });
        const { items, total } = result.data;

        const columns = [
            { label: 'Codice', render: r => createLink(r.codice, `?view=quiz-detail&id=${r.codice}`) },
            { label: 'Titolo', render: r => createLink(r.titolo, `?view=quiz-detail&id=${r.codice}`) },
            { label: 'Creatore', render: r => createLink(r.creatore, `?view=user-detail&id=${encodeURIComponent(r.creatore)}`) },
            { label: 'Inizio', render: r => document.createTextNode(formatDate(r.dataInizio)) },
            { label: 'Fine', render: r => document.createTextNode(formatDate(r.dataFine)) },
            { label: 'Stato', render: r => createStateBadge(r.stato) },
            { key: 'numeroDomande', label: 'Domande' },
            { key: 'numeroPartecipazioni', label: 'Partecipazioni' },
        ];

        centerContent.replaceChildren(renderTable({ columns, rows: items, emptyMsg: 'Nessun quiz trovato.', pagination: { total, page, limit, onPage: loadQuizzes } }));
    } catch (err) {
        renderError(err.message);
    }
}

async function loadParticipations(page = 1) {
    renderLoading();
    const q = getFilterValue('filter-q');
    const limit = parseInt(getFilterValue('filter-limit') || '25');
    const sort = getFilterValue('filter-sort');
    const dateFrom = getFilterValue('filter-dateFrom');
    const dateTo = getFilterValue('filter-dateTo');

    try {
        const result = await apiCall('search_participations', { q, limit, page, sort, dateFrom, dateTo });
        const { items, total } = result.data;

        const columns = [
            { label: 'Codice', render: r => createLink(r.codice, `?view=participation-detail&id=${r.codice}`) },
            { label: 'Utente', render: r => createLink(r.utente, `?view=user-detail&id=${encodeURIComponent(r.utente)}`) },
            { label: 'Quiz', render: r => createLink(r.titoloQuiz, `?view=quiz-detail&id=${r.quiz}`) },
            { label: 'Data', render: r => document.createTextNode(formatDate(r.data)) },
            { key: 'numeroRisposteDate', label: 'Risposte' },
            { key: 'punteggioTotale', label: 'Punteggio' },
        ];

        centerContent.replaceChildren(renderTable({ columns, rows: items, emptyMsg: 'Nessuna partecipazione trovata.', pagination: { total, page, limit, onPage: loadParticipations } }));
    } catch (err) {
        renderError(err.message);
    }
}

async function loadHomeStats() {
    try {
        const result = await apiCall('home');
        const stats = result.data || {};
        const statQuiz = document.getElementById('stat-quiz');
        const statQuestions = document.getElementById('stat-questions');
        const statUsers = document.getElementById('stat-users');

        if (statQuiz) statQuiz.textContent = stats.quiz_count ?? '—';
        if (statQuestions) statQuestions.textContent = stats.question_count ?? '—';
        if (statUsers) statUsers.textContent = stats.user_count ?? '—';
    } catch (error) {
        console.error('[QUIZZING] Errore caricamento statistiche:', error.message);
    }
}

/* ─── Filtri ──────────────────────────────────────── */

function getFilterValue(id) {
    return document.getElementById(id)?.value || '';
}

function clearFilters() {
    filterContainer.innerHTML = '';
}

function renderUserFilters() {
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-q">Ricerca testo</label>
            <input type="text" id="filter-q" class="form-input" placeholder="Nome, cognome, username...">
        </div>
        <div class="form-field">
            <label for="filter-sort">Ordina per</label>
            <select id="filter-sort" class="form-input">
                <option value="cognome">Cognome</option>
                <option value="nome">Nome</option>
                <option value="nomeUtente">Username</option>
                <option value="numeroQuizCreati">Quiz creati</option>
                <option value="numeroPartecipazioni">Partecipazioni</option>
            </select>
        </div>
        <div class="form-field">
            <label for="filter-limit">Risultati per pagina</label>
            <select id="filter-limit" class="form-input">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        </div>
        <div class="filter-actions">
            <button class="button button-primary" id="filter-search-btn">Cerca</button>
            <button class="button button-secondary" id="filter-reset-btn">Reset</button>
        </div>
    `;
    document.getElementById('filter-search-btn').addEventListener('click', () => loadUsers(1));
    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        document.getElementById('filter-q').value = '';
        loadUsers(1);
    });
    document.getElementById('filter-q').addEventListener('keydown', e => { if (e.key === 'Enter') loadUsers(1); });
}

function renderQuizFilters() {
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-q">Ricerca testo</label>
            <input type="text" id="filter-q" class="form-input" placeholder="Titolo, creatore...">
        </div>
        <div class="form-field">
            <label for="filter-stato">Stato</label>
            <select id="filter-stato" class="form-input">
                <option value="">Tutti</option>
                <option value="futuro">Futuro</option>
                <option value="aperto">Aperto</option>
                <option value="chiuso">Chiuso</option>
            </select>
        </div>
        <div class="form-field">
            <label for="filter-sort">Ordina per</label>
            <select id="filter-sort" class="form-input">
                <option value="codice">Codice</option>
                <option value="titolo">Titolo</option>
                <option value="dataInizio">Data inizio</option>
                <option value="numeroDomande">Domande</option>
                <option value="numeroPartecipazioni">Partecipazioni</option>
            </select>
        </div>
        <div class="form-field">
            <label for="filter-limit">Risultati per pagina</label>
            <select id="filter-limit" class="form-input">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        </div>
        <div class="filter-actions">
            <button class="button button-primary" id="filter-search-btn">Cerca</button>
            <button class="button button-secondary" id="filter-reset-btn">Reset</button>
        </div>
    `;
    document.getElementById('filter-search-btn').addEventListener('click', () => loadQuizzes(1));
    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        document.getElementById('filter-q').value = '';
        document.getElementById('filter-stato').value = '';
        loadQuizzes(1);
    });
    document.getElementById('filter-q').addEventListener('keydown', e => { if (e.key === 'Enter') loadQuizzes(1); });
}

function renderParticipationFilters() {
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-q">Ricerca testo</label>
            <input type="text" id="filter-q" class="form-input" placeholder="Utente, quiz...">
        </div>
        <div class="form-field">
            <label for="filter-dateFrom">Da data</label>
            <input type="date" id="filter-dateFrom" class="form-input">
        </div>
        <div class="form-field">
            <label for="filter-dateTo">A data</label>
            <input type="date" id="filter-dateTo" class="form-input">
        </div>
        <div class="form-field">
            <label for="filter-sort">Ordina per</label>
            <select id="filter-sort" class="form-input">
                <option value="data">Data</option>
                <option value="punteggioTotale">Punteggio</option>
                <option value="numeroRisposteDate">Risposte</option>
            </select>
        </div>
        <div class="form-field">
            <label for="filter-limit">Risultati per pagina</label>
            <select id="filter-limit" class="form-input">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        </div>
        <div class="filter-actions">
            <button class="button button-primary" id="filter-search-btn">Cerca</button>
            <button class="button button-secondary" id="filter-reset-btn">Reset</button>
        </div>
    `;
    document.getElementById('filter-search-btn').addEventListener('click', () => loadParticipations(1));
    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        document.getElementById('filter-q').value = '';
        document.getElementById('filter-dateFrom').value = '';
        document.getElementById('filter-dateTo').value = '';
        loadParticipations(1);
    });
    document.getElementById('filter-q').addEventListener('keydown', e => { if (e.key === 'Enter') loadParticipations(1); });
}

function renderManageUserFilters() {
    filterContainer.innerHTML = `
        <h2>Nuovo Utente</h2>
        <div class="form-field">
            <label for="crud-username">Username *</label>
            <input type="text" id="crud-username" class="form-input" required>
        </div>
        <div class="form-field">
            <label for="crud-nome">Nome *</label>
            <input type="text" id="crud-nome" class="form-input" required>
        </div>
        <div class="form-field">
            <label for="crud-cognome">Cognome *</label>
            <input type="text" id="crud-cognome" class="form-input" required>
        </div>
        <div class="form-field">
            <label for="crud-email">Email *</label>
            <input type="email" id="crud-email" class="form-input" required>
        </div>
        <div class="filter-actions">
            <button class="button button-primary" id="crud-create-btn">Crea Utente</button>
        </div>
        <div id="crud-feedback" class="alert" hidden></div>
    `;
    document.getElementById('crud-create-btn').addEventListener('click', () => handleCreateUser());
}

function renderEmptyFilters() {
    filterContainer.innerHTML = `
        <h2>Filtri</h2>
        <p class="filter-placeholder">Nessun filtro disponibile per questa sezione.</p>
    `;
}

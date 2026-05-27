/* ─── Filtri ──────────────────────────────────────── */

function getFilterValue(id) {
    return document.getElementById(id)?.value || '';
}

function clearFilters() {
    filterContainer.innerHTML = '';
}

function clearDateDefaults(root = filterContainer) {
    root.querySelectorAll('[data-date-filter]').forEach(input => {
        input.value = '';
        input.defaultValue = '';
        input.setAttribute('autocomplete', 'off');
    });
}

function snapshotFilterValues(root = filterContainer) {
    const values = {};
    root.querySelectorAll('input, select').forEach(element => {
        if (!element.id) return;
        values[element.id] = element.value;
    });
    return values;
}

function restoreFilterValues(values = {}, root = filterContainer) {
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element && !root.contains(element)) return;
        if (element) element.value = value;
    });
}

function dateFilterInput(id) {
    return `<input type="text" id="${id}" class="form-input" value="" placeholder="gg/mm/aaaa" pattern="\\d{2}/\\d{2}/\\d{4}" inputmode="numeric" autocomplete="off" data-date-filter data-date-picker>`;
}

/* Debounce: ritarda l'esecuzione fino a che l'utente smette di scrivere */
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

function minMaxFrom(items, key) {
    const values = items
        .map(item => Number(item[key]))
        .filter(value => Number.isFinite(value));
    if (values.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
}

function rangeField(id, label, min, max) {
    return `
        <div class="form-field" id="${id}-field">
            <label>${label}: <span class="range-labels"><span id="${id}-min-val">${min}</span> – <span id="${id}-max-val">${max}</span></span></label>
            <div class="dual-range">
                <input type="range" id="${id}-min" class="form-range" min="${min}" max="${max}" value="${min}" step="1">
                <input type="range" id="${id}-max" class="form-range" min="${min}" max="${max}" value="${max}" step="1">
            </div>
            <div class="range-anchors" id="${id}-anchors"></div>
        </div>
    `;
}

function dateDisplayToIso(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
    if (!match) return '';
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function getDateFilterValue(id) {
    return dateDisplayToIso(getFilterValue(id));
}

function buildRangeAnchors(min, max) {
    if (max <= min) return [min];
    const span = max - min;
    if (span <= 4) {
        return Array.from({ length: span + 1 }, (_, index) => min + index);
    }
    return [...new Set([0, 0.25, 0.5, 0.75, 1].map(pct => Math.round(min + span * pct)))];
}

function setupDualRange(id, onChange) {
    const minEl = document.getElementById(`${id}-min`);
    const maxEl = document.getElementById(`${id}-max`);
    const minVal = document.getElementById(`${id}-min-val`);
    const maxVal = document.getElementById(`${id}-max-val`);
    const anchors = document.getElementById(`${id}-anchors`);
    if (!minEl || !maxEl) return;

    const min = parseInt(minEl.min || '0');
    const max = parseInt(maxEl.max || '0');
    if (anchors) {
        anchors.innerHTML = buildRangeAnchors(min, max).map(value => `<span>${value}</span>`).join('');
    }

    const update = () => {
        if (parseInt(minEl.value) > parseInt(maxEl.value)) {
            const tmp = minEl.value;
            minEl.value = maxEl.value;
            maxEl.value = tmp;
        }
        if (minVal) minVal.textContent = minEl.value;
        if (maxVal) maxVal.textContent = maxEl.value;
    };

    minEl.addEventListener('input', () => { update(); onChange(); });
    maxEl.addEventListener('input', () => { update(); onChange(); });
    update();
}

function refreshRangeField(id) {
    const minEl = document.getElementById(`${id}-min`);
    const maxEl = document.getElementById(`${id}-max`);
    const minVal = document.getElementById(`${id}-min-val`);
    const maxVal = document.getElementById(`${id}-max-val`);
    if (!minEl || !maxEl) return;
    if (parseInt(minEl.value) > parseInt(maxEl.value)) {
        const tmp = minEl.value;
        minEl.value = maxEl.value;
        maxEl.value = tmp;
    }
    if (minVal) minVal.textContent = minEl.value;
    if (maxVal) maxVal.textContent = maxEl.value;
}

function getRangeFilter(id) {
    const minEl = document.getElementById(`${id}-min`);
    const maxEl = document.getElementById(`${id}-max`);
    return {
        min: minEl ? parseInt(minEl.value || minEl.min || '0') : null,
        max: maxEl ? parseInt(maxEl.value || maxEl.max || '0') : null,
        floor: minEl ? parseInt(minEl.min || '0') : null,
        ceiling: maxEl ? parseInt(maxEl.max || '0') : null,
    };
}

function getBoundedRangeParams(id, minKey, maxKey) {
    const range = getRangeFilter(id);
    const params = {};
    if (range.min !== null && range.floor !== null && range.min > range.floor) params[minKey] = range.min;
    if (range.max !== null && range.ceiling !== null && range.max < range.ceiling) params[maxKey] = range.max;
    return params;
}

function resetRangeField(id) {
    const range = getRangeFilter(id);
    const minEl = document.getElementById(`${id}-min`);
    const maxEl = document.getElementById(`${id}-max`);
    if (minEl && range.floor !== null) minEl.value = range.floor;
    if (maxEl && range.ceiling !== null) maxEl.value = range.ceiling;
    document.getElementById(`${id}-min-val`)?.replaceChildren(document.createTextNode(String(range.floor ?? 0)));
    document.getElementById(`${id}-max-val`)?.replaceChildren(document.createTextNode(String(range.ceiling ?? 0)));
}

function updateRangeBounds(id, min, max) {
    const normalizedMin = Number.isFinite(Number(min)) ? Number(min) : 0;
    const normalizedMax = Math.max(normalizedMin, Number.isFinite(Number(max)) ? Number(max) : normalizedMin);
    const minEl = document.getElementById(`${id}-min`);
    const maxEl = document.getElementById(`${id}-max`);
    if (!minEl || !maxEl) return;

    minEl.min = normalizedMin;
    minEl.max = normalizedMax;
    minEl.value = normalizedMin;
    maxEl.min = normalizedMin;
    maxEl.max = normalizedMax;
    maxEl.value = normalizedMax;
    document.getElementById(`${id}-min-val`)?.replaceChildren(document.createTextNode(String(normalizedMin)));
    document.getElementById(`${id}-max-val`)?.replaceChildren(document.createTextNode(String(normalizedMax)));

    const anchors = document.getElementById(`${id}-anchors`);
    if (anchors) {
        anchors.innerHTML = buildRangeAnchors(normalizedMin, normalizedMax).map(value => `<span>${value}</span>`).join('');
    }
}

/* ─── Filtri Ricerca Utenti ───────────────────────── */

async function renderUserFilters(onSearch, mode = 'extended', preservedValues = {}) {
    const isCompact = mode === 'compact';
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-username">Username</label>
            <input type="text" id="filter-username" class="form-input" placeholder="mario.rossi...">
        </div>
        <div class="form-field">
            <label for="filter-nome">Nome</label>
            <input type="text" id="filter-nome" class="form-input" placeholder="Mario...">
        </div>
        <div class="form-field">
            <label for="filter-cognome">Cognome</label>
            <input type="text" id="filter-cognome" class="form-input" placeholder="Rossi...">
        </div>
        ${!isCompact ? `
        <div class="form-field">
            <label for="filter-email">Email</label>
            <input type="text" id="filter-email" class="form-input" placeholder="@...">
        </div>
        <div class="form-field" id="quiz-slider-field">
            <label>Quiz creati: <span class="range-labels"><span id="quiz-min-val">0</span> – <span id="quiz-max-val">100</span></span></label>
            <div class="dual-range">
                <input type="range" id="filter-quiz-min" class="form-range" min="0" max="100" value="0" step="1">
                <input type="range" id="filter-quiz-max" class="form-range" min="0" max="100" value="100" step="1">
            </div>
            <!-- Ancore fisse (es: 0, max/2, max) -->
            <div class="range-anchors" id="quiz-anchors"></div>
        </div>
        <div class="form-field" id="part-slider-field">
            <label>Partecipazioni: <span class="range-labels"><span id="part-min-val">0</span> – <span id="part-max-val">200</span></span></label>
            <div class="dual-range">
                <input type="range" id="filter-part-min" class="form-range" min="0" max="200" value="0" step="1">
                <input type="range" id="filter-part-max" class="form-range" min="0" max="200" value="200" step="1">
            </div>
            <div class="range-anchors" id="part-anchors"></div>
        </div>
        ` : ''}
        <div class="filter-actions">
            <button class="button button-secondary" id="filter-reset-btn">Pulisci Filtri</button>
        </div>
    `;

    // Carichiamo i valori massimi reali dal DB
    try {
        const stats = await apiCall('user_stats');
        const realQuizMax = stats.data.quizMax || 100;
        const realPartMax = stats.data.partMax || 200;

        // Aggiorna slider quiz
        const qMinEl = document.getElementById('filter-quiz-min');
        const qMaxEl = document.getElementById('filter-quiz-max');
        if (qMinEl && qMaxEl) {
            qMinEl.max = realQuizMax;
            qMaxEl.max = realQuizMax;
            qMaxEl.value = realQuizMax;
            document.getElementById('quiz-max-val').textContent = realQuizMax;
            // Generiamo le ancore (0, 25%, 50%, 75%, 100%)
            const qAnchors = document.getElementById('quiz-anchors');
            if (qAnchors) {
                qAnchors.innerHTML = buildRangeAnchors(0, realQuizMax).map(value => `<span>${value}</span>`).join('');
            }
        }

        // Aggiorna slider partecipazioni
        const pMinEl = document.getElementById('filter-part-min');
        const pMaxEl = document.getElementById('filter-part-max');
        if (pMinEl && pMaxEl) {
            pMinEl.max = realPartMax;
            pMaxEl.max = realPartMax;
            pMaxEl.value = realPartMax;
            document.getElementById('part-max-val').textContent = realPartMax;
            const pAnchors = document.getElementById('part-anchors');
            if (pAnchors) {
                pAnchors.innerHTML = buildRangeAnchors(0, realPartMax).map(value => `<span>${value}</span>`).join('');
            }
        }
    } catch (e) {
        // Fallback silenzioso: gli slider restano con valori default
        console.warn('[QUIZZING] user_stats non disponibile:', e.message);
    }

    restoreFilterValues(preservedValues);

    const debouncedSearch = debounce(() => onSearch(1), 400);

    // Input testo — debounce
    ['filter-username', 'filter-nome', 'filter-cognome', 'filter-email'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedSearch);
    });

    // Sliders quiz
    const quizMin = document.getElementById('filter-quiz-min');
    const quizMax = document.getElementById('filter-quiz-max');
    const quizMinVal = document.getElementById('quiz-min-val');
    const quizMaxVal = document.getElementById('quiz-max-val');

    function updateQuizLabels() {
        if (!quizMin || !quizMax) return;
        // Evitiamo overlap invertito
        if (parseInt(quizMin.value) > parseInt(quizMax.value)) {
            const tmp = quizMin.value;
            quizMin.value = quizMax.value;
            quizMax.value = tmp;
        }
        quizMinVal.textContent = quizMin.value;
        quizMaxVal.textContent = parseInt(quizMax.value) >= parseInt(quizMax.max) ? quizMax.max + '+' : quizMax.value;
    }
    quizMin?.addEventListener('input', () => { updateQuizLabels(); debouncedSearch(); });
    quizMax?.addEventListener('input', () => { updateQuizLabels(); debouncedSearch(); });

    // Sliders partecipazioni
    const partMin = document.getElementById('filter-part-min');
    const partMax = document.getElementById('filter-part-max');
    const partMinVal = document.getElementById('part-min-val');
    const partMaxVal = document.getElementById('part-max-val');

    function updatePartLabels() {
        if (!partMin || !partMax) return;
        // Evitiamo overlap invertito
        if (parseInt(partMin.value) > parseInt(partMax.value)) {
            const tmp = partMin.value;
            partMin.value = partMax.value;
            partMax.value = tmp;
        }
        partMinVal.textContent = partMin.value;
        partMaxVal.textContent = parseInt(partMax.value) >= parseInt(partMax.max) ? partMax.max + '+' : partMax.value;
    }
    partMin?.addEventListener('input', () => { updatePartLabels(); debouncedSearch(); });
    partMax?.addEventListener('input', () => { updatePartLabels(); debouncedSearch(); });
    updateQuizLabels();
    updatePartLabels();

    // Pulisci Filtri
    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        ['filter-username', 'filter-nome', 'filter-cognome', 'filter-email'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        if (quizMin && quizMax) { quizMin.value = 0; quizMax.value = quizMax.max; updateQuizLabels(); }
        if (partMin && partMax) { partMin.value = 0; partMax.value = partMax.max; updatePartLabels(); }
        onSearch(1);
    });
}

function getUserFilterParams() {
    const quizMaxEl = document.getElementById('filter-quiz-max');
    const partMaxEl = document.getElementById('filter-part-max');
    return {
        fUsername: getFilterValue('filter-username'),
        fNome:     getFilterValue('filter-nome'),
        fCognome:  getFilterValue('filter-cognome'),
        fEmail:    getFilterValue('filter-email'),
        quizMin:   parseInt(getFilterValue('filter-quiz-min') || '0'),
        quizMax:   quizMaxEl && parseInt(quizMaxEl.value) >= parseInt(quizMaxEl.max) ? '' : getFilterValue('filter-quiz-max'),
        partMin:   parseInt(getFilterValue('filter-part-min') || '0'),
        partMax:   partMaxEl && parseInt(partMaxEl.value) >= parseInt(partMaxEl.max) ? '' : getFilterValue('filter-part-max'),
    };
}

/* ─── Filtri Dettaglio Utente (pannello sx) ───────── */

function renderUserDetailFilters(onFilterChange, mode = 'compact', user = null, preservedValues = {}) {
    const isCompact = mode === 'compact';
    const quizStats = minMaxFrom(user?.quizCreati || [], 'numeroDomande');
    const responseStats = minMaxFrom(user?.partecipazioni || [], 'numeroRisposteDate');
    const scoreStats = minMaxFrom(user?.partecipazioni || [], 'punteggioTotale');
    filterContainer.innerHTML = `
        <h2>Filtri Sezione</h2>
        <div class="filter-group">
            <h3 class="filter-group-title">Quiz creati</h3>
            <div class="form-field">
                <label for="ud-filter-quiz-title">Titolo</label>
                <input type="text" id="ud-filter-quiz-title" class="form-input" placeholder="Titolo...">
            </div>
            ${!isCompact ? `
            <div class="form-field">
                <label for="ud-filter-quiz-date-from">Da</label>
                ${dateFilterInput('ud-filter-quiz-date-from')}
            </div>
            <div class="form-field">
                <label for="ud-filter-quiz-date-to">A</label>
                ${dateFilterInput('ud-filter-quiz-date-to')}
            </div>
            ` : ''}
            ${rangeField('ud-filter-quiz-questions', 'Domande', quizStats.min, quizStats.max)}
        </div>
        <div class="filter-group">
            <h3 class="filter-group-title">Partecipazioni</h3>
            <div class="form-field">
                <label for="ud-filter-part-title">Quiz</label>
                <input type="text" id="ud-filter-part-title" class="form-input" placeholder="Quiz svolto...">
            </div>
            ${!isCompact ? `
            <div class="form-field">
                <label for="ud-filter-part-date-from">Da</label>
                ${dateFilterInput('ud-filter-part-date-from')}
            </div>
            <div class="form-field">
                <label for="ud-filter-part-date-to">A</label>
                ${dateFilterInput('ud-filter-part-date-to')}
            </div>
            ${rangeField('ud-filter-part-responses', 'Risposte', responseStats.min, responseStats.max)}
            ` : ''}
            ${rangeField('ud-filter-part-score', 'Punteggio', scoreStats.min, scoreStats.max)}
        </div>
        <div class="filter-actions">
            <button class="button button-secondary" id="ud-reset-btn">Pulisci Filtri</button>
        </div>
    `;
    clearDateDefaults();
    window.initDatePickers?.(filterContainer);
    restoreFilterValues(preservedValues);

    const debouncedChange = debounce(() => onFilterChange(), 400);
    [
        'ud-filter-quiz-title',
        'ud-filter-part-title',
        'ud-filter-quiz-date-from',
        'ud-filter-quiz-date-to',
        'ud-filter-part-date-from',
        'ud-filter-part-date-to',
    ].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedChange);
        document.getElementById(id)?.addEventListener('change', debouncedChange);
    });
    setupDualRange('ud-filter-quiz-questions', debouncedChange);
    setupDualRange('ud-filter-part-responses', debouncedChange);
    setupDualRange('ud-filter-part-score', debouncedChange);
    ['ud-filter-quiz-questions', 'ud-filter-part-responses', 'ud-filter-part-score'].forEach(refreshRangeField);

    document.getElementById('ud-reset-btn')?.addEventListener('click', () => {
        [
            'ud-filter-quiz-title',
            'ud-filter-part-title',
            'ud-filter-quiz-date-from',
            'ud-filter-quiz-date-to',
            'ud-filter-part-date-from',
            'ud-filter-part-date-to',
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['ud-filter-quiz-questions', 'ud-filter-part-responses', 'ud-filter-part-score'].forEach(id => {
            const range = getRangeFilter(id);
            const minEl = document.getElementById(`${id}-min`);
            const maxEl = document.getElementById(`${id}-max`);
            if (minEl && range.floor !== null) minEl.value = range.floor;
            if (maxEl && range.ceiling !== null) maxEl.value = range.ceiling;
            document.getElementById(`${id}-min-val`)?.replaceChildren(document.createTextNode(String(range.floor ?? 0)));
            document.getElementById(`${id}-max-val`)?.replaceChildren(document.createTextNode(String(range.ceiling ?? 0)));
        });
        onFilterChange();
    });
}

function getUserDetailFilterParams() {
    const quizQuestions = getRangeFilter('ud-filter-quiz-questions');
    const partResponses = getRangeFilter('ud-filter-part-responses');
    const partScore = getRangeFilter('ud-filter-part-score');
    return {
        quizTitle: getFilterValue('ud-filter-quiz-title').toLowerCase(),
        partTitle: getFilterValue('ud-filter-part-title').toLowerCase(),
        quizDateFrom: getDateFilterValue('ud-filter-quiz-date-from'),
        quizDateTo: getDateFilterValue('ud-filter-quiz-date-to'),
        partDateFrom: getDateFilterValue('ud-filter-part-date-from'),
        partDateTo: getDateFilterValue('ud-filter-part-date-to'),
        quizQuestions,
        partResponses,
        partScore,
    };
}

/* ─── Filtri Ricerca Quiz ─────────────────────────── */

async function renderQuizFilters(onSearch, mode = 'extended', preservedValues = {}) {
    const isCompact = mode === 'compact';
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-title">Titolo</label>
            <input type="text" id="filter-title" class="form-input" placeholder="Titolo quiz...">
        </div>
        <div class="form-field">
            <label for="filter-creator">Creatore</label>
            <input type="text" id="filter-creator" class="form-input" placeholder="Username creatore...">
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
        ${!isCompact ? `
        <div class="form-field">
            <label for="filter-code">Codice</label>
            <input type="text" id="filter-code" class="form-input" inputmode="numeric" placeholder="Codice quiz...">
        </div>
        <div class="form-field">
            <label for="filter-dateFrom">Da</label>
            ${dateFilterInput('filter-dateFrom')}
        </div>
        <div class="form-field">
            <label for="filter-dateTo">A</label>
            ${dateFilterInput('filter-dateTo')}
        </div>
        ${rangeField('filter-participations', 'Partecipazioni', 0, 0)}
        ` : ''}
        ${rangeField('filter-questions', 'Domande', 0, 0)}
        <div class="filter-actions">
            <button class="button button-secondary" id="filter-reset-btn">Pulisci Filtri</button>
        </div>
    `;
    clearDateDefaults();
    window.initDatePickers?.(filterContainer);

    const debouncedSearch = debounce(() => onSearch(1), 400);
    ['filter-title', 'filter-creator', 'filter-code'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedSearch);
    });
    document.getElementById('filter-stato')?.addEventListener('change', () => onSearch(1));
    document.getElementById('filter-dateFrom')?.addEventListener('change', () => onSearch(1));
    document.getElementById('filter-dateTo')?.addEventListener('change', () => onSearch(1));
    setupDualRange('filter-questions', debouncedSearch);
    setupDualRange('filter-participations', debouncedSearch);

    try {
        const stats = await apiCall('quiz_stats');
        updateRangeBounds('filter-questions', 0, stats.data.questionMax || 0);
        if (!isCompact) updateRangeBounds('filter-participations', 0, stats.data.participationMax || 0);
    } catch (e) {
        console.warn('[QUIZZING] quiz_stats non disponibile:', e.message);
    }

    restoreFilterValues(preservedValues);
    ['filter-questions', 'filter-participations'].forEach(refreshRangeField);

    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        ['filter-title', 'filter-creator', 'filter-stato', 'filter-code', 'filter-dateFrom', 'filter-dateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['filter-questions', 'filter-participations'].forEach(resetRangeField);
        onSearch(1);
    });
}

function getQuizFilterParams() {
    return {
        fTitolo:  getFilterValue('filter-title'),
        creatore: getFilterValue('filter-creator'),
        stato:    getFilterValue('filter-stato'),
        codice:   getFilterValue('filter-code'),
        dateFrom: getDateFilterValue('filter-dateFrom'),
        dateTo:   getDateFilterValue('filter-dateTo'),
        ...getBoundedRangeParams('filter-questions', 'questionMin', 'questionMax'),
        ...getBoundedRangeParams('filter-participations', 'participationMin', 'participationMax'),
    };
}

/* ─── Filtri Dettaglio Quiz (pannello sx) ─────────── */

function renderQuizDetailFilters(onFilterChange) {
    filterContainer.innerHTML = `
        <h2>Filtra Domande</h2>
        <div class="form-field">
            <label for="qf-numero">N° domanda</label>
            <input type="number" id="qf-numero" class="form-input" min="1" placeholder="Es. 3">
        </div>
        <div class="form-field">
            <label for="qf-testo">Testo domanda</label>
            <input type="text" id="qf-testo" class="form-input" placeholder="Cerca nel testo...">
        </div>
        <div class="form-field">
            <label for="qf-risposta">Testo risposta</label>
            <input type="text" id="qf-risposta" class="form-input" placeholder="Cerca nelle risposte...">
        </div>
        <div class="filter-actions">
            <button class="button button-secondary" id="qf-clear">Pulisci Filtri</button>
        </div>
        <div id="solutions-toggle-container" style="margin-top: 16px;">
            <h2>Opzioni</h2>
            <button class="button button-secondary" id="solutions-toggle-btn" style="width:100%">Mostra soluzioni</button>
        </div>
    `;

    const debouncedChange = debounce(() => onFilterChange(), 300);
    ['qf-numero', 'qf-testo', 'qf-risposta'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedChange);
    });

    document.getElementById('qf-clear')?.addEventListener('click', () => {
        ['qf-numero', 'qf-testo', 'qf-risposta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        onFilterChange();
    });
}

/* ─── Filtri Dettaglio Partecipazione (pannello sx) ─ */

function renderParticipationDetailFilters(onFilterChange) {
    filterContainer.innerHTML = `
        <h2>Filtra Domande</h2>
        <div class="form-field">
            <label for="pf-numero">N° domanda</label>
            <input type="number" id="pf-numero" class="form-input" min="1" placeholder="Es. 3">
        </div>
        <div class="form-field">
            <label for="pf-testo">Testo domanda</label>
            <input type="text" id="pf-testo" class="form-input" placeholder="Cerca nel testo...">
        </div>
        <div class="form-field">
            <label for="pf-risposta">Testo risposta</label>
            <input type="text" id="pf-risposta" class="form-input" placeholder="Cerca nelle risposte...">
        </div>
        <div class="filter-actions">
            <button class="button button-secondary" id="pf-clear">Pulisci Filtri</button>
        </div>
    `;

    const debouncedChange = debounce(() => onFilterChange(), 300);
    ['pf-numero', 'pf-testo', 'pf-risposta'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedChange);
    });

    document.getElementById('pf-clear')?.addEventListener('click', () => {
        ['pf-numero', 'pf-testo', 'pf-risposta'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        onFilterChange();
    });
}

/* ─── Filtri Ricerca Partecipazioni ───────────────── */

async function renderParticipationFilters(onSearch, mode = 'extended', preservedValues = {}) {
    const isCompact = mode === 'compact';
    filterContainer.innerHTML = `
        <h2>Filtri Ricerca</h2>
        <div class="form-field">
            <label for="filter-user">Utente</label>
            <input type="text" id="filter-user" class="form-input" placeholder="Username...">
        </div>
        <div class="form-field">
            <label for="filter-title">Quiz</label>
            <input type="text" id="filter-title" class="form-input" placeholder="Titolo quiz...">
        </div>
        ${!isCompact ? `
        <div class="form-field">
            <label for="filter-code">Codice</label>
            <input type="text" id="filter-code" class="form-input" inputmode="numeric" placeholder="Codice partecipazione...">
        </div>
        <div class="form-field">
            <label for="filter-dateFrom">Da</label>
            ${dateFilterInput('filter-dateFrom')}
        </div>
        <div class="form-field">
            <label for="filter-dateTo">A</label>
            ${dateFilterInput('filter-dateTo')}
        </div>
        ` : ''}
        ${rangeField('filter-responses', 'Risposte', 0, 0)}
        ${rangeField('filter-score', 'Punteggio', 0, 0)}
        <div class="filter-actions">
            <button class="button button-secondary" id="filter-reset-btn">Pulisci Filtri</button>
        </div>
    `;
    clearDateDefaults();
    window.initDatePickers?.(filterContainer);

    const debouncedSearch = debounce(() => onSearch(1), 400);
    ['filter-user', 'filter-title', 'filter-code'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', debouncedSearch);
    });
    document.getElementById('filter-dateFrom')?.addEventListener('change', () => onSearch(1));
    document.getElementById('filter-dateTo')?.addEventListener('change', () => onSearch(1));
    setupDualRange('filter-responses', debouncedSearch);
    setupDualRange('filter-score', debouncedSearch);

    try {
        const stats = await apiCall('participation_stats');
        updateRangeBounds('filter-responses', 0, stats.data.responseMax || 0);
        updateRangeBounds('filter-score', 0, stats.data.scoreMax || 0);
    } catch (e) {
        console.warn('[QUIZZING] participation_stats non disponibile:', e.message);
    }

    restoreFilterValues(preservedValues);
    ['filter-responses', 'filter-score'].forEach(refreshRangeField);

    document.getElementById('filter-reset-btn').addEventListener('click', () => {
        ['filter-user', 'filter-title', 'filter-code', 'filter-dateFrom', 'filter-dateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['filter-responses', 'filter-score'].forEach(resetRangeField);
        onSearch(1);
    });
}

function getParticipationFilterParams() {
    return {
        fUtente:     getFilterValue('filter-user'),
        fTitoloQuiz: getFilterValue('filter-title'),
        codice:      getFilterValue('filter-code'),
        dateFrom:    getDateFilterValue('filter-dateFrom'),
        dateTo:      getDateFilterValue('filter-dateTo'),
        ...getBoundedRangeParams('filter-responses', 'responseMin', 'responseMax'),
        ...getBoundedRangeParams('filter-score', 'scoreMin', 'scoreMax'),
    };
}

/* ─── Filtri Gestione Utenti ──────────────────────── */

function renderManageUserFilters(onSearch) {
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
        <hr style="margin: 16px 0; border-color: var(--border);">
        <h2>Cerca Utente</h2>
        <div class="form-field">
            <label for="manage-filter-q">Filtro</label>
            <input type="text" id="manage-filter-q" class="form-input" placeholder="Nome, username...">
        </div>
    `;

    document.getElementById('crud-create-btn').addEventListener('click', () => handleCreateUser());

    if (onSearch) {
        const debouncedSearch = debounce(() => onSearch(), 400);
        document.getElementById('manage-filter-q')?.addEventListener('input', debouncedSearch);
    }
}

function renderEmptyFilters() {
    filterContainer.innerHTML = `
        <h2>Filtri</h2>
        <p class="filter-placeholder">Nessun filtro disponibile per questa sezione.</p>
    `;
}

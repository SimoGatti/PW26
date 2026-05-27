/* ─── Dettaglio quiz ──────────────────────────────── */

async function renderQuizDetail(codice) {
    renderLoading();

    try {
        const result = await apiCall('quiz_detail', { codice });
        const quiz   = result.data;
        const container = document.createElement('div');
        container.className = 'detail-container';

        // ── Header: titolo + meta ─────────────────────
        const creatoreName = quiz.creatoreDettaglio
            ? `${quiz.creatoreDettaglio.nome} ${quiz.creatoreDettaglio.cognome}`
            : quiz.creatore;
        const creatoreEmail = quiz.creatoreDettaglio?.email ?? '';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'detail-header';
        headerDiv.innerHTML = `
            <div class="detail-header-top">
                <h3 class="detail-title">${quiz.titolo}</h3>
            </div>
            <div class="detail-meta">
                <span class="detail-meta-item"><strong>Codice:</strong> ${quiz.codice}</span>
                <span class="detail-meta-item"><strong>Creatore:</strong>
                    <a href="#" class="detail-link" data-view="user-detail" data-id="${encodeURIComponent(quiz.creatore)}">${creatoreName}</a>
                    ${creatoreEmail ? `<span style="color:var(--text-secondary);font-size:0.8em"> — ${creatoreEmail}</span>` : ''}
                </span>
                <span class="detail-meta-item"><strong>Periodo:</strong> ${formatDate(quiz.dataInizio)} — ${formatDate(quiz.dataFine)}</span>
                <span class="detail-meta-item"><strong>Domande:</strong> ${quiz.numeroDomande}</span>
                <span class="detail-meta-item"><strong>Partecipazioni:</strong> ${quiz.numeroPartecipazioni}</span>
                <span class="detail-meta-item"><strong>Stato:</strong> ${createStateBadge(quiz.stato || 'aperto').outerHTML}</span>
            </div>
        `;
        headerDiv.querySelector('.detail-header-top').appendChild(createBackButton('ricerca-quiz'));

        // ── Pulsante Partecipa ────────────────────────
        const partBtn = document.createElement('button');
        partBtn.className = 'button button-primary';
        partBtn.dataset.quiz = quiz.codice;
        if (quiz.stato === 'aperto') {
            partBtn.textContent = 'Partecipa al quiz';
            partBtn.id = 'start-participation-btn';
        } else {
            partBtn.textContent = quiz.stato === 'futuro'
                ? `Non ancora aperto (inizia il ${formatDate(quiz.dataInizio)})`
                : 'Quiz chiuso';
            partBtn.disabled = true;
        }
        headerDiv.appendChild(partBtn);
        container.appendChild(headerDiv);

        // ── Sezione domande collassabile ──────────────
        const details = document.createElement('details');
        details.open  = true;
        // Soluzioni nascoste di default
        details.classList.add('solutions-hidden');

        const summary = document.createElement('summary');
        summary.className = 'detail-section-title';
        summary.style.cssText = 'cursor:pointer; margin-bottom:10px;';
        summary.textContent = `Domande (${quiz.domande.length})`;
        details.appendChild(summary);

        // ── Cards domande ─────────────────────────────
        const cardsWrapper = document.createElement('div');
        cardsWrapper.id = 'quiz-questions-wrapper';

        quiz.domande.forEach(d => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.dataset.numero = d.numero;
            qCard.dataset.testo  = d.testo.toLowerCase();
            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">${d.numero}</span>
                    <span class="question-text">${d.testo}</span>
                </div>
                <ul class="answer-list">
                    ${d.risposte.map(r => `
                        <li class="answer-item ${isCorrectAnswer(r) ? 'answer-correct' : ''}"
                            data-testo="${r.testo.toLowerCase()}">
                            ${r.testo}
                            ${isCorrectAnswer(r) ? `<span class="answer-score">(${r.punteggio || 0} pt)</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            `;
            cardsWrapper.appendChild(qCard);
        });
        details.appendChild(cardsWrapper);
        container.appendChild(details);

        // ── Rendering nel DOM ─────────────────────────
        centerContent.replaceChildren(container);

        // ── Filtri nel pannello sinistro ──────────────
        function applyQuizFilters() {
            const numero   = parseInt(document.getElementById('qf-numero')?.value   || '0');
            const testo    = (document.getElementById('qf-testo')?.value    || '').toLowerCase();
            const risposta = (document.getElementById('qf-risposta')?.value || '').toLowerCase();

            cardsWrapper.querySelectorAll('.question-card').forEach(card => {
                let show = true;
                if (numero > 0 && parseInt(card.dataset.numero) !== numero) show = false;
                if (testo  && !card.dataset.testo.includes(testo))           show = false;
                if (risposta) {
                    const hasMatch = [...card.querySelectorAll('.answer-item')]
                        .some(li => (li.dataset.testo || '').includes(risposta));
                    if (!hasMatch) show = false;
                }
                card.classList.toggle('hidden-by-filter', !show);
            });
        }

        renderQuizDetailFilters(applyQuizFilters);

        // ── Toggle mostra/nascondi soluzioni (nel pannello sx) ───────
        let solutionsVisible = false; // default: nascoste
        const toggleSolBtn = document.getElementById('solutions-toggle-btn');
        if (toggleSolBtn) {
            toggleSolBtn.addEventListener('click', () => {
                solutionsVisible = !solutionsVisible;
                details.classList.toggle('solutions-hidden', !solutionsVisible);
                toggleSolBtn.textContent = solutionsVisible ? 'Nascondi soluzioni' : 'Mostra soluzioni';
            });
        }

        // ── Event listeners sui link del creatore ─────
        container.querySelectorAll('.detail-link').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                navigateTo(el.dataset.view, { id: el.dataset.id });
            });
        });

        document.getElementById('start-participation-btn')?.addEventListener('click', () => {
            const selectedUser = userSelect?.value;
            if (!selectedUser) {
                renderParticipationUserWarning(quiz.codice);
                return;
            }
            startParticipation(selectedUser, quiz.codice);
        });

    } catch (err) {
        renderEmptyFilters();
        renderError(err.message);
    }
}

function renderParticipationUserWarning(quizCodice) {
    const container = document.createElement('div');
    container.className = 'detail-container';
    container.innerHTML = `
        <div class="alert alert-warning">
            Seleziona un utente dal pannello a sinistra prima di partecipare.
        </div>
        <div class="detail-header-top">
            <button type="button" class="button button-primary" id="resume-participation-btn" disabled>Continua al quiz</button>
        </div>
    `;
    container.querySelector('.detail-header-top').appendChild(createBackButton('ricerca-quiz'));
    centerContent.replaceChildren(container);

    const resumeBtn = container.querySelector('#resume-participation-btn');
    const tryStart = () => {
        const selectedUser = userSelect?.value;
        resumeBtn.disabled = !selectedUser;
        if (selectedUser) {
            resumeBtn.textContent = `Continua come ${selectedUser}`;
        }
    };
    resumeBtn.addEventListener('click', () => {
        const selectedUser = userSelect?.value;
        if (selectedUser) startParticipation(selectedUser, quizCodice);
    });
    userSelect?.addEventListener('change', tryStart);
    tryStart();
}

/* ─── Dettaglio utente ────────────────────────────── */

async function renderUserDetail(nomeUtente) {
    renderLoading();

    try {
        const result = await apiCall('user_detail', { nomeUtente });
        const user   = result.data;

        // Stato sort locale per le tabelle interne
        const quizSort = { key: 'dataInizio', dir: 'DESC' };
        const partSort = { key: 'data',        dir: 'DESC' };
        let   viewMode = 'compact';
        const filterMemory = { values: {} };

        // ── Filtri nel pannello sinistro ──────────────
        renderUserDetailFilters(() => {
            filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
            renderUserDetailContent(user, quizSort, partSort, viewMode, (vm) => { viewMode = vm; }, filterMemory);
        }, viewMode, user);

        renderUserDetailContent(user, quizSort, partSort, viewMode, (vm) => { viewMode = vm; }, filterMemory);

    } catch (err) {
        renderEmptyFilters();
        renderError(err.message);
    }
}

function renderUserDetailContent(user, quizSort, partSort, viewMode, setViewMode, filterMemory = { values: {} }) {
    const {
        quizTitle,
        partTitle,
        quizDateFrom,
        quizDateTo,
        partDateFrom,
        partDateTo,
        quizQuestions,
        partResponses,
        partScore,
    } = getUserDetailFilterParams();

    const container = document.createElement('div');
    container.className = 'detail-container';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'detail-header';
    headerDiv.innerHTML = `
        <div class="detail-header-top">
            <h3 class="detail-title">${user.nome} ${user.cognome}</h3>
        </div>
        <div class="detail-meta">
            <span class="detail-meta-item"><strong>Username:</strong> ${user.nomeUtente}</span>
            <span class="detail-meta-item"><strong>Email:</strong> ${user.email}</span>
            ${String(user.Attivo) === '0' ? '<span class="badge badge-chiuso">Utente eliminato</span>' : ''}
            <span class="detail-meta-item"><strong>Quiz creati:</strong> ${user.numeroQuizCreati}</span>
            <span class="detail-meta-item"><strong>Partecipazioni:</strong> ${user.numeroPartecipazioni}</span>
        </div>
    `;
    headerDiv.querySelector('.detail-header-top').appendChild(createBackButton('ricerca-utenti'));
    container.appendChild(headerDiv);

    function sortRows(arr, sortState) {
        const multiplier = sortState.dir === 'DESC' ? -1 : 1;
        return [...arr].sort((a, b) => {
            const va = a[sortState.key] ?? '';
            const vb = b[sortState.key] ?? '';
            const na = Number(va);
            const nb = Number(vb);
            const cmp = Number.isFinite(na) && Number.isFinite(nb)
                ? na - nb
                : String(va).localeCompare(String(vb));
            return cmp * multiplier;
        });
    }

    function rangeIncludes(range, value) {
        if (!range || range.min === null || range.max === null) return true;
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return true;
        return numericValue >= range.min && numericValue <= range.max;
    }

    const filteredQuiz = user.quizCreati.filter(q =>
        (!quizTitle || q.titolo?.toLowerCase().includes(quizTitle)) &&
        (!quizDateFrom || q.dataInizio >= quizDateFrom) &&
        (!quizDateTo || q.dataFine <= quizDateTo) &&
        rangeIncludes(quizQuestions, q.numeroDomande)
    );
    const filteredPart = user.partecipazioni.filter(p =>
        (!partTitle || p.titoloQuiz?.toLowerCase().includes(partTitle)) &&
        (!partDateFrom || p.data >= partDateFrom) &&
        (!partDateTo || p.data <= partDateTo) &&
        rangeIncludes(partResponses, p.numeroRisposteDate) &&
        rangeIncludes(partScore, p.punteggioTotale)
    );

    const sortedQuiz = sortRows(filteredQuiz, quizSort);
    const sortedPart = sortRows(filteredPart, partSort);

    // ── Toggle compatta/estesa (sticky, non sposta la pagina) ─────
    const toggleBar = document.createElement('div');
    toggleBar.className = 'view-toggle-bar';
    toggleBar.appendChild(createViewToggle(
        () => {
            filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
            setViewMode('compact');
            renderUserDetailFilters(() => {
                filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
                renderUserDetailContent(user, quizSort, partSort, 'compact', setViewMode, filterMemory);
            }, 'compact', user, filterMemory.values);
            renderUserDetailContent(user, quizSort, partSort, 'compact', setViewMode, filterMemory);
        },
        () => {
            filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
            setViewMode('extended');
            renderUserDetailFilters(() => {
                filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
                renderUserDetailContent(user, quizSort, partSort, 'extended', setViewMode, filterMemory);
            }, 'extended', user, filterMemory.values);
            renderUserDetailContent(user, quizSort, partSort, 'extended', setViewMode, filterMemory);
        },
        viewMode
    ));
    container.appendChild(toggleBar);

    // ── Sezione Quiz Creati ───────────────────────────────────────
    const quizSection = document.createElement('div');
    quizSection.className = 'detail-section';
    quizSection.innerHTML = `<h4 class="detail-section-title">Quiz Creati (${filteredQuiz.length})</h4>`;

    const allQuizCols = [
        { label: 'Titolo',  sortKey: 'titolo',      render: r => createLink(r.titolo, `?view=quiz-detail&id=${r.codice}`) },
        { label: 'Inizio',  sortKey: 'dataInizio',  render: r => document.createTextNode(formatDate(r.dataInizio)), numeric: true },
        { label: 'Fine',    sortKey: 'dataFine',    render: r => document.createTextNode(formatDate(r.dataFine)),   numeric: true },
        { label: 'Domande', sortKey: 'numeroDomande', key: 'numeroDomande', numeric: true },
    ];
    const compactQuizCols = [
        { label: 'Titolo', sortKey: 'titolo', render: r => createLink(r.titolo, `?view=quiz-detail&id=${r.codice}`) },
        { label: 'Domande', sortKey: 'numeroDomande', key: 'numeroDomande', numeric: true },
    ];

    if (filteredQuiz.length > 0) {
        quizSection.appendChild(renderTable({
            columns: viewMode === 'compact' ? compactQuizCols : allQuizCols,
            rows: sortedQuiz,
            emptyMsg: 'Nessun quiz creato.',
            sortState: quizSort,
            onSort: (key, dir) => {
                quizSort.key = key; quizSort.dir = dir;
                filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
                renderUserDetailContent(user, quizSort, partSort, viewMode, setViewMode, filterMemory);
            },
        }));
    } else {
        quizSection.insertAdjacentHTML('beforeend', '<p class="empty-state">Nessun quiz trovato.</p>');
    }
    container.appendChild(quizSection);

    // ── Sezione Partecipazioni ────────────────────────────────────
    const partSection = document.createElement('div');
    partSection.className = 'detail-section';
    partSection.innerHTML = `<h4 class="detail-section-title">Partecipazioni (${filteredPart.length})</h4>`;

    const allPartCols = [
        { label: 'Quiz',      sortKey: 'titoloQuiz',       render: r => createLink(r.titoloQuiz, `?view=quiz-detail&id=${r.quiz}`) },
        { label: 'Data',      sortKey: 'data',             render: r => document.createTextNode(formatDate(r.data)), numeric: true },
        { label: 'Risposte',  sortKey: 'numeroRisposteDate', key: 'numeroRisposteDate', numeric: true },
        { label: 'Punteggio', sortKey: 'punteggioTotale',    key: 'punteggioTotale',    numeric: true },
    ];
    const compactPartCols = [
        { label: 'Quiz',      sortKey: 'titoloQuiz',      render: r => createLink(r.titoloQuiz, `?view=quiz-detail&id=${r.quiz}`) },
        { label: 'Punteggio', sortKey: 'punteggioTotale', key: 'punteggioTotale', numeric: true },
    ];

    if (filteredPart.length > 0) {
        partSection.appendChild(renderTable({
            columns: viewMode === 'compact' ? compactPartCols : allPartCols,
            rows: sortedPart,
            emptyMsg: 'Nessuna partecipazione.',
            sortState: partSort,
            onSort: (key, dir) => {
                partSort.key = key; partSort.dir = dir;
                filterMemory.values = { ...filterMemory.values, ...snapshotFilterValues() };
                renderUserDetailContent(user, quizSort, partSort, viewMode, setViewMode, filterMemory);
            },
        }));
    } else {
        partSection.insertAdjacentHTML('beforeend', '<p class="empty-state">Nessuna partecipazione trovata.</p>');
    }
    container.appendChild(partSection);

    centerContent.replaceChildren(container);
}

/* ─── Dettaglio partecipazione ────────────────────── */

async function renderParticipationDetail(codice) {
    renderLoading();

    try {
        const result = await apiCall('participation_detail', { codice });
        const part   = result.data;
        const container = document.createElement('div');
        container.className = 'detail-container';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'detail-header';
        headerDiv.innerHTML = `
            <div class="detail-header-top">
                <h3 class="detail-title">Partecipazione #${part.codice}</h3>
            </div>
            <div class="detail-meta">
                <span class="detail-meta-item"><strong>Utente:</strong>
                    <a href="#" class="detail-link" data-view="user-detail" data-id="${encodeURIComponent(part.utente)}">${part.nome} ${part.cognome}</a>
                </span>
                <span class="detail-meta-item"><strong>Quiz:</strong>
                    <a href="#" class="detail-link" data-view="quiz-detail" data-id="${part.quiz}">${part.titoloQuiz}</a>
                </span>
                <span class="detail-meta-item"><strong>Data:</strong> ${formatDate(part.data)}</span>
                <span class="detail-meta-item"><strong>Risposte date:</strong> ${part.numeroRisposteDate}</span>
                <span class="detail-meta-item"><strong>Punteggio totale:</strong> ${part.punteggioTotale}</span>
            </div>
        `;
        headerDiv.querySelector('.detail-header-top').appendChild(createBackButton('ricerca-partecipazioni'));
        container.appendChild(headerDiv);

        // ── Sezione domande collassabile ──────────────
        const details = document.createElement('details');
        details.open  = true;

        const summary = document.createElement('summary');
        summary.className = 'detail-section-title';
        summary.style.cssText = 'cursor:pointer; margin-bottom:10px;';
        summary.textContent = 'Domande e Risposte';
        details.appendChild(summary);

        const cardsWrapper = document.createElement('div');
        cardsWrapper.id = 'part-questions-wrapper';

        part.domande.forEach(d => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.dataset.numero = d.numero;
            qCard.dataset.testo  = d.testo.toLowerCase();

            const answersHtml = d.risposte.map(r => {
                const isCorrect = isCorrectAnswer(r);
                const cls = r.selezionata && isCorrect ? 'answer-selected-correct'
                          : r.selezionata             ? 'answer-selected-wrong'
                          : isCorrect                 ? 'answer-correct' : '';
                const suffix = r.selezionata ? ' ✓' : '';
                const score  = isCorrect ? ` <span class="answer-score">(${r.punteggio || 0} pt)</span>` : '';
                return `<li class="answer-item ${cls}" data-testo="${r.testo.toLowerCase()}">${r.testo}${suffix}${score}</li>`;
            }).join('');

            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">${d.numero}</span>
                    <span class="question-text">${d.testo}</span>
                </div>
                <ul class="answer-list">${answersHtml}</ul>
            `;
            cardsWrapper.appendChild(qCard);
        });
        details.appendChild(cardsWrapper);
        container.appendChild(details);

        // ── Rendering nel DOM prima di attaccare filtri ───────────
        centerContent.replaceChildren(container);

        // ── Filtri nel pannello sinistro ──────────────
        function applyPartFilters() {
            const numero   = parseInt(document.getElementById('pf-numero')?.value   || '0');
            const testo    = (document.getElementById('pf-testo')?.value    || '').toLowerCase();
            const risposta = (document.getElementById('pf-risposta')?.value || '').toLowerCase();
            cardsWrapper.querySelectorAll('.question-card').forEach(card => {
                let show = true;
                if (numero > 0 && parseInt(card.dataset.numero) !== numero) show = false;
                if (testo  && !card.dataset.testo.includes(testo))           show = false;
                if (risposta) {
                    const hasMatch = [...card.querySelectorAll('.answer-item')]
                        .some(li => (li.dataset.testo || '').includes(risposta));
                    if (!hasMatch) show = false;
                }
                card.classList.toggle('hidden-by-filter', !show);
            });
        }

        renderParticipationDetailFilters(applyPartFilters);

        container.querySelectorAll('.detail-link').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                navigateTo(el.dataset.view, { id: el.dataset.id });
            });
        });

    } catch (err) {
        renderEmptyFilters();
        renderError(err.message);
    }
}

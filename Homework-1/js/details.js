/* ─── Dettaglio quiz ──────────────────────────────── */

async function renderQuizDetail(codice) {
    clearFilters();
    renderEmptyFilters();
    renderLoading();

    try {
        const result = await apiCall('quiz_detail', { codice });
        const quiz = result.data;
        const container = document.createElement('div');
        container.className = 'detail-container';

        container.innerHTML = `
            <div class="detail-header">
                <h3 class="detail-title">${quiz.titolo}</h3>
                <div class="detail-meta">
                    <span class="detail-meta-item"><strong>Codice:</strong> ${quiz.codice}</span>
                    <span class="detail-meta-item"><strong>Creatore:</strong> <a href="#" class="detail-link" data-view="user-detail" data-id="${encodeURIComponent(quiz.creatore)}">${quiz.creatore}</a></span>
                    <span class="detail-meta-item"><strong>Periodo:</strong> ${formatDate(quiz.dataInizio)} — ${formatDate(quiz.dataFine)}</span>
                    <span class="detail-meta-item"><strong>Domande:</strong> ${quiz.numeroDomande}</span>
                    <span class="detail-meta-item"><strong>Partecipazioni:</strong> ${quiz.numeroPartecipazioni}</span>
                    <span class="detail-meta-item"><strong>Stato:</strong> ${createStateBadge(quiz.stato || 'aperto').outerHTML}</span>
                </div>
                <button class="button button-primary" id="start-participation-btn" data-quiz="${quiz.codice}">Partecipa al quiz</button>
            </div>
        `;

        if (quiz.creatoreDettaglio) {
            const creatorDiv = document.createElement('div');
            creatorDiv.className = 'detail-section';
            creatorDiv.innerHTML = `<h4 class="detail-section-title">Creatore</h4>
                <p>${quiz.creatoreDettaglio.nome} ${quiz.creatoreDettaglio.cognome} — ${quiz.creatoreDettaglio.email}</p>`;
            container.appendChild(creatorDiv);
        }

        const questionsDiv = document.createElement('div');
        questionsDiv.className = 'detail-section';
        questionsDiv.innerHTML = `<h4 class="detail-section-title">Domande (${quiz.domande.length})</h4>`;

        quiz.domande.forEach(d => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">${d.numero}</span>
                    <span class="question-text">${d.testo}</span>
                </div>
                <ul class="answer-list">
                    ${d.risposte.map(r => `<li class="answer-item ${isCorrectAnswer(r) ? 'answer-correct' : ''}">${r.testo} <span class="answer-score">(${r.punteggio || 0} pt)</span></li>`).join('')}
                </ul>
            `;
            questionsDiv.appendChild(qCard);
        });

        container.appendChild(questionsDiv);
        centerContent.replaceChildren(container);

        container.querySelectorAll('.detail-link').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                navigateTo(el.dataset.view, { id: el.dataset.id });
            });
        });

        document.getElementById('start-participation-btn')?.addEventListener('click', () => {
            const selectedUser = userSelect.value;
            if (!selectedUser) {
                renderMessage('Seleziona un utente dal pannello a sinistra prima di partecipare.');
                return;
            }
            startParticipation(selectedUser, quiz.codice);
        });
    } catch (err) {
        renderError(err.message);
    }
}

/* ─── Dettaglio utente ────────────────────────────── */

async function renderUserDetail(nomeUtente) {
    clearFilters();
    renderEmptyFilters();
    renderLoading();

    try {
        const result = await apiCall('user_detail', { nomeUtente });
        const user = result.data;
        const container = document.createElement('div');
        container.className = 'detail-container';

        container.innerHTML = `
            <div class="detail-header">
                <h3 class="detail-title">${user.nome} ${user.cognome}</h3>
                <div class="detail-meta">
                    <span class="detail-meta-item"><strong>Username:</strong> ${user.nomeUtente}</span>
                    <span class="detail-meta-item"><strong>Email:</strong> ${user.email}</span>
                    <span class="detail-meta-item"><strong>Quiz creati:</strong> ${user.numeroQuizCreati}</span>
                    <span class="detail-meta-item"><strong>Partecipazioni:</strong> ${user.numeroPartecipazioni}</span>
                </div>
            </div>
        `;

        const quizSection = document.createElement('div');
        quizSection.className = 'detail-section';
        quizSection.innerHTML = `<h4 class="detail-section-title">Quiz Creati (${user.quizCreati.length})</h4>`;
        if (user.quizCreati.length > 0) {
            quizSection.appendChild(renderTable({
                columns: [
                    { label: 'Codice', render: r => createLink(r.codice, `?view=quiz-detail&id=${r.codice}`) },
                    { label: 'Titolo', render: r => createLink(r.titolo, `?view=quiz-detail&id=${r.codice}`) },
                    { label: 'Inizio', render: r => document.createTextNode(formatDate(r.dataInizio)) },
                    { label: 'Fine', render: r => document.createTextNode(formatDate(r.dataFine)) },
                    { key: 'numeroDomande', label: 'Domande' },
                ],
                rows: user.quizCreati,
                emptyMsg: 'Nessun quiz creato.'
            }));
        } else {
            quizSection.innerHTML += '<p class="empty-state">Nessun quiz creato.</p>';
        }
        container.appendChild(quizSection);

        const partSection = document.createElement('div');
        partSection.className = 'detail-section';
        partSection.innerHTML = `<h4 class="detail-section-title">Partecipazioni (${user.partecipazioni.length})</h4>`;
        if (user.partecipazioni.length > 0) {
            partSection.appendChild(renderTable({
                columns: [
                    { label: 'Codice', render: r => createLink(r.codice, `?view=participation-detail&id=${r.codice}`) },
                    { label: 'Quiz', render: r => createLink(r.titoloQuiz, `?view=quiz-detail&id=${r.quiz}`) },
                    { label: 'Data', render: r => document.createTextNode(formatDate(r.data)) },
                    { key: 'numeroRisposteDate', label: 'Risposte' },
                    { key: 'punteggioTotale', label: 'Punteggio' },
                ],
                rows: user.partecipazioni,
                emptyMsg: 'Nessuna partecipazione.'
            }));
        } else {
            partSection.innerHTML += '<p class="empty-state">Nessuna partecipazione.</p>';
        }
        container.appendChild(partSection);

        centerContent.replaceChildren(container);
    } catch (err) {
        renderError(err.message);
    }
}

/* ─── Dettaglio partecipazione ────────────────────── */

async function renderParticipationDetail(codice) {
    clearFilters();
    renderEmptyFilters();
    renderLoading();

    try {
        const result = await apiCall('participation_detail', { codice });
        const part = result.data;
        const container = document.createElement('div');
        container.className = 'detail-container';

        container.innerHTML = `
            <div class="detail-header">
                <h3 class="detail-title">Partecipazione #${part.codice}</h3>
                <div class="detail-meta">
                    <span class="detail-meta-item"><strong>Utente:</strong> <a href="#" class="detail-link" data-view="user-detail" data-id="${encodeURIComponent(part.utente)}">${part.nome} ${part.cognome}</a></span>
                    <span class="detail-meta-item"><strong>Quiz:</strong> <a href="#" class="detail-link" data-view="quiz-detail" data-id="${part.quiz}">${part.titoloQuiz}</a></span>
                    <span class="detail-meta-item"><strong>Data:</strong> ${formatDate(part.data)}</span>
                    <span class="detail-meta-item"><strong>Risposte date:</strong> ${part.numeroRisposteDate}</span>
                    <span class="detail-meta-item"><strong>Punteggio totale:</strong> ${part.punteggioTotale}</span>
                </div>
            </div>
        `;

        const questionsDiv = document.createElement('div');
        questionsDiv.className = 'detail-section';
        questionsDiv.innerHTML = '<h4 class="detail-section-title">Domande e Risposte</h4>';

        part.domande.forEach(d => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">${d.numero}</span>
                    <span class="question-text">${d.testo}</span>
                </div>
                <ul class="answer-list">
                    ${d.risposte.map(r => {
                        const isCorrect = isCorrectAnswer(r);
                        const cls = r.selezionata && isCorrect ? 'answer-selected-correct'
                            : r.selezionata ? 'answer-selected-wrong'
                            : isCorrect ? 'answer-correct' : '';
                        let label = r.testo;
                        if (r.selezionata) label += ' ✓';
                        if (isCorrect) label += ` (${r.punteggio || 0} pt)`;
                        return `<li class="answer-item ${cls}">${label}</li>`;
                    }).join('')}
                </ul>
            `;
            questionsDiv.appendChild(qCard);
        });

        container.appendChild(questionsDiv);
        centerContent.replaceChildren(container);

        container.querySelectorAll('.detail-link').forEach(el => {
            el.addEventListener('click', e => {
                e.preventDefault();
                navigateTo(el.dataset.view, { id: el.dataset.id });
            });
        });
    } catch (err) {
        renderError(err.message);
    }
}

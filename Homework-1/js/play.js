/* ─── Svolgimento quiz ────────────────────────────── */

async function startParticipation(utente, quiz) {
    try {
        const result = await apiPost('start_participation', { utente, quiz });
        navigateTo('participation-play', { id: quiz, partecipazione: result.data.codice });
    } catch (err) {
        renderError(err.message);
    }
}

async function renderParticipationPlay(quizCodice, partecipazioneCodice) {
    clearFilters();
    renderEmptyFilters();
    renderLoading();

    try {
        const result = await apiCall('quiz_detail', { codice: quizCodice });
        const quiz = result.data;

        const container = document.createElement('div');
        container.className = 'detail-container';

        container.innerHTML = `
            <div class="detail-header">
                <h3 class="detail-title">${quiz.titolo}</h3>
                <p class="detail-subtitle">Partecipazione come <strong>${userSelect.options[userSelect.selectedIndex]?.text || 'utente'}</strong></p>
                <p class="detail-subtitle">Rispondi alle domande e invia.</p>
            </div>
        `;

        const form = document.createElement('form');
        form.id = 'quiz-form';
        form.addEventListener('submit', async e => {
            e.preventDefault();
            await submitQuizAnswers(partecipazioneCodice, quizCodice, quiz.domande, form);
        });

        quiz.domande.forEach(d => {
            const qCard = document.createElement('div');
            qCard.className = 'question-card';
            qCard.innerHTML = `
                <div class="question-header">
                    <span class="question-number">${d.numero}</span>
                    <span class="question-text">${d.testo}</span>
                </div>
                <div class="answer-list answer-list-play">
                    ${d.risposte.map(r => `
                        <label class="answer-option">
                            <input type="checkbox" name="q${d.numero}" value="${r.numero}" data-domanda="${d.numero}">
                            <span>${r.testo}</span>
                        </label>
                    `).join('')}
                </div>
            `;
            form.appendChild(qCard);
        });

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'button button-primary';
        submitBtn.textContent = 'Invia risposte';
        form.appendChild(submitBtn);

        container.appendChild(form);
        centerContent.replaceChildren(container);
    } catch (err) {
        renderError(err.message);
    }
}

async function submitQuizAnswers(partecipazione, quizCodice, domande, form) {
    const risposte = [];
    domande.forEach(d => {
        form.querySelectorAll(`input[name="q${d.numero}"]:checked`).forEach(cb => {
            risposte.push({ domanda: parseInt(cb.dataset.domanda), risposta: parseInt(cb.value) });
        });
    });

    if (risposte.length === 0) {
        renderMessage('Seleziona almeno una risposta prima di inviare.');
        return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Invio in corso...';

    try {
        await apiPost('submit_participation_answers', { partecipazione, risposte });
        const summary = document.createElement('div');
        summary.innerHTML = `
            <div class="alert alert-success">Risposte inviate con successo!</div>
            <p style="margin-top: 16px;">
                <a href="#" class="button button-primary" id="view-summary-link">Vedi riepilogo partecipazione</a>
            </p>
        `;
        centerContent.replaceChildren(summary);
        document.getElementById('view-summary-link').addEventListener('click', e => {
            e.preventDefault();
            navigateTo('participation-detail', { id: partecipazione });
        });
    } catch (err) {
        renderError(err.message);
        btn.disabled = false;
        btn.textContent = 'Invia risposte';
    }
}

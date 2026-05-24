/* ─── Router ──────────────────────────────────────── */

function navigateTo(view, params = {}) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    window.history.pushState({ view, ...params }, '', url.toString());
    activateRoute(view, params);
}

async function activateRoute(view, params = {}) {
    const item = findNavItemByRoute(view);
    const titles = {
        home: 'Home',
        'ricerca-utenti': 'Ricerca Utenti',
        'ricerca-quiz': 'Ricerca Quiz',
        'ricerca-partecipazioni': 'Ricerca Partecipazioni',
        'gestione-utenti': 'Gestione Utenti',
        'quiz-detail': 'Dettaglio Quiz',
        'user-detail': 'Dettaglio Utente',
        'participation-detail': 'Dettaglio Partecipazione',
        'participation-play': 'Svolgimento Quiz',
    };
    centerTitle.textContent = item?.dataset.title || titles[view] || 'QUIZZING';
    if (item) updateActiveNav(item);

    switch (view) {
        case 'home':
            renderHomeView();
            clearFilters();
            renderEmptyFilters();
            loadHomeStats();
            break;
        case 'ricerca-utenti':
            clearFilters();
            renderUserFilters();
            loadUsers(1);
            break;
        case 'ricerca-quiz':
            clearFilters();
            renderQuizFilters();
            loadQuizzes(1);
            break;
        case 'ricerca-partecipazioni':
            clearFilters();
            renderParticipationFilters();
            loadParticipations(1);
            break;
        case 'gestione-utenti':
            renderManageUsers();
            break;
        case 'quiz-detail':
            renderQuizDetail(params.id);
            break;
        case 'user-detail':
            renderUserDetail(params.id);
            break;
        case 'participation-detail':
            renderParticipationDetail(params.id);
            break;
        case 'participation-play':
            renderParticipationPlay(params.id, params.partecipazione);
            break;
        default:
            renderMessage('Sezione in fase di sviluppo.');
            break;
    }
}

/* ─── Inizializzazione ────────────────────────────── */

navItems.forEach(item => {
    item.addEventListener('click', event => {
        event.preventDefault();
        navigateTo(item.dataset.route);
    });
});

window.addEventListener('popstate', event => {
    const state = event.state || {};
    const view = state.view || 'home';
    const params = { ...state };
    delete params.view;
    activateRoute(view, params);
});

function applyNavMode() {
    navPanel.classList.remove('icon-only');
    const labels = navPanel.querySelectorAll('.nav-label');
    const anyTruncated = Array.from(labels).some(label => label.scrollWidth > label.offsetWidth + 1);
    navPanel.classList.toggle('icon-only', anyTruncated);
}

new ResizeObserver(() => applyNavMode()).observe(navPanel);

async function loadUserSelect() {
    try {
        const result = await apiCall('list_usernames', { limit: 100 });
        userSelect.innerHTML = '<option value="">Seleziona utente...</option>';
        (result.data.items || []).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.nomeUtente;
            opt.textContent = u.nomeUtente;
            userSelect.appendChild(opt);
        });
        syncUserSelectLabel();
    } catch {
        userSelect.innerHTML = '<option value="">Utenti non disponibili</option>';
        syncUserSelectLabel();
    }
}

userSelect?.addEventListener('change', syncUserSelectLabel);

const urlParams = new URL(window.location.href).searchParams;
const initialView = urlParams.get('view') || 'home';
const initialParams = {};
urlParams.forEach((v, k) => { if (k !== 'view') initialParams[k] = v; });
activateRoute(initialView, initialParams);
applyNavMode();
loadUserSelect();

/* ─── Router ──────────────────────────────────────── */

function currentRouteFromUrl() {
    const url = new URL(window.location.href);
    const params = {};
    url.searchParams.forEach((value, key) => {
        if (key !== 'view') params[key] = value;
    });
    return {
        view: url.searchParams.get('view') || 'home',
        params,
    };
}

function navigateTo(view, params = {}) {
    const from = currentRouteFromUrl();
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', view);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    window.history.pushState({ view, params, from }, '', url.toString());
    activateRoute(view, params);
}

function navigateBack(fallbackView = 'home', fallbackParams = {}) {
    const state = window.history.state || {};
    if (state.from?.view) {
        navigateTo(state.from.view, state.from.params || {});
    } else if (window.history.length > 1) {
        window.history.back();
    } else {
        navigateTo(fallbackView, fallbackParams);
    }
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
            renderUserFilters(loadUsers, searchState.users.mode);
            loadUsers(1);
            break;
        case 'ricerca-quiz':
            clearFilters();
            renderQuizFilters(loadQuizzes, searchState.quizzes.mode);
            loadQuizzes(1);
            break;
        case 'ricerca-partecipazioni':
            clearFilters();
            renderParticipationFilters(loadParticipations, searchState.participations.mode);
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
    const params = state.params || Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== 'view' && key !== 'from')
    );
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
        const storedUser = getStoredActiveUser();
        userSelect.innerHTML = '<option value="">Seleziona utente...</option>';
        (result.data.items || []).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.nomeUtente;
            opt.textContent = u.nomeUtente;
            userSelect.appendChild(opt);
        });
        const storedUserExists = Array.from(userSelect.options).some(option => option.value === storedUser);
        if (storedUser && storedUserExists) {
            userSelect.value = storedUser;
        } else if (storedUser) {
            storeActiveUser('');
        }
        syncUserSelectLabel();
    } catch {
        userSelect.innerHTML = '<option value="">Utenti non disponibili</option>';
        syncUserSelectLabel();
    }
}

userSelect?.addEventListener('change', () => {
    storeActiveUser(userSelect.value);
    syncUserSelectLabel();
});

const urlParams = new URL(window.location.href).searchParams;
const initialView = urlParams.get('view') || 'home';
const initialParams = {};
urlParams.forEach((v, k) => { if (k !== 'view') initialParams[k] = v; });
window.history.replaceState({ view: initialView, params: initialParams }, '', window.location.href);
activateRoute(initialView, initialParams);
applyNavMode();
loadUserSelect();

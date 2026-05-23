const API_URL = 'https://namenotfound.altervista.org/api.php';

const elements = {
    centerTitle: document.getElementById('center-title'),
    centerContent: document.getElementById('center-content'),
    navPanel: document.getElementById('nav-panel'),
    navItems: Array.from(document.querySelectorAll('#nav-panel .nav-item')),
    templates: {
        home: document.getElementById('view-home-template'),
        message: document.getElementById('view-message-template'),
        loading: document.getElementById('view-loading-template')
    },
    userSelect: document.getElementById('user-selection')
};

const userSelectUi = {
    wrapper: elements.userSelect ? elements.userSelect.closest('.custom-select-wrapper') : null,
    value: null
};

if (userSelectUi.wrapper) {
    userSelectUi.value = userSelectUi.wrapper.querySelector('.custom-select-value');
}

function cloneTemplate(template) {
    return template.content.cloneNode(true);
}

function findNavItemByRoute(route) {
    return elements.navItems.find(item => item.dataset.route === route) || elements.navItems[0];
}

function renderHomeView() {
    elements.centerContent.replaceChildren(cloneTemplate(elements.templates.home));
}

function renderLoadingView() {
    elements.centerContent.replaceChildren(cloneTemplate(elements.templates.loading));
}

function renderMessageView(message) {
    const fragment = cloneTemplate(elements.templates.message);
    fragment.querySelector('[data-message-text]').textContent = message;
    elements.centerContent.replaceChildren(fragment);
}

function updateActiveNav(activeItem) {
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item === activeItem);
    });
}

function updateBrowserUrl(item, replaceState = false) {
    const method = replaceState ? 'replaceState' : 'pushState';
    window.history[method]({ route: item.dataset.route }, '', item.getAttribute('href'));
}

function syncCustomSelect() {
    if (!elements.userSelect || !userSelectUi.wrapper || !userSelectUi.value) {
        return;
    }

    const selected = elements.userSelect.options[elements.userSelect.selectedIndex];
    userSelectUi.value.textContent = selected ? selected.text : '';
    userSelectUi.wrapper.classList.toggle('is-placeholder', !elements.userSelect.value);
}

function setUserSelectOptions(options, selectedValue = '') {
    if (!elements.userSelect) {
        return;
    }

    elements.userSelect.replaceChildren();

    options.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = value === selectedValue;
        elements.userSelect.appendChild(option);
    });

    syncCustomSelect();
}

function setUserSelectState(options, disabled = false) {
    if (!elements.userSelect) {
        return;
    }

    elements.userSelect.disabled = disabled;
    setUserSelectOptions(options);
}

async function fetchSectionData(action, extraParams = {}) {
    const apiUrl = new URL(API_URL);
    apiUrl.searchParams.set('action', action);

    Object.entries(extraParams).forEach(([key, value]) => {
        apiUrl.searchParams.set(key, String(value));
    });

    const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    let payload;

    try {
        payload = await response.json();
    } catch (error) {
        throw new Error(
            `[HTTP ${response.status}] La risposta non è JSON valido. ` +
            `Verifica che il server stia eseguendo PHP e non restituendo HTML. URL: ${apiUrl}`
        );
    }

    if (!response.ok || payload.status !== 'success') {
        throw new Error(`[HTTP ${response.status}] ${payload.message || 'Errore sconosciuto dal server.'}`);
    }

    return payload;
}

async function loadUserOptions() {
    if (!elements.userSelect) {
        return;
    }

    setUserSelectState([{ value: '', label: 'Caricamento utenti...' }], true);

    try {
        const payload = await fetchSectionData('list_usernames', { limit: 100 });
        const users = Array.isArray(payload.data && payload.data.items) ? payload.data.items : [];

        if (users.length === 0) {
            setUserSelectState([{ value: '', label: 'Nessun utente disponibile' }], true);
            return;
        }

        const options = [
            { value: '', label: '- Seleziona -' },
            ...users.map(user => ({
                value: user.nomeUtente,
                label: user.nomeUtente
            }))
        ];

        setUserSelectState(options, false);
    } catch (error) {
        setUserSelectState([{ value: '', label: 'Utenti non disponibili' }], true);
    }
}

function updateHomeStats(data) {
    if (!data) {
        return;
    }

    const stats = {
        'stat-quiz': data.quiz_count,
        'stat-questions': data.question_count,
        'stat-users': data.user_count
    };

    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    });
}

async function loadHomeStats() {
    try {
        const payload = await fetchSectionData('home');
        updateHomeStats(payload.data);
    } catch (error) {
        console.error('[QUIZZING] Errore caricamento statistiche:', error.message);
    }
}

async function activateRoute(route, options = {}) {
    const { replaceState = false } = options;
    const item = findNavItemByRoute(route);
    const isHome = item.dataset.route === 'home';

    elements.centerTitle.textContent = item.dataset.title || 'Home';
    elements.centerTitle.classList.toggle('center-title--hidden', isHome);
    updateActiveNav(item);
    updateBrowserUrl(item, replaceState);

    if (isHome) {
        renderHomeView();
        loadHomeStats();
        return;
    }

    renderLoadingView();

    try {
        const payload = await fetchSectionData(item.dataset.action || '');
        renderMessageView(payload.message || 'Contenuto caricato.');
    } catch (error) {
        renderMessageView(error.message || 'Errore di comunicazione con il server.');
    }
}

function applyNavMode() {
    elements.navPanel.classList.remove('icon-only');

    const labels = elements.navPanel.querySelectorAll('.nav-label');
    const hasTruncatedLabel = Array.from(labels).some(
        label => label.scrollWidth > label.offsetWidth + 1
    );

    elements.navPanel.classList.toggle('icon-only', hasTruncatedLabel);
}

function bindEvents() {
    if (elements.userSelect) {
        elements.userSelect.addEventListener('change', syncCustomSelect);
        syncCustomSelect();
    }

    elements.navItems.forEach(item => {
        item.addEventListener('click', event => {
            event.preventDefault();
            activateRoute(item.dataset.route);
        });
    });

    elements.centerContent.addEventListener('click', event => {
        const cta = event.target.closest('[data-route]');

        if (cta && !cta.closest('#nav-panel')) {
            event.preventDefault();
            activateRoute(cta.dataset.route);
        }
    });

    window.addEventListener('popstate', event => {
        const routeFromState = event.state && event.state.route;
        const routeFromUrl = new URL(window.location.href).searchParams.get('view');
        activateRoute(routeFromState || routeFromUrl || 'home', { replaceState: true });
    });

    new ResizeObserver(applyNavMode).observe(elements.navPanel);
}

function init() {
    const initialRoute = new URL(window.location.href).searchParams.get('view') || 'home';

    bindEvents();
    activateRoute(initialRoute, { replaceState: true });
    applyNavMode();
    loadUserOptions();
}

init();

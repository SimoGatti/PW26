const centerTitle = document.getElementById('center-title');
const centerContent = document.getElementById('center-content');
const navPanel = document.getElementById('nav-panel');
const navItems = Array.from(document.querySelectorAll('#nav-panel .nav-item'));
const homeTemplate = document.getElementById('view-home-template');
const messageTemplate = document.getElementById('view-message-template');
const loadingTemplate = document.getElementById('view-loading-template');

const userSelect = document.getElementById('user-selection');
const selectWrapper = userSelect ? userSelect.closest('.custom-select-wrapper') : null;
const selectValueEl = selectWrapper ? selectWrapper.querySelector('.custom-select-value') : null;

function setUserSelectOptions(options, selectedValue = '') {
    if (!userSelect) return;

    userSelect.replaceChildren();

    options.forEach(optionData => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.label;

        if (optionData.value === selectedValue) {
            option.selected = true;
        }

        userSelect.appendChild(option);
    });

    syncCustomSelect();
}

function setUserSelectLoadingState() {
    if (!userSelect) return;

    userSelect.disabled = true;
    setUserSelectOptions([
        { value: '', label: 'Caricamento utenti...' }
    ]);
}

function setUserSelectErrorState(message) {
    if (!userSelect) return;

    userSelect.disabled = true;
    setUserSelectOptions([
        { value: '', label: message }
    ]);
}

function syncCustomSelect() {
    if (!userSelect || !selectWrapper || !selectValueEl) return;

    const selected = userSelect.options[userSelect.selectedIndex];
    selectValueEl.textContent = selected ? selected.text : '';
    selectWrapper.classList.toggle('is-placeholder', !userSelect.value);
}

if (userSelect) {
    userSelect.addEventListener('change', syncCustomSelect);
    syncCustomSelect();
}

async function loadUserOptions() {
    if (!userSelect) return;

    setUserSelectLoadingState();

    try {
        const payload = await fetchSectionData('list_usernames', { limit: 100 });
        const users = Array.isArray(payload.data && payload.data.items) ? payload.data.items : [];

        if (users.length === 0) {
            userSelect.disabled = true;
            setUserSelectOptions([
                { value: '', label: 'Nessun utente disponibile' }
            ]);
            return;
        }

        const options = [{ value: '', label: '- Nessun utente -' }].concat(
            users.map(user => ({
                value: user.nomeUtente,
                label: user.nomeUtente
            }))
        );

        userSelect.disabled = false;
        setUserSelectOptions(options);
    } catch (error) {
        setUserSelectErrorState('Utenti non disponibili');
    }
}

function findNavItemByRoute(route) {
    return navItems.find(item => item.dataset.route === route) || navItems[0];
}

function cloneTemplate(template) {
    return template.content.cloneNode(true);
}

function renderHomeView() {
    centerContent.replaceChildren(cloneTemplate(homeTemplate));
}

function renderMessageView(message) {
    const fragment = cloneTemplate(messageTemplate);
    fragment.querySelector('[data-message-text]').textContent = message;
    centerContent.replaceChildren(fragment);
}

function renderLoadingView() {
    centerContent.replaceChildren(cloneTemplate(loadingTemplate));
}

function updateActiveNav(activeItem) {
    navItems.forEach(item => {
        item.classList.toggle('active', item === activeItem);
    });
}

function updateBrowserUrl(item, replaceState = false) {
    const method = replaceState ? 'replaceState' : 'pushState';
    window.history[method]({ route: item.dataset.route }, '', item.getAttribute('href'));
}

async function fetchSectionData(action, extraParams = {}) {
    const apiUrl = CONFIG.remoteApiUrl
        ? new URL(CONFIG.remoteApiUrl)
        : new URL('api.php', window.location.href);
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

    const payload = await response.json();

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Errore durante il caricamento della sezione.');
    }

    return payload;
}

async function activateRoute(route, options = {}) {
    const { replaceState = false } = options;
    const item = findNavItemByRoute(route);
    const title = item.dataset.title || 'Home';
    const action = item.dataset.action || '';

    centerTitle.textContent = title;
    centerTitle.classList.toggle('center-title--hidden', item.dataset.route === 'home');
    updateActiveNav(item);
    updateBrowserUrl(item, replaceState);

    if (item.dataset.route === 'home') {
        renderHomeView();
        // Carica in background le statistiche reali o mock dal server
        fetchSectionData('home')
            .then(payload => {
                if (payload.data) {
                    const quizEl = document.getElementById('stat-quiz');
                    const questionsEl = document.getElementById('stat-questions');
                    const usersEl = document.getElementById('stat-users');
                    
                    if (quizEl) quizEl.textContent = payload.data.quiz_count;
                    if (questionsEl) questionsEl.textContent = payload.data.question_count;
                    if (usersEl) usersEl.textContent = payload.data.user_count;
                }
            })
            .catch(error => {
                console.warn("Impossibile caricare le statistiche reali:", error);
            });
        return;
    }

    renderLoadingView();

    try {
        const payload = await fetchSectionData(action);
        renderMessageView(payload.message || 'Contenuto caricato.');
    } catch (error) {
        renderMessageView(error.message || 'Errore di comunicazione con il server.');
    }
}

navItems.forEach(item => {
    item.addEventListener('click', event => {
        event.preventDefault();
        activateRoute(item.dataset.route);
    });
});

centerContent.addEventListener('click', event => {
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

function applyNavMode() {
    navPanel.classList.remove('icon-only');

    const labels = navPanel.querySelectorAll('.nav-label');
    const anyTruncated = Array.from(labels).some(
        label => label.scrollWidth > label.offsetWidth + 1
    );

    navPanel.classList.toggle('icon-only', anyTruncated);
}

new ResizeObserver(() => applyNavMode()).observe(navPanel);

const initialRoute = new URL(window.location.href).searchParams.get('view') || 'home';
activateRoute(initialRoute, { replaceState: true });
applyNavMode();
loadUserOptions();

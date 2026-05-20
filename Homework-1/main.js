const centerTitle = document.getElementById('center-title');
const centerContent = document.getElementById('center-content');
const navPanel = document.getElementById('nav-panel');
const navItems = Array.from(document.querySelectorAll('#nav-panel .nav-item'));
const homeTemplate = document.getElementById('view-home-template');
const messageTemplate = document.getElementById('view-message-template');
const loadingTemplate = document.getElementById('view-loading-template');

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

async function fetchSectionData(action) {
    const apiUrl = new URL('api.php', window.location.href);
    apiUrl.searchParams.set('action', action);

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
    updateActiveNav(item);
    updateBrowserUrl(item, replaceState);

    if (item.dataset.route === 'home') {
        renderHomeView();
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

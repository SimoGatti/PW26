const centerTitle = document.getElementById('center-title');
const centerContent = document.getElementById('center-content');
const filterContainer = document.querySelector('.filter-container');
const navPanel = document.getElementById('nav-panel');
const navItems = Array.from(document.querySelectorAll('#nav-panel .nav-item'));
const homeTemplate = document.getElementById('view-home-template');
const messageTemplate = document.getElementById('view-message-template');
const loadingTemplate = document.getElementById('view-loading-template');
const userSelect = document.getElementById('user-selection');
const API_URL = 'https://namenotfound.altervista.org/api.php';

function findNavItemByRoute(route) {
    return navItems.find(item => item.dataset.route === route) || null;
}

function cloneTemplate(template) {
    return template.content.cloneNode(true);
}

function updateActiveNav(activeItem) {
    navItems.forEach(item => {
        item.classList.toggle('active', item === activeItem);
    });
}

function renderHomeView() {
    centerContent.replaceChildren(cloneTemplate(homeTemplate));
}

function renderMessage(message) {
    const fragment = cloneTemplate(messageTemplate);
    fragment.querySelector('[data-message-text]').textContent = message;
    centerContent.replaceChildren(fragment);
}

function renderLoading() {
    centerContent.replaceChildren(cloneTemplate(loadingTemplate));
}

function renderError(message) {
    const div = document.createElement('div');
    div.className = 'alert alert-error';
    div.textContent = message;
    centerContent.replaceChildren(div);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function syncUserSelectLabel() {
    const wrapper = userSelect?.closest('.custom-select-wrapper');
    const valueEl = wrapper?.querySelector('.custom-select-value');

    if (!userSelect || !wrapper || !valueEl) {
        return;
    }

    const selected = userSelect.options[userSelect.selectedIndex];
    valueEl.textContent = selected ? selected.textContent : '— Non Selezionato —';
    wrapper.classList.toggle('is-placeholder', !userSelect.value);
}

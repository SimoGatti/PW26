/* ─── Tabelle ─────────────────────────────────────── */

/**
 * renderTable({ columns, rows, emptyMsg, pagination, sortState, onSort, viewToggle })
 *
 * columns: [{ label, key?, render?, numeric?, sortKey?, colClass? }]
 * sortState: { key: string, dir: 'ASC'|'DESC' }
 * onSort: (key, dir) => void
 * pagination: { total, page, limit, onPage, onLimit }
 */
function renderTable({ columns, rows, emptyMsg, pagination, sortState, onSort, viewToggle }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    // ── Toolbar superiore: vista a sinistra, paginazione a destra ──
    if (pagination) {
        wrapper.appendChild(buildResultsToolbar(pagination, viewToggle, 'top'));
    } else if (viewToggle) {
        wrapper.appendChild(buildViewOnlyToolbar(viewToggle));
    }

    if (!rows || rows.length === 0) {
        wrapper.insertAdjacentHTML('beforeend', `<p class="empty-state">${emptyMsg || 'Nessun risultato trovato.'}</p>`);
        if (pagination) wrapper.appendChild(buildResultsToolbar(pagination, null, 'bottom'));
        return wrapper;
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    // ── Thead con sort ──────────────────────────────────────
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        if (col.numeric) th.classList.add('col-numeric');
        if (col.colClass) th.classList.add(col.colClass);

        if (col.sortKey && onSort) {
            th.classList.add('sortable');
            const isActive  = sortState && sortState.key === col.sortKey;
            const currentDir = isActive ? sortState.dir : 'ASC';
            if (isActive) th.classList.add(currentDir === 'ASC' ? 'sort-asc' : 'sort-desc');

            th.innerHTML = `${col.label}<span class="sort-icon">${
                isActive ? (currentDir === 'ASC' ? '▲' : '▼') : '⇅'
            }</span>`;

            th.addEventListener('click', () => {
                const nextDir = (isActive && currentDir === 'ASC') ? 'DESC' : 'ASC';
                onSort(col.sortKey, nextDir);
            });
        } else {
            th.textContent = col.label;
        }
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ── Tbody ───────────────────────────────────────────────
    const tbody = document.createElement('tbody');
    rows.forEach(row => {
        const tr = document.createElement('tr');
        // Supporto click-riga per partecipazioni
        if (row._clickRoute) {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', e => {
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
                navigateTo(row._clickRoute, row._clickParams || {});
            });
        }
        columns.forEach(col => {
            const td = document.createElement('td');
            if (col.numeric) td.classList.add('col-numeric');
            if (col.colClass) td.classList.add(col.colClass);
            if (col.render) {
                const rendered = col.render(row);
                if (rendered instanceof Node) td.appendChild(rendered);
                else td.textContent = rendered ?? '—';
            } else {
                td.textContent = row[col.key] ?? '—';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    // ── Paginazione sotto ───────────────────────────────────
    if (pagination) wrapper.appendChild(buildResultsToolbar(pagination, null, 'bottom'));
    return wrapper;
}

function buildViewOnlyToolbar(viewToggle) {
    const bar = document.createElement('div');
    bar.className = 'results-toolbar results-toolbar-top';
    bar.appendChild(viewToggle);
    return bar;
}

function buildResultsToolbar(pagination, viewToggle, position = 'top') {
    const bar = document.createElement('div');
    bar.className = `results-toolbar results-toolbar-${position}`;

    const left = document.createElement('div');
    left.className = 'results-toolbar-left';
    if (viewToggle) left.appendChild(viewToggle);
    bar.appendChild(left);

    const right = document.createElement('div');
    right.className = 'results-toolbar-right';
    right.appendChild(buildTopBar(pagination));
    right.appendChild(buildNavBar(pagination, position, position === 'bottom'));
    bar.appendChild(right);

    return bar;
}

/* Barra info: "1-25 di 100" + select limit */
function buildTopBar({ total, page, limit, onLimit }) {
    const bar = document.createElement('div');
    bar.className = 'table-top-bar';

    const info = document.createElement('span');
    info.className = 'pagination-info';
    const start = total > 0 ? Math.min((page - 1) * limit + 1, total) : 0;
    const end   = Math.min(page * limit, total);
    info.textContent = total > 0 ? `${start}–${end} di ${total}` : '0 risultati';
    bar.appendChild(info);

    if (onLimit) {
        const limitGroup = document.createElement('div');
        limitGroup.className = 'pagination-limit';
        limitGroup.insertAdjacentHTML('beforeend', '<span>Per pagina:</span>');
        const limitSel = document.createElement('select');
        [10, 25, 50, 100].forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            if (n === limit) opt.selected = true;
            limitSel.appendChild(opt);
        });
        limitSel.addEventListener('change', () => onLimit(parseInt(limitSel.value)));
        limitGroup.appendChild(limitSel);
        bar.appendChild(limitGroup);
    }

    return bar;
}

/* Pulsanti prev/next e, solo in basso, navigatore pagine */
function buildNavBar({ total, page, limit, onPage }, position = 'bottom', showPages = false) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return document.createDocumentFragment();

    const nav = document.createElement('nav');
    nav.className = `pagination pagination-${position}`;
    nav.setAttribute('aria-label', 'Paginazione risultati');

    const btnGroup = document.createElement('div');
    btnGroup.className = 'pagination-buttons';

    if (page > 1) {
        const prev = document.createElement('button');
        prev.className = 'button button-secondary button-sm';
        prev.textContent = '◀ Precedente';
        prev.addEventListener('click', () => onPage(page - 1));
        btnGroup.appendChild(prev);
    }

    if (showPages) {
        buildPageNavigator(page, totalPages, onPage).forEach(item => btnGroup.appendChild(item));
    }

    if (page < totalPages) {
        const next = document.createElement('button');
        next.className = 'button button-secondary button-sm';
        next.textContent = 'Successiva ▶';
        next.addEventListener('click', () => onPage(page + 1));
        btnGroup.appendChild(next);
    }
    nav.appendChild(btnGroup);
    return nav;
}

function buildPageNavigator(page, totalPages, onPage) {
    const pages = [];
    const add = value => {
        if (!pages.includes(value)) pages.push(value);
    };

    add(1);
    for (let p = page - 2; p <= page + 2; p++) {
        if (p > 1 && p < totalPages) add(p);
    }
    if (totalPages > 1) add(totalPages);
    pages.sort((a, b) => a - b);

    const items = [];
    pages.forEach((p, index) => {
        if (index > 0 && p - pages[index - 1] > 1) {
            const gap = document.createElement('span');
            gap.className = 'pagination-ellipsis';
            gap.textContent = '...';
            items.push(gap);
        }

        const btn = document.createElement('button');
        btn.className = 'button button-secondary button-sm pagination-page';
        if (p === page) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
        }
        btn.textContent = String(p);
        btn.addEventListener('click', () => {
            if (p !== page) onPage(p);
        });
        items.push(btn);
    });

    return items;
}

/* Mantieni per retrocompatibilità */
function renderPagination(opts) {
    const frag = document.createDocumentFragment();
    frag.appendChild(buildNavBar(opts));
    return frag;
}

/* ─── Link / Badge / helpers ──────────────────────── */

function createLink(text, href, className = '') {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text ?? '—';
    a.title = 'Clicca per i dettagli';
    if (className) a.className = className;
    a.addEventListener('click', e => {
        e.preventDefault();
        const url = new URL(a.href, window.location.href);
        const view = url.searchParams.get('view');
        const params = {};
        url.searchParams.forEach((v, k) => { if (k !== 'view') params[k] = v; });
        navigateTo(view, params);
    });
    return a;
}

function createStateBadge(stato) {
    const span = document.createElement('span');
    span.className = `badge badge-${stato}`;
    const labels = { futuro: 'Futuro', aperto: 'Aperto', chiuso: 'Chiuso' };
    span.textContent = labels[stato] || stato;
    return span;
}

function isCorrectAnswer(answer) {
    return String(answer.tipo || '').toLowerCase() === 'corretta';
}

/* ─── Pulsante Back (usa history nativa) ──────────── */

function createBackButton(fallbackView, fallbackParams = {}) {
    const btn = document.createElement('button');
    btn.className = 'back-button';
    btn.innerHTML = '← Indietro';
    btn.title = 'Torna alla pagina precedente';
    btn.addEventListener('click', () => {
        navigateTo(fallbackView, fallbackParams);
    });
    return btn;
}

/* ─── Toggle Vista Compatta/Estesa ────────────────── */

function createViewToggle(onCompact, onExtended, defaultMode = 'extended') {
    const wrapper = document.createElement('div');
    wrapper.className = 'view-toggle';

    const btnC = document.createElement('button');
    btnC.className = 'view-toggle-btn' + (defaultMode === 'compact' ? ' active' : '');
    btnC.textContent = 'Compatta';

    const btnE = document.createElement('button');
    btnE.className = 'view-toggle-btn' + (defaultMode === 'extended' ? ' active' : '');
    btnE.textContent = 'Estesa';

    btnC.addEventListener('click', () => {
        btnC.classList.add('active');
        btnE.classList.remove('active');
        onCompact();
    });
    btnE.addEventListener('click', () => {
        btnE.classList.add('active');
        btnC.classList.remove('active');
        onExtended();
    });

    wrapper.appendChild(btnC);
    wrapper.appendChild(btnE);
    return wrapper;
}

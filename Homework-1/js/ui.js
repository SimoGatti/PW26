/* ─── Tabelle ─────────────────────────────────────── */

function renderTable({ columns, rows, emptyMsg, pagination }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    if (!rows || rows.length === 0) {
        wrapper.innerHTML = `<p class="empty-state">${emptyMsg || 'Nessun risultato trovato.'}</p>`;
        if (pagination) wrapper.appendChild(renderPagination(pagination));
        return wrapper;
    }

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(col => {
            const td = document.createElement('td');
            if (col.render) {
                td.appendChild(col.render(row));
            } else {
                td.textContent = row[col.key] ?? '—';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    if (pagination) wrapper.appendChild(renderPagination(pagination));
    return wrapper;
}

function renderPagination({ total, page, limit, onPage }) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return document.createDocumentFragment();

    const nav = document.createElement('nav');
    nav.className = 'pagination';
    nav.setAttribute('aria-label', 'Paginazione risultati');

    const info = document.createElement('span');
    info.className = 'pagination-info';
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    info.textContent = `${start}–${end} di ${total}`;
    nav.appendChild(info);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'pagination-buttons';

    if (page > 1) {
        const prev = document.createElement('button');
        prev.className = 'button button-secondary button-sm';
        prev.textContent = '◀ Precedente';
        prev.addEventListener('click', () => onPage(page - 1));
        btnGroup.appendChild(prev);
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

function createLink(text, href, className = '') {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
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

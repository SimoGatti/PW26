/* ─── CRUD Utenti ─────────────────────────────────── */

let manageSortState = { key: 'cognome', dir: 'ASC' };
let currentManageItems = [];

async function renderManageUsers() {
    renderManageUserFilters(() => refreshManageUsers());
    renderLoading();
    await refreshManageUsers();
}

async function refreshManageUsers() {
    try {
        const q = getFilterValue('manage-filter-q');

        const result = await apiCall('manage_users', {
            q,
            limit: 100,
            sort: manageSortState.key,
            direction: manageSortState.dir
        });
        currentManageItems = result.data.items || [];

        renderManageUsersTable();
    } catch (err) {
        renderError(err.message);
    }
}

function renderManageUsersTable() {
    const container = document.createElement('div');
    const heading = document.createElement('h3');
    heading.className = 'section-heading';
    heading.textContent = 'Elenco Utenti';
    container.appendChild(heading);

    const columns = [
        { label: 'Username', sortKey: 'nomeUtente', key: 'nomeUtente' },
        { label: 'Nome',     sortKey: 'nome',       key: 'nome' },
        { label: 'Cognome',  sortKey: 'cognome',    key: 'cognome' },
        { label: 'Email',                           key: 'email' },
        { label: 'Quiz',     sortKey: 'numeroQuizCreati',     key: 'numeroQuizCreati', numeric: true },
        { label: 'Part.',    sortKey: 'numeroPartecipazioni', key: 'numeroPartecipazioni', numeric: true },
        { label: 'Azioni',   render: r => createManageActions(r) }
    ];

    const wrapper = renderTable({
        columns,
        rows: currentManageItems,
        emptyMsg: 'Nessun utente trovato.',
        sortState: manageSortState,
        onSort: (key, dir) => {
            manageSortState.key = key;
            manageSortState.dir = dir;
            refreshManageUsers();
        }
    });

    container.appendChild(wrapper);
    centerContent.replaceChildren(container);
}

function createManageActions(user) {
    const div = document.createElement('div');
    div.className = 'actions-cell';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'button button-secondary button-sm btn-edit';
    btnEdit.textContent = 'Modifica';
    btnEdit.addEventListener('click', (e) => startInlineEdit(e.target.closest('tr'), user));

    const btnDel = document.createElement('button');
    btnDel.className = 'button button-danger button-sm btn-delete';
    btnDel.textContent = 'Elimina';
    btnDel.addEventListener('click', () => handleDeleteUser(user.nomeUtente));

    div.appendChild(btnEdit);
    div.appendChild(btnDel);
    return div;
}

function createTableCell(content, numeric = false) {
    const cell = document.createElement('td');
    if (numeric) cell.className = 'col-numeric';
    cell.textContent = content ?? '';
    return cell;
}

function restoreManageRow(tr, user) {
    tr.classList.remove('editing-row');
    const actionsCell = document.createElement('td');
    actionsCell.appendChild(createManageActions(user));
    tr.replaceChildren(
        createTableCell(user.nomeUtente),
        createTableCell(user.nome),
        createTableCell(user.cognome),
        createTableCell(user.email),
        createTableCell(user.numeroQuizCreati ?? 0, true),
        createTableCell(user.numeroPartecipazioni ?? 0, true),
        actionsCell
    );
}

/**
 * Trasforma la riga in modalità editing inline.
 */
function startInlineEdit(tr, user) {
    tr.classList.add('editing-row');
    tr.innerHTML = `
        <td><input class="inline-edit-input" id="ie-username" value="${escapeHtml(user.nomeUtente)}"></td>
        <td><input class="inline-edit-input" id="ie-nome"    value="${escapeHtml(user.nome)}"></td>
        <td><input class="inline-edit-input" id="ie-cognome" value="${escapeHtml(user.cognome)}"></td>
        <td><input class="inline-edit-input" id="ie-email"   value="${escapeHtml(user.email)}" type="email"></td>
        <td class="col-numeric">${user.numeroQuizCreati ?? 0}</td>
        <td class="col-numeric">${user.numeroPartecipazioni ?? 0}</td>
        <td class="actions-cell">
            <button class="button button-primary button-sm btn-save">Salva</button>
            <button class="button button-secondary button-sm btn-cancel">Annulla</button>
        </td>
    `;

    tr.querySelector('.btn-cancel').addEventListener('click', () => {
        restoreManageRow(tr, user);
    });

    tr.querySelector('.btn-save').addEventListener('click', async () => {
        const nuovoNomeUtente = tr.querySelector('#ie-username').value.trim();
        const nome    = tr.querySelector('#ie-nome').value.trim();
        const cognome = tr.querySelector('#ie-cognome').value.trim();
        const email   = tr.querySelector('#ie-email').value.trim();

        if (!nuovoNomeUtente || !nome || !cognome || !email) {
            showCrudFeedback('error', 'Username, nome, cognome e email sono obbligatori.');
            return;
        }

        try {
            await apiPost('update_user', { nomeUtente: user.nomeUtente, nuovoNomeUtente, nome, cognome, email });
            showCrudFeedback('success', `Utente ${nuovoNomeUtente} aggiornato.`);
            await loadUserSelect();
            await refreshManageUsers();
        } catch (err) {
            showCrudFeedback('error', err.message);
        }
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showCrudFeedback(type, message) {
    const feedback = document.getElementById('crud-feedback');
    if (!feedback) return;
    feedback.hidden  = false;
    feedback.className = `alert alert-${type}`;
    feedback.textContent = message;
}

async function handleCreateUser() {
    const username = document.getElementById('crud-username')?.value.trim();
    const nome     = document.getElementById('crud-nome')?.value.trim();
    const cognome  = document.getElementById('crud-cognome')?.value.trim();
    const email    = document.getElementById('crud-email')?.value.trim();

    if (!username || !nome || !cognome || !email) {
        showCrudFeedback('error', 'Tutti i campi sono obbligatori.');
        return;
    }
    if (!email.includes('@')) {
        showCrudFeedback('error', 'Inserire un indirizzo email valido.');
        return;
    }

    try {
        await apiPost('create_user', { nomeUtente: username, nome, cognome, email });
        showCrudFeedback('success', 'Utente creato con successo.');
        ['crud-username', 'crud-nome', 'crud-cognome', 'crud-email'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        await loadUserSelect();
        await refreshManageUsers();
    } catch (err) {
        showCrudFeedback('error', err.message);
    }
}

async function handleDeleteUser(username) {
    if (!confirm(`Eliminare l'utente "${username}"?`)) return;


    try {
        await apiPost('delete_user', { nomeUtente: username });
        await loadUserSelect();
        await refreshManageUsers();
    } catch (err) {
        showCrudFeedback('error', err.message);
    }
}

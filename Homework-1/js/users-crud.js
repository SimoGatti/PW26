/* ─── CRUD Utenti ─────────────────────────────────── */

let editUsername = null;

async function renderManageUsers() {
    clearFilters();
    renderManageUserFilters();
    renderLoading();

    try {
        const result = await apiCall('manage_users', { q: '', limit: 100 });
        renderManageUsersTable(result.data.items || []);
    } catch (err) {
        renderError(err.message);
    }
}

function renderManageUsersTable(items) {
    const container = document.createElement('div');

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessun utente trovato.</p>';
        centerContent.replaceChildren(container);
        return;
    }

    const heading = document.createElement('h3');
    heading.className = 'section-heading';
    heading.textContent = 'Elenco Utenti';
    container.appendChild(heading);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
        <thead><tr>
            <th>Username</th><th>Nome</th><th>Cognome</th><th>Email</th>
            <th>Quiz</th><th>Part.</th><th>Azioni</th>
        </tr></thead>
    `;

    const tbody = document.createElement('tbody');
    items.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.nomeUtente}</td>
            <td>${user.nome}</td>
            <td>${user.cognome}</td>
            <td>${user.email}</td>
            <td>${user.numeroQuizCreati ?? 0}</td>
            <td>${user.numeroPartecipazioni ?? 0}</td>
            <td class="actions-cell">
                <button class="button button-secondary button-sm btn-edit" data-username="${user.nomeUtente}">Modifica</button>
                <button class="button button-danger button-sm btn-delete" data-username="${user.nomeUtente}">Elimina</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
    centerContent.replaceChildren(container);

    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => startEditUser(btn.dataset.username));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteUser(btn.dataset.username));
    });
}

async function startEditUser(username) {
    editUsername = username;
    try {
        const result = await apiCall('get_user', { nomeUtente: username });
        const user = result.data;

        document.getElementById('crud-username').value = user.nomeUtente;
        document.getElementById('crud-username').disabled = true;
        document.getElementById('crud-nome').value = user.nome;
        document.getElementById('crud-cognome').value = user.cognome;
        document.getElementById('crud-email').value = user.email;

        document.getElementById('crud-create-btn').textContent = 'Aggiorna Utente';
        document.getElementById('crud-feedback').hidden = true;

        if (!document.getElementById('crud-cancel-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'crud-cancel-btn';
            cancelBtn.className = 'button button-secondary';
            cancelBtn.textContent = 'Annulla';
            cancelBtn.addEventListener('click', cancelEditUser);
            document.querySelector('.filter-actions').appendChild(cancelBtn);
        }
    } catch (err) {
        showCrudFeedback('error', err.message);
    }
}

function cancelEditUser() {
    editUsername = null;
    document.getElementById('crud-username').value = '';
    document.getElementById('crud-username').disabled = false;
    document.getElementById('crud-nome').value = '';
    document.getElementById('crud-cognome').value = '';
    document.getElementById('crud-email').value = '';
    document.getElementById('crud-create-btn').textContent = 'Crea Utente';
    document.getElementById('crud-cancel-btn')?.remove();
    document.getElementById('crud-feedback').hidden = true;
}

function showCrudFeedback(type, message) {
    const feedback = document.getElementById('crud-feedback');
    feedback.hidden = false;
    feedback.className = `alert alert-${type}`;
    feedback.textContent = message;
}

async function handleCreateUser() {
    const username = document.getElementById('crud-username').value.trim();
    const nome = document.getElementById('crud-nome').value.trim();
    const cognome = document.getElementById('crud-cognome').value.trim();
    const email = document.getElementById('crud-email').value.trim();

    if (!username || !nome || !cognome || !email) {
        showCrudFeedback('error', 'Tutti i campi sono obbligatori.');
        return;
    }
    if (!email.includes('@')) {
        showCrudFeedback('error', 'Inserire un indirizzo email valido.');
        return;
    }

    try {
        if (editUsername) {
            await apiPost('update_user', { nomeUtente: editUsername, nome, cognome, email });
            showCrudFeedback('success', 'Utente aggiornato con successo.');
            cancelEditUser();
        } else {
            await apiPost('create_user', { nomeUtente: username, nome, cognome, email });
            showCrudFeedback('success', 'Utente creato con successo.');
            document.getElementById('crud-username').value = '';
            document.getElementById('crud-nome').value = '';
            document.getElementById('crud-cognome').value = '';
            document.getElementById('crud-email').value = '';
        }
        const result = await apiCall('manage_users', { q: '', limit: 100 });
        renderManageUsersTable(result.data.items);
    } catch (err) {
        showCrudFeedback('error', err.message);
    }
}

async function handleDeleteUser(username) {
    if (!confirm(`Eliminare l'utente "${username}"?`)) return;

    try {
        await apiPost('delete_user', { nomeUtente: username });
        const result = await apiCall('manage_users', { q: '', limit: 100 });
        renderManageUsersTable(result.data.items);
    } catch (err) {
        showCrudFeedback('error', err.message);
    }
}

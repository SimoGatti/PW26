/* ─── API ─────────────────────────────────────────── */

async function apiCall(action, data = {}) {
    const apiUrl = new URL(API_URL);
    apiUrl.searchParams.set('action', action);
    Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            apiUrl.searchParams.set(k, String(v));
        }
    });

    const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    });

    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        throw new Error(`La risposta del server non è JSON valido. URL: ${apiUrl.toString()}`);
    }

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Errore di comunicazione.');
    }
    return payload;
}

async function apiPost(action, data = {}) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ action, ...data })
    });

    let payload;
    try {
        payload = await response.json();
    } catch (error) {
        throw new Error(`La risposta del server non è JSON valido. URL: ${API_URL}`);
    }

    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Errore di comunicazione.');
    }
    return payload;
}

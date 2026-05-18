// ─── Nav: aggiorna titolo centrale al click ───────────────────────
const title    = document.getElementById('center-title');
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        title.textContent = item.dataset.label;
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});

// ─── Nav: icon-only quando il testo viene troncato ───────────────
const navPanel = document.getElementById('nav-panel');

function applyNavMode() {
    // 1. Rimuovi icon-only per rendere i label visibili e misurabili
    navPanel.classList.remove('icon-only');

    // 2. Accedere a scrollWidth forza il browser a ricalcolare il layout
    //    (sincronamente, prima di qualsiasi repaint)
    const labels = navPanel.querySelectorAll('.nav-label');
    const anyTruncated = Array.from(labels).some(
        label => label.scrollWidth > label.offsetWidth + 1  // +1px tolleranza subpixel
    );

    // 3. Applica la modalità corretta — il browser dipinge solo lo stato finale
    navPanel.classList.toggle('icon-only', anyTruncated);
}

// Osserva le variazioni di dimensione del pannello (resize, zoom)
new ResizeObserver(() => applyNavMode()).observe(navPanel);

// Applica subito al caricamento
applyNavMode();

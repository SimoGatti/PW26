const title    = document.getElementById('center-title');
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        title.textContent = item.dataset.label;

        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});

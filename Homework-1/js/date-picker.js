(function () {
    const weekdays = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
    const months = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile',
        'Maggio', 'Giugno', 'Luglio', 'Agosto',
        'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function toIsoDate(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function parseIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
        if (!match) return null;

        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const parsed = new Date(year, month, day);

        if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
            return null;
        }
        return parsed;
    }

    function sameDay(a, b) {
        return a && b &&
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function decadeStart(year) {
        return Math.floor(year / 10) * 10;
    }

    function createDatePicker(input) {
        if (input.dataset.datePickerReady === 'true') return;

        const field = input.closest('.form-field') || input.parentElement;
        const panel = document.createElement('div');
        let viewMode = 'days';
        let visibleDate = new Date();

        input.dataset.datePickerReady = 'true';
        input.value = '';
        input.defaultValue = '';
        input.setAttribute('autocomplete', 'off');
        field.classList.add('date-picker-field');
        panel.className = 'date-picker-panel';
        panel.hidden = true;
        document.body.appendChild(panel);

        function today() {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }

        function selectedDate() {
            return parseIsoDate(input.value);
        }

        function setVisibleFromOpening() {
            const base = today();
            visibleDate = new Date(base.getFullYear(), base.getMonth(), 1);
            viewMode = 'days';
        }

        function renderHeader(title) {
            return `
                <div class="date-picker-header">
                    <button class="button button-secondary date-picker-nav" type="button" data-prev aria-label="Periodo precedente">&lsaquo;</button>
                    <button class="date-picker-title" type="button" data-zoom-out>${title}</button>
                    <button class="button button-secondary date-picker-nav" type="button" data-next aria-label="Periodo successivo">&rsaquo;</button>
                </div>
            `;
        }

        function renderViewSwitcher() {
            return `
                <div class="date-picker-subheader">
                    <button class="button button-secondary button-sm" type="button" data-view-months>Mesi</button>
                    <button class="button button-secondary button-sm" type="button" data-view-years>Anni</button>
                    <button class="button button-secondary button-sm" type="button" data-view-decades>Decenni</button>
                </div>
            `;
        }

        function renderFooter() {
            return `
                <div class="date-picker-footer">
                    <button class="button button-secondary button-sm" type="button" data-clear>Pulisci</button>
                    <button class="button button-secondary button-sm" type="button" data-today>Oggi</button>
                </div>
            `;
        }

        function renderDays() {
            const year = visibleDate.getFullYear();
            const month = visibleDate.getMonth();
            const first = new Date(year, month, 1);
            const startOffset = (first.getDay() + 6) % 7;
            const gridStart = new Date(year, month, 1 - startOffset);
            const currentToday = today();
            const selected = selectedDate();

            panel.innerHTML = `
                ${renderHeader(`${months[month]} ${year}`)}
                ${renderViewSwitcher()}
                <div class="date-picker-weekdays">
                    ${weekdays.map(day => `<span>${day}</span>`).join('')}
                </div>
                <div class="date-picker-grid"></div>
                ${renderFooter()}
            `;

            const grid = panel.querySelector('.date-picker-grid');
            for (let index = 0; index < 42; index++) {
                const date = new Date(gridStart);
                date.setDate(gridStart.getDate() + index);

                const dayButton = document.createElement('button');
                dayButton.type = 'button';
                dayButton.className = 'date-picker-cell';
                dayButton.textContent = date.getDate();
                dayButton.dataset.date = toIsoDate(date);

                if (date.getMonth() !== month) dayButton.classList.add('is-outside');
                if (sameDay(date, currentToday)) dayButton.classList.add('is-today');
                if (sameDay(date, selected)) dayButton.classList.add('is-selected');

                grid.appendChild(dayButton);
            }
        }

        function renderMonths() {
            const year = visibleDate.getFullYear();
            panel.innerHTML = `
                ${renderHeader(String(year))}
                ${renderViewSwitcher()}
                <div class="date-picker-grid date-picker-grid-months">
                    ${months.map((month, index) => `
                        <button class="date-picker-cell date-picker-cell-large" type="button" data-month="${index}">${month.slice(0, 3)}</button>
                    `).join('')}
                </div>
                ${renderFooter()}
            `;
        }

        function renderYears() {
            const start = decadeStart(visibleDate.getFullYear());
            panel.innerHTML = `
                ${renderHeader(`${start} - ${start + 9}`)}
                ${renderViewSwitcher()}
                <div class="date-picker-grid date-picker-grid-years">
                    ${Array.from({ length: 12 }, (_, index) => start - 1 + index).map(year => `
                        <button class="date-picker-cell date-picker-cell-large ${year < start || year > start + 9 ? 'is-outside' : ''}" type="button" data-year="${year}">${year}</button>
                    `).join('')}
                </div>
                ${renderFooter()}
            `;
        }

        function renderDecades() {
            const start = decadeStart(visibleDate.getFullYear()) - 50;
            panel.innerHTML = `
                ${renderHeader(`${start} - ${start + 99}`)}
                ${renderViewSwitcher()}
                <div class="date-picker-grid date-picker-grid-years">
                    ${Array.from({ length: 12 }, (_, index) => start - 10 + index * 10).map(year => `
                        <button class="date-picker-cell date-picker-cell-large" type="button" data-decade="${year}">${year}s</button>
                    `).join('')}
                </div>
                ${renderFooter()}
            `;
        }

        function render() {
            if (viewMode === 'months') renderMonths();
            else if (viewMode === 'years') renderYears();
            else if (viewMode === 'decades') renderDecades();
            else renderDays();
        }

        function updatePosition() {
            if (panel.hidden) return;

            const gap = 6;
            const margin = 8;
            const rect = input.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 248;
            const panelHeight = panel.offsetHeight || 280;
            const left = Math.min(
                Math.max(rect.left, margin),
                Math.max(margin, window.innerWidth - panelWidth - margin)
            );
            const below = rect.bottom + gap;
            const above = rect.top - panelHeight - gap;
            const top = below + panelHeight <= window.innerHeight - margin
                ? below
                : Math.max(margin, above);

            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        }

        function open() {
            setVisibleFromOpening();
            render();
            panel.hidden = false;
            updatePosition();
        }

        function close() {
            panel.hidden = true;
        }

        function movePrevious() {
            if (viewMode === 'days') visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() - 1, 1);
            else if (viewMode === 'months') visibleDate = new Date(visibleDate.getFullYear() - 1, visibleDate.getMonth(), 1);
            else if (viewMode === 'years') visibleDate = new Date(visibleDate.getFullYear() - 10, visibleDate.getMonth(), 1);
            else visibleDate = new Date(visibleDate.getFullYear() - 100, visibleDate.getMonth(), 1);
            render();
        }

        function moveNext() {
            if (viewMode === 'days') visibleDate = new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 1);
            else if (viewMode === 'months') visibleDate = new Date(visibleDate.getFullYear() + 1, visibleDate.getMonth(), 1);
            else if (viewMode === 'years') visibleDate = new Date(visibleDate.getFullYear() + 10, visibleDate.getMonth(), 1);
            else visibleDate = new Date(visibleDate.getFullYear() + 100, visibleDate.getMonth(), 1);
            render();
        }

        input.addEventListener('focus', open);
        input.addEventListener('click', open);
        input.addEventListener('input', () => {
            const parsed = selectedDate();
            if (parsed) visibleDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
        });

        panel.addEventListener('pointerdown', event => event.preventDefault());
        panel.addEventListener('click', event => {
            event.stopPropagation();
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            if (target.matches('[data-prev]')) {
                movePrevious();
                updatePosition();
            } else if (target.matches('[data-next]')) {
                moveNext();
                updatePosition();
            }
            else if (target.matches('[data-zoom-out]')) {
                if (viewMode === 'days') viewMode = 'months';
                else if (viewMode === 'months') viewMode = 'years';
                else viewMode = 'decades';
                render();
                updatePosition();
            } else if (target.matches('[data-view-months]')) {
                viewMode = 'months';
                render();
                updatePosition();
            } else if (target.matches('[data-view-years]')) {
                viewMode = 'years';
                render();
                updatePosition();
            } else if (target.matches('[data-view-decades]')) {
                viewMode = 'decades';
                render();
                updatePosition();
            } else if (target.matches('[data-month]')) {
                visibleDate = new Date(visibleDate.getFullYear(), Number(target.dataset.month), 1);
                viewMode = 'days';
                render();
                updatePosition();
            } else if (target.matches('[data-year]')) {
                visibleDate = new Date(Number(target.dataset.year), visibleDate.getMonth(), 1);
                viewMode = 'months';
                render();
                updatePosition();
            } else if (target.matches('[data-decade]')) {
                visibleDate = new Date(Number(target.dataset.decade), visibleDate.getMonth(), 1);
                viewMode = 'years';
                render();
                updatePosition();
            } else if (target.matches('[data-clear]')) {
                input.value = '';
                input.dispatchEvent(new Event('change', { bubbles: true }));
                close();
            } else if (target.matches('[data-today]')) {
                input.value = toIsoDate(today());
                input.dispatchEvent(new Event('change', { bubbles: true }));
                close();
            } else if (target.matches('[data-date]')) {
                input.value = target.dataset.date;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                close();
            }
        });

        document.addEventListener('pointerdown', event => {
            if (!field.contains(event.target) && !panel.contains(event.target)) close();
        });
        window.addEventListener('resize', updatePosition);
        document.addEventListener('scroll', updatePosition, true);
    }

    window.initDatePickers = function initDatePickers(root = document) {
        root.querySelectorAll('[data-date-picker]').forEach(createDatePicker);
    };

    document.addEventListener('DOMContentLoaded', () => window.initDatePickers());
}());

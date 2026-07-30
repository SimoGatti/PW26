// Miglioramenti progressivi: senza JavaScript form, link e conferme restano
// normali richieste Django.
document.documentElement.classList.add("js");

(() => {
  // Timer e AbortController evitano che una risposta lenta sovrascriva
  // l'ultima ricerca digitata dall'utente.
  let timer;
  let requestController;
  let suggestionTimer;
  let suggestionController;
  let confirmOpener;

  const listingSelector =
    "[data-live-link], .pagination a, .data-table thead a";

  function announce(message) {
    let status = document.querySelector(".live-update-status");
    if (!status) {
      status = document.createElement("div");
      status.className = "live-update-status";
      status.setAttribute("role", "status");
      document.body.append(status);
    }
    status.textContent = message;
    window.setTimeout(() => status.remove(), 1200);
  }

  function enhance(container = document) {
    // Questa funzione viene richiamata anche sui pannelli sostituiti via fetch.
    container.querySelectorAll(".range-filter").forEach((group) => {
      const ranges = [...group.querySelectorAll("input[type='range']")];
      ranges.forEach((range, index) => {
        const output = range.parentElement.querySelector("output");
        if (output) output.value = range.value;
        range.addEventListener("input", () => {
          if (index === 0 && Number(range.value) > Number(ranges[1]?.value)) {
            ranges[1].value = range.value;
            ranges[1].parentElement.querySelector("output").value = range.value;
          }
          if (index === 1 && Number(range.value) < Number(ranges[0]?.value)) {
            ranges[0].value = range.value;
            ranges[0].parentElement.querySelector("output").value = range.value;
          }
          if (output) output.value = range.value;
        });
      });
    });

    container.querySelectorAll(".date-steppers:empty").forEach((holder) => {
      const input = holder
        .closest("form")
        .querySelector(`[name="${holder.dataset.dateTarget}"]`);
      [
        ["Giorno", "date"],
        ["Mese", "month"],
        ["Anno", "year"],
      ].forEach(([label, unit]) => {
        const control = document.createElement("span");
        control.className = "date-unit-control";
        const caption = document.createElement("small");
        caption.textContent = label;
        const makeButton = (amount) => {
          const direction = amount > 0 ? "Avanti" : "Indietro";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "date-arrow";
          button.title = `${direction} di un ${label.toLowerCase()}`;
          button.setAttribute("aria-label", button.title);
          const icon = document.createElement("span");
          icon.className = `ui-icon ${amount > 0 ? "icon-up" : "icon-down"}`;
          icon.setAttribute("aria-hidden", "true");
          button.append(icon);
          button.addEventListener("click", () => {
            // Mezzogiorno evita cambi di giorno dovuti all'offset del fuso.
            const value = input.value ? new Date(`${input.value}T12:00:00`) : new Date();
            if (unit === "date") value.setDate(value.getDate() + amount);
            if (unit === "month") value.setMonth(value.getMonth() + amount);
            if (unit === "year") value.setFullYear(value.getFullYear() + amount);
            input.value = [
              value.getFullYear(),
              String(value.getMonth() + 1).padStart(2, "0"),
              String(value.getDate()).padStart(2, "0"),
            ].join("-");
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });
          return button;
        };
        control.append(makeButton(1), caption, makeButton(-1));
        holder.append(control);
      });
    });
  }

  function captureInterfaceState() {
    // I pannelli vengono rimpiazzati: posizione, focus e cursore vanno
    // conservati esplicitamente per non interrompere la digitazione.
    const active = document.activeElement;
    return {
      leftScroll: document.querySelector(".left-panel .panel-body")?.scrollTop || 0,
      centerScroll: document.querySelector(".center-panel .panel-body")?.scrollTop || 0,
      activeName: active?.name || null,
      selectionStart: typeof active?.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active?.selectionEnd === "number" ? active.selectionEnd : null,
    };
  }

  function restoreInterfaceState(state) {
    const left = document.querySelector(".left-panel .panel-body");
    const center = document.querySelector(".center-panel .panel-body");
    if (left) left.scrollTop = state.leftScroll;
    if (center) center.scrollTop = state.centerScroll;
    if (state.activeName) {
      const active = [...document.querySelectorAll("[name]")].find(
        (element) => element.name === state.activeName
      );
      if (active) {
        active.focus({ preventScroll: true });
        if (state.selectionStart !== null && active.setSelectionRange) {
          active.setSelectionRange(state.selectionStart, state.selectionEnd);
        }
      }
    }
  }

  function openConfirmation(trigger) {
    const overlay = document.getElementById(trigger.dataset.confirmTarget);
    if (!overlay) return false;
    confirmOpener = trigger;
    overlay.hidden = false;
    document.body.classList.add("confirm-open");
    overlay.querySelector("[data-confirm-close]")?.focus();
    return true;
  }

  function closeConfirmation(overlay) {
    overlay.hidden = true;
    document.body.classList.remove("confirm-open");
    confirmOpener?.focus();
    confirmOpener = null;
  }

  function syncQuestionsToggle(button) {
    const stack = document.getElementById(button.getAttribute("aria-controls"));
    const questions = [...(stack?.querySelectorAll("details.question-card") || [])];
    const allOpen = questions.length > 0 && questions.every((item) => item.open);
    const label = allOpen ? "Comprimi tutte" : "Espandi tutte";
    const icon = button.querySelector(".ui-icon");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-expanded", String(allOpen));
    icon?.classList.toggle("icon-expand-all", !allOpen);
    icon?.classList.toggle("icon-collapse-all", allOpen);
  }

  async function updateListing(url, push = true) {
    const interfaceState = captureInterfaceState();
    requestController?.abort();
    requestController = new AbortController();
    const center = document.querySelector(".center-panel");
    const form = document.querySelector(".live-filters");
    center?.classList.add("loading");
    form?.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(url, {
        headers: { "X-Requested-With": "fetch" },
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const next = new DOMParser().parseFromString(html, "text/html");
      const nextLeft = next.querySelector(".left-panel .panel-body");
      const nextCenter = next.querySelector(".center-panel .panel-body");
      if (!nextLeft || !nextCenter) {
        // Una risposta inattesa viene lasciata gestire al browser come GET.
        window.location.assign(url);
        return;
      }
      document.querySelector(".left-panel .panel-body").replaceWith(nextLeft);
      document.querySelector(".center-panel .panel-body").replaceWith(nextCenter);
      document.title = next.title;
      if (push) history.pushState({}, "", url);
      enhance(document);
      restoreInterfaceState(interfaceState);
      announce("Risultati aggiornati");
    } catch (error) {
      if (error.name !== "AbortError") window.location.assign(url);
    } finally {
      document.querySelector(".center-panel")?.classList.remove("loading");
      document.querySelector(".live-filters")?.removeAttribute("aria-busy");
    }
  }

  function submitFilters(form) {
    const url = new URL(form.action || window.location.href, window.location.href);
    const params = new URLSearchParams(new FormData(form));
    params.delete("page");
    url.search = params.toString();
    updateListing(url);
  }

  // Gli handler sono delegati a document perché filtri, tabelle e paginazione
  // vengono sostituiti dopo ogni aggiornamento.
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.matches(".live-filters")) {
      event.preventDefault();
      window.clearTimeout(timer);
      submitFilters(form);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-suggestions-url]")) {
      const input = event.target;
      const results = document.getElementById(input.getAttribute("aria-controls"));
      window.clearTimeout(suggestionTimer);
      suggestionController?.abort();
      results.replaceChildren();
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
      if (input.value.trim().length < 2) return;
      suggestionTimer = window.setTimeout(async () => {
        suggestionController = new AbortController();
        const url = new URL(input.dataset.suggestionsUrl, window.location.origin);
        url.searchParams.set("q", input.value.trim());
        try {
          const response = await fetch(url, { signal: suggestionController.signal });
          if (!response.ok) return;
          const data = await response.json();
          data.items.forEach((item) => {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "user-suggestion";
            option.setAttribute("role", "option");
            option.dataset.username = item.username;
            const username = document.createElement("strong");
            username.textContent = item.username;
            const name = document.createElement("small");
            name.textContent = `${item.nome} ${item.cognome}`;
            option.append(username, name);
            results.append(option);
          });
          results.hidden = data.items.length === 0;
          input.setAttribute("aria-expanded", String(data.items.length > 0));
        } catch (error) {
          if (error.name !== "AbortError") results.replaceChildren();
        }
      }, 250);
      return;
    }
    const form = event.target.closest(".live-filters");
    if (!form || !event.target.matches("input:not([type='date'])")) return;
    if (
      ["search", "text"].includes(event.target.type) &&
      event.target.value.trim().length === 1
    ) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => submitFilters(form), 500);
  });

  document.addEventListener("change", (event) => {
    const form = event.target.closest(".live-filters");
    if (!form || !event.target.matches("select, input[type='date']")) return;
    window.clearTimeout(timer);
    submitFilters(form);
  });

  document.addEventListener("click", (event) => {
    const backLink = event.target.closest("[data-history-back]");
    if (backLink && document.referrer) {
      const previous = new URL(document.referrer);
      if (previous.origin === window.location.origin) {
        event.preventDefault();
        history.back();
        return;
      }
    }
    const suggestion = event.target.closest(".user-suggestion");
    if (suggestion) {
      const search = suggestion.closest(".user-search");
      const input = search.querySelector("[data-suggestions-url]");
      input.value = suggestion.dataset.username;
      search.querySelector(".user-suggestions").hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.focus();
      return;
    }
    const confirmationTrigger = event.target.closest("[data-confirm-target]");
    if (confirmationTrigger && openConfirmation(confirmationTrigger)) {
      event.preventDefault();
      return;
    }
    const confirmationClose = event.target.closest("[data-confirm-close]");
    if (confirmationClose) {
      closeConfirmation(confirmationClose.closest(".confirm-overlay"));
      return;
    }
    if (event.target.matches(".confirm-overlay")) {
      closeConfirmation(event.target);
      return;
    }
    const link = event.target.closest(listingSelector);
    if (link && link.origin === window.location.origin) {
      event.preventDefault();
      updateListing(link.href);
      return;
    }
    const questionsToggle = event.target.closest(".questions-toggle-all");
    if (questionsToggle) {
      const stack = document.getElementById(
        questionsToggle.getAttribute("aria-controls")
      );
      if (!stack) return;
      const questions = [...stack.querySelectorAll("details.question-card")];
      const shouldOpen = questions.some((item) => !item.open);
      questions.forEach((item) => {
        item.open = shouldOpen;
      });
      syncQuestionsToggle(questionsToggle);
      return;
    }
    const solutions = event.target.closest(".solutions-toggle");
    if (solutions) {
      event.preventDefault();
      const stack = solutions.closest(".content-section").querySelector(".question-stack");
      const hidden = stack.classList.toggle("solutions-hidden");
      const label = hidden ? "Mostra soluzioni" : "Nascondi soluzioni";
      const icon = solutions.querySelector(".ui-icon");
      solutions.href = hidden
        ? solutions.dataset.showUrl
        : solutions.dataset.hideUrl;
      solutions.setAttribute("aria-label", label);
      solutions.setAttribute("title", label);
      solutions.setAttribute("aria-pressed", String(!hidden));
      icon?.classList.toggle("icon-eye", hidden);
      icon?.classList.toggle("icon-eye-off", !hidden);
    }
  });

  // Mantiene coerente il controllo globale anche se una domanda viene aperta
  // o chiusa singolarmente.
  document.addEventListener("toggle", (event) => {
    if (!event.target.matches("details.question-card")) return;
    const stack = event.target.closest(".question-stack");
    const button = document.querySelector(
      `.questions-toggle-all[aria-controls="${stack.id}"]`
    );
    if (button) syncQuestionsToggle(button);
  }, true);

  document.addEventListener("keydown", (event) => {
    const confirmation = document.querySelector(".confirm-overlay:not([hidden])");
    if (confirmation) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation(confirmation);
        return;
      }
      if (event.key === "Tab") {
        // La modale custom trattiene il focus finché viene chiusa.
        const focusable = [...confirmation.querySelectorAll("button, a, input")]
          .filter((element) => !element.disabled && !element.hidden);
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      return;
    }
    const input = event.target.closest("[data-suggestions-url]");
    if (!input) return;
    const results = document.getElementById(input.getAttribute("aria-controls"));
    const options = [...results.querySelectorAll(".user-suggestion")];
    if (!options.length || results.hidden) return;
    const current = options.findIndex((option) => option.classList.contains("active"));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      options.forEach((option) => option.classList.remove("active"));
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = current < 0 ? (direction > 0 ? 0 : options.length - 1) : (current + direction + options.length) % options.length;
      options[next].classList.add("active");
      options[next].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && current >= 0) {
      event.preventDefault();
      options[current].click();
    } else if (event.key === "Escape") {
      results.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("popstate", () => updateListing(window.location.href, false));
  enhance(document);
})();

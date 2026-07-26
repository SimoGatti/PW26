document.documentElement.classList.add("js");

(() => {
  let timer;
  let requestController;
  let suggestionTimer;
  let suggestionController;

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
        ["−G", "Indietro di un giorno", "date", -1],
        ["+G", "Avanti di un giorno", "date", 1],
        ["−M", "Indietro di un mese", "month", -1],
        ["+M", "Avanti di un mese", "month", 1],
        ["−A", "Indietro di un anno", "year", -1],
        ["+A", "Avanti di un anno", "year", 1],
      ].forEach(([text, label, unit, amount]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "icon-button";
        button.textContent = text;
        button.title = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", () => {
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
        holder.append(button);
      });
    });
  }

  async function updateListing(url, push = true) {
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
        window.location.assign(url);
        return;
      }
      document.querySelector(".left-panel .panel-body").replaceWith(nextLeft);
      document.querySelector(".center-panel .panel-body").replaceWith(nextCenter);
      document.title = next.title;
      if (push) history.pushState({}, "", url);
      enhance(document);
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
      const datalist = document.getElementById(input.getAttribute("list"));
      window.clearTimeout(suggestionTimer);
      suggestionController?.abort();
      datalist.replaceChildren();
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
            const option = document.createElement("option");
            option.value = item.username;
            option.label = `${item.nome} ${item.cognome}`;
            datalist.append(option);
          });
        } catch (error) {
          if (error.name !== "AbortError") datalist.replaceChildren();
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
    const link = event.target.closest(listingSelector);
    if (link && link.origin === window.location.origin) {
      event.preventDefault();
      updateListing(link.href);
      return;
    }
    const solutions = event.target.closest(".solutions-toggle");
    if (solutions) {
      const stack = solutions.closest(".content-section").querySelector(".question-stack");
      const hidden = stack.classList.toggle("solutions-hidden");
      solutions.textContent = hidden ? "Mostra soluzioni" : "Nascondi soluzioni";
      solutions.setAttribute("aria-pressed", String(!hidden));
    }
  });

  window.addEventListener("popstate", () => updateListing(window.location.href, false));
  enhance(document);
})();

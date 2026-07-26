/* Enhancement: il submit GET continua a funzionare senza JavaScript. */
document.querySelectorAll("form.live-filters").forEach((form) => {
  let timer;
  const submit = () => form.requestSubmit();
  form.querySelectorAll("input[type='text'], input[type='search'], input[type='number']").forEach((input) => {
    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      if (input.type !== "number" && input.value.trim().length > 0 && input.value.trim().length < 2) return;
      timer = window.setTimeout(submit, 450);
    });
  });
  form.querySelectorAll("select, input[type='date']").forEach((input) => input.addEventListener("change", submit));
});

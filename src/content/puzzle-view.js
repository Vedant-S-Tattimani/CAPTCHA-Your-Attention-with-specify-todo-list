/*
 * Renders any puzzle from lib/puzzles.js as a small form. Shared by the Shorts overlay and the
 * popup's "Try" demo so both look and behave the same. Styling is up to the host page
 * (overlay-style.js for YouTube, popup/puzzle-demo.css for the popup).
 */
(function () {
  "use strict";

  const { check } = globalThis.FocusPuzzles;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  const MASK = "•";
  const PLACEHOLDER = { number: "Your answer", text: "Type your answer" };

  /**
   * @param {{
   *   next: () => object,                      // returns a new puzzle
   *   onSolved: (puzzle: object) => void,
   *   decorate?: (parts: { question: HTMLElement, input: HTMLInputElement, submit: HTMLButtonElement }) => void,
   * }} options
   * @returns {{ element: HTMLFormElement, focus: () => void, destroy: () => void }}
   */
  function create({ next, onSolved, decorate }) {
    let puzzle = null;
    let timers = [];

    const kind = el("div", { className: "kind" });
    const question = el("div", { className: "question" });
    const choices = el("div", { className: "choices", role: "group" });
    const input = el("input", { type: "text", autocomplete: "off", spellcheck: false });
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("aria-label", "Answer");
    const feedback = el("div", { className: "feedback", role: "status" });
    const submit = el("button", { type: "submit", className: "primary", textContent: "Check" });
    const another = el("button", { type: "button", className: "ghost", textContent: "Different puzzle" });
    const form = el("form", { className: "puzzle" }, [kind, question, choices, input, feedback, el("div", { className: "row" }, [submit, another])]);
    decorate?.({ question, input, submit });

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function solved() {
      clearTimers();
      form.classList.add("solved");
      onSolved(puzzle);
    }

    function wrong(message = "Not quite. Try again.") {
      feedback.textContent = message;
      form.classList.remove("shake");
      void form.offsetWidth; // restart the shake animation
      form.classList.add("shake");
    }

    function renderChoices() {
      choices.replaceChildren(
        ...puzzle.options.map((option) => {
          const button = el("button", { type: "button", className: "choice", textContent: option });
          button.setAttribute("aria-label", `Choose ${option}`);
          button.addEventListener("click", () => {
            if (check(puzzle, option)) return solved();
            button.disabled = true;
            wrong("Nope, that one belongs. Try another.");
          });
          return button;
        })
      );
    }

    /** Memory: show the digits, count down, then mask them and unlock the input. */
    function startMemory() {
      const seconds = Math.ceil(puzzle.hideAfterMs / 1000);
      input.disabled = true;
      input.placeholder = "Memorise…";
      question.classList.add("memorising");
      for (let s = seconds; s > 0; s--) {
        timers.push(setTimeout(() => (kind.textContent = `Memorise… ${s}`), (seconds - s) * 1000));
      }
      timers.push(
        setTimeout(() => {
          question.classList.remove("memorising");
          question.textContent = puzzle.answer.split("").map(() => MASK).join(" ");
          kind.textContent = "Now type what you saw";
          input.disabled = false;
          input.placeholder = "Type the digits";
          input.focus();
        }, puzzle.hideAfterMs)
      );
    }

    function render() {
      clearTimers();
      puzzle = next();
      form.className = `puzzle kind-${puzzle.kind}`;
      form.dataset.kind = puzzle.kind;
      kind.textContent = puzzle.prompt;
      question.textContent = puzzle.kind === "phrase" ? `“${puzzle.display}”` : puzzle.display;
      question.hidden = !puzzle.display;
      feedback.textContent = "";

      const isChoice = puzzle.input === "choice";
      choices.hidden = !isChoice;
      input.hidden = isChoice;
      submit.hidden = isChoice;
      input.value = "";
      input.disabled = false;
      input.inputMode = puzzle.input === "number" ? "numeric" : "text";
      input.placeholder = PLACEHOLDER[puzzle.input] || "";
      if (isChoice) renderChoices();
      if (puzzle.hideAfterMs) startMemory();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!puzzle || puzzle.input === "choice" || input.disabled) return;
      if (check(puzzle, input.value)) return solved();
      wrong();
      input.value = "";
      input.focus();
    });
    another.addEventListener("click", () => {
      render();
      focus();
    });
    // Phrase puzzles must be typed: block paste/drop into the box and copying the phrase.
    ["paste", "drop"].forEach((type) =>
      input.addEventListener(type, (event) => {
        if (!puzzle?.noPaste) return;
        event.preventDefault();
        feedback.textContent = "No pasting. Type it out 😉";
      })
    );
    question.addEventListener("copy", (event) => {
      if (puzzle?.noPaste) event.preventDefault();
    });

    function focus() {
      const target = puzzle?.input === "choice" ? choices.querySelector(".choice") : input;
      if (target && !target.disabled) target.focus();
    }

    render();
    return { element: form, focus, destroy: clearTimers };
  }

  globalThis.FocusPuzzleView = { create };
})();

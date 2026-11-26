/*
 * Guard tab: choose which puzzle types the Shorts guard may show, and try any of them in a
 * demo inside the popup (same view as on YouTube; demo solves don't count towards stats).
 */
(function () {
  "use strict";

  const { PUZZLE_KINDS } = globalThis.FocusSettings;
  const { KIND_INFO, generate } = globalThis.FocusPuzzles;
  const { create: createPuzzleView } = globalThis.FocusPuzzleView;

  const DEMO_DIFFICULTY = 2;
  const CLOSE_AFTER_SOLVE_MS = 1100;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  /**
   * @param {{
   *   grid: HTMLElement, error: HTMLElement, demo: HTMLElement,
   *   getKinds: () => string[], saveKinds: (kinds: string[]) => Promise<void>,
   *   celebrate: (origin?: Element) => void, onError: (e: unknown) => void,
   * }} deps
   */
  function setup(deps) {
    const slot = deps.demo.querySelector("[data-demo-slot]");
    const title = deps.demo.querySelector("[data-demo-title]");
    let view = null;
    let returnFocus = null;
    let closeTimer = null;

    function closeDemo() {
      clearTimeout(closeTimer);
      view?.destroy();
      view = null;
      slot.replaceChildren();
      deps.demo.hidden = true;
      returnFocus?.focus();
    }

    function openDemo(kind, trigger) {
      closeDemo();
      returnFocus = trigger;
      title.textContent = `${KIND_INFO[kind].icon} ${KIND_INFO[kind].label}`;
      view = createPuzzleView({
        next: () => generate(kind, DEMO_DIFFICULTY),
        onSolved: () => {
          view.element.querySelector(".feedback").textContent = "Solved! 🎉 That's how it works on Shorts.";
          deps.celebrate(view.element);
          closeTimer = setTimeout(closeDemo, CLOSE_AFTER_SOLVE_MS);
        },
      });
      slot.replaceChildren(view.element);
      deps.demo.hidden = false;
      view.focus();
    }

    async function toggle(kind, checked, checkbox) {
      const current = deps.getKinds();
      const next = checked ? [...current, kind] : current.filter((k) => k !== kind);
      if (next.length === 0) {
        checkbox.checked = true;
        deps.error.textContent = "Keep at least one puzzle type on.";
        return;
      }
      deps.error.textContent = "";
      await deps.saveKinds(PUZZLE_KINDS.filter((k) => next.includes(k)));
    }

    function card(kind) {
      const info = KIND_INFO[kind];
      const checkbox = el("input", { type: "checkbox", className: "kind-check" });
      checkbox.dataset.kind = kind;
      checkbox.addEventListener("change", () => toggle(kind, checkbox.checked, checkbox).catch(deps.onError));
      const tryBtn = el("button", { type: "button", className: "kind-try", textContent: "▶ Try" });
      tryBtn.setAttribute("aria-label", `Try a ${info.label} puzzle`);
      tryBtn.addEventListener("click", () => openDemo(kind, tryBtn));
      return el("li", { className: "kind-card" }, [
        el("label", { className: "kind-main" }, [
          checkbox,
          el("span", { className: "kind-icon", textContent: info.icon, ariaHidden: "true" }),
          el("span", { className: "kind-text" }, [
            el("span", { className: "kind-name", textContent: info.label }),
            el("span", { className: "kind-example", textContent: info.example }),
          ]),
        ]),
        tryBtn,
      ]);
    }

    deps.grid.replaceChildren(...PUZZLE_KINDS.map(card));
    deps.demo.querySelector("[data-demo-close]").addEventListener("click", closeDemo);
    deps.demo.addEventListener("click", (e) => {
      if (e.target === deps.demo) closeDemo();
    });
    deps.demo.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDemo();
    });

    /** Sync checkboxes with saved settings. */
    function render() {
      const kinds = deps.getKinds();
      deps.grid.querySelectorAll(".kind-check").forEach((box) => {
        box.checked = kinds.includes(box.dataset.kind);
        box.closest(".kind-card").classList.toggle("off", !box.checked);
      });
    }

    return { render, openDemo };
  }

  globalThis.FocusPuzzlePicker = { setup };
})();

/*
 * Shorts guard: counts YouTube Shorts and interrupts with a math puzzle.
 * Based on CAPTCHA-Your-Attention (MIT, Yash Yadav).
 * Runs on all of youtube.com because YouTube is a single-page app: going from the
 * home page to Shorts doesn't reload the page.
 */
(function () {
  "use strict";

  const { KEYS, sanitizeSettings, addStats, shouldShowPuzzle } = globalThis.FocusSettings;
  const { generatePuzzle, difficultyFor, isCorrect } = globalThis.FocusCaptcha;
  const { isFocusing } = globalThis.FocusPomodoro;
  const { topTask } = globalThis.FocusTasks;

  const POLL_MS = 500;
  const FLUSH_SECONDS = 10;
  const HOST_ID = "focus-guard-host";
  const INSTANCE_ATTR = "data-focus-guard";

  /*
   * The guard can be added twice to one tab: once by Chrome on page load and again by the
   * background worker after the extension is reloaded. The newest copy marks the page and
   * older copies stop themselves when they see a different mark.
   */
  const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  document.documentElement.setAttribute(INSTANCE_ATTR, instanceId);
  document.getElementById(HOST_ID)?.remove();

  let timerId = null;
  let settings = sanitizeSettings(null);
  let pomodoro = null;
  let tasks = [];
  let currentShortId = null;
  let shortsThisSession = 0;
  let shortsSinceLastPuzzle = 0;
  let pendingSeconds = 0;
  let puzzleOpen = false;
  let lastTick = Date.now();

  function shortIdFromUrl() {
    const match = location.pathname.match(/^\/shorts\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  async function bumpStats(delta) {
    try {
      const data = await chrome.storage.local.get(KEYS.stats);
      await chrome.storage.local.set({ [KEYS.stats]: addStats(data[KEYS.stats], delta) });
    } catch (error) {
      // Happens when the extension is reloaded while the page is open; nothing to save to.
      console.warn("[Focus Guard] could not save stats", error);
    }
  }

  function reportStatus() {
    chrome.storage.local
      .set({
        [KEYS.guardStatus]: { seenAt: Date.now(), shortsSinceLast: shortsSinceLastPuzzle, focusing: isFocusing(pomodoro) },
      })
      .catch((error) => console.warn("[Focus Guard] could not save status", error));
  }

  /** False once the extension was reloaded/removed or a newer copy of this script took over. */
  function stillCurrent() {
    const extensionAlive = Boolean(globalThis.chrome?.runtime?.id);
    return extensionAlive && document.documentElement.getAttribute(INSTANCE_ATTR) === instanceId;
  }

  function pauseVideos() {
    document.querySelectorAll("video").forEach((v) => {
      if (!v.paused) v.pause();
    });
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  /*
   * Layout that must survive even if the shadow stylesheet never applies (seen in real use:
   * the puzzle rendered as bare controls in the corner, under YouTube's header). Set inline
   * with !important so neither YouTube's CSS nor a missing stylesheet can undo it.
   */
  const CRITICAL_STYLES = {
    host: { position: "fixed", inset: "0", "z-index": "2147483647", display: "block", margin: "0", padding: "0" },
    backdrop: {
      position: "fixed",
      inset: "0",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      padding: "16px",
      background: "rgba(10, 12, 16, 0.78)",
      "font-family": 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    card: {
      width: "100%",
      "max-width": "360px",
      "box-sizing": "border-box",
      padding: "24px",
      "border-radius": "16px",
      background: "#fffdf8",
      color: "#1f2328",
      "text-align": "center",
      "box-shadow": "0 20px 50px rgba(0, 0, 0, 0.35)",
    },
    question: { "font-size": "26px", "font-weight": "600", margin: "0 0 12px" },
    input: { width: "100%", "box-sizing": "border-box", padding: "10px", "font-size": "18px", "text-align": "center" },
    primary: { background: "#d9480f", color: "#fff", border: "0", padding: "10px 12px", "border-radius": "10px", cursor: "pointer" },
  };

  function pin(node, styles) {
    Object.entries(styles).forEach(([prop, value]) => node.style.setProperty(prop, value, "important"));
    return node;
  }

  function closePuzzle() {
    document.getElementById(HOST_ID)?.remove();
    puzzleOpen = false;
  }

  function openPuzzle() {
    if (puzzleOpen) return;
    puzzleOpen = true;
    pauseVideos();

    const host = pin(el("div", { id: HOST_ID }), CRITICAL_STYLES.host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = el("style", { textContent: globalThis.FocusOverlayCss || "" });

    const focusing = isFocusing(pomodoro);
    let puzzle = generatePuzzle(difficultyFor(shortsThisSession, settings.difficultyStep));

    const question = pin(el("div", { className: "question", textContent: `${puzzle.text} = ?` }), CRITICAL_STYLES.question);
    const input = pin(
      el("input", { type: "text", inputMode: "numeric", autocomplete: "off", placeholder: "Your answer" }),
      CRITICAL_STYLES.input
    );
    input.setAttribute("aria-label", "Answer");
    const feedback = el("div", { className: "feedback", role: "status" });
    const submit = pin(el("button", { type: "submit", className: "primary", textContent: "Check" }), CRITICAL_STYLES.primary);
    const another = el("button", { type: "button", className: "ghost", textContent: "Different puzzle" });
    const leave = el("button", { type: "button", className: "ghost", textContent: "Leave Shorts" });

    const task = topTask(tasks);
    const reminder = task
      ? el("p", { className: "reminder" }, ["Up next: ", el("strong", { textContent: task.title })])
      : el("p", { className: "reminder", textContent: "Is this what you meant to be doing?" });

    const form = el("form", {}, [question, input, feedback, el("div", { className: "row" }, [submit, another]), leave]);
    const card = el("div", { className: "card", role: "dialog", ariaModal: "true" }, [
      el("h2", { textContent: focusing ? "You're in a focus session" : "Time for a brain check" }),
      el("p", {
        className: "sub",
        textContent: `${shortsThisSession} short${shortsThisSession === 1 ? "" : "s"} this visit. Solve this to keep watching.`,
      }),
      reminder,
      form,
    ]);
    card.setAttribute("aria-label", "Focus Guard puzzle");
    pin(card, CRITICAL_STYLES.card);
    shadow.append(style, pin(el("div", { className: "backdrop" }, [card]), CRITICAL_STYLES.backdrop));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (isCorrect(input.value, puzzle.answer)) {
        closePuzzle();
        shortsSinceLastPuzzle = 0;
        reportStatus();
        bumpStats({ puzzlesSolved: 1 });
        document.querySelector("video")?.play().catch(() => {});
        return;
      }
      feedback.textContent = "Not quite. Try again.";
      input.value = "";
      input.focus();
    });
    another.addEventListener("click", () => {
      puzzle = generatePuzzle(difficultyFor(shortsThisSession, settings.difficultyStep));
      question.textContent = `${puzzle.text} = ?`;
      feedback.textContent = "";
      input.focus();
    });
    leave.addEventListener("click", () => {
      closePuzzle();
      shortsSinceLastPuzzle = 0;
      location.assign("https://www.youtube.com/");
    });
    // Keep YouTube's shortcuts (numbers seek, arrows scroll Shorts) from reacting to typing.
    ["keydown", "keyup", "keypress", "wheel"].forEach((type) =>
      host.addEventListener(type, (e) => e.stopPropagation(), { capture: false })
    );

    document.documentElement.append(host);
    input.focus();
  }

  function onShortChanged(id) {
    currentShortId = id;
    shortsThisSession += 1;
    shortsSinceLastPuzzle += 1;
    bumpStats({ shortsWatched: 1 });
    reportStatus();
    if (shouldShowPuzzle(shortsSinceLastPuzzle, settings, isFocusing(pomodoro))) openPuzzle();
  }

  function tick() {
    if (!stillCurrent()) {
      clearInterval(timerId);
      return;
    }
    const now = Date.now();
    const elapsed = (now - lastTick) / 1000;
    lastTick = now;

    const id = shortIdFromUrl();
    if (!id) {
      if (puzzleOpen) closePuzzle();
      currentShortId = null;
      return;
    }
    if (id !== currentShortId) onShortChanged(id);
    if (puzzleOpen) {
      pauseVideos(); // YouTube tries to autoplay; keep it paused until solved.
      if (!document.getElementById(HOST_ID)) puzzleOpen = false; // page removed our overlay
      return;
    }
    if (document.visibilityState === "visible") {
      pendingSeconds += elapsed;
      if (pendingSeconds >= FLUSH_SECONDS) {
        const whole = Math.floor(pendingSeconds);
        pendingSeconds -= whole;
        bumpStats({ secondsOnShorts: whole });
      }
    }
  }

  chrome.storage.local
    .get([KEYS.settings, KEYS.pomodoro, KEYS.tasks])
    .then((data) => {
      settings = sanitizeSettings(data[KEYS.settings]);
      pomodoro = data[KEYS.pomodoro] || null;
      tasks = Array.isArray(data[KEYS.tasks]) ? data[KEYS.tasks] : [];
      timerId = setInterval(tick, POLL_MS);
    })
    .catch((error) => console.error("[Focus Guard] failed to start", error));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !stillCurrent()) return;
    if (changes[KEYS.settings]) settings = sanitizeSettings(changes[KEYS.settings].newValue);
    if (changes[KEYS.pomodoro]) pomodoro = changes[KEYS.pomodoro].newValue || null;
    if (changes[KEYS.tasks]) tasks = Array.isArray(changes[KEYS.tasks].newValue) ? changes[KEYS.tasks].newValue : [];
    if (!settings.guardEnabled && puzzleOpen) closePuzzle();
  });
})();

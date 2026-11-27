/*
 * Short-video guard: counts videos on YouTube Shorts, Instagram Reels, TikTok, Facebook Reels and
 * Snapchat Spotlight (see lib/platforms.js) and interrupts with a puzzle every few videos.
 * Runs on the whole site because these are single-page apps: opening the video feed from the
 * home page doesn't reload the page.
 */
(function () {
  "use strict";

  const { platformForHost, videoIdFromPath, isScrollFeed, dominantVideo } = globalThis.FocusPlatforms;
  const platform = platformForHost(location.hostname);
  if (!platform) return; // not a supported site

  const { KEYS, sanitizeSettings, shouldShowPuzzle } = globalThis.FocusSettings;
  const { difficultyFor } = globalThis.FocusCaptcha;
  const { generate, nextKind } = globalThis.FocusPuzzles;
  const { create: createPuzzleView } = globalThis.FocusPuzzleView;
  const { isFocusing } = globalThis.FocusPomodoro;
  const { focusTask } = globalThis.FocusTasks;

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
  let focusTaskId = null;
  let currentShortId = null;
  let shortsThisSession = 0;
  let shortsSinceLastPuzzle = 0;
  let pendingSeconds = 0;
  let puzzleOpen = false;
  let lastTick = Date.now();

  const unitOne = platform.unit.replace(/s$/, "");
  const videoKeys = new WeakMap();
  let nextVideoKey = 1;

  /** Stable key for a <video>: its source when it has one, else a per-element number. */
  function keyFor(video) {
    const src = video.currentSrc || video.src || video.poster;
    if (src && !src.startsWith("blob:")) return src;
    if (!videoKeys.has(video)) videoKeys.set(video, `video-${nextVideoKey++}`);
    return `${videoKeys.get(video)}|${src || ""}`;
  }

  /** On feeds that keep one address (TikTok For You): the video filling the screen. */
  function onScreenVideoKey() {
    const boxes = [...document.querySelectorAll("video")].map((video) => {
      const rect = video.getBoundingClientRect();
      return { key: keyFor(video), top: rect.top, bottom: rect.bottom, playing: !video.paused };
    });
    return dominantVideo(boxes, window.innerHeight);
  }

  /**
   * What's on screen: { id } for a video, { id: null, onFeed: true } while scrolling a feed
   * without one video filling the screen, or { id: null, onFeed: false } when off the feed.
   */
  function currentVideo() {
    const fromPath = videoIdFromPath(platform, location.pathname);
    if (fromPath) return { id: fromPath, onFeed: true };
    if (isScrollFeed(platform, location.pathname)) return { id: onScreenVideoKey(), onFeed: true };
    return { id: null, onFeed: false };
  }

  const guardedHere = () => settings.guardEnabled && settings.platforms.includes(platform.id);

  /**
   * Records activity for Insights (videos, time, puzzles). The background worker is the only
   * writer, so counts from several tabs at once can't overwrite each other.
   */
  async function bumpStats(delta) {
    try {
      const response = await chrome.runtime.sendMessage({ type: "activity", delta: { ...delta, platform: platform.id } });
      if (!response?.ok) console.warn("[Focus Guard] activity not saved", response?.error);
    } catch (error) {
      // Happens when the extension is reloaded while the page is open; nothing to save to.
      console.warn("[Focus Guard] could not save stats", error);
    }
  }

  function reportStatus() {
    chrome.storage.local
      .set({
        [KEYS.guardStatus]: {
          seenAt: Date.now(),
          shortsSinceLast: shortsSinceLastPuzzle,
          focusing: isFocusing(pomodoro),
          platform: platform.id,
        },
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
      background: "rgba(17, 18, 18, 0.78)",
      "font-family": 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    },
    card: {
      width: "100%",
      "max-width": "360px",
      "box-sizing": "border-box",
      padding: "24px",
      "border-radius": "4px",
      border: "1px solid #111212",
      "background-color": "#ffffff",
      color: "#111212",
      "text-align": "center",
      "box-shadow": "8px 8px 0 #36c5f0, 0 24px 60px rgba(0, 0, 0, 0.4)",
    },
    question: { "font-weight": "800", margin: "0 0 12px" },
    input: { width: "100%", "box-sizing": "border-box", padding: "10px", "font-size": "18px", "text-align": "center" },
    primary: { background: "#111212", color: "#fff", border: "1px solid #111212", "border-radius": "4px", cursor: "pointer" },
  };

  function pin(node, styles) {
    Object.entries(styles).forEach(([prop, value]) => node.style.setProperty(prop, value, "important"));
    return node;
  }

  /*
   * @font-face rules don't work inside a shadow root, so the overlay's fonts are added to the
   * page's font set once, under names that can't clash with YouTube's. If loading fails the
   * overlay simply uses the fallback fonts listed in overlay-style.js.
   */
  let fontsRequested = false;
  function loadOverlayFonts() {
    if (fontsRequested || typeof FontFace === "undefined") return;
    fontsRequested = true;
    const faces = [
      new FontFace("FocusGuard Display", `url("${chrome.runtime.getURL("fonts/bitcount-prop-single.woff2")}")`, {
        weight: "400 900",
      }),
      new FontFace("FocusGuard Hand", `url("${chrome.runtime.getURL("fonts/shadows-into-light.woff2")}")`),
    ];
    faces.forEach((face) =>
      face
        .load()
        .then((loaded) => document.fonts.add(loaded))
        .catch((error) => console.warn("[Focus Guard] overlay font not loaded, using fallback", error))
    );
  }

  /*
   * Puzzle types come in a shuffled rotation: every selected type once before any repeats. The
   * rotation is saved, so it carries on across tabs, reloads and different sites.
   */
  let puzzleRotation = null;

  function nextPuzzle() {
    const { kind, rotation } = nextKind(puzzleRotation, settings.puzzleKinds);
    puzzleRotation = rotation;
    chrome.storage.local
      .set({ [KEYS.puzzleRotation]: rotation })
      .catch((error) => console.warn("[Focus Guard] could not save puzzle rotation", error));
    return generate(kind, difficultyFor(shortsThisSession, settings.difficultyStep));
  }

  let activeView = null;

  function closePuzzle() {
    activeView?.destroy();
    activeView = null;
    document.getElementById(HOST_ID)?.remove();
    puzzleOpen = false;
  }

  function onPuzzleSolved() {
    closePuzzle();
    shortsSinceLastPuzzle = 0;
    reportStatus();
    bumpStats({ puzzlesSolved: 1 });
    document.querySelector("video")?.play().catch(() => {});
  }

  function openPuzzle() {
    if (puzzleOpen) return;
    puzzleOpen = true;
    pauseVideos();
    loadOverlayFonts();

    const host = pin(el("div", { id: HOST_ID }), CRITICAL_STYLES.host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = el("style", { textContent: globalThis.FocusOverlayCss || "" });
    const focusing = isFocusing(pomodoro);

    activeView = createPuzzleView({
      next: nextPuzzle,
      onSolved: onPuzzleSolved,
      decorate: ({ question, input, submit }) => {
        pin(question, CRITICAL_STYLES.question);
        pin(input, CRITICAL_STYLES.input);
        pin(submit, CRITICAL_STYLES.primary);
      },
    });
    const form = activeView.element;
    const leave = el("button", { type: "button", className: "ghost leave", textContent: `Leave ${platform.short}` });
    form.append(leave);

    const task = focusTask(tasks, focusTaskId);
    const reminder = task
      ? el("p", { className: "reminder" }, ["🎯 You wanted to: ", el("strong", { textContent: task.title })])
      : el("p", { className: "reminder", textContent: "Is this what you meant to be doing?" });

    const card = el("div", { className: "card", role: "dialog", ariaModal: "true" }, [
      el("p", { className: "scribble", textContent: focusing ? "hey, focus time!" : "hey, wait!" }),
      el("h2", { textContent: focusing ? "You're in a focus session" : "Time for a brain check" }),
      el("p", {
        className: "sub",
        textContent: `${shortsThisSession} ${shortsThisSession === 1 ? unitOne : platform.unit} this visit. Solve this to keep watching.`,
      }),
      reminder,
      form,
    ]);
    card.setAttribute("aria-label", "Focus Guard puzzle");
    pin(card, CRITICAL_STYLES.card);
    shadow.append(style, pin(el("div", { className: "backdrop" }, [card]), CRITICAL_STYLES.backdrop));

    leave.addEventListener("click", () => {
      closePuzzle();
      shortsSinceLastPuzzle = 0;
      location.assign(platform.home);
    });
    // Keep the site's shortcuts (numbers seek, arrows scroll the feed) from reacting to typing.
    ["keydown", "keyup", "keypress", "wheel"].forEach((type) =>
      host.addEventListener(type, (e) => e.stopPropagation(), { capture: false })
    );

    document.documentElement.append(host);
    activeView.focus();
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

    if (!guardedHere()) {
      if (puzzleOpen) closePuzzle();
      return;
    }
    const { id, onFeed } = currentVideo();
    if (!onFeed) {
      if (puzzleOpen) closePuzzle();
      currentShortId = null;
      return;
    }
    if (id && id !== currentShortId) onShortChanged(id);
    if (puzzleOpen) {
      pauseVideos(); // Feeds try to autoplay; keep them paused until solved.
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
    .get([KEYS.settings, KEYS.pomodoro, KEYS.tasks, KEYS.focusTaskId, KEYS.puzzleRotation])
    .then((data) => {
      focusTaskId = data[KEYS.focusTaskId] || null;
      puzzleRotation = data[KEYS.puzzleRotation] || null;
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
    if (changes[KEYS.focusTaskId]) focusTaskId = changes[KEYS.focusTaskId].newValue || null;
    // Another tab drew a puzzle: continue the same rotation here.
    if (changes[KEYS.puzzleRotation]) puzzleRotation = changes[KEYS.puzzleRotation].newValue || null;
    if (changes[KEYS.tasks]) tasks = Array.isArray(changes[KEYS.tasks].newValue) ? changes[KEYS.tasks].newValue : [];
    if (!settings.guardEnabled && puzzleOpen) closePuzzle();
  });
})();

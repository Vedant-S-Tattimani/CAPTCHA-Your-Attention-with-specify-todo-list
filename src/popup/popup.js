/* Popup UI. Reads/writes chrome.storage; the timer itself runs in the background worker. */
(function () {
  "use strict";

  const { KEYS, sanitizeSettings, sanitizeStats, EMPTY_STATS, guardStatusText } = globalThis.FocusSettings;
  const P = globalThis.FocusPomodoro;
  const T = globalThis.FocusTasks;
  const G = globalThis.FocusProgress;
  const { render: renderInsightsInto } = globalThis.FocusInsights;
  const { celebrate } = globalThis.FocusCelebrate;

  const RING_LENGTH = 2 * Math.PI * 54;
  const $ = (id) => document.getElementById(id);

  let settings = sanitizeSettings(null);
  let pomodoro = P.createState(settings);
  let tasks = [];
  let daily = {};
  let totals = null; // lifetime counters for XP; null until the first event after upgrading
  let focusTaskId = null;
  let guardStatus;
  let lastCompletedWork = null;
  let tasksView = null;
  let puzzlePicker = null;
  let platformPicker = null;

  /* ---------- helpers ---------- */
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  const todayKey = () => G.dayKey(new Date());

  async function saveSettings(patch) {
    settings = sanitizeSettings({ ...settings, ...patch });
    await chrome.storage.local.set({ [KEYS.settings]: settings });
  }

  async function saveTasks(next) {
    tasks = next;
    renderFocusOn();
    await chrome.storage.local.set({ [KEYS.tasks]: tasks });
  }

  async function setFocusTask(id) {
    focusTaskId = id;
    renderFocusOn();
    await chrome.storage.local.set({ [KEYS.focusTaskId]: id });
  }

  /** Sends activity to the background worker (the single writer); Insights updates via storage events. */
  async function recordToday(delta) {
    const response = await chrome.runtime.sendMessage({ type: "activity", delta });
    if (!response?.ok) throw new Error(response?.error || "Activity was not saved");
  }

  /** Lifetime totals for XP; before the first new event, fall back to the daily log. */
  const xpTotals = () => totals || G.totals(daily);

  async function timer(action) {
    const res = await chrome.runtime.sendMessage({ type: "timer", action });
    if (!res?.ok) throw new Error(res?.error || "Timer did not respond");
    pomodoro = res.state;
    renderTimer();
  }

  function reportError(error) {
    console.error("[Focus Guard]", error);
    $("focus-hint").textContent = "Something went wrong. Try reopening the popup.";
  }

  /* ---------- tabs ---------- */
  function setupTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    function select(tab) {
      tabs.forEach((t) => {
        const selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        $(t.getAttribute("aria-controls")).hidden = !selected;
      });
      tab.focus();
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const step = e.key === "ArrowRight" ? 1 : -1;
        select(tabs[(i + step + tabs.length) % tabs.length]);
      });
    });
  }

  /* ---------- progress: chips, daily goal, insights ---------- */
  function goalMessage(done, goal) {
    if (done === 0) return "Finish a session to plant today's seed 🌱";
    if (done < goal) return `${goal - done} more to make today's plant bloom`;
    return "Goal reached! Today's plant is in bloom 🌸";
  }

  function renderProgress() {
    const today = todayKey();
    const done = G.getDay(daily, today).sessions;
    const goal = settings.dailyGoal;
    const streakDays = G.streak(daily, today);
    const level = G.levelFor(G.xpFor(xpTotals()));

    $("chip-streak").textContent = `🔥 ${streakDays}`;
    $("chip-streak").classList.toggle("cold", streakDays === 0);
    $("chip-streak").title = `${streakDays}-day focus streak`;
    $("chip-level").textContent = `Lv ${level.level}`;
    $("chip-level").title = `${level.title} · ${level.xp} XP`;

    $("goal-count").textContent = `${done} / ${goal}`;
    $("goal-dots").replaceChildren(
      ...Array.from({ length: goal }, (_, i) => {
        const dot = el("li", { className: `goal-dot${i < done ? " filled" : ""}${i === done - 1 ? " latest" : ""}` });
        dot.setAttribute("aria-label", `Session ${i + 1} ${i < done ? "done" : "not done yet"}`);
        return dot;
      })
    );
    $("goal-msg").textContent = goalMessage(done, goal);
    renderInsightsInto($("panel-insights"), { log: daily, totals: xpTotals(), goal, today });
  }

  /* ---------- Focus tab ---------- */
  function renderFocusOn() {
    const task = T.focusTask(tasks, focusTaskId);
    $("focus-on").classList.toggle("empty-state", !task);
    $("focus-on-label").textContent = task ? "Focusing on" : "No focus task yet";
    $("focus-on-title").textContent = task ? task.title : "";
    $("focus-on-title").hidden = !task;
    $("focus-on-pick").hidden = Boolean(task);
  }

  const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  /** Top strip: guard on/off with a status dot, plus the current time. */
  function renderStatusBar() {
    const on = settings.guardEnabled;
    $("status-dot").classList.toggle("off", !on);
    $("status-text").textContent = on ? "GUARD ON" : "GUARD OFF";
    $("status-time").textContent = TIME_FORMAT.format(new Date()).toUpperCase();
  }

  /** The handwritten note above the title reacts to what you're doing. */
  function taglineFor(state) {
    if (state.running && state.mode === "work") return "in the zone!";
    if (state.running) return "take a breather~";
    if (G.getDay(daily, todayKey()).sessions >= settings.dailyGoal) return "goal smashed!";
    return "let's focus!";
  }

  function renderTimer() {
    const now = Date.now();
    const left = P.remaining(pomodoro, now);
    const total = P.durationMs(pomodoro.mode, settings);
    const fraction = total > 0 ? left / total : 0;

    $("dial").dataset.mode = pomodoro.mode;
    $("dial").classList.toggle("running", pomodoro.running);
    $("mode-label").textContent = pomodoro.mode === "work" ? "Work" : "Break";
    $("clock").textContent = P.formatClock(left);
    $("progress").style.strokeDashoffset = String(RING_LENGTH * (1 - fraction));
    $("session-count").textContent = `${pomodoro.completedWork} session${pomodoro.completedWork === 1 ? "" : "s"} done`;
    $("btn-toggle").textContent = pomodoro.running ? "Pause" : "Start";
    $("focus-hint").textContent = P.isFocusing(pomodoro) ? "Shorts will ask for a puzzle on every video." : "";
    $("tagline").textContent = taglineFor(pomodoro);
    renderStatusBar();
    tasksView?.renderTimer();

    if (lastCompletedWork !== null && pomodoro.completedWork > lastCompletedWork) celebrate($("dial"));
    lastCompletedWork = pomodoro.completedWork;
  }

  function setupFocus() {
    $("progress").style.strokeDasharray = String(RING_LENGTH);
    $("btn-toggle").addEventListener("click", () => timer(pomodoro.running ? "pause" : "start").catch(reportError));
    $("btn-reset").addEventListener("click", () => timer("reset").catch(reportError));
    $("btn-skip").addEventListener("click", () => timer("skip").catch(reportError));
    $("focus-on-pick").addEventListener("click", () => {
      $("tab-tasks").click();
      $("task-title").focus();
    });
    const numbers = { "work-minutes": "workMinutes", "break-minutes": "breakMinutes", "daily-goal": "dailyGoal" };
    Object.entries(numbers).forEach(([id, key]) =>
      $(id).addEventListener("change", (e) => saveSettings({ [key]: e.target.value }).catch(reportError))
    );
    setInterval(renderTimer, 250);
  }

  /* ---------- Tasks tab (popup/tasks-view.js) ---------- */
  function setupTasks() {
    tasksView = globalThis.FocusTasksView.setup({
      getTasks: () => tasks,
      saveTasks,
      getFocusId: () => focusTaskId,
      setFocusTask,
      getSettings: () => settings,
      saveSettings,
      getPomodoro: () => pomodoro,
      timer,
      recordToday,
      celebrate,
      todayKey,
      onError: reportError,
    });
  }

  /* ---------- Guard tab ---------- */
  function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function renderStats(raw) {
    const stats = sanitizeStats(raw);
    $("stat-shorts").textContent = String(stats.shortsWatched);
    $("stat-time").textContent = formatDuration(stats.secondsOnShorts);
    $("stat-solved").textContent = String(stats.puzzlesSolved);
    const { PLATFORMS, PLATFORM_IDS } = globalThis.FocusPlatforms;
    $("stat-by-platform").replaceChildren(
      ...PLATFORM_IDS.filter((id) => stats.byPlatform[id]).map((id) =>
        el("li", { title: PLATFORMS[id].name }, [
          el("span", { textContent: PLATFORMS[id].icon, ariaHidden: "true" }),
          el("span", { textContent: `${PLATFORMS[id].short} ${stats.byPlatform[id]}` }),
        ])
      )
    );
  }

  function renderGuardStatus() {
    $("guard-status").textContent = guardStatusText(guardStatus, settings, Date.now());
  }

  function renderSettings() {
    $("work-minutes").value = settings.workMinutes;
    $("break-minutes").value = settings.breakMinutes;
    $("daily-goal").value = settings.dailyGoal;
    $("guard-enabled").checked = settings.guardEnabled;
    $("puzzle-every").value = settings.puzzleEvery;
    $("puzzle-every-out").textContent = String(settings.puzzleEvery);
    $("difficulty-step").value = settings.difficultyStep;
    $("difficulty-step-out").textContent = String(settings.difficultyStep);
    $("strict-focus").checked = settings.strictDuringFocus;
    $("notify").checked = settings.notify;
    puzzlePicker?.render();
    platformPicker?.render().catch(reportError);
    renderGuardStatus();
  }

  function setupGuard() {
    const checkboxes = { "guard-enabled": "guardEnabled", "strict-focus": "strictDuringFocus", notify: "notify" };
    Object.entries(checkboxes).forEach(([id, key]) =>
      $(id).addEventListener("change", (e) => saveSettings({ [key]: e.target.checked }).catch(reportError))
    );
    const ranges = { "puzzle-every": "puzzleEvery", "difficulty-step": "difficultyStep" };
    Object.entries(ranges).forEach(([id, key]) => {
      $(id).addEventListener("input", (e) => ($(`${id}-out`).textContent = e.target.value));
      $(id).addEventListener("change", (e) => saveSettings({ [key]: e.target.value }).catch(reportError));
    });
    puzzlePicker = globalThis.FocusPuzzlePicker.setup({
      grid: $("kind-grid"),
      error: $("kind-error"),
      demo: $("demo"),
      getKinds: () => settings.puzzleKinds,
      saveKinds: (kinds) => saveSettings({ puzzleKinds: kinds }),
      celebrate,
      onError: reportError,
    });
    platformPicker = globalThis.FocusPlatformPicker.setup({
      list: $("platform-list"),
      message: $("platform-msg"),
      getPlatforms: () => settings.platforms,
      savePlatforms: (ids) => saveSettings({ platforms: ids }),
      onError: reportError,
    });
    $("btn-reset-stats").addEventListener("click", () => {
      if (!confirm("Reset all Shorts stats to zero?")) return;
      chrome.storage.local.set({ [KEYS.stats]: { ...EMPTY_STATS } }).catch(reportError);
    });
  }

  /*
   * Unpacked extensions read popup files from disk every time, but Chrome only re-reads the
   * manifest and the YouTube content scripts when the extension is reloaded. If the files were
   * updated without a reload, the popup looks new while YouTube still runs old code. Detect that
   * by comparing the running version with manifest.json on disk, and offer a one-click reload.
   */
  async function checkForStaleInstall() {
    const running = chrome.runtime.getManifest().version;
    const response = await fetch(chrome.runtime.getURL("manifest.json"), { cache: "no-store" });
    if (!response.ok) return;
    const onDisk = (await response.json()).version;
    if (!onDisk || onDisk === running) return;
    $("update-running").textContent = `v${running} (files are v${onDisk})`;
    $("update-banner").hidden = false;
    $("update-reload").addEventListener("click", () => chrome.runtime.reload());
  }

  /* ---------- boot ---------- */
  function onStorageChanged(changes, area) {
    if (area !== "local") return;
    if (changes[KEYS.pomodoro]?.newValue) pomodoro = changes[KEYS.pomodoro].newValue;
    if (changes[KEYS.settings]) {
      settings = sanitizeSettings(changes[KEYS.settings].newValue);
      renderSettings();
      renderProgress();
    }
    if (changes[KEYS.stats]) renderStats(changes[KEYS.stats].newValue);
    if (changes[KEYS.daily] || changes[KEYS.totals]) {
      if (changes[KEYS.daily]) daily = changes[KEYS.daily].newValue || {};
      if (changes[KEYS.totals]) totals = changes[KEYS.totals].newValue || null;
      renderProgress();
    }
    if (changes[KEYS.guardStatus]) {
      guardStatus = changes[KEYS.guardStatus].newValue;
      renderGuardStatus();
    }
    renderTimer();
  }

  async function init() {
    $("version").textContent = `v${chrome.runtime.getManifest().version}`;
    checkForStaleInstall().catch((error) => console.warn("[Focus Guard] update check failed", error));
    setupTabs();
    setupFocus();
    setupTasks();
    setupGuard();

    const keys = [KEYS.settings, KEYS.pomodoro, KEYS.tasks, KEYS.stats, KEYS.guardStatus, KEYS.daily, KEYS.totals, KEYS.focusTaskId];
    const data = await chrome.storage.local.get(keys);
    totals = data[KEYS.totals] || null;
    guardStatus = data[KEYS.guardStatus];
    settings = sanitizeSettings(data[KEYS.settings]);
    pomodoro = data[KEYS.pomodoro] || P.createState(settings);
    tasks = Array.isArray(data[KEYS.tasks]) ? data[KEYS.tasks] : [];
    daily = data[KEYS.daily] || {};
    focusTaskId = data[KEYS.focusTaskId] || null;
    renderSettings();
    tasksView.render();
    renderFocusOn();
    renderTimer();
    renderProgress();
    renderStats(data[KEYS.stats]);

    chrome.storage.onChanged.addListener(onStorageChanged);
    setInterval(renderGuardStatus, 5000);
  }

  init().catch(reportError);
})();

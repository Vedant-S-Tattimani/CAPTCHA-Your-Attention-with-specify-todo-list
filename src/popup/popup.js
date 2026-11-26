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
  const TAG_LABELS = { work: "Work", study: "Study", personal: "Personal", health: "Health", other: "Other" };
  const $ = (id) => document.getElementById(id);

  let settings = sanitizeSettings(null);
  let pomodoro = P.createState(settings);
  let tasks = [];
  let daily = {};
  let focusTaskId = null;
  let guardStatus;
  let filter = { query: "", tag: "all" };
  let lastCompletedWork = null;

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
    renderTasks();
    await chrome.storage.local.set({ [KEYS.tasks]: tasks });
  }

  async function setFocusTask(id) {
    focusTaskId = id;
    renderTasks();
    renderFocusOn();
    await chrome.storage.local.set({ [KEYS.focusTaskId]: id });
  }

  async function recordToday(delta) {
    const data = await chrome.storage.local.get(KEYS.daily);
    daily = G.recordActivity(data[KEYS.daily], todayKey(), delta);
    await chrome.storage.local.set({ [KEYS.daily]: daily });
    renderProgress();
  }

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
    const level = G.levelFor(G.xpFor(G.totals(daily)));

    $("chip-streak").textContent = `${streakDays > 0 ? "🔥" : "🌑"} ${streakDays}`;
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
    renderInsightsInto($("panel-insights"), { log: daily, goal, today });
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

  /* ---------- Tasks tab ---------- */
  function onToggleTask(task, checkbox) {
    const becomingDone = !task.done;
    saveTasks(T.toggleTask(tasks, task.id))
      .then(() => recordToday({ tasksDone: becomingDone ? 1 : -1 }))
      .catch(reportError);
    if (becomingDone) celebrate(checkbox);
  }

  function taskItem(task, today) {
    const checkbox = el("input", { type: "checkbox", checked: task.done });
    checkbox.setAttribute("aria-label", `Mark "${task.title}" ${task.done ? "not done" : "done"}`);
    checkbox.addEventListener("change", () => onToggleTask(task, checkbox));

    const info = el("div", { className: "task-info" }, [
      el("span", { className: `pill ${task.priority}`, textContent: task.priority }),
      el("span", { textContent: TAG_LABELS[task.tag] || "Other" }),
    ]);
    if (task.deadline) {
      const overdue = T.isOverdue(task, today);
      info.append(el("span", { className: overdue ? "overdue" : "", textContent: overdue ? `Overdue ${task.deadline}` : `Due ${task.deadline}` }));
    }

    const pinned = task.id === focusTaskId && !task.done;
    const focusBtn = el("button", { className: `icon-btn focus-btn${pinned ? " on" : ""}`, textContent: "🎯" });
    focusBtn.title = pinned ? "Stop focusing on this" : "Focus on this";
    focusBtn.setAttribute("aria-pressed", String(pinned));
    focusBtn.setAttribute("aria-label", `${pinned ? "Stop focusing on" : "Focus on"} "${task.title}"`);
    focusBtn.disabled = task.done;
    focusBtn.addEventListener("click", () => setFocusTask(pinned ? null : task.id).catch(reportError));

    const del = el("button", { className: "icon-btn delete", textContent: "×", title: "Delete task" });
    del.setAttribute("aria-label", `Delete "${task.title}"`);
    del.addEventListener("click", () => saveTasks(T.removeTask(tasks, task.id)).catch(reportError));

    const li = el("li", { className: `task${task.done ? " done" : ""}${pinned ? " pinned" : ""}` }, [
      checkbox,
      el("div", {}, [el("div", { className: "task-title", textContent: task.title }), info]),
      el("div", { className: "task-actions" }, [focusBtn, del]),
    ]);
    li.dataset.tag = task.tag;
    return li;
  }

  function renderTasks() {
    const today = todayKey();
    const visible = T.sortTasks(T.filterTasks(tasks, filter));
    $("task-list").replaceChildren(...visible.map((t) => taskItem(t, today)));
    $("task-empty").hidden = visible.length > 0;
    $("task-empty").textContent = tasks.length ? "No tasks match." : "No tasks yet. Add one above.";
    $("btn-clear-done").hidden = !tasks.some((t) => t.done);
    renderFocusOn();
  }

  function setupTasks() {
    const tagOptions = T.TAGS.map((tag) => el("option", { value: tag, textContent: TAG_LABELS[tag] }));
    $("task-tag").replaceChildren(...tagOptions);
    $("task-filter").replaceChildren(
      el("option", { value: "all", textContent: "All tags" }),
      ...T.TAGS.map((tag) => el("option", { value: tag, textContent: TAG_LABELS[tag] }))
    );

    $("task-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const result = T.addTask(tasks, {
        title: $("task-title").value,
        tag: $("task-tag").value,
        priority: $("task-priority").value,
        deadline: $("task-deadline").value,
      });
      $("task-error").textContent = result.ok ? "" : result.error;
      if (!result.ok) return;
      $("task-title").value = "";
      $("task-deadline").value = "";
      saveTasks(result.tasks).catch(reportError);
      $("task-title").focus();
    });
    $("task-search").addEventListener("input", (e) => {
      filter = { ...filter, query: e.target.value };
      renderTasks();
    });
    $("task-filter").addEventListener("change", (e) => {
      filter = { ...filter, tag: e.target.value };
      renderTasks();
    });
    $("btn-clear-done").addEventListener("click", () => saveTasks(T.clearDone(tasks)).catch(reportError));
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
    $("btn-reset-stats").addEventListener("click", () => {
      if (!confirm("Reset all Shorts stats to zero?")) return;
      chrome.storage.local.set({ [KEYS.stats]: { ...EMPTY_STATS } }).catch(reportError);
    });
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
    if (changes[KEYS.daily]) {
      daily = changes[KEYS.daily].newValue || {};
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
    setupTabs();
    setupFocus();
    setupTasks();
    setupGuard();

    const keys = [KEYS.settings, KEYS.pomodoro, KEYS.tasks, KEYS.stats, KEYS.guardStatus, KEYS.daily, KEYS.focusTaskId];
    const data = await chrome.storage.local.get(keys);
    guardStatus = data[KEYS.guardStatus];
    settings = sanitizeSettings(data[KEYS.settings]);
    pomodoro = data[KEYS.pomodoro] || P.createState(settings);
    tasks = Array.isArray(data[KEYS.tasks]) ? data[KEYS.tasks] : [];
    daily = data[KEYS.daily] || {};
    focusTaskId = data[KEYS.focusTaskId] || null;
    renderSettings();
    renderTasks();
    renderTimer();
    renderProgress();
    renderStats(data[KEYS.stats]);

    chrome.storage.onChanged.addListener(onStorageChanged);
    setInterval(renderGuardStatus, 5000);
  }

  init().catch(reportError);
})();

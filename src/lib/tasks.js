/**
 * Task list logic: title, priority, tag (colour category, like sticky notes) and deadline.
 * Stored locally in chrome.storage, so no account is needed.
 * All functions are pure and return new arrays.
 */
(function (root) {
  "use strict";

  const PRIORITIES = Object.freeze(["high", "medium", "low"]);
  const TAGS = Object.freeze(["work", "study", "personal", "health", "other"]);
  const MAX_TITLE_LENGTH = 120;
  const MAX_TASKS = 200;
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function makeId(now, random) {
    return `${now.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`;
  }

  /** @returns {{ ok: true, task: object } | { ok: false, error: string }} */
  function validateTaskInput(input) {
    const title = String(input?.title ?? "").trim();
    if (!title) return { ok: false, error: "Give the task a title." };
    if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` };
    const priority = PRIORITIES.includes(input?.priority) ? input.priority : "medium";
    const tag = TAGS.includes(input?.tag) ? input.tag : "other";
    const deadline = String(input?.deadline ?? "").trim();
    if (deadline && !DATE_PATTERN.test(deadline)) return { ok: false, error: "Deadline must be a date." };
    return { ok: true, task: { title, priority, tag, deadline } };
  }

  function addTask(tasks, input, now = Date.now(), random = Math.random) {
    if (tasks.length >= MAX_TASKS) return { ok: false, error: `You can keep up to ${MAX_TASKS} tasks.`, tasks };
    const result = validateTaskInput(input);
    if (!result.ok) return { ...result, tasks };
    const task = { id: makeId(now, random), ...result.task, done: false, createdAt: now };
    return { ok: true, tasks: [...tasks, task] };
  }

  /** Edits title, tag, priority and deadline with the same validation as adding. */
  function updateTask(tasks, id, input) {
    if (!tasks.some((t) => t.id === id)) return { ok: false, error: "That task no longer exists.", tasks };
    const result = validateTaskInput(input);
    if (!result.ok) return { ...result, tasks };
    return { ok: true, tasks: tasks.map((t) => (t.id === id ? { ...t, ...result.task } : t)) };
  }

  function toggleTask(tasks, id) {
    return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTask(tasks, id) {
    return tasks.filter((t) => t.id !== id);
  }

  function clearDone(tasks) {
    return tasks.filter((t) => !t.done);
  }

  const NO_DEADLINE = "9999-12-31";
  const byPriority = (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const byDeadline = (a, b) => {
    const da = a.deadline || NO_DEADLINE;
    const db = b.deadline || NO_DEADLINE;
    return da === db ? 0 : da < db ? -1 : 1;
  };
  const byOldest = (a, b) => a.createdAt - b.createdAt;
  const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });

  /** Sort orders offered in the Tasks tab. Open tasks always come before finished ones. */
  const SORT_MODES = Object.freeze({
    smart: { label: "Smart", compare: [byPriority, byDeadline, byOldest] },
    deadline: { label: "Deadline", compare: [byDeadline, byPriority, byOldest] },
    priority: { label: "Priority", compare: [byPriority, byOldest] },
    newest: { label: "Newest", compare: [(a, b) => b.createdAt - a.createdAt] },
    az: { label: "A–Z", compare: [byTitle, byOldest] },
  });

  /** Sorts by the chosen mode (default "smart": priority, then nearest deadline, then oldest). */
  function sortTasks(tasks, mode = "smart") {
    const compare = (SORT_MODES[mode] || SORT_MODES.smart).compare;
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      for (const fn of compare) {
        const result = fn(a, b);
        if (result !== 0) return result;
      }
      return 0;
    });
  }

  function filterTasks(tasks, { query = "", tag = "all" } = {}) {
    const q = String(query).trim().toLowerCase();
    return tasks.filter((t) => (tag === "all" || t.tag === tag) && (!q || t.title.toLowerCase().includes(q)));
  }

  /** The task to show as a reminder on the Shorts guard. */
  function topTask(tasks) {
    return sortTasks(tasks).find((t) => !t.done) || null;
  }

  /** The task the user pinned with "Focus on this", if still open; otherwise the top task. */
  function focusTask(tasks, focusId) {
    const pinned = focusId ? tasks.find((t) => t.id === focusId && !t.done) : null;
    return pinned || topTask(tasks);
  }

  function isOverdue(task, todayIso) {
    return Boolean(task.deadline && !task.done && task.deadline < todayIso);
  }

  const api = {
    PRIORITIES,
    TAGS,
    MAX_TITLE_LENGTH,
    SORT_MODES,
    validateTaskInput,
    addTask,
    updateTask,
    toggleTask,
    removeTask,
    clearDone,
    sortTasks,
    filterTasks,
    topTask,
    focusTask,
    isOverdue,
  };
  root.FocusTasks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

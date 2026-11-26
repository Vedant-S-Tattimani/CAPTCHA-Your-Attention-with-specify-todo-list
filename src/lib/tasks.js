/**
 * Task list logic, ported from Specify's Task model (MIT, Yevheniia Simaka):
 * title, priority, tag (colour category, like sticky notes) and deadline.
 * Stored locally in chrome.storage instead of MongoDB, so no account is needed.
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

  function toggleTask(tasks, id) {
    return tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTask(tasks, id) {
    return tasks.filter((t) => t.id !== id);
  }

  function clearDone(tasks) {
    return tasks.filter((t) => !t.done);
  }

  /** Open tasks first, then by priority, then by nearest deadline, then oldest. */
  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      const da = a.deadline || "9999-12-31";
      const db = b.deadline || "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return a.createdAt - b.createdAt;
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

  function isOverdue(task, todayIso) {
    return Boolean(task.deadline && !task.done && task.deadline < todayIso);
  }

  const api = {
    PRIORITIES,
    TAGS,
    MAX_TITLE_LENGTH,
    validateTaskInput,
    addTask,
    toggleTask,
    removeTask,
    clearDone,
    sortTasks,
    filterTasks,
    topTask,
    isOverdue,
  };
  root.FocusTasks = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

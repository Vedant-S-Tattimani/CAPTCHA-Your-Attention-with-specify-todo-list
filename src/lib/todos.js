/**
 * Simple todos, like Specify's quick todo list: just a line of text you can tick off or delete,
 * without the tag/priority/deadline of a full task. Pure functions returning new arrays.
 */
(function (root) {
  "use strict";

  const MAX_TEXT_LENGTH = 120;
  const MAX_TODOS = 100;

  function makeId(now, random) {
    return `t${now.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`;
  }

  /** @returns {{ ok: boolean, todos: object[], error?: string }} */
  function addTodo(todos, text, now = Date.now(), random = Math.random) {
    const clean = String(text ?? "").trim().replace(/\s+/g, " ");
    if (!clean) return { ok: false, error: "Type something first.", todos };
    if (clean.length > MAX_TEXT_LENGTH) return { ok: false, error: `Keep it under ${MAX_TEXT_LENGTH} characters.`, todos };
    if (todos.length >= MAX_TODOS) return { ok: false, error: `You can keep up to ${MAX_TODOS} todos.`, todos };
    return { ok: true, todos: [...todos, { id: makeId(now, random), text: clean, done: false, createdAt: now }] };
  }

  function toggleTodo(todos, id) {
    return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTodo(todos, id) {
    return todos.filter((t) => t.id !== id);
  }

  function clearDoneTodos(todos) {
    return todos.filter((t) => !t.done);
  }

  /** Drops anything malformed (stored data is never trusted). */
  function sanitizeTodos(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((t) => t && typeof t.id === "string" && typeof t.text === "string" && t.text.trim())
      .slice(0, MAX_TODOS)
      .map((t) => ({
        id: t.id,
        text: t.text.slice(0, MAX_TEXT_LENGTH),
        done: Boolean(t.done),
        createdAt: Number(t.createdAt) || 0,
      }));
  }

  const api = { MAX_TEXT_LENGTH, MAX_TODOS, addTodo, toggleTodo, removeTodo, clearDoneTodos, sanitizeTodos };
  root.FocusTodos = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

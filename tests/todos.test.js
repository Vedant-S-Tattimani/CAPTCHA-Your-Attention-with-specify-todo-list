const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/lib/todos.js");

const rng = () => 0.5;

test("addTodo trims text and appends an open todo", () => {
  const res = D.addTodo([], "  buy   milk  ", 1, rng);
  assert.equal(res.ok, true);
  assert.equal(res.todos[0].text, "buy milk");
  assert.equal(res.todos[0].done, false);
});

test("addTodo rejects empty, too long, or too many without changing the list", () => {
  const start = D.addTodo([], "a", 1, rng).todos;
  for (const bad of ["", "   ", "x".repeat(121)]) {
    const res = D.addTodo(start, bad, 2, rng);
    assert.equal(res.ok, false);
    assert.equal(res.todos, start);
  }
  const full = Array.from({ length: D.MAX_TODOS }, (_, i) => ({ id: `t${i}`, text: "x", done: false, createdAt: i }));
  assert.equal(D.addTodo(full, "one more", 1, rng).ok, false);
});

test("toggle, remove and clear done return new arrays", () => {
  let todos = D.addTodo([], "a", 1, () => 0.1).todos;
  todos = D.addTodo(todos, "b", 2, () => 0.2).todos;
  const toggled = D.toggleTodo(todos, todos[0].id);
  assert.equal(toggled[0].done, true);
  assert.equal(todos[0].done, false);
  assert.deepEqual(D.removeTodo(toggled, todos[1].id).map((t) => t.text), ["a"]);
  assert.deepEqual(D.clearDoneTodos(toggled).map((t) => t.text), ["b"]);
});

test("sanitizeTodos drops malformed entries", () => {
  const clean = D.sanitizeTodos([{ id: "1", text: "ok", done: 1 }, { id: 2, text: "bad id" }, null, { id: "3", text: "   " }]);
  assert.deepEqual(clean, [{ id: "1", text: "ok", done: true, createdAt: 0 }]);
  assert.deepEqual(D.sanitizeTodos("nope"), []);
});

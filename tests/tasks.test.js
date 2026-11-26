const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../src/lib/tasks.js");

const rng = () => 0.5;

function build(inputs) {
  return inputs.reduce((tasks, input, i) => T.addTask(tasks, input, 1000 + i, rng).tasks, []);
}

test("addTask validates and fills defaults", () => {
  const res = T.addTask([], { title: "  Write essay  " }, 1, rng);
  assert.equal(res.ok, true);
  const [task] = res.tasks;
  assert.equal(task.title, "Write essay");
  assert.equal(task.priority, "medium");
  assert.equal(task.tag, "other");
  assert.equal(task.deadline, "");
  assert.equal(task.done, false);
});

test("addTask rejects bad input without changing the list", () => {
  const start = build([{ title: "a" }]);
  for (const bad of [{ title: "" }, { title: "   " }, { title: "x".repeat(121) }, { title: "ok", deadline: "tomorrow" }]) {
    const res = T.addTask(start, bad, 5, rng);
    assert.equal(res.ok, false);
    assert.equal(typeof res.error, "string");
    assert.equal(res.tasks, start);
  }
});

test("addTask ignores unknown priority and tag values", () => {
  const [task] = T.addTask([], { title: "t", priority: "urgent!!", tag: "<script>" }, 1, rng).tasks;
  assert.equal(task.priority, "medium");
  assert.equal(task.tag, "other");
});

test("toggleTask, removeTask and clearDone return new arrays", () => {
  const tasks = build([{ title: "a" }, { title: "b" }]);
  const toggled = T.toggleTask(tasks, tasks[0].id);
  assert.equal(toggled[0].done, true);
  assert.equal(tasks[0].done, false);
  assert.equal(T.removeTask(toggled, tasks[1].id).length, 1);
  assert.deepEqual(T.clearDone(toggled).map((t) => t.title), ["b"]);
});

test("sortTasks orders open tasks by priority then deadline", () => {
  const tasks = build([
    { title: "low", priority: "low" },
    { title: "high-late", priority: "high", deadline: "2030-01-01" },
    { title: "high-soon", priority: "high", deadline: "2026-12-01" },
    { title: "med", priority: "medium" },
  ]);
  const withDone = T.toggleTask(tasks, tasks[2].id);
  assert.deepEqual(T.sortTasks(withDone).map((t) => t.title), ["high-late", "med", "low", "high-soon"]);
});

test("updateTask edits fields with validation and leaves other tasks alone", () => {
  const tasks = build([{ title: "old", tag: "work" }, { title: "other" }]);
  const res = T.updateTask(tasks, tasks[0].id, { title: " new title ", tag: "study", priority: "high", deadline: "2026-12-01" });
  assert.equal(res.ok, true);
  assert.deepEqual(
    { title: res.tasks[0].title, tag: res.tasks[0].tag, priority: res.tasks[0].priority, deadline: res.tasks[0].deadline },
    { title: "new title", tag: "study", priority: "high", deadline: "2026-12-01" }
  );
  assert.equal(res.tasks[0].id, tasks[0].id, "keeps id");
  assert.equal(res.tasks[0].createdAt, tasks[0].createdAt, "keeps creation time");
  assert.equal(res.tasks[1], tasks[1]);
  assert.equal(tasks[0].title, "old", "not mutated");
  const bad = T.updateTask(tasks, tasks[0].id, { title: "" });
  assert.equal(bad.ok, false);
  assert.equal(bad.tasks, tasks);
  assert.equal(T.updateTask(tasks, "missing", { title: "x" }).ok, false);
});

test("sortTasks supports every sort mode, always open before done", () => {
  const tasks = build([
    { title: "banana", priority: "low", deadline: "2026-12-10" },
    { title: "Apple", priority: "high" },
    { title: "cherry", priority: "medium", deadline: "2026-12-01" },
    { title: "date", priority: "high", deadline: "2026-12-20" },
  ]);
  const titles = (mode) => T.sortTasks(tasks, mode).map((t) => t.title);
  assert.deepEqual(titles("smart"), ["date", "Apple", "cherry", "banana"]);
  assert.deepEqual(titles("deadline"), ["cherry", "banana", "date", "Apple"]);
  assert.deepEqual(titles("priority"), ["Apple", "date", "cherry", "banana"]);
  assert.deepEqual(titles("newest"), ["date", "cherry", "Apple", "banana"]);
  assert.deepEqual(titles("az"), ["Apple", "banana", "cherry", "date"]);
  assert.deepEqual(titles("bogus"), titles("smart"));
  const withDone = T.toggleTask(tasks, tasks[1].id);
  assert.equal(T.sortTasks(withDone, "az").at(-1).title, "Apple", "done goes last in every mode");
});

test("every settings sort option has a sort mode", () => {
  const S = require("../src/lib/settings.js");
  assert.deepEqual([...S.TASK_SORTS].sort(), Object.keys(T.SORT_MODES).sort());
  assert.equal(S.sanitizeSettings({ taskSort: "nope", taskView: "cards" }).taskSort, "smart");
  assert.equal(S.sanitizeSettings({ taskView: "grid" }).taskView, "grid");
});

test("filterTasks matches tag and case-insensitive search", () => {
  const tasks = build([
    { title: "Math homework", tag: "study" },
    { title: "Gym", tag: "health" },
    { title: "math quiz", tag: "study" },
  ]);
  assert.equal(T.filterTasks(tasks, { tag: "study" }).length, 2);
  assert.equal(T.filterTasks(tasks, { query: "MATH" }).length, 2);
  assert.equal(T.filterTasks(tasks, { query: "gym", tag: "study" }).length, 0);
  assert.equal(T.filterTasks(tasks).length, 3);
});

test("topTask returns the most important open task or null", () => {
  const tasks = build([{ title: "a", priority: "low" }, { title: "b", priority: "high" }]);
  assert.equal(T.topTask(tasks).title, "b");
  assert.equal(T.topTask(T.toggleTask(T.toggleTask(tasks, tasks[0].id), tasks[1].id)), null);
});

test("focusTask prefers the pinned open task, else falls back to topTask", () => {
  const tasks = build([{ title: "a", priority: "low" }, { title: "b", priority: "high" }]);
  assert.equal(T.focusTask(tasks, tasks[0].id).title, "a");
  assert.equal(T.focusTask(tasks, null).title, "b");
  assert.equal(T.focusTask(tasks, "missing").title, "b");
  assert.equal(T.focusTask(T.toggleTask(tasks, tasks[0].id), tasks[0].id).title, "b", "done pinned task is skipped");
});

test("isOverdue only flags open tasks past their deadline", () => {
  const [task] = build([{ title: "a", deadline: "2026-01-01" }]);
  assert.equal(T.isOverdue(task, "2026-01-02"), true);
  assert.equal(T.isOverdue(task, "2026-01-01"), false);
  assert.equal(T.isOverdue({ ...task, done: true }, "2027-01-01"), false);
});

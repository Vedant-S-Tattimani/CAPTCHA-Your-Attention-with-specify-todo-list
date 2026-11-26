const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../src/lib/pomodoro.js");

const SETTINGS = { workMinutes: 25, breakMinutes: 5 };
const MIN = 60 * 1000;

test("createState starts paused in work mode with a full work period", () => {
  const s = P.createState(SETTINGS);
  assert.deepEqual(s, { mode: "work", running: false, endsAt: null, remainingMs: 25 * MIN, completedWork: 0 });
});

test("start, pause and resume keep the remaining time", () => {
  const s0 = P.createState(SETTINGS);
  const s1 = P.start(s0, 1000);
  assert.equal(s1.running, true);
  assert.equal(s1.endsAt, 1000 + 25 * MIN);
  assert.equal(P.remaining(s1, 1000 + 10 * MIN), 15 * MIN);

  const s2 = P.pause(s1, 1000 + 10 * MIN);
  assert.equal(s2.running, false);
  assert.equal(s2.remainingMs, 15 * MIN);
  assert.equal(P.remaining(s2, 999999999), 15 * MIN);

  const s3 = P.start(s2, 5000);
  assert.equal(s3.endsAt, 5000 + 15 * MIN);
  assert.equal(s0.running, false, "original state not mutated");
});

test("start and pause are no-ops when already in that state", () => {
  const running = P.start(P.createState(SETTINGS), 0);
  assert.equal(P.start(running, 50), running);
  const paused = P.createState(SETTINGS);
  assert.equal(P.pause(paused, 50), paused);
});

test("remaining never goes negative", () => {
  const s = P.start(P.createState(SETTINGS), 0);
  assert.equal(P.remaining(s, 26 * MIN), 0);
});

test("advance alternates work and break and counts finished work sessions", () => {
  const work = P.start(P.createState(SETTINGS), 0);
  const brk = P.advance(work, SETTINGS, 100);
  assert.equal(brk.mode, "break");
  assert.equal(brk.running, true);
  assert.equal(brk.endsAt, 100 + 5 * MIN);
  assert.equal(brk.completedWork, 1);

  const work2 = P.advance(brk, SETTINGS, 200);
  assert.equal(work2.mode, "work");
  assert.equal(work2.completedWork, 1);
});

test("reset restores the full length of the current mode", () => {
  const brk = P.advance(P.createState(SETTINGS), SETTINGS, 0);
  const r = P.reset(brk, SETTINGS);
  assert.equal(r.mode, "break");
  assert.equal(r.running, false);
  assert.equal(r.remainingMs, 5 * MIN);
});

test("isFocusing is true only for a running work phase", () => {
  const s = P.createState(SETTINGS);
  assert.equal(P.isFocusing(s), false);
  assert.equal(P.isFocusing(P.start(s, 0)), true);
  assert.equal(P.isFocusing(P.advance(s, SETTINGS, 0)), false);
  assert.equal(P.isFocusing(null), false);
});

test("sanitizeSettings clamps and falls back to defaults", () => {
  assert.deepEqual(P.sanitizeSettings({ workMinutes: "0", breakMinutes: 999 }), { workMinutes: 1, breakMinutes: 180 });
  assert.deepEqual(P.sanitizeSettings({ workMinutes: "abc" }), { workMinutes: 25, breakMinutes: 5 });
  assert.deepEqual(P.sanitizeSettings(undefined), { workMinutes: 25, breakMinutes: 5 });
});

test("formatClock renders mm:ss rounding partial seconds up", () => {
  assert.equal(P.formatClock(25 * MIN), "25:00");
  assert.equal(P.formatClock(61 * 1000), "01:01");
  assert.equal(P.formatClock(500), "00:01");
  assert.equal(P.formatClock(-5), "00:00");
});

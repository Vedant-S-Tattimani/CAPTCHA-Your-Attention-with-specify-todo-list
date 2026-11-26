const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/settings.js");

test("sanitizeSettings fills defaults and clamps ranges", () => {
  assert.deepEqual(S.sanitizeSettings(null), { ...S.DEFAULTS });
  const s = S.sanitizeSettings({ puzzleEvery: 0, difficultyStep: "7", guardEnabled: "yes", workMinutes: 500 });
  assert.equal(s.puzzleEvery, 1);
  assert.equal(s.difficultyStep, 7);
  assert.equal(s.guardEnabled, true);
  assert.equal(s.workMinutes, 180);
});

test("dailyGoal defaults to 4 and is clamped", () => {
  assert.equal(S.sanitizeSettings(null).dailyGoal, 4);
  assert.equal(S.sanitizeSettings({ dailyGoal: 0 }).dailyGoal, 1);
  assert.equal(S.sanitizeSettings({ dailyGoal: 99 }).dailyGoal, 16);
});

test("addStats adds without mutating and rejects garbage", () => {
  const base = { shortsWatched: 2, secondsOnShorts: 10, puzzlesSolved: 1 };
  const next = S.addStats(base, { shortsWatched: 1, puzzlesSolved: 2 });
  assert.deepEqual(next, { shortsWatched: 3, secondsOnShorts: 10, puzzlesSolved: 3 });
  assert.equal(base.shortsWatched, 2);
  assert.deepEqual(S.addStats(undefined, {}), { ...S.EMPTY_STATS });
  assert.deepEqual(S.sanitizeStats({ shortsWatched: -5 }), { ...S.EMPTY_STATS });
});

test("first puzzle comes on the third short by default", () => {
  const s = S.sanitizeSettings(null);
  assert.equal(S.shouldShowPuzzle(2, s, false), false);
  assert.equal(S.shouldShowPuzzle(3, s, false), true);
});

test("shortsUntilPuzzle counts down and never goes negative", () => {
  const s = S.sanitizeSettings({ puzzleEvery: 4 });
  assert.equal(S.shortsUntilPuzzle(1, s, false), 3);
  assert.equal(S.shortsUntilPuzzle(9, s, false), 0);
  assert.equal(S.shortsUntilPuzzle(0, s, true), 1);
});

test("guardStatusText explains each state", () => {
  const s = S.sanitizeSettings({ puzzleEvery: 3 });
  const now = 1_000_000;
  assert.match(S.guardStatusText(undefined, s, now), /Not seen on YouTube Shorts yet/);
  assert.match(S.guardStatusText(undefined, { ...s, guardEnabled: false }, now), /off/);
  assert.match(S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 1, focusing: false }, s, now), /Puzzle in 2 more shorts/);
  assert.match(S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 2, focusing: false }, s, now), /Puzzle in 1 more short\./);
  assert.match(S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 3, focusing: false }, s, now), /puzzle is due/);
  assert.match(S.guardStatusText({ seenAt: now - 10 * 60 * 1000, shortsSinceLast: 1 }, s, now), /Ready/);
});

test("shouldShowPuzzle respects interval, focus mode and the off switch", () => {
  const s = S.sanitizeSettings({ puzzleEvery: 5 });
  assert.equal(S.shouldShowPuzzle(4, s, false), false);
  assert.equal(S.shouldShowPuzzle(5, s, false), true);
  assert.equal(S.shouldShowPuzzle(1, s, true), true, "strict during focus");
  assert.equal(S.shouldShowPuzzle(1, { ...s, strictDuringFocus: false }, true), false);
  assert.equal(S.shouldShowPuzzle(99, { ...s, guardEnabled: false }, true), false);
});

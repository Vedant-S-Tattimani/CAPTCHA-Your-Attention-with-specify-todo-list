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

test("puzzleKinds keeps known kinds in display order and is never empty", () => {
  assert.deepEqual(S.sanitizeSettings(null).puzzleKinds, [...S.PUZZLE_KINDS]);
  assert.deepEqual(S.sanitizeKinds(["phrase", "math", "math", "nope"]), ["math", "phrase"]);
  assert.deepEqual(S.sanitizeKinds([]), [...S.PUZZLE_KINDS]);
  assert.deepEqual(S.sanitizeKinds("math"), [...S.PUZZLE_KINDS]);
});

test("dailyGoal defaults to 4 and is clamped", () => {
  assert.equal(S.sanitizeSettings(null).dailyGoal, 4);
  assert.equal(S.sanitizeSettings({ dailyGoal: 0 }).dailyGoal, 1);
  assert.equal(S.sanitizeSettings({ dailyGoal: 99 }).dailyGoal, 16);
});

test("addStats adds without mutating and rejects garbage", () => {
  const base = { shortsWatched: 2, secondsOnShorts: 10, puzzlesSolved: 1 };
  const next = S.addStats(base, { shortsWatched: 1, puzzlesSolved: 2 });
  assert.deepEqual(next, { shortsWatched: 3, secondsOnShorts: 10, puzzlesSolved: 3, byPlatform: {} });
  assert.equal(base.shortsWatched, 2);
  assert.deepEqual(S.addStats(undefined, {}), { ...S.EMPTY_STATS });
  assert.deepEqual(S.sanitizeStats({ shortsWatched: -5 }), { ...S.EMPTY_STATS });
});

test("addStats counts videos per platform and drops unknown platforms", () => {
  let stats = S.addStats(undefined, { shortsWatched: 1, platform: "youtube" });
  stats = S.addStats(stats, { shortsWatched: 1, platform: "instagram" });
  stats = S.addStats(stats, { shortsWatched: 1, platform: "instagram" });
  stats = S.addStats(stats, { puzzlesSolved: 1, platform: "instagram" });
  assert.equal(stats.shortsWatched, 3);
  assert.deepEqual(stats.byPlatform, { youtube: 1, instagram: 2 });
  assert.deepEqual(S.sanitizeStats({ byPlatform: { myspace: 4, tiktok: -1, snapchat: "2" } }).byPlatform, { snapchat: 2 });
});

test("platforms setting always includes YouTube", () => {
  assert.deepEqual(S.sanitizeSettings(null).platforms, ["youtube"]);
  assert.deepEqual(S.sanitizeSettings({ platforms: ["tiktok", "x"] }).platforms, ["youtube", "tiktok"]);
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
  assert.match(S.guardStatusText(undefined, s, now), /Not seen on a short-video feed yet/);
  assert.match(S.guardStatusText(undefined, { ...s, guardEnabled: false }, now), /off/);
  assert.match(
    S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 1, focusing: false }, s, now),
    /Watching YouTube Shorts now\. Puzzle in 2 more videos/
  );
  assert.match(
    S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 2, platform: "instagram" }, s, now),
    /Watching Instagram Reels now\. Puzzle in 1 more video\./
  );
  assert.match(S.guardStatusText({ seenAt: now - 5000, shortsSinceLast: 3, platform: "tiktok" }, s, now), /TikTok now\. A puzzle is due/);
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

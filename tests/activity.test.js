const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../src/lib/activity.js");
const G = require("../src/lib/progress.js");

const DAY = "2026-11-26";

test("a watched video updates stats, today's log and per-platform counts", () => {
  const next = A.applyActivity({}, { shortsWatched: 1, platform: "instagram" }, DAY);
  assert.equal(next.stats.shortsWatched, 1);
  assert.deepEqual(next.stats.byPlatform, { instagram: 1 });
  assert.equal(next.daily[DAY].shorts, 1);
  assert.deepEqual(next.totals, { sessions: 0, focusMinutes: 0, puzzles: 0, tasksDone: 0 });
});

test("a finished focus session feeds the garden, streak, chart and XP", () => {
  const next = A.applyActivity({}, { sessions: 1, focusMinutes: 25 }, DAY);
  assert.equal(next.daily[DAY].sessions, 1);
  assert.equal(next.daily[DAY].focusMinutes, 25);
  assert.equal(next.totals.sessions, 1);
  assert.equal(G.streak(next.daily, DAY), 1);
  assert.equal(G.xpFor(next.totals), 10);
});

test("a solved puzzle and a ticked task count in stats, log and totals; unticking takes it back", () => {
  let s = A.applyActivity({}, { puzzlesSolved: 1 }, DAY);
  s = A.applyActivity(s, { tasksDone: 1 }, DAY);
  assert.equal(s.stats.puzzlesSolved, 1);
  assert.equal(s.daily[DAY].puzzles, 1);
  assert.equal(s.totals.puzzles, 1);
  assert.equal(s.totals.tasksDone, 1);
  s = A.applyActivity(s, { tasksDone: -1 }, DAY);
  assert.equal(s.totals.tasksDone, 0);
  assert.equal(s.daily[DAY].tasksDone, 0);
});

test("lifetime totals are kept when old days drop out of the 60-day log (level never drops)", () => {
  let s = A.applyActivity({}, { sessions: 1, focusMinutes: 25 }, "2026-01-01");
  s = A.applyActivity(s, { sessions: 1, focusMinutes: 25 }, "2026-01-02");
  s = A.applyActivity(s, { puzzlesSolved: 1 }, DAY); // months later: January is pruned from the log
  assert.equal(Object.keys(s.daily).includes("2026-01-01"), false, "old day pruned");
  assert.equal(G.totals(s.daily).sessions, 0, "the log alone would lose them");
  assert.equal(s.totals.sessions, 2, "lifetime totals keep them");
  assert.equal(G.xpFor(s.totals), 2 * 10 + 2);
});

test("first run after upgrading starts totals from the existing log", () => {
  const daily = { [DAY]: { sessions: 3, focusMinutes: 75, puzzles: 4, tasksDone: 2 } };
  const s = A.applyActivity({ daily }, { shortsWatched: 1 }, DAY);
  assert.deepEqual(s.totals, { sessions: 3, focusMinutes: 75, puzzles: 4, tasksDone: 2 });
});

test("inputs are not mutated", () => {
  const state = { stats: { shortsWatched: 1 }, daily: { [DAY]: { shorts: 1 } }, totals: { sessions: 1 } };
  const copy = JSON.parse(JSON.stringify(state));
  A.applyActivity(state, { shortsWatched: 1, sessions: 1 }, DAY);
  assert.deepEqual(state, copy);
});

test("bad or oversized events are clamped and unknown platforms ignored", () => {
  const d = A.sanitizeDelta({ shortsWatched: 50, puzzlesSolved: -3, focusMinutes: 9999, tasksDone: 7, platform: "myspace", evil: 1 });
  assert.equal(d.shortsWatched, 1);
  assert.equal(d.puzzlesSolved, 0);
  assert.equal(d.focusMinutes, 180);
  assert.equal(d.tasksDone, 1);
  assert.equal(d.platform, null);
  assert.equal("evil" in d, false);
  assert.deepEqual(A.applyActivity({}, null, DAY).totals, { sessions: 0, focusMinutes: 0, puzzles: 0, tasksDone: 0 });
});

test("the queue runs jobs one at a time, so no update is lost", async () => {
  const enqueue = A.createQueue();
  let store = {};
  const read = async () => {
    await new Promise((r) => setTimeout(r, Math.random() * 5));
    return store;
  };
  const write = async (value) => {
    await new Promise((r) => setTimeout(r, Math.random() * 5));
    store = value;
  };
  const record = (delta) => enqueue(async () => write(A.applyActivity(await read(), delta, DAY)));
  await Promise.all(Array.from({ length: 40 }, () => record({ shortsWatched: 1, platform: "youtube" })));
  assert.equal(store.stats.shortsWatched, 40);
  assert.equal(store.daily[DAY].shorts, 40);
});

test("without the queue, overlapping read-modify-writes lose updates (the old bug)", async () => {
  let store = {};
  const read = async () => {
    await new Promise((r) => setTimeout(r, 1));
    return store;
  };
  const write = async (value) => {
    await new Promise((r) => setTimeout(r, 1));
    store = value;
  };
  await Promise.all(Array.from({ length: 40 }, async () => write(A.applyActivity(await read(), { shortsWatched: 1 }, DAY))));
  assert.ok(store.stats.shortsWatched < 40, `lost updates expected, got ${store.stats.shortsWatched}`);
});

test("a failed job doesn't block later ones", async () => {
  const enqueue = A.createQueue();
  await assert.rejects(enqueue(async () => {
    throw new Error("boom");
  }));
  assert.equal(await enqueue(async () => "next"), "next");
});

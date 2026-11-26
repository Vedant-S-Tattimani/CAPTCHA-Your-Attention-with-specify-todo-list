const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../src/lib/progress.js");

test("dayKey and shiftKey use local calendar dates, across month and year ends", () => {
  assert.equal(G.dayKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(G.shiftKey("2026-03-01", -1), "2026-02-28");
  assert.equal(G.shiftKey("2026-12-31", 1), "2027-01-01");
});

test("recordActivity adds to a day without mutating the log", () => {
  const log = {};
  const a = G.recordActivity(log, "2026-11-26", { sessions: 1, focusMinutes: 25 });
  const b = G.recordActivity(a, "2026-11-26", { shorts: 3, sessions: 1, focusMinutes: 25 });
  assert.deepEqual(b["2026-11-26"], { sessions: 2, focusMinutes: 50, shorts: 3, puzzles: 0, tasksDone: 0 });
  assert.deepEqual(log, {});
  assert.equal(a["2026-11-26"].shorts, 0);
});

test("recordActivity never goes negative and ignores junk", () => {
  const log = G.recordActivity({ "2026-11-26": { tasksDone: 1 } }, "2026-11-26", { tasksDone: -5, shorts: "x" });
  assert.equal(log["2026-11-26"].tasksDone, 0);
  assert.equal(log["2026-11-26"].shorts, 0);
});

test("recordActivity prunes days older than 60 and drops bad keys", () => {
  const log = { "2026-01-01": { sessions: 1 }, "2026-11-01": { sessions: 1 }, junk: { sessions: 9 } };
  const next = G.recordActivity(log, "2026-11-26", { sessions: 1 });
  assert.deepEqual(Object.keys(next).sort(), ["2026-11-01", "2026-11-26"]);
});

test("streak counts consecutive focus days and survives an empty today", () => {
  const log = {
    "2026-11-23": { sessions: 2 },
    "2026-11-24": { sessions: 1 },
    "2026-11-25": { sessions: 3 },
  };
  assert.equal(G.streak(log, "2026-11-25"), 3);
  assert.equal(G.streak(log, "2026-11-26"), 3, "today not done yet: streak kept");
  assert.equal(G.streak(log, "2026-11-27"), 0, "missed a whole day: streak broken");
  assert.equal(G.streak({}, "2026-11-26"), 0);
});

test("lastDays returns n days oldest first with labels", () => {
  const days = G.lastDays({ "2026-11-26": { focusMinutes: 50 } }, "2026-11-26", 7);
  assert.equal(days.length, 7);
  assert.equal(days[0].key, "2026-11-20");
  assert.equal(days[6].key, "2026-11-26");
  assert.equal(days[6].isToday, true);
  assert.equal(days[6].focusMinutes, 50);
  assert.equal(days[6].label, "Thu");
  assert.equal(days[0].focusMinutes, 0);
});

test("xp and levels", () => {
  const total = G.totals({ a: { sessions: 3, puzzles: 5, tasksDone: 2 } });
  assert.equal(G.xpFor(total), 30 + 10 + 10);
  assert.deepEqual(G.levelFor(0), {
    level: 1,
    maxLevel: 7,
    title: "Seedling",
    nextTitle: "Sprout",
    xp: 0,
    levelStartXp: 0,
    nextXp: 50,
    progress: 0,
  });
  const mid = G.levelFor(100);
  assert.equal(mid.level, 2);
  assert.equal(mid.progress, 0.5);
  const max = G.levelFor(99999);
  assert.equal(max.level, G.LEVELS.length);
  assert.equal(max.nextXp, null);
  assert.equal(max.nextTitle, null);
  assert.equal(mid.nextTitle, "Sapling");
  assert.equal(mid.levelStartXp, 50);
  assert.equal(max.progress, 1);
  assert.equal(G.levelFor(-10).level, 1);
});

test("plantStage grows towards the daily goal", () => {
  assert.equal(G.plantStage(0, 4), 0);
  assert.equal(G.plantStage(1, 4), 1);
  assert.equal(G.plantStage(2, 4), 1);
  assert.equal(G.plantStage(3, 4), 2);
  assert.equal(G.plantStage(4, 4), 4);
  assert.equal(G.plantStage(9, 4), 4);
  assert.equal(G.plantStage(1, 0), 4);
});

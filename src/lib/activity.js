/**
 * One pure function that applies an activity event (a video watched, a puzzle solved, a focus
 * session finished, a task ticked) to everything Insights reads:
 *
 *   stats  - all-time Guard stats (videos, time, puzzles, per platform)
 *   daily  - day-by-day log for the garden, streak and weekly charts (last 60 days)
 *   totals - lifetime counters for XP and levels; never trimmed, so your level can't go down
 *
 * The background worker is the only writer and applies events one at a time, so updates from
 * different tabs and the popup can't overwrite each other. Loaded by the worker and by tests.
 */
(function (root) {
  "use strict";

  const load = (name, file) => root[name] || (typeof require === "function" ? require(file) : null);
  const settingsApi = load("FocusSettings", "./settings.js");
  const progress = load("FocusProgress", "./progress.js");
  const platformsApi = load("FocusPlatforms", "./platforms.js");

  const TOTAL_FIELDS = Object.freeze(["sessions", "focusMinutes", "puzzles", "tasksDone"]);

  /* Per-event limits: one event never adds more than this (guards against bad messages). */
  const LIMITS = Object.freeze({
    shortsWatched: [0, 1],
    secondsOnShorts: [0, 120],
    puzzlesSolved: [0, 1],
    sessions: [0, 1],
    focusMinutes: [0, 180],
    tasksDone: [-1, 1],
  });

  function clamp(value, [min, max]) {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : 0;
  }

  /** Keeps only known fields, within limits, and a known platform id. */
  function sanitizeDelta(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const delta = Object.fromEntries(Object.entries(LIMITS).map(([key, range]) => [key, clamp(src[key], range)]));
    delta.platform = platformsApi.PLATFORM_IDS.includes(src.platform) ? src.platform : null;
    return delta;
  }

  function emptyTotals() {
    return { sessions: 0, focusMinutes: 0, puzzles: 0, tasksDone: 0 };
  }

  function sanitizeTotals(raw) {
    const totals = emptyTotals();
    if (!raw || typeof raw !== "object") return totals;
    TOTAL_FIELDS.forEach((f) => {
      const n = Math.trunc(Number(raw[f]));
      totals[f] = Number.isFinite(n) && n > 0 ? n : 0;
    });
    return totals;
  }

  /** First run after upgrading: start lifetime totals from what the daily log already has. */
  function totalsFromDaily(daily) {
    const t = progress.totals(daily || {});
    return sanitizeTotals({ sessions: t.sessions, focusMinutes: t.focusMinutes, puzzles: t.puzzles, tasksDone: t.tasksDone });
  }

  /**
   * @param {{ stats?: object, daily?: object, totals?: object }} state current stored values
   * @param {object} rawDelta event, e.g. { shortsWatched: 1, platform: "youtube" }
   * @param {string} dayKey local date "YYYY-MM-DD"
   * @returns {{ stats: object, daily: object, totals: object }} new values (inputs untouched)
   */
  function applyActivity(state, rawDelta, dayKey) {
    const delta = sanitizeDelta(rawDelta);
    const stats = settingsApi.addStats(state.stats, {
      shortsWatched: delta.shortsWatched,
      secondsOnShorts: delta.secondsOnShorts,
      puzzlesSolved: delta.puzzlesSolved,
      platform: delta.platform,
    });
    const daily = progress.recordActivity(state.daily, dayKey, {
      shorts: delta.shortsWatched,
      puzzles: delta.puzzlesSolved,
      sessions: delta.sessions,
      focusMinutes: delta.focusMinutes,
      tasksDone: delta.tasksDone,
    });
    const base = state.totals ? sanitizeTotals(state.totals) : totalsFromDaily(state.daily);
    const totals = sanitizeTotals({
      sessions: base.sessions + delta.sessions,
      focusMinutes: base.focusMinutes + delta.focusMinutes,
      puzzles: base.puzzles + delta.puzzlesSolved,
      tasksDone: base.tasksDone + delta.tasksDone,
    });
    return { stats, daily, totals };
  }

  /**
   * Runs async jobs strictly one after another (a failed job doesn't block the next).
   * @returns {(job: () => Promise<any>) => Promise<any>}
   */
  function createQueue() {
    let tail = Promise.resolve();
    return (job) => {
      const run = tail.then(job, job);
      tail = run.catch(() => {});
      return run;
    };
  }

  const api = { sanitizeDelta, sanitizeTotals, totalsFromDaily, applyActivity, createQueue, LIMITS };
  root.FocusActivity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

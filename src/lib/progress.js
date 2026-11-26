/**
 * Daily activity log, streaks, levels and the Focus Garden.
 * The log is a plain object keyed by local date ("2026-11-26") and kept to the last 60 days.
 * All functions are pure and return new objects.
 */
(function (root) {
  "use strict";

  const KEEP_DAYS = 60;
  const FIELDS = Object.freeze(["sessions", "focusMinutes", "shorts", "puzzles", "tasksDone"]);
  const XP = Object.freeze({ sessions: 10, puzzles: 2, tasksDone: 5 });
  const LEVELS = Object.freeze([
    { xp: 0, title: "Seedling" },
    { xp: 50, title: "Sprout" },
    { xp: 150, title: "Sapling" },
    { xp: 350, title: "Focused" },
    { xp: 700, title: "Deep Worker" },
    { xp: 1200, title: "Flow Master" },
    { xp: 2000, title: "Zen Guardian" },
  ]);
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /** Local calendar date as YYYY-MM-DD. */
  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function shiftKey(key, days) {
    const d = parseKey(key);
    d.setDate(d.getDate() + days);
    return dayKey(d);
  }

  function emptyDay() {
    return { sessions: 0, focusMinutes: 0, shorts: 0, puzzles: 0, tasksDone: 0 };
  }

  function cleanDay(raw) {
    const day = emptyDay();
    if (!raw || typeof raw !== "object") return day;
    FIELDS.forEach((f) => {
      const n = Math.floor(Number(raw[f]));
      day[f] = Number.isFinite(n) && n > 0 ? n : 0;
    });
    return day;
  }

  function getDay(log, key) {
    return cleanDay(log && log[key]);
  }

  /** Adds `delta` to the given day and drops days older than KEEP_DAYS. */
  function recordActivity(log, key, delta) {
    const current = getDay(log, key);
    const next = { ...current };
    FIELDS.forEach((f) => {
      next[f] = Math.max(0, current[f] + (Number(delta[f]) || 0));
    });
    const oldest = shiftKey(key, -(KEEP_DAYS - 1));
    const kept = Object.fromEntries(
      Object.entries(log || {}).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= oldest && k !== key)
    );
    return { ...kept, [key]: next };
  }

  /**
   * Consecutive days with at least one finished focus session, ending today.
   * If today has none yet, the streak still counts up to yesterday (it isn't lost until tomorrow).
   */
  function streak(log, todayKey) {
    let key = getDay(log, todayKey).sessions > 0 ? todayKey : shiftKey(todayKey, -1);
    let count = 0;
    while (getDay(log, key).sessions > 0 && count < KEEP_DAYS) {
      count += 1;
      key = shiftKey(key, -1);
    }
    return count;
  }

  /** The last `n` days, oldest first, for charts. */
  function lastDays(log, todayKey, n) {
    return Array.from({ length: n }, (_, i) => {
      const key = shiftKey(todayKey, i - (n - 1));
      return { key, label: DAY_NAMES[parseKey(key).getDay()], isToday: key === todayKey, ...getDay(log, key) };
    });
  }

  function totals(log) {
    return Object.keys(log || {}).reduce((acc, key) => {
      const day = getDay(log, key);
      FIELDS.forEach((f) => {
        acc[f] += day[f];
      });
      return acc;
    }, emptyDay());
  }

  function xpFor(total) {
    return total.sessions * XP.sessions + total.puzzles * XP.puzzles + total.tasksDone * XP.tasksDone;
  }

  /** Level info from total XP. `progress` is 0..1 towards the next level (1 at max level). */
  function levelFor(xp) {
    const safe = Math.max(0, Math.floor(xp) || 0);
    let index = 0;
    LEVELS.forEach((lvl, i) => {
      if (safe >= lvl.xp) index = i;
    });
    const current = LEVELS[index];
    const next = LEVELS[index + 1] || null;
    const progress = next ? (safe - current.xp) / (next.xp - current.xp) : 1;
    return { level: index + 1, title: current.title, xp: safe, nextXp: next ? next.xp : null, progress };
  }

  /** Plant growth stage 0..4 for one garden plot, from sessions done vs the daily goal. */
  function plantStage(sessions, goal) {
    if (sessions <= 0) return 0;
    const g = Math.max(1, goal);
    if (sessions >= g) return 4;
    return Math.min(3, 1 + Math.floor(((sessions - 1) / g) * 3));
  }

  const api = {
    FIELDS,
    LEVELS,
    XP,
    dayKey,
    shiftKey,
    getDay,
    recordActivity,
    streak,
    lastDays,
    totals,
    xpFor,
    levelFor,
    plantStage,
  };
  root.FocusProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

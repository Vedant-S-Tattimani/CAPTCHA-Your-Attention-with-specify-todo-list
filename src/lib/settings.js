/**
 * Shared storage keys and user settings with validation.
 * Loaded as a classic script (extension pages, content script, worker) and CommonJS (tests).
 */
(function (root) {
  "use strict";

  const KEYS = Object.freeze({
    settings: "settings",
    pomodoro: "pomodoro",
    tasks: "tasks",
    stats: "stats",
    guardStatus: "guardStatus",
    daily: "daily",
    focusTaskId: "focusTaskId",
  });

  const STATUS_FRESH_MS = 2 * 60 * 1000;

  /** Every puzzle type, in display order. lib/puzzles.js has a generator for each. */
  const PUZZLE_KINDS = Object.freeze(["math", "sequence", "scramble", "memory", "odd", "phrase"]);

  const DEFAULTS = Object.freeze({
    workMinutes: 25,
    breakMinutes: 5,
    guardEnabled: true,
    puzzleEvery: 3, // shorts between puzzles
    difficultyStep: 5, // shorts per difficulty level
    strictDuringFocus: true, // puzzle on every short while a work session runs
    notify: true,
    dailyGoal: 4, // focus sessions per day
    puzzleKinds: PUZZLE_KINDS, // which puzzle types the guard may show
  });

  /** Known, de-duplicated puzzle kinds in display order; never empty. */
  function sanitizeKinds(value) {
    if (!Array.isArray(value)) return [...PUZZLE_KINDS];
    const chosen = PUZZLE_KINDS.filter((kind) => value.includes(kind));
    return chosen.length > 0 ? chosen : [...PUZZLE_KINDS];
  }

  const EMPTY_STATS = Object.freeze({ shortsWatched: 0, secondsOnShorts: 0, puzzlesSolved: 0 });

  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }

  function bool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function sanitizeSettings(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      workMinutes: clampInt(s.workMinutes, 1, 180, DEFAULTS.workMinutes),
      breakMinutes: clampInt(s.breakMinutes, 1, 180, DEFAULTS.breakMinutes),
      guardEnabled: bool(s.guardEnabled, DEFAULTS.guardEnabled),
      puzzleEvery: clampInt(s.puzzleEvery, 1, 50, DEFAULTS.puzzleEvery),
      difficultyStep: clampInt(s.difficultyStep, 1, 100, DEFAULTS.difficultyStep),
      strictDuringFocus: bool(s.strictDuringFocus, DEFAULTS.strictDuringFocus),
      notify: bool(s.notify, DEFAULTS.notify),
      dailyGoal: clampInt(s.dailyGoal, 1, 16, DEFAULTS.dailyGoal),
      puzzleKinds: sanitizeKinds(s.puzzleKinds),
    };
  }

  function sanitizeStats(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      shortsWatched: clampInt(s.shortsWatched, 0, Number.MAX_SAFE_INTEGER, 0),
      secondsOnShorts: clampInt(s.secondsOnShorts, 0, Number.MAX_SAFE_INTEGER, 0),
      puzzlesSolved: clampInt(s.puzzlesSolved, 0, Number.MAX_SAFE_INTEGER, 0),
    };
  }

  function addStats(stats, delta) {
    const base = sanitizeStats(stats);
    return sanitizeStats({
      shortsWatched: base.shortsWatched + (delta.shortsWatched || 0),
      secondsOnShorts: base.secondsOnShorts + (delta.secondsOnShorts || 0),
      puzzlesSolved: base.puzzlesSolved + (delta.puzzlesSolved || 0),
    });
  }

  /** Should a puzzle appear after this many shorts since the last one? */
  function shouldShowPuzzle(shortsSinceLast, settings, focusing) {
    if (!settings.guardEnabled) return false;
    const every = focusing && settings.strictDuringFocus ? 1 : settings.puzzleEvery;
    return shortsSinceLast >= every;
  }

  /** Shorts left before the next puzzle (0 = one is showing / due now). */
  function shortsUntilPuzzle(shortsSinceLast, settings, focusing) {
    const every = focusing && settings.strictDuringFocus ? 1 : settings.puzzleEvery;
    return Math.max(0, every - shortsSinceLast);
  }

  /**
   * One-line explanation for the popup of what the Shorts guard is doing.
   * @param {{ seenAt: number, shortsSinceLast: number, focusing: boolean } | undefined} status
   */
  function guardStatusText(status, settings, now) {
    if (!settings.guardEnabled) return "The guard is off.";
    if (!status || !Number.isFinite(status.seenAt)) {
      return "Not seen on YouTube Shorts yet. Open a Short (refresh any YouTube tab that was already open).";
    }
    if (now - status.seenAt > STATUS_FRESH_MS) return "Ready. It will start counting when you open YouTube Shorts.";
    const left = shortsUntilPuzzle(status.shortsSinceLast, settings, Boolean(status.focusing));
    if (left === 0) return "Watching Shorts now. A puzzle is due.";
    return `Watching Shorts now. Puzzle in ${left} more short${left === 1 ? "" : "s"}.`;
  }

  const api = {
    KEYS,
    DEFAULTS,
    EMPTY_STATS,
    PUZZLE_KINDS,
    sanitizeKinds,
    sanitizeSettings,
    sanitizeStats,
    addStats,
    shouldShowPuzzle,
    shortsUntilPuzzle,
    guardStatusText,
  };
  root.FocusSettings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

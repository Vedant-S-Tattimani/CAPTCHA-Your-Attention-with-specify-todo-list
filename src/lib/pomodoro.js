/**
 * Pomodoro timer state: a plain object with an absolute end time, so the background worker
 * can keep the timer running while the popup is closed. All functions return new objects.
 */
(function (root) {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({ workMinutes: 25, breakMinutes: 5 });
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 180;
  const MS_PER_MINUTE = 60 * 1000;

  function sanitizeMinutes(value, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, MIN_MINUTES), MAX_MINUTES);
  }

  function sanitizeSettings(settings) {
    const s = settings || {};
    return {
      workMinutes: sanitizeMinutes(s.workMinutes, DEFAULT_SETTINGS.workMinutes),
      breakMinutes: sanitizeMinutes(s.breakMinutes, DEFAULT_SETTINGS.breakMinutes),
    };
  }

  function durationMs(mode, settings) {
    const s = sanitizeSettings(settings);
    return (mode === "break" ? s.breakMinutes : s.workMinutes) * MS_PER_MINUTE;
  }

  function createState(settings) {
    return { mode: "work", running: false, endsAt: null, remainingMs: durationMs("work", settings), completedWork: 0 };
  }

  function remaining(state, now) {
    if (!state.running) return state.remainingMs;
    return Math.max(0, state.endsAt - now);
  }

  function start(state, now) {
    if (state.running) return state;
    return { ...state, running: true, endsAt: now + state.remainingMs };
  }

  function pause(state, now) {
    if (!state.running) return state;
    return { ...state, running: false, endsAt: null, remainingMs: remaining(state, now) };
  }

  function reset(state, settings) {
    return { ...state, running: false, endsAt: null, remainingMs: durationMs(state.mode, settings) };
  }

  /** Ends the current phase and starts the next one immediately. */
  function advance(state, settings, now) {
    const nextMode = state.mode === "work" ? "break" : "work";
    const length = durationMs(nextMode, settings);
    return {
      mode: nextMode,
      running: true,
      endsAt: now + length,
      remainingMs: length,
      completedWork: state.completedWork + (state.mode === "work" ? 1 : 0),
    };
  }

  /** True while a work phase is actively counting down. */
  function isFocusing(state) {
    return Boolean(state && state.running && state.mode === "work");
  }

  function formatClock(ms) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const api = {
    DEFAULT_SETTINGS,
    sanitizeSettings,
    durationMs,
    createState,
    remaining,
    start,
    pause,
    reset,
    advance,
    isFocusing,
    formatClock,
  };
  root.FocusPomodoro = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

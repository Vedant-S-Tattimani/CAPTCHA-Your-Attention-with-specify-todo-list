/**
 * Builds a preview of the real popup (src/popup/popup.html) that runs in a normal browser tab:
 * a stand-in for the extension API backed by in-memory sample data. Used only for screenshots.
 *
 * Query options (on /popup-preview.html):
 *   tab=guard|focus|tasks|insights   which tab to show
 *   scroll=<css selector>            scroll that element to the top
 *   running=1                        start the focus timer
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** Sample data: a plausible week of use, so the screenshots look lived-in. */
const SAMPLE_DATA = `
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const store = {
  settings: { workMinutes: 25, breakMinutes: 5, guardEnabled: true, puzzleEvery: 3, difficultyStep: 5, strictDuringFocus: true,
    notify: true, dailyGoal: 4, platforms: ["youtube", "instagram", "tiktok"], taskSort: "smart", taskView: "list" },
  daily: {
    [day(-6)]: { sessions: 1, focusMinutes: 25, shorts: 34, puzzles: 6 },
    [day(-5)]: { sessions: 2, focusMinutes: 50, shorts: 21, puzzles: 4, tasksDone: 1 },
    [day(-4)]: { sessions: 3, focusMinutes: 75, shorts: 14, puzzles: 3, tasksDone: 2 },
    [day(-3)]: { sessions: 4, focusMinutes: 100, shorts: 9, puzzles: 2, tasksDone: 3 },
    [day(-2)]: { sessions: 2, focusMinutes: 50, shorts: 11, puzzles: 2, tasksDone: 1 },
    [day(-1)]: { sessions: 5, focusMinutes: 125, shorts: 4, puzzles: 1, tasksDone: 4 },
    [day(0)]: { sessions: 3, focusMinutes: 75, shorts: 3, puzzles: 1, tasksDone: 2 },
  },
  totals: { sessions: 46, focusMinutes: 1150, puzzles: 38, tasksDone: 21 },
  stats: { shortsWatched: 186, secondsOnShorts: 9420, puzzlesSolved: 38, byPlatform: { youtube: 92, instagram: 61, tiktok: 33 } },
  guardStatus: { seenAt: Date.now() - 4000, shortsSinceLast: 1, focusing: false, platform: "instagram" },
  tasks: [
    { id: "a", title: "Finish history essay", priority: "high", tag: "study", deadline: day(1), done: false, createdAt: 1 },
    { id: "b", title: "Gym: upper body", priority: "medium", tag: "health", deadline: "", done: false, createdAt: 2 },
    { id: "c", title: "Plan sprint board", priority: "medium", tag: "work", deadline: day(3), done: false, createdAt: 3 },
    { id: "d", title: "Call grandma", priority: "low", tag: "personal", deadline: "", done: false, createdAt: 4 },
    { id: "e", title: "Read chapter 4", priority: "low", tag: "study", deadline: "", done: true, createdAt: 5 },
  ],
  todos: [
    { id: "t1", text: "Charge laptop", done: true, createdAt: 1 },
    { id: "t2", text: "Buy notebook", done: false, createdAt: 2 },
    { id: "t3", text: "Water the plants", done: false, createdAt: 3 },
  ],
  focusTaskId: "a",
};`;

const STUB = `
const listeners = [];
const granted = new Set(["https://www.instagram.com/*", "https://www.tiktok.com/*"]);
window.chrome = {
  permissions: {
    contains: async ({ origins }) => origins.every((o) => granted.has(o)),
    request: async ({ origins }) => (origins.forEach((o) => granted.add(o)), true),
    remove: async ({ origins }) => (origins.forEach((o) => granted.delete(o)), true),
  },
  storage: { local: {
    get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
    set: async (obj) => { const ch = {}; for (const k in obj) { ch[k] = { oldValue: store[k], newValue: obj[k] }; store[k] = obj[k]; } listeners.forEach((f) => f(ch, "local")); },
  }, onChanged: { addListener: (f) => listeners.push(f) } },
  runtime: {
    id: "preview",
    getURL: (p) => "/src/" + p,
    getManifest: () => ({ version: "${JSON.parse(fs.readFileSync(path.join(ROOT, "src/manifest.json"), "utf8")).version}" }),
    reload: () => {},
    sendMessage: async (m) => {
      if (m.type === "activity") return { ok: true };
      const P = FocusPomodoro, s = FocusSettings.sanitizeSettings(store.settings), st = store.pomodoro || P.createState(s);
      const next = { start: () => P.start(st, Date.now()), pause: () => P.pause(st, Date.now()), reset: () => P.reset(st, s),
        skip: () => P.pause(P.advance(st, s, Date.now()), Date.now()) }[m.action]();
      await chrome.storage.local.set({ pomodoro: next });
      return { ok: true, state: next };
    },
  },
};`;

/** Runs after the popup loads: pick the tab, start the timer, scroll. */
const AFTER_LOAD = `
<script>
(async () => {
  const q = new URLSearchParams(location.search);
  await new Promise((r) => setTimeout(r, 300));
  if (q.get("running")) document.getElementById("btn-toggle").click();
  const tab = document.getElementById("tab-" + (q.get("tab") || "guard"));
  if (tab) tab.click();
  if (q.get("view") === "grid") document.getElementById("view-grid")?.click();
  if (q.get("demo")) document.querySelectorAll(".kind-try")[Number(q.get("demo")) - 1]?.click();
  document.activeElement?.blur();
  if (q.get("scroll")) {
    await new Promise((r) => setTimeout(r, 200));
    const target = document.querySelector(q.get("scroll"));
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 150);
  }
  document.documentElement.dataset.ready = "1";
})();
</script>`;

function buildPopupPreview() {
  let html = fs.readFileSync(path.join(ROOT, "src/popup/popup.html"), "utf8");
  html = html
    .replace(/(src|href)="\.\.\//g, '$1="/src/')
    .replace(/(src|href)="([a-z-]+\.(?:js|css))"/g, '$1="/src/popup/$2"')
    .replace("</head>", `<script>${SAMPLE_DATA}\n${STUB}</script>\n<style>html{scrollbar-width:none}</style>\n</head>`)
    .replace("</body>", `${AFTER_LOAD}\n</body>`);
  return html;
}

module.exports = { buildPopupPreview };

/* Background service worker: owns the Pomodoro timer so it keeps running with the popup closed. */
importScripts("lib/settings.js", "lib/pomodoro.js", "lib/progress.js");

const { KEYS, sanitizeSettings } = self.FocusSettings;
const P = self.FocusPomodoro;
const G = self.FocusProgress;
const ALARM = "pomodoro-phase-end";

const BREAK_TIPS = [
  "Stand up and stretch your arms and back.",
  "Drink a glass of water.",
  "Look at something 20 metres away for 20 seconds.",
  "Take five slow, deep breaths.",
  "Walk around for a minute.",
  "Roll your shoulders and relax your jaw.",
  "Step away from the screen. No Shorts!",
];

async function load() {
  const data = await chrome.storage.local.get([KEYS.settings, KEYS.pomodoro]);
  const settings = sanitizeSettings(data[KEYS.settings]);
  const state = data[KEYS.pomodoro] || P.createState(settings);
  return { settings, state };
}

async function save(state) {
  await chrome.storage.local.set({ [KEYS.pomodoro]: state });
  await chrome.alarms.clear(ALARM);
  if (state.running) chrome.alarms.create(ALARM, { when: state.endsAt });
  await updateBadge(state);
  return state;
}

async function updateBadge(state) {
  const text = state.running ? (state.mode === "work" ? "W" : "B") : "";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: state.mode === "work" ? "#d9480f" : "#2b8a3e" });
}

/** Adds a finished work session to today's log. Returns today's session count. */
async function recordFocusSession(settings) {
  const key = G.dayKey(new Date());
  const data = await chrome.storage.local.get(KEYS.daily);
  const log = G.recordActivity(data[KEYS.daily], key, { sessions: 1, focusMinutes: settings.workMinutes });
  await chrome.storage.local.set({ [KEYS.daily]: log });
  return log[key].sessions;
}

function phaseMessage(nextState, settings, sessionsToday) {
  if (nextState.mode !== "break") {
    return { title: "Break over", message: `Back to it: ${settings.workMinutes} minutes of focus.` };
  }
  const tip = BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)];
  if (sessionsToday === settings.dailyGoal) {
    return { title: "Daily goal reached! 🌳", message: `${sessionsToday} focus sessions today. Your garden is in full bloom. ${tip}` };
  }
  return {
    title: `Session ${sessionsToday} of ${settings.dailyGoal} done 🌱`,
    message: `Take a ${settings.breakMinutes}-minute break. ${tip}`,
  };
}

async function notifyPhase(nextState, settings, sessionsToday) {
  if (!settings.notify) return;
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      ...phaseMessage(nextState, settings, sessionsToday),
    });
  } catch (error) {
    console.warn("[Focus Guard] notification failed", error);
  }
}

async function finishPhase() {
  const { settings, state } = await load();
  if (!state.running) return;
  const next = P.advance(state, settings, Date.now());
  await save(next);
  const sessionsToday = state.mode === "work" ? await recordFocusSession(settings) : 0;
  await notifyPhase(next, settings, sessionsToday);
}

const ACTIONS = {
  start: (state) => P.start(state, Date.now()),
  pause: (state) => P.pause(state, Date.now()),
  reset: (state, settings) => P.reset(state, settings),
  skip: (state, settings) => P.pause(P.advance(state, settings, Date.now()), Date.now()),
};

async function handleTimerAction(action) {
  const handler = ACTIONS[action];
  if (!handler) throw new Error(`Unknown timer action: ${action}`);
  const { settings, state } = await load();
  return save(handler(state, settings));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "timer") return false;
  handleTimerAction(message.action)
    .then((state) => sendResponse({ ok: true, state }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true; // async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) finishPhase().catch((e) => console.error("[Focus Guard] phase end failed", e));
});

/* If timer lengths change while the timer sits untouched at full length, show the new length. */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[KEYS.settings]) return;
  const oldSettings = sanitizeSettings(changes[KEYS.settings].oldValue);
  load()
    .then(({ settings, state }) => {
      const untouched = !state.running && state.remainingMs === P.durationMs(state.mode, oldSettings);
      return untouched ? save(P.reset(state, settings)) : null;
    })
    .catch((e) => console.error("[Focus Guard] settings sync failed", e));
});

/* After a browser restart, a phase that ended while Chrome was closed is moved on and paused. */
async function recover() {
  const { settings, state } = await load();
  if (state.running && state.endsAt <= Date.now()) {
    await save(P.pause(P.advance(state, settings, Date.now()), Date.now()));
  } else {
    await save(state);
  }
}

/*
 * Chrome only adds content scripts to pages loaded after install, so YouTube tabs that were
 * already open would have no guard until refreshed. Add it to them now.
 */
async function injectIntoOpenYouTubeTabs() {
  const { content_scripts: [guard] } = chrome.runtime.getManifest();
  const tabs = await chrome.tabs.query({ url: guard.matches });
  await Promise.all(
    tabs.map((tab) =>
      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: guard.js })
        .catch((e) => console.warn(`[Focus Guard] could not add guard to tab ${tab.id}`, e))
    )
  );
}

chrome.runtime.onStartup.addListener(() => recover().catch((e) => console.error("[Focus Guard] recover failed", e)));
chrome.runtime.onInstalled.addListener((details) => {
  recover().catch((e) => console.error("[Focus Guard] install init failed", e));
  injectIntoOpenYouTubeTabs().catch((e) => console.error("[Focus Guard] injection failed", e));
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") }).catch((e) => console.warn(e));
  }
});

/* Keyboard shortcut (Alt+Shift+F by default) starts or pauses the timer from any page. */
chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-timer") return;
  load()
    .then(({ state }) => handleTimerAction(state.running ? "pause" : "start"))
    .catch((e) => console.error("[Focus Guard] shortcut failed", e));
});

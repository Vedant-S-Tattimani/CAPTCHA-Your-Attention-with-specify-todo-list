# Focus Guard

A browser extension (Chrome and Edge) that helps you plan your work and stop doomscrolling on **YouTube Shorts, Instagram Reels, TikTok, Facebook Reels and Snapchat Spotlight**. It pairs a scroll guard (puzzles that interrupt short-video feeds) with focus tools (a Pomodoro timer and sticky-note tasks).

The two parts work together:

- **During a work session, feeds get strict.** Every video asks for a puzzle (you can turn this off).
- **The puzzle reminds you what you should be doing.** It shows your most important open task.
- The toolbar icon shows **W** during work and **B** during a break, and you get a notification when each phase ends.

Everything is stored on your computer (`chrome.storage.local`). There's no account, no server, and nothing is sent anywhere.

### Data and privacy

- **No API keys, no database, no server, no sign-up.** Nothing needs configuring.
- **All data lives in Chrome's local extension storage** on your computer: settings, tasks, timer, stats, the 60-day activity log and lifetime XP totals. Removing the extension deletes it.
- **No network requests.** The only `fetch` reads the extension's own `manifest.json` (for the "Update ready" banner). Fonts and icons are bundled.
- **Site access is opt-in.** Only YouTube is enabled at install. Chrome asks before the guard runs on Instagram, TikTok, Facebook or Snapchat, and switching a site off removes the access.
- **Insights data has one writer.** Guard tabs and the popup send events to the background worker, which applies them one at a time (`lib/activity.js`), so nothing is lost when several tabs report at once. XP comes from lifetime totals that are never trimmed, so your level never goes down.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the **`src`** folder inside this project.
4. Pin Focus Guard from the puzzle-piece menu so the timer badge is visible.

After editing any file, click the reload icon on the extension's card in `chrome://extensions` (the popup shows an **Update ready** banner with a one-click reload when you forget). Open tabs on guarded sites get the updated guard automatically.

### Platforms

YouTube Shorts is guarded out of the box. Switch the others on in the popup's **Guard → Platforms** section. Chrome asks for access to a site the first time you switch it on, and switching it off removes that access again.

| Platform | Where | How a new video is detected |
|----------|-------|-----------------------------|
| ▶️ YouTube Shorts | `youtube.com/shorts/…` | The address changes per video |
| 📸 Instagram Reels | `instagram.com/reels/…` | The address changes per reel |
| 🎵 TikTok | `tiktok.com/foryou`, `/@user/video/…` | On the For You feed the address stays the same, so the guard watches which video fills the screen |
| 📘 Facebook Reels | `facebook.com/reel/…` | The address changes per reel |
| 👻 Snapchat Spotlight | `snapchat.com/@user/spotlight/…` | The address changes per video (checked on the live site) |

These sites change their pages often. If a platform stops counting, its pattern lives in one place: `src/lib/platforms.js`.

### Is the guard running?

Open the popup's **Guard** tab. The line under the on/off switch tells you what the guard sees:

- *"Not seen on a short-video feed yet"*: open a feed on a site that's switched on, or refresh a tab that was already open.
- *"Watching Instagram Reels now. Puzzle in 2 more videos."*: it's working and counting down.

By default the first puzzle appears on the **3rd** video (or on every video during a work session).

## Using it

- **Focus tab**: start, pause, reset or skip the Pomodoro timer. A bar of dots tracks today's sessions against your daily goal. Under *Timer settings* you can change the work and break lengths and the daily goal.
- **Tasks tab**:
  - **Create, edit (✎), delete (×)** tasks with a tag (Work, Study, Personal, Health, Other), a priority and an optional deadline
  - **Sort** by Smart (priority, then deadline), Deadline, Priority, Newest or A–Z; **search** and filter by tag
  - **List or grid view** (your choice is remembered)
  - **Pomodoro timer strip** at the top, the same timer as the Focus tab
  - **Quick todos**: simple one-line todos to add, tick off and delete

  Press 🎯 on a task to focus on it: it shows on the timer and on every puzzle. Finishing a task earns XP (and confetti).
- **Guard tab** (opens first): turn the guard on or off, switch platforms on, pick puzzle types, choose how often puzzles appear and how quickly they get harder, and see all-time stats with a count per platform.
- **Insights tab**: your level and XP, your streak, the Focus Garden, and 7-day charts of focus minutes and videos watched.

### Motivation features

| Feature | How it works |
|---------|--------------|
| 🔥 Streak | Days in a row with at least one finished focus session. Today doesn't break it until the day is over. |
| 🌱 Focus Garden | One plant per day for the last week. It sprouts with your first session and blooms at your daily goal. |
| ⭐ Levels | XP from finished sessions (10), finished tasks (5) and solved puzzles (2). Seven levels, from Seedling to Zen Guardian. |
| 🧩 Puzzles | Six types, chosen in the Guard tab (see below). All get harder the more videos you watch. |
| 🔔 Break tips | When a work session ends, the notification shows your progress towards today's goal and a break idea. |
| ⌨️ Shortcut | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> starts or pauses the timer from any page. Change it at `chrome://extensions/shortcuts`. |
| 👋 Welcome page | Opens once on first install with a 3-step quick start. |

The daily history keeps the last 60 days.

### Puzzle types

Turn each type on or off in the **Guard** tab (at least one stays on). Press **▶ Try** on any type to play a demo inside the popup. Demo solves don't count towards your stats.

Selected types come in a **shuffled rotation**: you get every selected type once before any type repeats, and never the same type twice in a row. The rotation is saved, so it carries on across tabs, page reloads and platforms.

| Type | What you do | Gets harder by |
|------|-------------|----------------|
| ➗ Math | Solve `7 + 3 × 2` (normal operator precedence) | More operations |
| 🔢 Next number | Continue `3, 7, 11, 15, ?` | Bigger steps, then multiplying |
| 🔤 Word scramble | Unscramble `C S U O F` → FOCUS (any letter case) | Longer words |
| 🧠 Memory | Digits show for 3 seconds, then you type them back | More digits (4 to 9) |
| 🧩 Odd one out | Tap the emoji that doesn't belong | 5 choices instead of 4 |
| ⌨️ Type it out | Type a short motivating phrase exactly (pasting is blocked) | Longer phrases |

## Project layout

```
src/
  manifest.json          Manifest V3
  background.js          Service worker: runs the timer with chrome.alarms, badge, notifications
  platform-sync.js       Service worker helper: adds/removes the guard per platform and permission
  lib/                   Pure logic, shared by every part and covered by tests
    platforms.js         Supported sites, their feed addresses and video detection
    activity.js          Applies activity events to stats, daily log and lifetime totals
    todos.js             Simple todos (add, tick, delete)
    captcha.js           Math and number-sequence generators
    puzzles.js           All six puzzle types, one shape, answer checking
    pomodoro.js          Timer state
    tasks.js             Task list operations
    settings.js          Storage keys, settings validation, stats
    progress.js          Daily log, streaks, XP/levels, garden growth
  content/
    shorts-guard.js      Runs on each guarded site, counts videos, shows the puzzle overlay
    puzzle-view.js       Renders any puzzle type (shared by the overlay and the popup demo)
    overlay-style.js     Overlay styles, applied inside the overlay's shadow root
  popup/                 Toolbar popup UI (platform-picker.js: platform switches; tasks-view.js: Tasks tab)
    insights.js          Level card, Focus Garden, weekly charts
    celebrate.js         Confetti (skipped if the system asks for reduced motion)
  welcome/               First-install welcome page
  icons/                 Original puzzle-piece icon (source: store/design/icon.svg)
tests/                   Unit tests (Node's built-in test runner)
```

## Microsoft Edge

Focus Guard runs in Edge unchanged (Edge uses the same extension system as Chrome).

- **Try it:** open `edge://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `src` folder.
- **Publish it:** everything for the Edge Add-ons store is in [`store/`](store/):
  - [`store/edge-listing.md`](store/edge-listing.md): listing text, category, privacy URL, permission notes for reviewers
  - `store/images/`: 300×300 logo, 440×280 promo tile, four 1280×800 screenshots
  - [`PRIVACY.md`](PRIVACY.md): the privacy policy (use its GitHub URL in Partner Center)

Build the upload zip (checks the manifest and writes `dist/focus-guard-<version>.zip` with `manifest.json` at the top level):

```powershell
npm run package
```

Regenerate the icons and store images after UI changes (needs Edge installed). Start `node tools/preview-server.js` in another terminal for the screenshots:

```powershell
powershell -ExecutionPolicy Bypass -File tools/store-images.ps1 -PreviewUrl http://127.0.0.1:5178
```

## Tests

Requires Node 22 or newer. No packages to install.

```powershell
npm test
```

## Licence

MIT. See [LICENSE](LICENSE).

Licence texts required by bundled third-party components (the fonts, and earlier MIT-licensed code) are kept in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and `src/fonts/`.

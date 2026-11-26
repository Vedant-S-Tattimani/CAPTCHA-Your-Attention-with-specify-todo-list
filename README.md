# Focus Guard

A Chrome extension that helps you plan your work and stop doomscrolling. It combines two open-source projects:

| From | What it brings |
|------|----------------|
| [Specify](https://github.com/jane-does-coding/Specify) | Pomodoro timer and colour-tagged "sticky note" tasks |
| [CAPTCHA-Your-Attention](https://github.com/You-now-Who/CAPTCHA-Your-Attention) | Math puzzles that interrupt YouTube Shorts, plus stats |

The two parts work together:

- **During a work session, Shorts get strict.** Every short asks for a puzzle (you can turn this off).
- **The puzzle reminds you what you should be doing.** It shows your most important open task.
- The toolbar icon shows **W** during work and **B** during a break, and you get a notification when each phase ends.

Everything is stored on your computer (`chrome.storage.local`). There's no account, no server, and nothing is sent anywhere.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the **`src`** folder inside this project.
4. Pin Focus Guard from the puzzle-piece menu so the timer badge is visible.

After editing any file, click the reload icon on the extension's card in `chrome://extensions`. Open YouTube tabs get the updated guard automatically.

### Is the guard running?

Open the popup's **Guard** tab. The line under the on/off switch tells you what the guard sees:

- *"Not seen on YouTube Shorts yet"*: the guard hasn't run on a Shorts page. Open a Short, or refresh the YouTube tab.
- *"Watching Shorts now. Puzzle in 2 more shorts."*: it's working and counting down.

By default the first puzzle appears on the **3rd** short (or on every short during a work session).

## Using it

- **Focus tab**: start, pause, reset or skip the Pomodoro timer. Set the work and break lengths in minutes.
- **Tasks tab**: add tasks with a tag (Work, Study, Personal, Health, Other), a priority and an optional deadline. Tasks sort by status, then priority, then deadline. Overdue tasks are flagged.
- **Guard tab**: turn the Shorts guard on or off, choose how often puzzles appear and how quickly they get harder, and see your stats.

## Project layout

```
src/
  manifest.json          Manifest V3
  background.js          Service worker: runs the timer with chrome.alarms, badge, notifications
  lib/                   Pure logic, shared by every part and covered by tests
    captcha.js           Puzzle generator
    pomodoro.js          Timer state
    tasks.js             Task list operations
    settings.js          Storage keys, settings validation, stats
  content/
    shorts-guard.js      Runs on YouTube, detects Shorts, shows the puzzle overlay
    overlay-style.js     Overlay styles, applied inside the overlay's shadow root
  popup/                 Toolbar popup UI
  icons/                 From CAPTCHA-Your-Attention
tests/                   Unit tests (Node's built-in test runner)
```

## Tests

Requires Node 22 or newer. No packages to install.

```powershell
npm test
```

## What changed from the original projects

**From CAPTCHA-Your-Attention, fixed:**

- Answers used left-to-right maths: `2 + 3 × 4` expected 20, not 14, so correct answers were rejected. Puzzles now follow normal operator precedence.
- The guard only loaded when a Shorts page was opened directly. Going from the YouTube home page into Shorts didn't trigger it. It now follows YouTube's in-page navigation.
- "CAPTCHAs solved" went up when a puzzle *appeared*, not when it was solved. The popup also read the wrong storage key, so "shorts scrolled" always showed 0.
- Time was counted every second on any Shorts page, even in background tabs. It now counts only while the tab is visible and no puzzle is open.
- Typing the answer could trigger YouTube's keyboard shortcuts (number keys jump through the video). Key presses inside the puzzle no longer reach the page.
- Removed `alert()` pop-ups, the debug logging that ran every 200 ms, and an unused 40,000-line `math.js` bundle.

**From Specify, adapted:**

- Specify is a Next.js website with MongoDB and logins. Its timer and task features were rewritten in plain JavaScript with local storage, so they work in an extension with no backend.
- The timer now runs in the background, so it keeps going when the popup is closed.

## Licence

Both original projects are MIT-licensed. Their licence texts are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and must stay with any copy you share or publish.

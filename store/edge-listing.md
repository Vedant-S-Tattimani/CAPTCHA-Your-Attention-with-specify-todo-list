# Microsoft Edge Add-ons: listing kit

Copy each section into Partner Center (`partner.microsoft.com/dashboard/microsoftedge`).

---

## Package

- **File:** `dist/focus-guard-<version>.zip` (build it with `npm run package`)
- `manifest.json` is at the top level of the zip, as the store requires.

## Availability

- **Visibility:** Public (or Hidden to share by link only)
- **Markets:** All markets

## Properties

- **Category:** Productivity
- **Privacy policy URL:**
  https://github.com/Vedant-S-Tattimani/CAPTCHA-Your-Attention-with-specify-todo-list/blob/main/PRIVACY.md
- **Website URL (optional):**
  https://github.com/Vedant-S-Tattimani/CAPTCHA-Your-Attention-with-specify-todo-list
- **Support contact:** the GitHub issues page above (or your own email)
- **Mature content:** No

## Store listing (English)

**Display name**

Focus Guard

**Short description** (shown in search results)

Stop doomscrolling with puzzles on YouTube Shorts, Instagram, TikTok, Facebook and Snapchat. Plus focus timer and tasks.

**Description**

Caught in the endless scroll? Focus Guard gently breaks the loop.

Every few short videos, Focus Guard pauses the feed and asks you to solve a quick puzzle before you keep watching, plus a reminder of what you actually meant to be doing. It's a moment to decide whether this is really how you want to spend your time.

WORKS ON
• YouTube Shorts (on by default)
• Instagram Reels, TikTok, Facebook Reels and Snapchat Spotlight (switch them on when you want; your browser asks for access only then)

SIX KINDS OF PUZZLES
• Math • Next number in a sequence • Word scramble • Memory • Odd one out • Type it out
Pick the ones you like. They come in a fair rotation and get harder the more you scroll. Try any of them right in the popup.

FOCUS TOOLS
• Pomodoro focus timer that keeps running when the popup is closed, with break tips
• Tasks with tags, priorities and deadlines: create, edit, sort, search, list or grid view
• Quick todos for small things
• Pin a task with 🎯 and it appears on every puzzle as a reminder
• Alt+Shift+F starts or pauses the timer from any page

STAY MOTIVATED
• Daily focus goal and streaks
• A focus garden: one plant per day that grows with each session and blooms at your goal
• Levels and XP from Seedling to Zen Guardian
• Weekly charts of focus minutes against short videos watched

PRIVATE BY DESIGN
No account, no servers, no tracking, no ads. Everything stays in your browser.

Open source (MIT): https://github.com/Vedant-S-Tattimani/CAPTCHA-Your-Attention-with-specify-todo-list

**Search terms** (up to 7)

doomscrolling, focus, pomodoro, youtube shorts blocker, productivity, screen time, reels blocker

## Images (in `store/images/`)

| Field | File | Size |
|-------|------|------|
| Extension logo | `logo-300.png` | 300 × 300 |
| Small promotional tile (optional) | `promo-tile-440x280.png` | 440 × 280 |
| Screenshots | `screenshot-1-guard.png` … `screenshot-4-insights.png` | 1280 × 800 |

## Notes for certification (paste into "Notes for certification")

Focus Guard needs no account, test login or API key.

How to test:
1. Install, open YouTube (https://www.youtube.com/shorts) and scroll through 3 Shorts. A puzzle overlay appears. Solve it to continue (Different puzzle shows another type).
2. Open the toolbar popup: Guard tab (platforms, puzzle types with "Try" demos, stats), Focus tab (timer), Tasks tab, Insights tab.
3. Optional sites: in Guard → Platforms, switch on Instagram/TikTok/Facebook/Snapchat; the browser asks for that site's permission at that moment.

Permissions:
- storage: saves settings, tasks and stats locally.
- alarms: ends focus/break periods on time while the popup is closed.
- notifications: tells the user when a focus or break period ends.
- scripting: adds the guard to sites the user switched on, and to tabs that were already open.
- Host access to youtube.com: counts Shorts and shows the puzzle overlay.
- Optional host access (instagram.com, tiktok.com, facebook.com, snapchat.com): requested only when the user switches that site on.

No data leaves the device; there are no network requests.

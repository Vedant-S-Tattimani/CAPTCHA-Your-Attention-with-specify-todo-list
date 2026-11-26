/*
 * Overlay styles for the Shorts puzzle. Kept in JS so they are applied together with the overlay
 * (inside its shadow root) instead of depending on a separate stylesheet request.
 * Same visual language as the popup: graph paper, ink, cyan selection frame, sticky notes.
 */
globalThis.FocusOverlayCss = `
:host {
  all: initial;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(17, 18, 18, 0.78);
  backdrop-filter: blur(6px);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.backdrop,
.card {
  --ink: #111212;
  --dim: #5d6063;
  --rule: #e4e4e4;
  --grid: #f0f0f0;
  --cyan: #36c5f0;
  --cyan-strong: #1a8fbd;
  --berry: #e01e5a;
  --cream: #f5dda1;
  --display: "FocusGuard Display", "Segoe UI", system-ui, sans-serif;
  --hand: "FocusGuard Hand", "Segoe Print", "Comic Sans MS", cursive;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
}

.card {
  position: relative;
  width: min(360px, 100%);
  box-sizing: border-box;
  padding: 22px 24px 20px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  color: var(--ink);
  text-align: center;
  background-color: #ffffff;
  background-image: linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 20px 20px;
  box-shadow: 8px 8px 0 var(--cyan), 0 24px 60px rgba(0, 0, 0, 0.4);
  animation: pop-in 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.95);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }
}

.scribble {
  position: relative;
  display: inline-block;
  margin: 0 0 6px;
  color: var(--berry);
  font: 22px/1 var(--hand);
  transform: rotate(-3deg);
}

.scribble::after {
  content: "";
  position: absolute;
  left: -4px;
  right: -6px;
  bottom: -6px;
  height: 7px;
  background: no-repeat center / 100% 100%
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 8' preserveAspectRatio='none'%3E%3Cpath d='M2 6 Q30 1 60 4 T98 3' fill='none' stroke='%2336c5f0' stroke-width='2.2' stroke-linecap='round'/%3E%3C/svg%3E");
}

h2 {
  margin: 4px 0 4px;
  font: 800 22px/1.1 var(--display);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sub {
  margin: 0 0 14px;
  color: var(--dim);
  font: 11px var(--mono);
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

/* Sticky note with the task you meant to do */
.reminder {
  margin: 0 6px 18px;
  padding: 9px 12px;
  background: var(--cream);
  font-size: 13px;
  overflow-wrap: anywhere;
  transform: rotate(-1.5deg);
  box-shadow: 0 6px 14px rgba(17, 18, 18, 0.12);
}

.kind {
  margin-bottom: 6px;
  color: var(--cyan-strong);
  font: 700 11px var(--mono);
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

/* The question sits in a Figma-style selection frame */
.question {
  position: relative;
  display: inline-block;
  margin: 0 0 14px;
  padding: 6px 14px 4px;
  border: 1px solid var(--cyan);
  font: 800 30px/1.2 var(--display);
  letter-spacing: 1px;
  user-select: none;
}

.question::before,
.question::after {
  content: "";
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--cyan);
}

.question::before {
  top: -4px;
  left: -4px;
}

.question::after {
  right: -4px;
  bottom: -4px;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  background: #ffffff;
  color: var(--ink);
  font: 600 18px var(--mono);
  text-align: center;
}

input:focus {
  outline: 3px solid var(--cyan);
  outline-offset: 0;
}

.feedback {
  min-height: 20px;
  margin: 6px 0;
  color: var(--berry);
  font: 18px var(--hand);
}

.row {
  display: flex;
  gap: 10px;
}

button {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid var(--ink);
  border-radius: 4px;
  font: 700 14px var(--display);
  letter-spacing: 0.6px;
  text-transform: uppercase;
  cursor: pointer;
  transition: transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 120ms, background-color 150ms;
}

.primary {
  background: var(--ink);
  color: #ffffff;
  box-shadow: 3px 3px 0 var(--cyan);
}

.primary:hover {
  background: #2c2e2e;
}

.ghost {
  background: #ffffff;
  color: var(--ink);
}

.ghost:hover {
  background: #f4f4f4;
}

button:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

form > .ghost {
  width: 100%;
  margin-top: 12px;
  border: 0;
  background: transparent;
  color: var(--dim);
  font: 18px var(--hand);
  text-decoration: underline;
  text-transform: none;
}

button:focus-visible {
  outline: 3px solid var(--cyan);
  outline-offset: 2px;
}
`;

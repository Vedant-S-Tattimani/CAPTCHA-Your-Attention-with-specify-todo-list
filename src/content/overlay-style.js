/*
 * Overlay styles for the Shorts puzzle. Kept in JS so they are applied together with the overlay
 * (inside its shadow root) instead of depending on a separate stylesheet request.
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
  background: rgba(10, 12, 16, 0.72);
  backdrop-filter: blur(6px);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.card {
  width: min(360px, 100%);
  box-sizing: border-box;
  padding: 24px;
  border-radius: 16px;
  background: #fffdf8;
  color: #1f2328;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  text-align: center;
}

.backdrop,
.card {
  --display: "FocusGuard Display", "Segoe UI", system-ui, sans-serif;
  --hand: "FocusGuard Hand", "Segoe Print", "Comic Sans MS", cursive;
}

.scribble {
  display: inline-block;
  margin: 0 0 2px;
  color: #d9480f;
  font: 20px/1 var(--hand);
  transform: rotate(-3deg);
  border-bottom: 2px solid #d9480f;
  border-radius: 0 0 40% 60% / 0 0 6px 4px;
  padding: 0 4px 2px;
}

h2 {
  margin: 4px 0 4px;
  font: 800 22px/1.1 var(--display);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.sub {
  margin: 0 0 12px;
  font-size: 13px;
  color: #59636e;
}

.reminder {
  margin: 0 0 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #fff3bf;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.kind {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #d9480f;
}

.card {
  animation: pop-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }
}

.question {
  margin-bottom: 12px;
  font: 800 30px/1.2 var(--display);
  letter-spacing: 1px;
  user-select: none;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #d0d7de;
  border-radius: 10px;
  font-size: 18px;
  text-align: center;
}

input:focus {
  outline: none;
  border-color: #d9480f;
}

.feedback {
  min-height: 20px;
  margin: 6px 0;
  font-size: 13px;
  color: #c92a2a;
}

.row {
  display: flex;
  gap: 8px;
}

button {
  flex: 1;
  padding: 9px 12px;
  border: 2px solid #1f2328;
  border-radius: 12px;
  font: 700 15px var(--display);
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 3px 0 #1f2328;
  transition: transform 80ms, box-shadow 80ms, background-color 150ms;
}

button:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 #1f2328;
}

.primary {
  background: #d9480f;
  color: #fff;
}

.primary:hover {
  background: #b93c0b;
}

.ghost {
  background: #fff;
  color: #1f2328;
}

.ghost:hover {
  background: #f1f3f5;
}

form > .ghost {
  width: 100%;
  margin-top: 10px;
  border: 0;
  box-shadow: none;
  background: transparent;
  color: #59636e;
  font: 18px var(--hand);
  text-decoration: underline;
}

form > .ghost:active {
  transform: none;
}

button:focus-visible {
  outline: 3px solid #4dabf7;
  outline-offset: 2px;
}
`;

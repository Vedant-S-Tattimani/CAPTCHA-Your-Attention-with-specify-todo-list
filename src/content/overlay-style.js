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

h2 {
  margin: 0 0 4px;
  font-size: 20px;
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

.question {
  margin-bottom: 12px;
  font: 600 26px/1.2 ui-monospace, "Cascadia Mono", Consolas, monospace;
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
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.primary {
  background: #d9480f;
  color: #fff;
  font-weight: 600;
}

.primary:hover {
  background: #b93c0b;
}

.ghost {
  background: #f1f3f5;
  color: #1f2328;
}

.ghost:hover {
  background: #e3e6e9;
}

form > .ghost {
  width: 100%;
  margin-top: 8px;
  background: transparent;
  text-decoration: underline;
  color: #59636e;
}

button:focus-visible {
  outline: 3px solid #4dabf7;
  outline-offset: 2px;
}
`;

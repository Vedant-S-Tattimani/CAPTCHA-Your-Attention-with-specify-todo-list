/**
 * All Shorts-guard puzzle types behind one shape, so one view can render any of them:
 *
 *   { kind, prompt, display, answer, input: "number" | "text" | "choice", options?, hideAfterMs?, noPaste? }
 *
 * Math and number sequences come from captcha.js; the rest are defined here.
 * Loaded as a classic script (content script / popup) and CommonJS (tests).
 */
(function (root) {
  "use strict";

  const captcha = root.FocusCaptcha || (typeof require === "function" ? require("./captcha.js") : null);
  const settingsApi = root.FocusSettings || (typeof require === "function" ? require("./settings.js") : null);

  /** Shown in the Guard tab's puzzle picker. */
  const KIND_INFO = Object.freeze({
    math: { label: "Math", icon: "➗", example: "7 + 3 × 2 = ?" },
    sequence: { label: "Next number", icon: "🔢", example: "3, 7, 11, 15, ?" },
    scramble: { label: "Word scramble", icon: "🔤", example: "C S U O F → FOCUS" },
    memory: { label: "Memory", icon: "🧠", example: "Remember 4 8 1 9" },
    odd: { label: "Odd one out", icon: "🧩", example: "🍎 🍌 🚗 🍇" },
    phrase: { label: "Type it out", icon: "⌨️", example: "“back to work”" },
  });

  /* Word lists get longer as difficulty rises. All are motivating, focus-themed words. */
  const WORDS = [
    ["FOCUS", "STUDY", "GOALS", "LEARN", "DREAM", "SMART", "BRAIN", "CALM", "MIND", "PLAN", "GROW", "BOOK"],
    ["GARDEN", "PUZZLE", "ROCKET", "BRIGHT", "HEALTH", "JOURNEY", "LIBRARY", "PROJECT", "BALANCE", "SUCCESS"],
    ["CREATIVE", "KNOWLEDGE", "DISCOVERY", "ADVENTURE", "CHAMPION", "NOTEBOOK", "MOUNTAIN", "PROGRESS", "SUNSHINE"],
  ];

  const PHRASES = [
    ["back to work", "one more page", "focus mode on", "I choose my time", "small steps count"],
    ["my goals matter more than shorts", "I will finish what I started", "small steps every single day"],
    [
      "the future me will thank me for this focus",
      "I control my attention, not the algorithm",
      "discipline is choosing what I want most",
    ],
  ];

  const EMOJI_SETS = [
    ["🍎", "🍌", "🍇", "🍓", "🍒", "🍍", "🥝", "🍑"],
    ["🐶", "🐱", "🐼", "🦊", "🐸", "🐵", "🐰", "🐯"],
    ["🚗", "🚌", "🚲", "🚀", "🚂", "🛵", "🚁", "🚜"],
    ["⚽", "🏀", "🎾", "🏈", "⚾", "🏐", "🏓", "🏸"],
    ["🎸", "🎹", "🥁", "🎺", "🎻", "🎷"],
    ["🌧️", "⛈️", "❄️", "🌈", "🌪️", "☁️", "🌤️"],
  ];

  const MEMORY_SHOW_MS = 3000;

  function pick(random, items) {
    return items[Math.floor(random() * items.length)];
  }

  function shuffle(random, items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Difficulty 1..6 mapped to list tier 0..2. */
  function tier(difficulty) {
    const d = Math.max(1, Math.min(6, Math.floor(difficulty) || 1));
    return Math.min(2, Math.floor((d - 1) / 2));
  }

  /* ---------- generators ---------- */

  function mathPuzzle(difficulty, random) {
    const { text, answer } = captcha.generatePuzzle(difficulty, random);
    return { kind: "math", prompt: "Solve it", display: `${text} = ?`, answer: String(answer), input: "number" };
  }

  function sequencePuzzle(difficulty, random) {
    const { text, answer } = captcha.generateSequence(difficulty, random);
    return { kind: "sequence", prompt: "What comes next?", display: text, answer: String(answer), input: "number" };
  }

  function scramblePuzzle(difficulty, random) {
    const word = pick(random, WORDS[tier(difficulty)]);
    let letters = shuffle(random, word.split(""));
    for (let tries = 0; letters.join("") === word && tries < 10; tries++) letters = shuffle(random, word.split(""));
    if (letters.join("") === word) letters = [...letters.slice(1), letters[0]]; // guaranteed different
    return { kind: "scramble", prompt: "Unscramble the word", display: letters.join(" "), answer: word, input: "text" };
  }

  function memoryPuzzle(difficulty, random) {
    const length = 3 + Math.max(1, Math.min(6, Math.floor(difficulty) || 1));
    const digits = Array.from({ length }, () => Math.floor(random() * 10)).join("");
    return {
      kind: "memory",
      prompt: "Memorise, then type it",
      display: digits.split("").join(" "),
      answer: digits,
      input: "number",
      hideAfterMs: MEMORY_SHOW_MS,
    };
  }

  function oddPuzzle(difficulty, random) {
    const count = difficulty >= 4 ? 5 : 4;
    const [mainSet, otherSet] = shuffle(random, EMOJI_SETS);
    const same = shuffle(random, mainSet).slice(0, count - 1);
    const odd = pick(random, otherSet);
    return {
      kind: "odd",
      prompt: "Tap the odd one out",
      display: "",
      answer: odd,
      input: "choice",
      options: shuffle(random, [...same, odd]),
    };
  }

  function phrasePuzzle(difficulty, random) {
    const phrase = pick(random, PHRASES[tier(difficulty)]);
    return { kind: "phrase", prompt: "Type it out exactly", display: phrase, answer: phrase, input: "text", noPaste: true };
  }

  const GENERATORS = Object.freeze({
    math: mathPuzzle,
    sequence: sequencePuzzle,
    scramble: scramblePuzzle,
    memory: memoryPuzzle,
    odd: oddPuzzle,
    phrase: phrasePuzzle,
  });

  /** One puzzle of the given kind. */
  function generate(kind, difficulty, random = Math.random) {
    const make = GENERATORS[kind] || GENERATORS.math;
    return make(difficulty, random);
  }

  /** A puzzle of a random kind from the user's enabled kinds. */
  function pickChallenge(difficulty, enabledKinds, random = Math.random) {
    const kinds = settingsApi.sanitizeKinds(enabledKinds);
    return generate(pick(random, kinds), difficulty, random);
  }

  /**
   * Fair rotation ("shuffle bag"): every enabled kind comes up once, in a shuffled order, before
   * any kind repeats. Kinds switched off are skipped; newly switched-on kinds join the next round.
   * A new round never starts with the kind that ended the last one.
   *
   * @param {{ bag?: string[], last?: string | null } | undefined} rotation saved rotation state
   * @param {string[]} enabledKinds
   * @returns {{ kind: string, rotation: { bag: string[], last: string } }}
   */
  function nextKind(rotation, enabledKinds, random = Math.random) {
    const kinds = settingsApi.sanitizeKinds(enabledKinds);
    const saved = rotation && Array.isArray(rotation.bag) ? rotation : { bag: [], last: null };
    let bag = saved.bag.filter((kind) => kinds.includes(kind));
    if (bag.length === 0) {
      bag = shuffle(random, kinds);
      if (bag.length > 1 && bag[0] === saved.last) bag.push(bag.shift());
    }
    const [kind, ...rest] = bag;
    return { kind, rotation: { bag: rest, last: kind } };
  }

  /* ---------- answer checking ---------- */

  const normalizeLetters = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const normalizeDigits = (s) => String(s ?? "").replace(/\s+/g, "");
  const normalizePhrase = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  function check(challenge, input) {
    switch (challenge.kind) {
      case "math":
      case "sequence":
        return captcha.isCorrect(input, Number(challenge.answer));
      case "scramble":
        return normalizeLetters(input).length > 0 && normalizeLetters(input) === challenge.answer;
      case "memory":
        return /^\d+$/.test(normalizeDigits(input)) && normalizeDigits(input) === challenge.answer;
      case "odd":
        return input === challenge.answer;
      case "phrase":
        return normalizePhrase(input).length > 0 && normalizePhrase(input) === normalizePhrase(challenge.answer);
      default:
        return false;
    }
  }

  const api = { KIND_INFO, WORDS, PHRASES, EMOJI_SETS, generate, pickChallenge, nextKind, check };
  root.FocusPuzzles = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

/**
 * Math and number-sequence puzzle generators for the guard.
 * Answers use normal operator precedence (× before + and −), so they match what people expect.
 *
 * Loaded as a classic script (content script / popup) and as a CommonJS module (tests).
 */
(function (root) {
  "use strict";

  const OPERATORS = ["+", "-", "*"];
  const MIN_OPERAND = 1;
  const MAX_OPERAND = 10;
  const MAX_DIFFICULTY = 6;

  function randomInt(random, min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function pick(random, items) {
    return items[Math.floor(random() * items.length)];
  }

  /** Evaluates tokens [n, op, n, op, n...] honouring * before + and -. */
  function evaluate(numbers, operators) {
    const terms = [numbers[0]];
    const signs = [];
    operators.forEach((op, i) => {
      const next = numbers[i + 1];
      if (op === "*") {
        terms[terms.length - 1] = terms[terms.length - 1] * next;
      } else {
        signs.push(op);
        terms.push(next);
      }
    });
    return terms.slice(1).reduce((acc, term, i) => (signs[i] === "+" ? acc + term : acc - term), terms[0]);
  }

  function clampDifficulty(difficulty) {
    const level = Number.isFinite(difficulty) ? Math.floor(difficulty) : 1;
    return Math.min(Math.max(level, 1), MAX_DIFFICULTY);
  }

  /**
   * @param {number} difficulty 1 = "a op b", each level adds one more operation.
   * @param {() => number} [random] injectable RNG for tests.
   * @returns {{ text: string, answer: number }}
   */
  function generatePuzzle(difficulty, random = Math.random) {
    const level = clampDifficulty(difficulty);
    const numbers = [randomInt(random, MIN_OPERAND, MAX_OPERAND)];
    const operators = [];
    for (let i = 0; i < level; i++) {
      operators.push(pick(random, OPERATORS));
      numbers.push(randomInt(random, MIN_OPERAND, MAX_OPERAND));
    }
    const text = numbers
      .map((n, i) => (i === 0 ? String(n) : `${operators[i - 1] === "*" ? "×" : operators[i - 1]} ${n}`))
      .join(" ");
    return { text, answer: evaluate(numbers, operators) };
  }

  const SEQUENCE_TERMS = 4;

  /**
   * "What comes next?" puzzle. Easy levels add a constant; from level 3 it may multiply instead.
   * @returns {{ kind: "sequence", text: string, answer: number, prompt: string }}
   */
  function generateSequence(difficulty, random = Math.random) {
    const level = clampDifficulty(difficulty);
    const geometric = level >= 3 && random() < 0.5;
    const start = geometric ? randomInt(random, 1, 5) : randomInt(random, 1, 10 * level);
    const step = geometric ? randomInt(random, 2, 3) : randomInt(random, 2, 3 + 2 * level);
    const terms = [start];
    for (let i = 1; i <= SEQUENCE_TERMS; i++) {
      terms.push(geometric ? terms[i - 1] * step : terms[i - 1] + step);
    }
    const answer = terms.pop();
    return { kind: "sequence", text: `${terms.join(", ")}, ?`, answer, prompt: "What comes next?" };
  }

  /** Difficulty rises by one every `stepEvery` shorts watched this session. */
  function difficultyFor(shortsThisSession, stepEvery) {
    const step = Math.max(1, Math.floor(stepEvery) || 1);
    return clampDifficulty(Math.floor(Math.max(0, shortsThisSession) / step) + 1);
  }

  function isCorrect(input, answer) {
    const trimmed = String(input ?? "").trim();
    if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return false;
    return Number(trimmed) === answer;
  }

  const api = { generatePuzzle, generateSequence, difficultyFor, isCorrect, evaluate, MAX_DIFFICULTY };
  root.FocusCaptcha = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

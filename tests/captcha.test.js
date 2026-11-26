const test = require("node:test");
const assert = require("node:assert/strict");
const { generatePuzzle, difficultyFor, isCorrect, evaluate, MAX_DIFFICULTY } = require("../src/lib/captcha.js");

/** Deterministic RNG that cycles through the given values. */
function sequence(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("evaluate applies multiplication before addition", () => {
  assert.equal(evaluate([2, 3, 4], ["+", "*"]), 14);
  assert.equal(evaluate([10, 2, 3], ["-", "*"]), 4);
  assert.equal(evaluate([5, 2, 3], ["-", "-"]), 0);
  assert.equal(evaluate([2, 3, 4], ["*", "*"]), 24);
});

test("generatePuzzle answer matches the displayed expression", () => {
  for (let level = 1; level <= MAX_DIFFICULTY; level++) {
    for (let run = 0; run < 200; run++) {
      const { text, answer } = generatePuzzle(level);
      const jsExpr = text.replace(/×/g, "*");
      // eslint-disable-next-line no-new-func
      assert.equal(answer, Function(`return (${jsExpr})`)(), `level ${level}: ${text}`);
      assert.equal(text.split(" ").length, 2 * level + 1);
    }
  }
});

test("generatePuzzle is deterministic with an injected RNG", () => {
  const a = generatePuzzle(2, sequence([0.1, 0.5, 0.3, 0.9, 0.7]));
  const b = generatePuzzle(2, sequence([0.1, 0.5, 0.3, 0.9, 0.7]));
  assert.deepEqual(a, b);
});

test("generatePuzzle clamps out-of-range difficulty", () => {
  assert.equal(generatePuzzle(0).text.split(" ").length, 3);
  assert.equal(generatePuzzle(NaN).text.split(" ").length, 3);
  assert.equal(generatePuzzle(99).text.split(" ").length, 2 * MAX_DIFFICULTY + 1);
});

test("difficultyFor steps up every N shorts", () => {
  assert.equal(difficultyFor(0, 3), 1);
  assert.equal(difficultyFor(2, 3), 1);
  assert.equal(difficultyFor(3, 3), 2);
  assert.equal(difficultyFor(9, 3), 4);
  assert.equal(difficultyFor(1000, 1), MAX_DIFFICULTY);
  assert.equal(difficultyFor(5, 0), MAX_DIFFICULTY);
  assert.equal(difficultyFor(-4, 3), 1);
});

test("isCorrect accepts only an exact integer answer", () => {
  assert.equal(isCorrect("14", 14), true);
  assert.equal(isCorrect(" -3 ", -3), true);
  assert.equal(isCorrect("", 0), false);
  assert.equal(isCorrect("14.0", 14), false);
  assert.equal(isCorrect("1e1", 10), false);
  assert.equal(isCorrect(null, 0), false);
  assert.equal(isCorrect("13", 14), false);
});

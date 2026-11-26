const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePuzzle,
  generateSequence,
  generateChallenge,
  difficultyFor,
  isCorrect,
  evaluate,
  MAX_DIFFICULTY,
} = require("../src/lib/captcha.js");

test("generateSequence answer continues the shown pattern", () => {
  for (let level = 1; level <= MAX_DIFFICULTY; level++) {
    for (let run = 0; run < 200; run++) {
      const { kind, text, answer } = generateSequence(level);
      assert.equal(kind, "sequence");
      const nums = text.replace(", ?", "").split(", ").map(Number);
      assert.equal(nums.length, 4);
      const diffs = nums.slice(1).map((n, i) => n - nums[i]);
      const ratios = nums.slice(1).map((n, i) => n / nums[i]);
      const additive = diffs.every((d) => d === diffs[0]);
      const multiplicative = ratios.every((r) => r === ratios[0]);
      assert.ok(additive || multiplicative, `pattern unclear: ${text}`);
      const expected = additive ? nums[3] + diffs[0] : nums[3] * ratios[0];
      assert.equal(answer, expected, text);
    }
  }
});

test("easy sequences only add; geometric ones appear from level 3", () => {
  const kinds = new Set();
  for (let i = 0; i < 300; i++) {
    const nums = generateSequence(1).text.replace(", ?", "").split(", ").map(Number);
    assert.equal(nums[1] - nums[0], nums[2] - nums[1]);
    const hard = generateSequence(4).text.replace(", ?", "").split(", ").map(Number);
    kinds.add(hard[1] - hard[0] === hard[2] - hard[1] ? "add" : "multiply");
  }
  assert.deepEqual([...kinds].sort(), ["add", "multiply"]);
});

test("generateChallenge mixes math and sequence puzzles", () => {
  const kinds = new Set();
  for (let i = 0; i < 200; i++) {
    const c = generateChallenge(2);
    kinds.add(c.kind);
    assert.equal(typeof c.prompt, "string");
    assert.ok(c.text.endsWith("?"));
  }
  assert.deepEqual([...kinds].sort(), ["math", "sequence"]);
});

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

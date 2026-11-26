const test = require("node:test");
const assert = require("node:assert/strict");
const Z = require("../src/lib/puzzles.js");
const { PUZZLE_KINDS } = require("../src/lib/settings.js");

const LEVELS = [1, 2, 3, 4, 5, 6];
const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

test("every settings kind has a generator and picker info", () => {
  for (const kind of PUZZLE_KINDS) {
    assert.ok(Z.KIND_INFO[kind], `info for ${kind}`);
    const c = Z.generate(kind, 1);
    assert.equal(c.kind, kind);
    for (const field of ["prompt", "answer", "input"]) assert.equal(typeof c[field], "string", `${kind}.${field}`);
  }
});

test("each kind accepts its own answer and rejects a wrong one", () => {
  for (const kind of PUZZLE_KINDS) {
    for (const level of LEVELS) {
      repeat(50, () => {
        const c = Z.generate(kind, level);
        assert.equal(Z.check(c, c.answer), true, `${kind} L${level} accepts ${c.answer}`);
        assert.equal(Z.check(c, ""), false, `${kind} rejects empty`);
        assert.equal(Z.check(c, "definitely wrong 999999"), false, `${kind} rejects nonsense`);
      });
    }
  }
});

test("math and sequence answers match the shown expression", () => {
  repeat(100, () => {
    const m = Z.generate("math", 3);
    const expr = m.display.replace(" = ?", "").replace(/×/g, "*");
    assert.equal(Number(m.answer), Function(`return (${expr})`)()); // eslint-disable-line no-new-func
    const s = Z.generate("sequence", 2);
    assert.ok(s.display.endsWith(", ?"));
  });
});

test("scramble is a real shuffle of a listed word and checks case-insensitively", () => {
  const allWords = Z.WORDS.flat();
  repeat(200, () => {
    const c = Z.generate("scramble", 1 + Math.floor(Math.random() * 6));
    const letters = c.display.replace(/ /g, "");
    assert.ok(allWords.includes(c.answer));
    assert.notEqual(letters, c.answer, "never shown already solved");
    assert.deepEqual([...letters].sort(), [...c.answer].sort());
    assert.equal(Z.check(c, c.answer.toLowerCase()), true);
    assert.equal(Z.check(c, ` ${c.answer.toLowerCase()} `), true);
  });
});

test("scramble words get longer with difficulty", () => {
  const avg = (level) => repeat(100, () => Z.generate("scramble", level).answer.length).reduce((a, b) => a + b) / 100;
  assert.ok(avg(1) < avg(3) && avg(3) < avg(6));
});

test("memory length grows with difficulty, hides after a delay, ignores spaces", () => {
  assert.equal(Z.generate("memory", 1).answer.length, 4);
  assert.equal(Z.generate("memory", 6).answer.length, 9);
  const c = Z.generate("memory", 2);
  assert.ok(c.hideAfterMs > 0);
  assert.match(c.answer, /^\d+$/);
  assert.equal(Z.check(c, c.answer.split("").join(" ")), true);
});

test("odd one out has exactly one item from a different set", () => {
  repeat(200, () => {
    const c = Z.generate("odd", 1 + Math.floor(Math.random() * 6));
    assert.equal(c.input, "choice");
    assert.equal(new Set(c.options).size, c.options.length, "no duplicates");
    assert.ok(c.options.includes(c.answer));
    const setOf = (e) => Z.EMOJI_SETS.findIndex((s) => s.includes(e));
    const others = c.options.filter((o) => o !== c.answer);
    assert.ok(others.every((o) => setOf(o) === setOf(others[0])), "the rest share one set");
    assert.notEqual(setOf(c.answer), setOf(others[0]));
    others.forEach((o) => assert.equal(Z.check(c, o), false));
  });
  assert.equal(Z.generate("odd", 1).options.length, 4);
  assert.equal(Z.generate("odd", 5).options.length, 5);
});

test("phrase ignores case, punctuation and extra spaces but not missing words", () => {
  const c = { kind: "phrase", answer: "I control my attention, not the algorithm" };
  assert.equal(Z.check(c, "i control my attention not the algorithm"), true);
  assert.equal(Z.check(c, "  I   control my attention, not the algorithm! "), true);
  assert.equal(Z.check(c, "I control my attention"), false);
  assert.equal(Z.generate("phrase", 1).noPaste, true);
});

test("pickChallenge only uses enabled kinds and falls back when none are valid", () => {
  const kinds = new Set(repeat(200, () => Z.pickChallenge(2, ["scramble", "odd"]).kind));
  assert.deepEqual([...kinds].sort(), ["odd", "scramble"]);
  assert.equal(Z.pickChallenge(2, ["memory"]).kind, "memory");
  const fallback = new Set(repeat(300, () => Z.pickChallenge(2, ["bogus"]).kind));
  assert.equal(fallback.size, PUZZLE_KINDS.length);
});

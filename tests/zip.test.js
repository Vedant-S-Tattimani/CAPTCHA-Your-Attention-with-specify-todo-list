const test = require("node:test");
const assert = require("node:assert/strict");
const { createZip, readZip, crc32 } = require("../tools/zip.js");

test("crc32 matches known values", () => {
  assert.equal(crc32(Buffer.from("")), 0);
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("createZip round-trips names and contents (text and binary)", () => {
  const entries = [
    { name: "manifest.json", data: Buffer.from('{"manifest_version":3}') },
    { name: "lib/tasks.js", data: Buffer.from("x".repeat(5000)) },
    { name: "icons/icon16.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) },
  ];
  const back = readZip(createZip(entries));
  assert.deepEqual(back.map((f) => f.name), entries.map((e) => e.name));
  back.forEach((f, i) => assert.ok(f.data.equals(entries[i].data), f.name));
});

test("compressible files are actually deflated", () => {
  const big = Buffer.from("focus ".repeat(10000));
  const zip = createZip([{ name: "a.txt", data: big }]);
  assert.ok(zip.length < big.length / 10);
  assert.ok(readZip(zip)[0].data.equals(big));
});

test("backslash or absolute entry names are refused", () => {
  assert.throws(() => createZip([{ name: "lib\\tasks.js", data: Buffer.from("x") }]), /Bad zip entry/);
  assert.throws(() => createZip([{ name: "/manifest.json", data: Buffer.from("x") }]), /Bad zip entry/);
});

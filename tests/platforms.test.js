const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../src/lib/platforms.js");

const { PLATFORMS: P } = F;

test("platformForHost recognises each site and ignores others", () => {
  assert.equal(F.platformForHost("www.youtube.com").id, "youtube");
  assert.equal(F.platformForHost("m.youtube.com").id, "youtube");
  assert.equal(F.platformForHost("www.instagram.com").id, "instagram");
  assert.equal(F.platformForHost("www.tiktok.com").id, "tiktok");
  assert.equal(F.platformForHost("m.facebook.com").id, "facebook");
  assert.equal(F.platformForHost("WWW.SNAPCHAT.COM").id, "snapchat");
  assert.equal(F.platformForHost("evil-youtube.com"), null);
  assert.equal(F.platformForHost(""), null);
});

test("video ids come from each platform's address format", () => {
  const cases = [
    ["youtube", "/shorts/abc123XYZ", "abc123XYZ"],
    ["youtube", "/watch", null],
    ["instagram", "/reels/C9xYz_-1Ab/", "C9xYz_-1Ab"],
    ["instagram", "/reel/C9xYz_-1Ab/", "C9xYz_-1Ab"],
    ["instagram", "/reels/", null],
    ["instagram", "/p/C9xYz/", null],
    ["tiktok", "/@someone/video/7312345678901234567", "7312345678901234567"],
    ["tiktok", "/foryou", null],
    ["facebook", "/reel/1234567890123", "1234567890123"],
    ["facebook", "/reels/", null],
    ["snapchat", "/@noe1-9/spotlight/W7_EDlXWTBiXAEEni", "W7_EDlXWTBiXAEEni"],
    ["snapchat", "/spotlight/W7_EDlXWTBi", "W7_EDlXWTBi"],
    ["snapchat", "/spotlight", null],
  ];
  for (const [id, path, expected] of cases) {
    assert.equal(F.videoIdFromPath(P[id], path), expected, `${id} ${path}`);
  }
  assert.equal(F.videoIdFromPath(null, "/shorts/x"), null);
});

test("only TikTok feed pages use on-screen video detection", () => {
  assert.equal(F.isScrollFeed(P.tiktok, "/foryou"), true);
  assert.equal(F.isScrollFeed(P.tiktok, "/foryou/"), true);
  assert.equal(F.isScrollFeed(P.tiktok, "/"), true);
  assert.equal(F.isScrollFeed(P.tiktok, "/@someone"), false);
  assert.equal(F.isScrollFeed(P.youtube, "/"), false);
  assert.equal(F.isScrollFeed(P.instagram, "/reels/"), false);
});

test("dominantVideo picks the video covering most of the screen", () => {
  const vh = 800;
  assert.equal(
    F.dominantVideo(
      [
        { key: "a", top: -700, bottom: 100, playing: false },
        { key: "b", top: 100, bottom: 900, playing: true },
      ],
      vh
    ),
    "b"
  );
  assert.equal(F.dominantVideo([{ key: "a", top: 500, bottom: 1300, playing: true }], vh), null, "under half visible");
  assert.equal(F.dominantVideo([], vh), null);
  assert.equal(
    F.dominantVideo(
      [
        { key: "a", top: 0, bottom: 800, playing: false },
        { key: "b", top: 0, bottom: 800, playing: true },
      ],
      vh
    ),
    "b",
    "tie goes to the playing video"
  );
});

test("sanitizePlatforms keeps known ids in order and always includes YouTube", () => {
  assert.deepEqual(F.sanitizePlatforms(undefined), ["youtube"]);
  assert.deepEqual(F.sanitizePlatforms(["snapchat", "bogus", "instagram"]), ["youtube", "instagram", "snapchat"]);
  assert.deepEqual(F.sanitizePlatforms(["youtube", "tiktok"]), ["youtube", "tiktok"]);
});

test("permissionOrigins: none for built-in YouTube, site patterns for the rest", () => {
  assert.deepEqual(F.permissionOrigins("youtube"), []);
  assert.deepEqual(F.permissionOrigins("instagram"), ["https://www.instagram.com/*"]);
  assert.equal(F.permissionOrigins("facebook").length, 3);
  assert.deepEqual(F.permissionOrigins("nope"), []);
});

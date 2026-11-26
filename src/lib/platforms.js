/**
 * Short-video platforms the guard supports. Each entry says where the feed lives and how to tell
 * that a new video is showing:
 *
 *   - pathPattern: the video's id is in the address (YouTube, Instagram, Facebook, Snapchat, and
 *     TikTok when a video is opened on its own page). Verified on the live sites where possible.
 *   - feedPaths + viewport detection: TikTok's For You feed keeps the same address while you
 *     scroll, so the content script watches which <video> fills the screen instead.
 *
 * Loaded as a classic script (content script / popup / worker) and CommonJS (tests).
 */
(function (root) {
  "use strict";

  const PLATFORMS = Object.freeze({
    youtube: {
      id: "youtube",
      name: "YouTube Shorts",
      short: "YouTube",
      icon: "▶️",
      unit: "Shorts",
      hosts: ["www.youtube.com", "m.youtube.com"],
      matches: ["https://www.youtube.com/*", "https://m.youtube.com/*"],
      pathPattern: /^\/shorts\/([^/?#]+)/,
      home: "https://www.youtube.com/",
      builtIn: true, // declared in the manifest, no extra permission needed
    },
    instagram: {
      id: "instagram",
      name: "Instagram Reels",
      short: "Instagram",
      icon: "📸",
      unit: "Reels",
      hosts: ["www.instagram.com"],
      matches: ["https://www.instagram.com/*"],
      pathPattern: /^\/reels?\/([A-Za-z0-9_-]+)/,
      home: "https://www.instagram.com/",
    },
    tiktok: {
      id: "tiktok",
      name: "TikTok",
      short: "TikTok",
      icon: "🎵",
      unit: "TikToks",
      hosts: ["www.tiktok.com"],
      matches: ["https://www.tiktok.com/*"],
      pathPattern: /^\/@[^/]+\/video\/(\d+)/,
      feedPaths: ["/", "/foryou", "/following", "/explore", "/friends"],
      home: "https://www.tiktok.com/messages",
    },
    facebook: {
      id: "facebook",
      name: "Facebook Reels",
      short: "Facebook",
      icon: "📘",
      unit: "Reels",
      hosts: ["www.facebook.com", "m.facebook.com", "web.facebook.com"],
      matches: ["https://www.facebook.com/*", "https://m.facebook.com/*", "https://web.facebook.com/*"],
      pathPattern: /^\/reels?\/(\d+)/,
      home: "https://www.facebook.com/",
    },
    snapchat: {
      id: "snapchat",
      name: "Snapchat Spotlight",
      short: "Snapchat",
      icon: "👻",
      unit: "Spotlights",
      hosts: ["www.snapchat.com"],
      matches: ["https://www.snapchat.com/*"],
      // Verified: /@user/spotlight/<id> (also /spotlight/<id>)
      pathPattern: /^(?:\/@[^/]+)?\/spotlight\/([^/?#]+)/,
      home: "https://www.snapchat.com/",
    },
  });

  const PLATFORM_IDS = Object.freeze(Object.keys(PLATFORMS));

  /** Which platform a hostname belongs to, or null. */
  function platformForHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return PLATFORM_IDS.map((id) => PLATFORMS[id]).find((p) => p.hosts.includes(host)) || null;
  }

  /** Video id from the address, or null. */
  function videoIdFromPath(platform, pathname) {
    const match = platform?.pathPattern ? String(pathname || "").match(platform.pathPattern) : null;
    return match ? match[1] : null;
  }

  /** True on a feed page where the address doesn't change per video (TikTok's For You). */
  function isScrollFeed(platform, pathname) {
    if (!platform?.feedPaths) return false;
    const path = String(pathname || "/").replace(/\/+$/, "") || "/";
    return platform.feedPaths.includes(path);
  }

  /**
   * The video that fills most of the screen, given each video's visible box.
   * @param {{ key: string, top: number, bottom: number, playing: boolean }[]} boxes
   * @param {number} viewportHeight
   * @returns {string | null} that video's key when it covers at least half the screen
   */
  function dominantVideo(boxes, viewportHeight) {
    let best = null;
    let bestVisible = 0;
    boxes.forEach((box) => {
      const visible = Math.max(0, Math.min(box.bottom, viewportHeight) - Math.max(box.top, 0));
      if (visible > bestVisible || (visible === bestVisible && box.playing)) {
        best = box;
        bestVisible = visible;
      }
    });
    return best && bestVisible >= viewportHeight * 0.5 ? best.key : null;
  }

  /** Known platform ids in display order; YouTube is always included. */
  function sanitizePlatforms(value) {
    const chosen = Array.isArray(value) ? PLATFORM_IDS.filter((id) => value.includes(id)) : [];
    return chosen.includes("youtube") ? chosen : ["youtube", ...chosen];
  }

  /** Origins to request from Chrome for a platform (none for built-in YouTube). */
  function permissionOrigins(platformId) {
    const p = PLATFORMS[platformId];
    return p && !p.builtIn ? [...p.matches] : [];
  }

  const api = {
    PLATFORMS,
    PLATFORM_IDS,
    platformForHost,
    videoIdFromPath,
    isScrollFeed,
    dominantVideo,
    sanitizePlatforms,
    permissionOrigins,
  };
  root.FocusPlatforms = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

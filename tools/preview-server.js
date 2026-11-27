#!/usr/bin/env node
/**
 * Tiny static server for store/design pages and the popup preview (used to render screenshots).
 * Serves the project folder on http://127.0.0.1:5178 and builds the popup preview on request.
 *
 *   node tools/preview-server.js
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildPopupPreview } = require("./popup-preview.js");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 5178;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/popup-preview.html") {
      res.writeHead(200, { "content-type": TYPES[".html"] });
      res.end(buildPopupPreview());
      return;
    }
    const file = path.join(ROOT, urlPath === "/" ? "store/design/screenshot.html" : urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`preview server on http://127.0.0.1:${PORT}`));

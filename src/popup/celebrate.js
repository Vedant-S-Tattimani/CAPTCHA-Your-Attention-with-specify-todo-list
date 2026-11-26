/* Small confetti burst for finished tasks and sessions. Skipped when the user prefers reduced motion. */
(function () {
  "use strict";

  const COLORS = ["#d9480f", "#f59f00", "#37b24d", "#4c6ef5", "#e64980"];
  const PIECES = 70;
  const DURATION_MS = 1400;
  const GRAVITY = 0.18;

  function celebrate(originEl) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas.remove();

    const box = originEl?.getBoundingClientRect();
    const ox = box ? box.left + box.width / 2 : canvas.width / 2;
    const oy = box ? box.top + box.height / 2 : canvas.height / 3;
    const pieces = Array.from({ length: PIECES }, () => ({
      x: ox,
      y: oy,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      size: 4 + Math.random() * 4,
      spin: Math.random() * Math.PI,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const start = performance.now();
    function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.max(0, 1 - t / DURATION_MS);
      pieces.forEach((p) => {
        p.vy += GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });
      if (t < DURATION_MS) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  globalThis.FocusCelebrate = { celebrate };
})();

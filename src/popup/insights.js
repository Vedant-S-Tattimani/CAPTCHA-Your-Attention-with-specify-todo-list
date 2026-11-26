/* Insights tab: level card, Focus Garden and 7-day charts. Pure DOM/SVG, no libraries. */
(function () {
  "use strict";

  const G = globalThis.FocusProgress;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DAYS = 7;

  function svg(tag, attrs = {}, children = []) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    node.append(...children);
    return node;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  /* ---------- Focus Garden ---------- */

  /** One plant drawn in a 40×56 box. Stage 0 = bare soil, 4 = in bloom. */
  function plant(stage) {
    const parts = [svg("ellipse", { cx: 20, cy: 52, rx: 15, ry: 4, class: "soil" })];
    if (stage === 0) {
      parts.push(svg("circle", { cx: 20, cy: 49, r: 1.6, class: "seed" }));
      return parts;
    }
    const height = [0, 12, 22, 32, 38][stage];
    parts.push(svg("path", { d: `M20 50 Q${stage % 2 ? 18 : 22} ${50 - height / 2} 20 ${50 - height}`, class: "stem" }));
    const leaves = Math.min(stage + 1, 4);
    for (let i = 0; i < leaves; i++) {
      const y = 46 - (i * height) / leaves;
      const side = i % 2 === 0 ? -1 : 1;
      const size = 7 - i * 0.6;
      parts.push(
        svg("path", {
          d: `M20 ${y} q${side * size} ${-size * 0.9} ${side * size * 1.6} ${-size * 0.2} q${-side * size * 0.6} ${size * 0.8} ${-side * size * 1.6} ${size * 0.2}z`,
          class: "leaf",
        })
      );
    }
    if (stage === 4) {
      const top = 50 - height;
      [0, 72, 144, 216, 288].forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        parts.push(svg("circle", { cx: 20 + Math.cos(rad) * 4, cy: top + Math.sin(rad) * 4, r: 3.2, class: "petal" }));
      });
      parts.push(svg("circle", { cx: 20, cy: top, r: 2.6, class: "bloom-center" }));
    }
    return parts;
  }

  function garden(days, goal) {
    const plots = days.map((day) => {
      const stage = G.plantStage(day.sessions, goal);
      const box = svg("svg", { viewBox: "0 0 40 56", class: `plant stage-${stage}`, "aria-hidden": "true" }, plant(stage));
      const plot = el("li", { className: `plot${day.isToday ? " today" : ""}` }, [
        box,
        el("span", { className: "plot-day", textContent: day.isToday ? "Today" : day.label }),
      ]);
      plot.title = `${day.label}: ${day.sessions} focus session${day.sessions === 1 ? "" : "s"}`;
      return plot;
    });
    const list = el("ul", { className: "garden" }, plots);
    list.setAttribute("aria-label", "Focus garden: one plant per day, it grows with each focus session");
    return list;
  }

  /* ---------- Bar charts (small multiples, one measure each) ---------- */

  const CHART = { width: 328, height: 92, top: 14, bottom: 18, gap: 10 };

  /** Bar path with 4px rounded top corners, square at the baseline. */
  function barPath(x, y, w, h) {
    const r = Math.min(4, w / 2, h);
    return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
  }

  function barChart({ days, field, label, unit, seriesClass }) {
    const plotH = CHART.height - CHART.top - CHART.bottom;
    const max = Math.max(1, ...days.map((d) => d[field]));
    const slot = CHART.width / days.length;
    const barW = slot - CHART.gap;
    const baseline = CHART.top + plotH;
    const tooltip = el("div", { className: "chart-tip", hidden: true });

    const columns = days.map((day, i) => {
      const value = day[field];
      const h = value > 0 ? Math.max(3, (value / max) * plotH) : 0;
      const x = i * slot + CHART.gap / 2;
      const text = `${day.isToday ? "Today" : day.label}: ${value} ${unit}`;
      const group = svg("g", { class: "col", tabindex: 0, role: "img", "aria-label": text }, [
        svg("rect", { x: i * slot, y: 0, width: slot, height: CHART.height, class: "hit" }),
        h > 0 ? svg("path", { d: barPath(x, baseline - h, barW, h), class: `bar ${seriesClass}` }) : svg("g"),
        svg("text", { x: x + barW / 2, y: CHART.height - 4, class: `axis-label${day.isToday ? " is-today" : ""}` }, [
          document.createTextNode(day.isToday ? "Today" : day.label.slice(0, 2)),
        ]),
      ]);
      const show = () => {
        tooltip.textContent = text;
        tooltip.hidden = false;
        tooltip.style.left = `${Math.min(Math.max(x + barW / 2, 50), CHART.width - 50)}px`;
      };
      group.addEventListener("mouseenter", show);
      group.addEventListener("focus", show);
      group.addEventListener("mouseleave", () => (tooltip.hidden = true));
      group.addEventListener("blur", () => (tooltip.hidden = true));
      return group;
    });

    const total = days.reduce((sum, d) => sum + d[field], 0);
    const chart = svg("svg", { viewBox: `0 0 ${CHART.width} ${CHART.height}`, class: "chart" }, [
      svg("line", { x1: 0, x2: CHART.width, y1: baseline + 0.5, y2: baseline + 0.5, class: "baseline" }),
      ...columns,
    ]);
    return el("figure", { className: "chart-card" }, [
      el("figcaption", {}, [
        el("span", { className: `swatch ${seriesClass}` }),
        el("span", { className: "chart-title", textContent: label }),
        el("span", { className: "chart-total", textContent: `${total} ${unit} this week` }),
      ]),
      el("div", { className: "chart-wrap" }, [chart, tooltip]),
    ]);
  }

  /* ---------- Level card ---------- */

  function levelCard(log, streakDays) {
    const info = G.levelFor(G.xpFor(G.totals(log)));
    const bar = el("div", { className: "xp-bar" }, [el("span", { className: "xp-fill" })]);
    bar.firstChild.style.width = `${Math.round(info.progress * 100)}%`;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(Math.round(info.progress * 100)));
    bar.setAttribute("aria-label", "Progress to next level");
    const next = info.nextXp ? `${info.nextXp - info.xp} XP to level ${info.level + 1}` : "Max level reached";
    return el("section", { className: "level-card" }, [
      el("div", { className: "level-badge", textContent: String(info.level) }),
      el("div", { className: "level-body" }, [
        el("div", { className: "level-title", textContent: info.title }),
        bar,
        el("div", { className: "level-meta", textContent: `${info.xp} XP · ${next}` }),
      ]),
      el("div", { className: "streak-big" }, [
        el("span", { className: "flame", textContent: streakDays > 0 ? "🔥" : "🌑" }),
        el("strong", { textContent: String(streakDays) }),
        el("small", { textContent: streakDays === 1 ? "day streak" : "days streak" }),
      ]),
    ]);
  }

  /**
   * Renders the whole Insights tab into `container`.
   * @param {HTMLElement} container
   * @param {{ log: object, goal: number, today: string }} data
   */
  function render(container, { log, goal, today }) {
    const days = G.lastDays(log, today, DAYS);
    const streakDays = G.streak(log, today);
    const todayDay = days[days.length - 1];
    container.replaceChildren(
      levelCard(log, streakDays),
      el("h2", { textContent: "Focus garden" }),
      el("p", {
        className: "hint-left",
        textContent: `Each plant grows with that day's focus sessions and blooms at your goal of ${goal}. Today: ${todayDay.sessions}/${goal}.`,
      }),
      garden(days, goal),
      el("h2", { textContent: "This week" }),
      barChart({ days, field: "focusMinutes", label: "Focus minutes", unit: "min", seriesClass: "s-focus" }),
      barChart({ days, field: "shorts", label: "Shorts watched", unit: "shorts", seriesClass: "s-shorts" })
    );
  }

  globalThis.FocusInsights = { render };
})();

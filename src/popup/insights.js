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

  /** Drawn flame (outer + inner). Coloured by CSS: grey when the streak is 0, berry/yellow when lit. */
  function flame() {
    return svg("svg", { viewBox: "0 0 24 24", class: "flame", "aria-hidden": "true" }, [
      svg("path", {
        class: "flame-outer",
        d: "M12 22c-4.4 0-8-3.1-8-7.5 0-3.1 1.9-5.4 3.6-7.2.4 1.6 1.2 2.8 2.4 3.4C9.6 7 11.3 4.1 14 2c.3 3.3 2 5.2 3.6 7 1.4 1.6 2.4 3.3 2.4 5.5C20 18.9 16.4 22 12 22z",
      }),
      svg("path", {
        class: "flame-inner",
        d: "M12 20c-1.9 0-3.3-1.3-3.3-3.1 0-1.6 1-2.6 2-3.6.1 1 .6 1.6 1.3 1.9.2-1.7 1-3 2.1-3.9.2 1.7 1.2 2.8 1.2 4.6 0 2.4-1.5 4.1-3.3 4.1z",
      }),
    ]);
  }

  function xpSection(info) {
    const pct = Math.round(info.progress * 100);
    const fill = el("span", { className: "xp-fill" });
    fill.style.width = `${pct}%`;
    const bar = el("div", { className: "xp-bar" }, [fill]);
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(pct));
    bar.setAttribute("aria-label", info.nextTitle ? `Progress to ${info.nextTitle}` : "Max level reached");

    const left = info.nextXp ? `${info.xp} / ${info.nextXp} XP` : `${info.xp} XP`;
    const right = info.nextTitle
      ? [`${info.nextXp - info.xp} XP to `, el("strong", { textContent: info.nextTitle })]
      : ["Max level 🏆"];
    return el("div", { className: "xp" }, [
      el("div", { className: "xp-labels" }, [el("span", { textContent: left }), el("span", {}, right)]),
      bar,
    ]);
  }

  /** Flame, count and the last 7 days as small squares (filled = focused that day). */
  function streakSection(streakDays, days) {
    const lit = streakDays > 0;
    const week = el(
      "ol",
      { className: "week-dots" },
      days.map((day) => {
        const dot = el("li", { className: `week-dot${day.sessions > 0 ? " on" : ""}${day.isToday ? " today" : ""}` });
        dot.title = `${day.isToday ? "Today" : day.label}: ${day.sessions > 0 ? "focused" : "no session"}`;
        return dot;
      })
    );
    const section = el("div", { className: `streak${lit ? " lit" : ""}` }, [
      el("div", { className: "streak-count" }, [flame(), el("strong", { textContent: String(streakDays) })]),
      el("small", { textContent: "day streak" }),
      week,
    ]);
    section.setAttribute("aria-label", `${streakDays}-day focus streak`);
    return section;
  }

  function levelCard(log, streakDays, days) {
    const info = G.levelFor(G.xpFor(G.totals(log)));
    return el("section", { className: "level-card" }, [
      el("div", { className: "level-badge" }, [
        el("span", { textContent: "LV" }),
        el("strong", { textContent: String(info.level) }),
      ]),
      el("div", { className: "level-head" }, [
        el("div", { className: "level-title", textContent: info.title }),
        el("div", { className: "level-sub", textContent: `Level ${info.level} of ${info.maxLevel}` }),
      ]),
      streakSection(streakDays, days),
      xpSection(info),
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
      levelCard(log, streakDays, days),
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

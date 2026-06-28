/**
 * Native SVG charts — no charting libraries.
 *
 *   - buildXpLineChart(series): cumulative XP over time (area + line). Rebuilt
 *     on every filter change; its internal scales adapt to the data volume so
 *     the line gracefully scales up or down.
 *   - buildAuditChart({up, down}): audits done vs received, with a parity (1.0)
 *     reference line.
 *
 * Everything is built with createElementNS so the SVG is real DOM (enabling CSS
 * hover/animation and ARIA).
 */

import { formatXp, formatMonthYear, formatDay } from '../utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes + children. */
function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const c of children) node.appendChild(c);
  return node;
}

function text(value) {
  return document.createTextNode(String(value));
}

function withEmpty(svg, W, H, message) {
  svg.appendChild(
    el('text', { x: W / 2, y: H / 2, class: 'chart__empty', 'text-anchor': 'middle' }, [
      text(message),
    ])
  );
  return svg;
}

/* ------------------------------------------------------------------------ *
 * Graph 1 — XP progress over time (line / area chart)
 * ------------------------------------------------------------------------ */

/**
 * @param {Array<{date: Date, cumulative: number, value: number, path?: string}>} series
 * @returns {SVGSVGElement}
 */
export function buildXpLineChart(series) {
  const W = 720;
  const H = 340;
  const m = { top: 24, right: 24, bottom: 44, left: 66 };
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'chart chart--line',
    role: 'img',
    'aria-label': 'Line chart of cumulative XP earned over time',
  });

  if (!series.length) return withEmpty(svg, W, H, 'No XP for this selection');

  // Index-based X: points are evenly spaced in chronological order, so the
  // final point is always the most recent transaction sitting at the far right.
  const n = series.length;
  const yMax = series[n - 1].cumulative || 1;

  const xAt = (i) => m.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yScale = (v) => m.top + innerH - (v / yMax) * innerH;

  // --- Grid + Y axis labels (5 ticks) ---
  const gGrid = el('g', { class: 'chart__grid' });
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = yScale(v);
    gGrid.appendChild(
      el('line', { x1: m.left, y1: y, x2: m.left + innerW, y2: y, class: 'chart__gridline' })
    );
    gGrid.appendChild(
      el('text', { x: m.left - 10, y: y + 4, class: 'chart__label chart__label--y' }, [
        text(formatXp(v)),
      ])
    );
  }
  svg.appendChild(gGrid);

  // --- X axis labels (start, middle, end) ---
  const gx = el('g', { class: 'chart__axis-x' });
  const idxs = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];
  idxs.forEach((idx) => {
    const p = series[idx];
    gx.appendChild(
      el('text', { x: xAt(idx), y: H - 14, class: 'chart__label chart__label--x' }, [
        text(formatMonthYear(p.date)),
      ])
    );
  });
  svg.appendChild(gx);

  // --- Area + line paths ---
  const linePoints = series.map((p, i) => `${xAt(i)},${yScale(p.cumulative)}`);
  const lineD = 'M' + linePoints.join(' L');
  const areaD = `M${xAt(0)},${yScale(0)} L` + linePoints.join(' L') + ` L${xAt(n - 1)},${yScale(0)} Z`;

  svg.appendChild(el('path', { d: areaD, class: 'chart__area' }));
  svg.appendChild(el('path', { d: lineD, class: 'chart__line' }));

  // --- Interactive points with native <title> tooltips ---
  const gDots = el('g', { class: 'chart__dots' });
  series.forEach((p, i) => {
    const isLast = i === n - 1;
    const cx = xAt(i);
    const cy = yScale(p.cumulative);
    const dot = el('circle', {
      cx,
      cy,
      r: isLast ? 5 : 3.5,
      class: isLast ? 'chart__dot chart__dot--last' : 'chart__dot',
      tabindex: '0',
    });
    const label = `${formatDay(p.date)} · ${formatXp(p.cumulative)} total`;
    dot.appendChild(el('title', {}, [text(label)]));
    dot.setAttribute('aria-label', label);
    gDots.appendChild(dot);
  });
  svg.appendChild(gDots);

  return svg;
}

/* ------------------------------------------------------------------------ *
 * Graph 2 — Audits done vs received (bar chart + parity reference line)
 * ------------------------------------------------------------------------ */

/**
 * @param {{ up: number, down: number }} param0
 * @returns {SVGSVGElement}
 */
export function buildAuditChart({ up = 0, down = 0 } = {}) {
  const W = 560;
  const H = 320;
  const m = { top: 30, right: 28, bottom: 48, left: 66 };
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;

  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'chart chart--audit',
    role: 'img',
    'aria-label': `Audits done (${Math.round(up)}) versus received (${Math.round(down)})`,
  });

  if (!up && !down) return withEmpty(svg, W, H, 'No audit activity yet');

  const yMax = Math.max(up, down, 1);
  const yScale = (v) => m.top + innerH - (v / yMax) * innerH;

  // --- Grid + Y labels ---
  const ticks = 4;
  const gGrid = el('g', { class: 'chart__grid' });
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax / ticks) * i;
    const y = yScale(v);
    gGrid.appendChild(
      el('line', { x1: m.left, y1: y, x2: m.left + innerW, y2: y, class: 'chart__gridline' })
    );
    gGrid.appendChild(
      el('text', { x: m.left - 10, y: y + 4, class: 'chart__label chart__label--y' }, [
        text(formatXp(v)),
      ])
    );
  }
  svg.appendChild(gGrid);

  // --- Bars ---
  const bars = [
    { label: 'Done (up)', value: up, cls: 'is-up' },
    { label: 'Received (down)', value: down, cls: 'is-down' },
  ];
  const slot = innerW / bars.length;
  const barW = Math.min(120, slot * 0.5);

  bars.forEach((b, i) => {
    const h = (b.value / yMax) * innerH;
    const x = m.left + slot * i + (slot - barW) / 2;
    const y = m.top + innerH - h;

    const rect = el('rect', {
      x,
      y,
      width: barW,
      height: h,
      rx: 8,
      class: `chart__bar ${b.cls}`,
      tabindex: '0',
      'aria-label': `${b.label}: ${formatXp(b.value)}`,
    });
    rect.appendChild(el('title', {}, [text(`${b.label}: ${formatXp(b.value)}`)]));
    rect.style.transformOrigin = `${x}px ${m.top + innerH}px`;
    svg.appendChild(rect);

    svg.appendChild(
      el('text', { x: x + barW / 2, y: y - 10, class: 'chart__bar-value' }, [text(formatXp(b.value))])
    );
    svg.appendChild(
      el('text', { x: x + barW / 2, y: H - 16, class: 'chart__label chart__label--cat' }, [
        text(b.label),
      ])
    );
  });

  // --- Parity (ratio 1.0) reference line at the "received" level ---
  if (down > 0) {
    const y = yScale(down);
    svg.appendChild(
      el('line', { x1: m.left, y1: y, x2: m.left + innerW, y2: y, class: 'chart__refline' })
    );
    svg.appendChild(
      el('text', { x: m.left + innerW, y: y - 6, class: 'chart__refline-label', 'text-anchor': 'end' }, [
        text('parity 1.0'),
      ])
    );
  }

  return svg;
}

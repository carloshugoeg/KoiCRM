// Helpers de SVG para el reporte. Todo se dibuja a mano: sin dependencias,
// sin fetch en tiempo de render, y con geometria estable al imprimir a PDF.

export const C = {
  surface: '#ffffff',
  plane: '#f9f9f7',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  s1: '#2a78d6', // azul
  s2: '#eb6834', // naranja
  s3: '#1baf7a', // aqua
  s4: '#eda100', // amarillo
  s5: '#e87ba4', // magenta
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  // rampa secuencial azul (100 -> 700)
  seq: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'],
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const fmtInt = (n) => Math.round(n).toLocaleString('es-GT');
export const fmtQ = (n) => 'Q' + Math.round(n).toLocaleString('es-GT');
export const fmtQk = (n) => {
  if (n >= 1000000) return 'Q' + (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1000) return 'Q' + Math.round(n / 1000) + 'k';
  return 'Q' + Math.round(n);
};
export const fmtPct = (n, d = 0) => n.toFixed(d) + '%';

// Tamano explicito en px: al imprimir, el SVG no debe reescalarse ni crecer
// respecto de la altura con la que se calculo el layout de la pagina.
function svg(w, h, body, cls = '') {
  return `<svg class="chart ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">${body}</svg>`;
}

function txt(x, y, s, { size = 11, fill = C.ink2, anchor = 'start', weight = 400, tab = false } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${tab ? ' style="font-variant-numeric:tabular-nums"' : ''}>${esc(s)}</text>`;
}

// Barra horizontal con extremo redondeado 4px anclado a la linea base izquierda.
function barPathH(x, y, w, h, r = 4) {
  const rr = Math.min(r, Math.max(0, w));
  if (w <= 0.5) return '';
  return `M${x},${y} H${x + w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h - rr} a${rr},${rr} 0 0 1 -${rr},${rr} H${x} Z`;
}
function barPathV(x, y, w, h, r = 4) {
  const rr = Math.min(r, Math.max(0, h), w / 2);
  if (h <= 0.5) return '';
  return `M${x},${y + h} V${y + rr} a${rr},${rr} 0 0 1 ${rr},-${rr} H${x + w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} V${y + h} Z`;
}

/* ---------------------------------------------------------------- barras H */
export function hBar({
  rows, width = 620, labelW = 132, valueW = 96, barH = 16, gap = 12,
  color = C.s1, fmt = fmtInt, sublabel = null, max = null, footer = null,
}) {
  const top = 4;
  const plotW = width - labelW - valueW;
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  const rowH = barH + gap;
  const h = top + rows.length * rowH + (footer ? 18 : 0);
  let b = '';
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const w = Math.max(0, (r.value / m) * plotW);
    const col = r.color || color;
    b += `<rect x="${labelW}" y="${y}" width="${plotW}" height="${barH}" fill="${C.plane}" rx="4"/>`;
    b += `<path d="${barPathH(labelW, y, w, barH)}" fill="${col}"/>`;
    b += txt(labelW - 10, y + barH / 2 + 4, r.label, { anchor: 'end', fill: C.ink, size: 11.5, weight: r.bold ? 600 : 400 });
    if (r.sub) b += txt(labelW - 10, y + barH / 2 + 15, r.sub, { anchor: 'end', fill: C.muted, size: 9 });
    b += txt(width - 4, y + barH / 2 + 4, fmt(r.value), { anchor: 'end', fill: C.ink, size: 11.5, weight: 600, tab: true });
    if (r.note) b += txt(width - 4, y + barH / 2 + 15, r.note, { anchor: 'end', fill: C.muted, size: 9, tab: true });
  });
  if (footer) b += txt(labelW, h - 4, footer, { size: 9.5, fill: C.muted });
  return svg(width, h, b);
}

/* ---------------------------------------------------------------- barras V */
export function vBar({
  rows, width = 620, height = 180, color = C.s1, fmt = fmtInt,
  showValues = true, yTicks = 4, labelEvery = 1, valueSize = 10,
}) {
  const padL = 44, padR = 8, padT = 16, padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const m = Math.max(...rows.map((r) => r.value), 1);
  const step = plotW / rows.length;
  const bw = Math.min(step * 0.62, 46);
  let b = '';
  for (let i = 0; i <= yTicks; i++) {
    const v = (m / yTicks) * i;
    const y = padT + plotH - (v / m) * plotH;
    b += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${i === 0 ? C.axis : C.grid}" stroke-width="1"/>`;
    b += txt(padL - 8, y + 3.5, fmtInt(v), { anchor: 'end', size: 9, fill: C.muted, tab: true });
  }
  rows.forEach((r, i) => {
    const x = padL + i * step + (step - bw) / 2;
    const hh = (r.value / m) * plotH;
    const y = padT + plotH - hh;
    b += `<path d="${barPathV(x, y, bw, hh)}" fill="${r.color || color}"${r.hatch ? ' opacity="0.55"' : ''}/>`;
    if (showValues && r.value > 0) b += txt(x + bw / 2, y - 5, fmt(r.value), { anchor: 'middle', size: valueSize, fill: C.ink, weight: 600, tab: true });
    if (i % labelEvery === 0) b += txt(x + bw / 2, height - 16, r.label, { anchor: 'middle', size: 9.5, fill: C.ink2 });
    if (r.sub) b += txt(x + bw / 2, height - 5, r.sub, { anchor: 'middle', size: 8.5, fill: C.muted });
  });
  return svg(width, height, b);
}

/* ------------------------------------------------------- barras apiladas % */
export function stacked100({ rows, series, width = 620, labelW = 110, barH = 20, gap = 10 }) {
  const plotW = width - labelW - 8;
  const rowH = barH + gap;
  const h = rows.length * rowH + 6;
  let b = '';
  rows.forEach((r, i) => {
    const y = 4 + i * rowH;
    const total = series.reduce((a, s) => a + (r.values[s.key] || 0), 0) || 1;
    let x = labelW;
    series.forEach((s) => {
      const v = r.values[s.key] || 0;
      if (!v) return;
      const w = (v / total) * plotW;
      b += `<rect x="${x}" y="${y}" width="${Math.max(0, w - 2)}" height="${barH}" fill="${s.color}" rx="2"/>`;
      const pct = (v / total) * 100;
      if (pct >= 9) b += txt(x + (w - 2) / 2, y + barH / 2 + 3.5, Math.round(pct) + '%', { anchor: 'middle', size: 9, fill: '#ffffff', weight: 700 });
      x += w;
    });
    b += txt(labelW - 10, y + barH / 2 + 4, r.label, { anchor: 'end', fill: C.ink, size: 11, weight: 500 });
  });
  return svg(width, h, b);
}

/* --------------------------------------------------------- linea + area */
export function lineArea({
  series, labels, width = 620, height = 190, fmt = fmtInt,
  yTicks = 4, markLast = null, partialFrom = null,
}) {
  const padL = 40, padR = 12, padT = 18, padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const all = series.flatMap((s) => s.values);
  const m = Math.max(...all, 1);
  const n = labels.length;
  const X = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v) => padT + plotH - (v / m) * plotH;
  let b = '';
  for (let i = 0; i <= yTicks; i++) {
    const v = (m / yTicks) * i;
    const y = Y(v);
    b += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${i === 0 ? C.axis : C.grid}" stroke-width="1"/>`;
    b += txt(padL - 8, y + 3.5, fmtInt(v), { anchor: 'end', size: 9, fill: C.muted, tab: true });
  }
  if (partialFrom != null) {
    const x0 = X(partialFrom) - (plotW / (n - 1)) * 0.5;
    b += `<rect x="${x0}" y="${padT}" width="${width - padR - x0}" height="${plotH}" fill="${C.plane}"/>`;
    b += txt(width - padR - 4, padT + plotH - 6, 'semana parcial', { anchor: 'end', size: 8.5, fill: C.muted });
  }
  series.forEach((s) => {
    const pts = s.values.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
    if (s.area) b += `<polygon points="${padL},${Y(0)} ${pts} ${X(n - 1)},${Y(0)}" fill="${s.color}" opacity="0.10"/>`;
    b += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.values.forEach((v, i) => {
      b += `<circle cx="${X(i)}" cy="${Y(v)}" r="4.5" fill="${s.color}" stroke="${C.surface}" stroke-width="2"/>`;
    });
  });
  // etiquetas directas solo en puntos clave, nunca en todos
  if (markLast) {
    markLast.forEach(({ si, i, dy = -12, anchor = 'middle' }) => {
      const s = series[si];
      b += txt(X(i), Y(s.values[i]) + dy, fmt(s.values[i]), { anchor, size: 10.5, fill: C.ink, weight: 700, tab: true });
    });
  }
  labels.forEach((l, i) => {
    b += txt(X(i), height - 18, l, { anchor: 'middle', size: 9.5, fill: C.ink2 });
  });
  return svg(width, height, b);
}

/* ------------------------------------------------------------------ embudo */
export function funnel({ stages, width = 620, rowH = 34, gap = 6 }) {
  const labelW = 116, valueW = 150;
  const plotW = width - labelW - valueW;
  const m = Math.max(...stages.map((s) => s.deals), 1);
  const h = stages.length * (rowH + gap);
  let b = '';
  stages.forEach((s, i) => {
    const y = i * (rowH + gap);
    const w = Math.max(3, (s.deals / m) * plotW);
    b += `<rect x="${labelW}" y="${y}" width="${plotW}" height="${rowH}" fill="${C.plane}" rx="4"/>`;
    b += `<path d="${barPathH(labelW, y, w, rowH)}" fill="${s.color}"/>`;
    const yTop = y + rowH / 2 - 2, ySub = y + rowH / 2 + 10, yMid = y + rowH / 2 + 4;
    b += txt(labelW - 10, yTop, s.label, { anchor: 'end', fill: C.ink, size: 11.5, weight: 600 });
    b += txt(labelW - 10, ySub, s.sub || '', { anchor: 'end', fill: C.muted, size: 9 });
    const inside = w > 74;
    b += txt(inside ? labelW + w - 8 : labelW + w + 8, yMid, fmtInt(s.deals) + ' neg.', {
      anchor: inside ? 'end' : 'start', size: 12, weight: 700, fill: inside ? '#ffffff' : C.ink, tab: true,
    });
    b += txt(width - 4, yTop, fmtQ(s.valor), { anchor: 'end', size: 11.5, fill: C.ink, weight: 600, tab: true });
    b += txt(width - 4, ySub, s.right || '', { anchor: 'end', size: 9, fill: C.muted, tab: true });
  });
  return svg(width, h, b);
}

/* -------------------------------------------------------------- leyenda */
export function legend(items) {
  return `<div class="legend">${items.map((it) => `<span class="lg"><i style="background:${it.color}"></i>${esc(it.label)}</span>`).join('')}</div>`;
}

/* ------------------------------------------------- tabla con celdas teñidas */
export function heatTable({ head, rows, tint, leftCols = [] }) {
  const cls = (i) => (i === 0 || leftCols.includes(i) ? '' : 'num');
  const th = head.map((h, i) => `<th class="${cls(i)}">${esc(h)}</th>`).join('');
  const tr = rows.map((r) => {
    const tds = r.cells.map((c, i) => {
      if (i === 0) return `<td class="lbl">${esc(c.v)}${c.sub ? `<span class="sub">${esc(c.sub)}</span>` : ''}</td>`;
      const bg = c.pct != null && tint ? tint(c.pct) : null;
      return `<td class="${cls(i)}"${bg ? ` style="background:${bg}"` : ''}>${esc(c.v)}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

// Tinte secuencial azul, con piso legible: nunca tan claro que desaparezca.
export function tintBlue(pct) {
  const idx = Math.min(C.seq.length - 1, Math.max(0, Math.round((pct / 100) * 6)));
  return C.seq[idx] + (pct < 8 ? '00' : 'cc');
}

export { esc };

// `npm run contrast`: every colour pair the layout draws from brand.json, in light and dark, with
// its WCAG contrast ratio and, for a pair that fails, the nearest shade of the text colour that
// passes (same hue, mixed towards black or white). `npm run contrast -- "#e0a526" "#ffffff"`
// measures one pair.
const hex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h ?? '');
  if (!m) throw new Error(`not a #rrggbb colour: ${h}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = (h) => {
  const [r, g, b] = hex(h);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
export function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// The nearest shade of `fg` (mixed towards black or white, whichever moves away from `bg`) that
// reaches `need` against `bg`, or null.
export function passingShade(fg, bg, need) {
  const target = luminance(bg) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  const from = hex(fg);
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const c = toHex(from.map((v, i) => v + (target[i] - v) * t));
    if (ratio(c, bg) >= need) return c;
  }
  return null;
}

// [what, text colour key, background key, needed ratio]
export const PAIRS = [
  ['body text on the card', 'text', 'card', 4.5],
  ['body text on panels', 'text', 'panel', 4.5],
  ['muted text (notes) on the card', 'muted', 'card', 4.5],
  ['footer text on the page', 'muted', 'page', 4.5],
  ['links on the card', 'link', 'card', 4.5],
  ['footer links on the page', 'link', 'page', 4.5],
  ['eyebrow labels (13px bold) on the card', 'accent', 'card', 4.5],
  ['button text on the button', 'onPrimary', 'primary', 4.5],
  ['header name on the page', 'text', 'page', 4.5],
  ['button against the card (to be seen)', 'primary', 'card', 3],
];

export function brandPairs(brand) {
  const rows = [];
  for (const mode of ['light', 'dark']) {
    const c = brand[mode];
    for (const [what, fg, bg, need] of PAIRS) {
      const r = ratio(c[fg], c[bg]);
      rows.push({ mode, what, fg: `${mode}.${fg}`, bg: `${mode}.${bg}`, fgHex: c[fg], bgHex: c[bg], ratio: r, need, ok: r >= need, suggest: r >= need ? null : passingShade(c[fg], c[bg], need) });
    }
  }
  return rows;
}

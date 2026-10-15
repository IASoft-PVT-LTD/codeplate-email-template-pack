// Opens every built email in the browser and measures what a reader would meet:
//   light  (680 px wide): images load, contrast of every piece of text (WCAG AA), text and links
//          carry their colour inline (Gmail with non-Google accounts drops <style>), text ≥ 12px
//   dark   (680 px, prefers-color-scheme: dark, as Apple Mail does it): the page
//          turns dark and every piece of text still reaches AA contrast
//   mobile (375 px): no sideways scrolling, buttons tall enough to tap
//   all    pictures keep their shape, and no cut-out picture (a logo) vanishes into the colour
//          behind it; nothing is loaded from outside assets/images/
// and takes the screenshots: shots/<id>/light.png, dark.png, mobile.png, plus contact sheets.
//
// What this can't tell you: how Gmail's apps and Outlook.com recolour emails in their own dark
// mode, or how Outlook for Windows (Word's engine) lays tables out. See README "What the checks
// can't see".
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openPage, showHtml } from './browser.mjs';
import { ROOT } from './render.mjs';

export const VIEWS = {
  light: { width: 680, height: 900, colorScheme: 'light' },
  dark: { width: 680, height: 900, colorScheme: 'dark' },
  mobile: { width: 375, height: 812, colorScheme: 'light' },
};
export const MIN_FONT_PX = 12;
export const MIN_TAP_PX = 40;

// Runs in the page: returns everything the checks judge.
function measure({ minFont, minTap }) {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  // The colour behind an element: the first ancestor with a background, blended down to white.
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    return layers.reverse().reduce((under, top) => blend(top, under), { r: 255, g: 255, b: 255, a: 1 });
  };
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === 'hidden' || Number(s.opacity) === 0 || s.display === 'none') return false;
      if ((s.maxHeight === '0px' || s.height === '0px') && s.overflow === 'hidden') return false;
    }
    return true;
  };
  const inline = (el, prop) => {
    const re = new RegExp(`(^|;)\\s*${prop}\\s*:`, 'i');
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) if (re.test(n.getAttribute('style') ?? '')) return true;
    return false;
  };
  const els = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    if (t.textContent.trim() && t.parentElement && visible(t.parentElement)) els.add(t.parentElement);
  }
  const texts = [];
  for (const el of els) {
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    const bg = backdrop(el);
    const size = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    texts.push({
      text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
      tag: el.tagName.toLowerCase(),
      ratio: fg ? Math.round(ratio(blend(fg, bg), bg) * 100) / 100 : 0,
      need: large ? 3 : 4.5,
      size,
      inlineColour: inline(el, 'color'),
      inlineFont: inline(el, 'font-family'),
    });
  }
  const images = [...document.images].map((img) => {
    const r = img.getBoundingClientRect();
    const bg = backdrop(img);
    return { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0, width: r.width, height: r.height, natural: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0, backdrop: [bg.r, bg.g, bg.b].map(Math.round) };
  });
  const buttons = [...document.querySelectorAll('.btn a')].filter(visible).map((a) => ({ text: a.textContent.trim(), height: a.getBoundingClientRect().height, width: a.getBoundingClientRect().width }));
  const pageBg = backdrop(document.querySelector('.page > div') ?? document.body);
  return {
    texts,
    images,
    buttons,
    scrollWidth: document.documentElement.scrollWidth,
    pageLuminance: lum(pageBg),
    minFont,
    minTap,
    height: document.documentElement.scrollHeight,
  };
}

// A picture with transparent parts (a logo, a cut-out) whose visible pixels are mostly within
// 1.5:1 of the colour behind it disappears: a charcoal logo on the dark-mode page. Only pictures
// that are at least 10% transparent count (cut-outs, not photos with rounded corners). Returns the
// share of such pixels when it is over half, else null. Opaque pictures carry their own
// background and are skipped. The file is read from assets/images/ (a data: URL can be drawn
// to a canvas and read back; the https address can't).
const VANISH_RATIO = 1.5;
const VANISH_SHARE = 0.5;
async function vanishing(page, img, brand, root) {
  if (!brand?.assetBaseUrl || !img.src?.startsWith(brand.assetBaseUrl)) return null;
  const name = decodeURIComponent(img.src.slice(brand.assetBaseUrl.length).split(/[?#]/)[0]);
  const file = join(root, 'assets', 'images', name);
  if (!existsSync(file) || !/\.(png|gif)$/i.test(file)) return null;
  const url = `data:image/${name.toLowerCase().endsWith('.gif') ? 'gif' : 'png'};base64,${readFileSync(file).toString('base64')}`;
  return page.evaluate(async ({ url, backdrop, minRatio, share }) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    const w = Math.min(im.naturalWidth, 200);
    const h = Math.max(1, Math.round((im.naturalHeight * w) / im.naturalWidth));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(im, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const lb = lum(...backdrop);
    let opaque = 0;
    let clear = 0;
    let close = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        clear++;
        continue;
      }
      opaque++;
      const l = lum(d[i], d[i + 1], d[i + 2]);
      const ratio = (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05);
      if (ratio < minRatio) close++;
    }
    // Only cut-outs: at least a tenth of the picture transparent (rounded corners alone are not).
    if (!opaque || clear / (clear + opaque) < 0.1) return null;
    const part = close / opaque;
    return part > share ? part : null;
  }, { url, backdrop: img.backdrop, minRatio: VANISH_RATIO, share: VANISH_SHARE });
}

// results: [{ id, html }]. Returns { reports: { id: { view: problems[] } }, shots: [paths] }.
export async function inspectEmails(items, { brand, root = ROOT, screenshots = true, browserPath } = {}) {
  const browser = await launch(browserPath);
  const reports = {};
  const shots = [];
  try {
    for (const [view, opts] of Object.entries(VIEWS)) {
      const { page, context, external, missing } = await openPage(browser, { brand, root, ...opts });
      for (const { id, html } of items) {
        const problems = (reports[id] ??= { light: [], dark: [], mobile: [] })[view];
        external.length = 0;
        missing.length = 0;
        await showHtml(page, html);
        const m = await page.evaluate(measure, { minFont: MIN_FONT_PX, minTap: MIN_TAP_PX });
        for (const url of new Set(external)) problems.push(`loads ${url}: emails may only load their images from brand.json's assetBaseUrl (no web fonts, trackers or CSS files in the template)`);
        for (const url of new Set(missing)) problems.push(`image not found: ${url} (no such file in assets/images/)`);
        for (const img of m.images) {
          if (!img.ok) problems.push(`image did not load: ${img.src}`);
          else if (img.height > 0 && Math.abs(img.width / img.height / img.natural - 1) > 0.03) problems.push(`${img.src} is drawn ${Math.round(img.width)}x${Math.round(img.height)}, stretched out of its shape: drop the fixed height (mj-image height="auto", the default)`);
          else {
            const hidden = await vanishing(page, img, brand, root);
            if (hidden !== null) problems.push(`${img.src}: ${Math.round(hidden * 100)}% of the picture is nearly the colour behind it (rgb ${img.backdrop.join(', ')}), so it vanishes${view === 'dark' ? ' in dark mode' : ''}: give it a background shape or a light outline (see docs/recipes/dark-mode.md)`);
          }
        }
        for (const t of m.texts) {
          if (t.ratio < t.need) problems.push(`contrast ${t.ratio}:1 (needs ${t.need}:1) for "${t.text}" (${t.size}px ${t.tag})`);
        }
        if (view === 'light') {
          for (const t of m.texts) {
            if (!t.inlineColour) problems.push(`"${t.text}" gets its colour only from the <style> block: Gmail with non-Google accounts and some Outlooks drop it; set color on the MJML component or inline`);
            if (!t.inlineFont) problems.push(`"${t.text}" has no inline font-family (it would fall back to Times in Outlook)`);
            if (t.size < MIN_FONT_PX) problems.push(`"${t.text}" is ${t.size}px; keep text at ${MIN_FONT_PX}px or more (iOS enlarges smaller text and breaks the layout)`);
          }
        }
        if (view === 'dark' && m.pageLuminance > 0.2) problems.push('the page stays light in dark mode: the dark styles in partials/layout.mjml did not apply (check the css-class names)');
        if (view === 'mobile') {
          if (m.scrollWidth > opts.width + 1) problems.push(`the email is ${m.scrollWidth}px wide on a ${opts.width}px phone: something is too wide (a fixed-width image or table, a long unbroken word or link)`);
          for (const b of m.buttons) if (b.height < MIN_TAP_PX) problems.push(`button "${b.text}" is ${Math.round(b.height)}px tall on a phone; make it at least ${MIN_TAP_PX}px (inner-padding)`);
        }
        if (screenshots) {
          const dir = join(root, 'shots', id);
          mkdirSync(dir, { recursive: true });
          const file = join(dir, `${view}.png`);
          writeFileSync(file, await page.screenshot({ fullPage: true }));
          shots.push({ id, view, file, height: m.height });
        }
      }
      await context.close();
    }
    if (screenshots) shots.push(...await contactSheets(browser, items.map((i) => i.id), root));
  } finally {
    await browser.close();
  }
  return { reports, shots };
}

// One sheet per view: every email side by side, scaled down, with its id. Open these first.
async function contactSheets(browser, ids, root) {
  const out = [];
  for (const view of Object.keys(VIEWS)) {
    const thumbs = ids.map((id) => ({ id, src: `data:image/png;base64,${readFileSync(join(root, 'shots', id, `${view}.png`)).toString('base64')}` }));
    const w = view === 'mobile' ? 188 : 272;
    const cols = 5;
    const bg = view === 'dark' ? '#0b0d10' : '#e9e6df';
    const page = await browser.newPage({ viewport: { width: cols * (w + 16) + 16, height: 400 } });
    await page.setContent(`<!doctype html><html><head><style>
      body{margin:0;padding:16px;background:${bg};font:600 13px system-ui,sans-serif;color:${view === 'dark' ? '#ddd' : '#333'}}
      .g{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:16px;align-items:start}
      img{width:${w}px;display:block;border:1px solid rgba(128,128,128,.4)}p{margin:0 0 6px}
    </style></head><body><div class="g">${thumbs.map((t) => `<div><p>${t.id}</p><img src="${t.src}"></div>`).join('')}</div></body></html>`);
    await page.evaluate(async () => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; })))));
    const file = join(root, 'shots', `contact-${view}.png`);
    writeFileSync(file, await page.screenshot({ fullPage: true }));
    await page.close();
    out.push({ id: '*', view, file });
  }
  return out;
}

export function clearShots(root = ROOT) {
  rmSync(join(root, 'shots'), { recursive: true, force: true });
}

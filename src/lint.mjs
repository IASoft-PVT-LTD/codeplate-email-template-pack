// The rules a built email must follow, read from the HTML and the plain text (no browser needed).
// Each function returns { problems, warnings }: problems fail the checks, warnings are printed.
//
//   checkHtml(html, ctx)   size (Gmail clips over 102 KB), <head> basics and dark-mode meta,
//                          elements and CSS mail apps drop, images (https, PNG/JPG/GIF, alt,
//                          width, the file exists), links (https/mailto/tel, real text),
//                          tables (layout tables role="presentation"), marketing footer
//   checkText(text, ctx)   the plain-text version: present, readable, every link of the HTML,
//                          no markup or template leftovers, short lines
//   checkMeta(rendered)    subject and preheader
//
// ctx: { brand, meta (the emails.json entry), data (what it was rendered with), root }
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'htmlparser2';
import * as du from 'domutils';
import { pngSize } from '../checks/shared/assets.mjs';

export const GMAIL_CLIP_BYTES = 102 * 1024;
export const SIZE_WARN_BYTES = 80 * 1024;

// CSS that Gmail, Outlook for Windows (Word's engine) or Yahoo drop or break. Problems fail;
// warnings degrade gracefully (fine as decoration, never needed to read the email).
const CSS_PROBLEMS = [
  [/(^|[;{\s])position\s*:\s*(absolute|fixed|sticky|relative)/i, 'position: … (ignored by Gmail and Outlook; lay out with MJML sections and columns)'],
  [/display\s*:\s*(inline-)?(flex|grid)/i, 'display: flex/grid (Outlook for Windows ignores it; use mj-section/mj-column, or mj-group to keep columns side by side)'],
  [/var\(\s*--/i, 'CSS variables var(--…) (Gmail drops the whole rule; use the brand.json colours through {{brand…}})'],
  [/calc\(/i, 'calc() (Outlook for Windows and some webmail drop it)'],
  [/@import/i, '@import (most mail apps never fetch it)'],
  [/@font-face/i, '@font-face web fonts (Gmail and Outlook ignore them and the download can be tracked; use a system font stack in brand.json)'],
  [/url\(/i, 'url(…) background images (Outlook for Windows ignores them; use an <mj-image> and a background colour)'],
];
const CSS_WARNINGS = [
  [/box-shadow/i, 'box-shadow (not shown in Gmail or Outlook; fine as decoration only)'],
  [/(^|[;{\s])(transform|transition|animation)\s*:/i, 'transform/transition/animation (most mail apps ignore them)'],
  [/(^|[;{\s])filter\s*:/i, 'filter (most mail apps ignore it)'],
];
const FORBIDDEN_TAGS = {
  script: 'scripts never run in email and get it flagged as spam',
  form: 'forms are blocked or broken in most mail apps; link to a page instead',
  input: 'form fields are blocked in most mail apps; link to a page instead',
  iframe: 'iframes are blocked everywhere',
  video: 'video only plays in Apple Mail; use a picture that links to the video',
  audio: 'audio is blocked in most mail apps',
  object: 'embedded objects are blocked',
  embed: 'embedded objects are blocked',
  svg: 'Gmail and Outlook do not show SVG; draw it to PNG (npm run images)',
  canvas: 'canvas needs scripts, which never run',
  base: '<base> changes every link and is stripped by many clients',
};
const VAGUE_LINKS = /^(click here|here|this|link|this link|more)$/i;
const SOFT_VAGUE_LINKS = /^(read more|learn more|click|go)$/i;

const text = (node) => du.textContent(node).replace(/\s+/g, ' ').trim();
const attr = (el, name) => el.attribs?.[name];
const snippet = (s, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function parseHtml(html) {
  return parseDocument(html, { lowerCaseTags: true, lowerCaseAttributeNames: true });
}

// Every https link of the email, with what it's for: used by checkHtml and checkText.
export function linksOf(doc) {
  return du.findAll((el) => el.name === 'a' && attr(el, 'href') !== undefined, doc.children).map((a) => {
    const imgs = du.findAll((el) => el.name === 'img', a.children);
    return { href: attr(a, 'href').trim(), text: text(a), imageOnly: !text(a) && imgs.length > 0, alt: imgs.map((i) => attr(i, 'alt') ?? '').join(' ').trim(), style: attr(a, 'style') ?? '' };
  });
}

export function checkHtml(html, { brand, meta, data = {}, root }) {
  const problems = [];
  const warnings = [];
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes >= GMAIL_CLIP_BYTES) problems.push(`HTML is ${(bytes / 1024).toFixed(1)} KB: Gmail clips emails over 102 KB (the end, with the footer and unsubscribe link, is hidden behind "View entire message"). Split it, shorten it, or remove repeated sections.`);
  else if (bytes > SIZE_WARN_BYTES) warnings.push(`HTML is ${(bytes / 1024).toFixed(1)} KB: close to Gmail's 102 KB clip limit (your sending service's tracking links add more)`);

  const doc = parseHtml(html);
  const all = (name) => du.findAll((el) => el.name === name, doc.children);
  const htmlEl = all('html')[0];
  if (!/^<!doctype html>/i.test(html.trimStart())) problems.push('the HTML must start with <!doctype html>');
  if (!attr(htmlEl ?? {}, 'lang')) problems.push('<html> has no lang attribute (screen readers need it to pick a voice): set "lang" in brand.json');
  else if (brand.lang && attr(htmlEl, 'lang') !== brand.lang) problems.push(`<html lang="${attr(htmlEl, 'lang')}"> differs from brand.json "lang": "${brand.lang}"`);
  const metas = all('meta');
  const metaContent = (name) => metas.find((m) => (attr(m, 'name') ?? '').toLowerCase() === name)?.attribs.content ?? null;
  if (!metas.some((m) => /charset=utf-8/i.test(attr(m, 'content') ?? '') || /utf-8/i.test(attr(m, 'charset') ?? ''))) problems.push('no UTF-8 charset meta tag');
  if (!metaContent('viewport')) problems.push('no viewport meta tag (phones would show the email zoomed out)');
  if (!/light\s+dark/.test(metaContent('color-scheme') ?? '')) problems.push('no <meta name="color-scheme" content="light dark">: Apple Mail and others then invert or ignore the dark-mode styles (partials/layout.mjml)');
  if (!/light\s+dark/.test(metaContent('supported-color-schemes') ?? '')) problems.push('no <meta name="supported-color-schemes" content="light dark"> (older Apple Mail needs it; partials/layout.mjml)');
  const css = all('style').map((s) => text(s)).join('\n');
  if (!/@media[^{]*prefers-color-scheme\s*:\s*dark/i.test(css)) problems.push('no @media (prefers-color-scheme: dark) styles: the email has no dark mode of its own (partials/layout.mjml)');
  if (!/color-scheme\s*:\s*light\s+dark/i.test(css)) problems.push(':root { color-scheme: light dark; } is missing from the styles (partials/layout.mjml)');
  const titleEl = all('title')[0];
  const title = titleEl ? text(titleEl) : '';
  if (!title) problems.push('<title> is empty (some clients show it; MJML fills it from the subject)');

  for (const [tag, why] of Object.entries(FORBIDDEN_TAGS)) {
    if (all(tag).length) problems.push(`<${tag}> found: ${why}`);
  }
  for (const l of all('link')) {
    if (/stylesheet/i.test(attr(l, 'rel') ?? '')) problems.push(`<link rel="stylesheet" href="${attr(l, 'href')}">: external CSS is never loaded by Gmail or Outlook; styles go on the MJML components`);
  }
  if (metas.some((m) => /refresh/i.test(attr(m, 'http-equiv') ?? ''))) problems.push('<meta http-equiv="refresh"> is not allowed in email');

  // CSS: inline styles and <style> blocks.
  const seen = new Set();
  const cssSources = [...du.findAll((el) => attr(el, 'style') !== undefined, doc.children).map((el) => [`<${el.name} style>`, attr(el, 'style')]), ['<style>', css]];
  for (const [where, value] of cssSources) {
    for (const [re, why] of CSS_PROBLEMS) if (re.test(value) && !seen.has(why)) { seen.add(why); problems.push(`${where}: ${why}`); }
    for (const [re, why] of CSS_WARNINGS) if (re.test(value) && !seen.has(why)) { seen.add(why); warnings.push(`${where}: ${why}`); }
  }

  // Images.
  for (const img of all('img')) {
    const src = (attr(img, 'src') ?? '').trim();
    const label = `<img src="${snippet(src, 70)}">`;
    if (!/^https:\/\//i.test(src)) problems.push(`${label}: image addresses must be absolute https:// URLs (mail apps load them from the web; put the file in assets/images/ and use {{asset "file.png"}})`);
    if (/\.svg(\?|#|$)/i.test(src) || /^data:image\/svg/i.test(src)) problems.push(`${label}: SVG images don't show in Gmail or Outlook; draw a PNG (npm run images)`);
    else if (/^data:/i.test(src)) problems.push(`${label}: data: images are blocked by Gmail and bloat the email; use a file in assets/images/`);
    else if (!/\.(png|jpe?g|gif)(\?|#|$)/i.test(src)) warnings.push(`${label}: use PNG, JPG or GIF (WebP and AVIF don't show in Outlook for Windows)`);
    const alt = attr(img, 'alt');
    const decorative = (attr(img, 'role') ?? '') === 'presentation';
    if (alt === undefined) problems.push(`${label}: no alt attribute (screen readers and image-blocking mail apps show the alt text)`);
    else if (!alt.trim() && !decorative) problems.push(`${label}: alt text is empty: describe the picture (or, for a purely decorative one, add role="presentation")`);
    if (!/^\d+$/.test(attr(img, 'width') ?? '')) problems.push(`${label}: needs a width attribute in pixels (Outlook for Windows shows images at their full file size otherwise)`);
    if (brand.assetBaseUrl && src.startsWith(brand.assetBaseUrl)) {
      const name = decodeURIComponent(src.slice(brand.assetBaseUrl.length).split(/[?#]/)[0]);
      const file = join(root, 'assets', 'images', name);
      if (!existsSync(file)) problems.push(`${label}: assets/images/${name} doesn't exist`);
      else {
        const size = /\.png$/i.test(file) ? pngSize(readFileSync(file)) : null;
        const shown = Number(attr(img, 'width'));
        if (size && shown && size.width < shown) warnings.push(`${label}: the PNG is ${size.width}px wide but shown at ${shown}px, so it looks blurry; draw it at ${shown * 2}px`);
        const kb = readFileSync(file).length / 1024;
        if (kb > 400) warnings.push(`${label}: ${kb.toFixed(0)} KB is heavy for email (aim for under 200 KB; mobile data and slow clients)`);
      }
    }
  }

  // Links.
  const links = linksOf(doc);
  for (const l of links) {
    const label = `<a href="${snippet(l.href, 70)}">${snippet(l.text || l.alt)}</a>`;
    if (/^(#|$)/.test(l.href) || /^javascript:/i.test(l.href)) problems.push(`${label}: links need a real destination`);
    else if (/^http:\/\//i.test(l.href)) problems.push(`${label}: use https:// (http links are flagged by mail apps and browsers)`);
    else if (!/^(https:\/\/|mailto:|tel:)/i.test(l.href)) problems.push(`${label}: links must be absolute https://, mailto: or tel: (relative links go nowhere from an inbox)`);
    if (/\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(l.href)) problems.push(`${label}: points at localhost`);
    if (/\s/.test(l.href)) problems.push(`${label}: the address contains spaces`);
    if (!l.text && !l.alt) problems.push(`${label}: the link has no text (and no image alt text) for screen readers`);
    if (VAGUE_LINKS.test(l.text)) problems.push(`${label}: say where the link goes ("Download the invoice"), not "${l.text}"`);
    else if (SOFT_VAGUE_LINKS.test(l.text)) warnings.push(`${label}: "${l.text}" says little out of context; name the destination`);
    if (l.text && !/(^|;)\s*color\s*:/i.test(l.style)) problems.push(`${label}: give the link an inline colour (style="color:{{brand.light.link}}"), or Gmail shows it in its own blue`);
  }

  // Tables: layout tables are role="presentation"; data tables keep header cells.
  for (const t of all('table')) {
    const hasTh = du.findAll((el) => el.name === 'th', t.children).length > 0;
    if ((attr(t, 'role') ?? '') !== 'presentation' && !hasTh) problems.push(`a <table> without role="presentation" or header cells (<th>): screen readers announce layout tables as data ("${snippet(text(t), 40)}")`);
  }

  // Leftovers from the template or the data.
  const bodyText = text(all('body')[0] ?? doc);
  if (/\{\{|\}\}/.test(html)) problems.push('"{{" or "}}" left in the HTML: a Handlebars tag that did not render');
  if (/\bTODO\b/.test(bodyText)) problems.push('"TODO" left in the email text (npm run new-email puts placeholders in; replace them)');
  for (const bad of ['undefined', '[object Object]', 'NaN', 'null']) {
    if (new RegExp(`(^|[^\\w])${bad.replace(/[[\]]/g, '\\$&')}([^\\w]|$)`).test(bodyText)) problems.push(`"${bad}" appears in the email text: a missing or wrong value in the data`);
  }
  const h1 = all('h1').length;
  if (h1 === 0) warnings.push('no <h1>: give the email one main heading (screen readers jump by headings)');
  if (h1 > 1) warnings.push(`${h1} <h1> headings: keep one, use <h2> for the rest`);

  // Marketing emails: unsubscribe link and postal address (CAN-SPAM, PECR/GDPR, Gmail and Yahoo's sender rules).
  if (meta.type === 'marketing') {
    const unsub = links.find((l) => /unsubscribe/i.test(l.text));
    if (!unsub) problems.push('marketing email without a visible "Unsubscribe" link (the law and Gmail/Yahoo sender rules require one): partials/footer.mjml shows it when the email\'s type is "marketing"');
    else if (data.unsubscribeUrl && unsub.href !== data.unsubscribeUrl) problems.push(`the Unsubscribe link goes to ${unsub.href}, not the unsubscribeUrl in the data (${data.unsubscribeUrl})`);
    if (brand.address && !bodyText.includes(brand.address)) problems.push('marketing email without the postal address from brand.json (required by CAN-SPAM and similar laws)');
  }
  return { problems, warnings, bytes, links };
}

// The plain-text version.
export function checkText(textVersion, { brand, meta, data = {}, html }) {
  const problems = [];
  const warnings = [];
  const t = textVersion ?? '';
  const words = t.split(/\s+/).filter(Boolean).length;
  if (!t.trim()) return { problems: ['the plain-text version is empty'], warnings };
  if (words < 15) problems.push(`the plain-text version has only ${words} words: it should carry the whole message`);
  if (/<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(t)) problems.push('HTML tags in the plain-text version');
  if (/&(amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-f]+);/i.test(t)) problems.push('HTML entities (&amp; …) in the plain-text version');
  if (/\{\{|\}\}/.test(t)) problems.push('"{{" or "}}" in the plain-text version');
  if (/@media|\{[^}\n]*:[^}\n]*;[^}\n]*\}/.test(t)) problems.push('CSS leaked into the plain-text version');
  for (const bad of ['undefined', '[object Object]', 'NaN']) if (t.includes(bad)) problems.push(`"${bad}" in the plain-text version`);
  if (brand.name && !t.includes(brand.name)) problems.push(`the plain-text version never names the sender (${brand.name})`);
  if (html) {
    const doc = parseHtml(html);
    for (const l of linksOf(doc)) {
      if (l.imageOnly || !/^https:\/\//i.test(l.href)) continue;
      if (!t.includes(l.href)) problems.push(`the plain-text version is missing the link ${l.href} ("${snippet(l.text)}")`);
    }
  }
  if (meta.type === 'marketing' && data.unsubscribeUrl && !t.includes(data.unsubscribeUrl)) problems.push('the plain-text version has no unsubscribe link');
  const long = t.split('\n').filter((line) => line.length > 78 && line.replace(/https?:\/\/\S+|mailto:\S+/g, '').length > 30 && !/^\S+$/.test(line.trim()));
  if (long.length) warnings.push(`${long.length} plain-text line(s) over 78 characters (some clients wrap them badly): "${snippet(long[0])}"`);
  return { problems, warnings, words };
}

// Subject and preheader (what the inbox list shows).
export function checkMeta({ subject, preheader }) {
  const problems = [];
  const warnings = [];
  if (!subject) problems.push('the subject is empty (emails.json)');
  else if (subject.length > 100) problems.push(`the subject is ${subject.length} characters: inboxes cut it at 40-70; keep it under 70`);
  else if (subject.length > 70) warnings.push(`the subject is ${subject.length} characters: phones show about 40, desktops about 70`);
  if (/\{\{|\}\}|undefined|\[object Object\]|\bTODO\b/.test(subject ?? '')) problems.push(`the subject has a template leftover: "${subject}"`);
  if (!preheader) problems.push('the preheader is empty (emails.json): without one, inboxes show the first words of the email, often "View in browser" or the logo\'s alt text');
  else if (preheader.length < 30) warnings.push(`the preheader is only ${preheader.length} characters; aim for 40-130 so the inbox preview isn't filled from the email body`);
  else if (preheader.length > 150) warnings.push(`the preheader is ${preheader.length} characters; inboxes show about 90-130`);
  if (/\{\{|\}\}|undefined|\bTODO\b/.test(preheader ?? '')) problems.push(`the preheader has a template leftover: "${preheader}"`);
  return { problems, warnings };
}

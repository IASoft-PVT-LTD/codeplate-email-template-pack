// Turns one email into what you send: subject, preheader, HTML and plain text.
//
//   import { renderEmail } from './src/render.mjs';
//   const { subject, html, text, headers } = await renderEmail('password-reset', {
//     recipient: { email: 'maya@example.com' }, user: { firstName: 'Maya' },
//     resetUrl: 'https://app.example.com/reset?token=…', expiresInMinutes: 30,
//   });
//
// The steps: emails/<id>.mjml is a Handlebars template (your data, plus brand.json as
// `brand`) wrapped in partials/layout.mjml → MJML source → MJML 5 → HTML with the CSS
// inlined → html-to-text → the plain-text version. Missing data is an error (Handlebars
// strict mode), so an email never goes out saying "Hi ,". Optional parts use {{#if x}}.
//
// Use it from your app (see docs/recipes/send-*.md) or through `npm run build`, which renders
// every email with its preview data in emails/<id>.props.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { convert } from 'html-to-text';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw userError(`${file}: ${e.code === 'ENOENT' ? 'missing' : `not valid JSON (${e.message})`}`);
  }
};

export function userError(message) {
  const e = new Error(message);
  e.userFacing = true;
  return e;
}

export const loadBrand = (root = ROOT) => readJson(join(root, 'brand.json'));
export const loadEmails = (root = ROOT) => readJson(join(root, 'emails.json')).emails ?? [];

export function loadProps(id, root = ROOT) {
  return readJson(join(root, 'emails', `${id}.props.json`));
}

// The URL an image in assets/images/ is served from once uploaded (brand.json assetBaseUrl).
export function assetUrl(brand, file) {
  return new URL(file, brand.assetBaseUrl).href;
}

// A Handlebars instance with the template's helpers and every partial in partials/.
export function createHandlebars(brand, root = ROOT) {
  const hb = Handlebars.create();
  const locale = brand.locale ?? 'en-GB';
  const timeZone = brand.timeZone ?? 'UTC';
  // {{asset "logo.png"}} → https://…/email-assets/logo.png
  hb.registerHelper('asset', (file) => {
    if (typeof file !== 'string' || !file) throw new Error('{{asset}} needs a file name from assets/images/');
    return assetUrl(brand, file);
  });
  // {{money 4900 "GBP"}} → £49.00. Amounts are whole minor units (pence, cents), never floats.
  hb.registerHelper('money', (amount, currency) => {
    if (!Number.isInteger(amount)) throw new Error(`{{money}} needs whole minor units (pence, cents), got ${JSON.stringify(amount)}`);
    if (typeof currency !== 'string') throw new Error('{{money}} needs a currency code: {{money amount "GBP"}}');
    const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits;
    return fmt.format(amount / 10 ** digits);
  });
  // {{date "2026-10-14"}} → 14 October 2026; {{date sentAt "datetime"}} → 14 Oct 2026, 09:30;
  // {{date at "fulldatetime"}} → Tuesday 3 November 2026 at 09:30; {{date at "time"}} → 09:30.
  // Also "full", "long" (the default), "medium" and "short" for the date alone; an unknown
  // style gives "long". Written in brand.json's locale and time zone (the examples: en-IE,
  // Europe/Dublin).
  // Dates come from the data, never the clock, so the same data gives the same email.
  const DATE_STYLES = {
    datetime: { dateStyle: 'medium', timeStyle: 'short' },
    fulldatetime: { dateStyle: 'full', timeStyle: 'short' },
    time: { timeStyle: 'short' },
  };
  hb.registerHelper('date', (iso, style) => {
    const d = new Date(iso);
    if (typeof iso !== 'string' || Number.isNaN(d.getTime())) throw new Error(`{{date}} needs an ISO date like "2026-10-14", got ${JSON.stringify(iso)}`);
    const opts = typeof style === 'string' && Object.hasOwn(DATE_STYLES, style) ? DATE_STYLES[style]
      : { dateStyle: typeof style === 'string' && ['full', 'long', 'medium', 'short'].includes(style) ? style : 'long' };
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(d);
  });
  hb.registerHelper('eq', (a, b) => a === b);
  // {{plural count "item" "items"}} → "3 items"
  hb.registerHelper('plural', (n, one, many) => `${n} ${n === 1 ? one : many}`);
  const dir = join(root, 'partials');
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.mjml')) : []) {
    hb.registerPartial(basename(f, '.mjml'), readFileSync(join(dir, f), 'utf8'));
  }
  return hb;
}

// Options for html-to-text: what the plain-text version keeps and drops.
export const TEXT_OPTIONS = {
  wordwrap: 76,
  selectors: [
    // The hidden preheader (it is in the inbox preview, not the email), pictures and spacers.
    { selector: 'div[style*="display:none"]', format: 'skip' },
    { selector: 'img', format: 'skip' },
    { selector: 'h1', options: { uppercase: false } },
    { selector: 'h2', options: { uppercase: false } },
    { selector: 'h3', options: { uppercase: false } },
    // Data tables (a table with <th> header cells, like the receipt's line items) as aligned
    // columns; layout tables as plain blocks.
    { selector: 'table.text-data', format: 'dataTable', options: { uppercaseHeaderCells: false, maxColumnWidth: 44 } },
    { selector: 'table', format: 'block' },
    { selector: 'tr', format: 'block' },
    { selector: 'td', format: 'block' },
    { selector: 'a', options: { hideLinkHrefIfSameAsText: true, linkBrackets: ['(', ')'] } },
    // Anything marked css-class="text-skip" stays out of the plain text.
    { selector: '.text-skip', format: 'skip' },
  ],
};

// Innermost tables with header cells are data tables: mark them for TEXT_OPTIONS.
const markDataTables = (html) => html.replace(/<table\b([^>]*)>((?:(?!<table\b)[\s\S])*?)<\/table>/g,
  (all, attrs, inner) => (/<th\b/.test(inner) ? `<table class="text-data"${attrs}>${inner}</table>` : all));

export function htmlToText(html) {
  return convert(markDataTables(html), TEXT_OPTIONS)
    .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

// Renders one email. `data` is what you'd pass when sending (the props file has an example).
// Returns { id, type, subject, preheader, html, text, headers, mjml, warnings }.
export async function renderEmail(id, data, { root = ROOT, brand = loadBrand(root), emails = loadEmails(root), hb } = {}) {
  const meta = emails.find((e) => e.id === id);
  if (!meta) throw userError(`emails.json has no email "${id}" (it has: ${emails.map((e) => e.id).join(', ')})`);
  const file = join(root, 'emails', `${id}.mjml`);
  if (!existsSync(file)) throw userError(`emails/${id}.mjml is missing (emails.json lists "${id}")`);
  hb ??= createHandlebars(brand, root);
  const marketing = meta.type === 'marketing';
  const base = { ...data, brand, marketing, email: { id, type: meta.type } };
  const fill = (what, template, ctx) => {
    try {
      return hb.compile(template, { strict: true })(ctx);
    } catch (e) {
      throw userError(`${what}: ${e.message.split('\n')[0]} (add it to the data, e.g. emails/${id}.props.json, or make that part optional with {{#if …}})`);
    }
  };
  const subject = fill(`emails.json "${id}" subject`, meta.subject ?? '', base).replace(/\s+/g, ' ').trim();
  const preheader = fill(`emails.json "${id}" preheader`, meta.preheader ?? '', base).replace(/\s+/g, ' ').trim();
  // Each email file is the inside of the layout: {{#> layout}} … {{/layout}} is added around it.
  const body = readFileSync(file, 'utf8');
  const finalSource = fill(`emails/${id}.mjml`, `{{#> layout}}\n${body}\n{{/layout}}`, { ...base, subject, preheader });
  // fonts: {} stops MJML adding a Google Fonts @import when a font stack names Roboto, Open Sans…
  // (an outside request, blocked by many clients; fonts here are system stacks on purpose).
  const result = await mjml2html(finalSource, { validationLevel: 'soft', keepComments: false, fonts: {} });
  const warnings = (result.errors ?? []).map((e) => `emails/${id}.mjml (MJML line ${e.line}): ${e.message}`);
  const html = result.html;
  const headers = marketing && data.unsubscribeUrl
    ? { 'List-Unsubscribe': `<${data.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : {};
  return { id, type: meta.type, subject, preheader, html, text: htmlToText(html), headers, mjml: finalSource, warnings };
}

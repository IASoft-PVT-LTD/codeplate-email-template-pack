// Checks brand.json, emails.json and the emails/ folder agree, before anything is rendered.
// Returns a list of problems (empty when all is well), each naming the file to fix.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './render.mjs';

export const BRAND_KEYS = ['name', 'url', 'assetBaseUrl', 'logo', 'supportEmail', 'address', 'lang', 'dir', 'locale', 'timeZone', 'fontFamily', 'headingFontFamily', 'width', 'radius', 'light', 'dark', 'signOff', 'sender'];
export const COLOUR_KEYS = ['page', 'card', 'text', 'muted', 'primary', 'onPrimary', 'accent', 'border', 'panel', 'link'];
export const EMAIL_KEYS = ['id', 'type', 'subject', 'preheader', 'about'];
export const TYPES = ['transactional', 'marketing'];

const tryJson = (file, problems) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    problems.push(`${file.replace(/\\/g, '/').split('/').slice(-2).join('/')}: ${e.code === 'ENOENT' ? 'missing' : `not valid JSON (${e.message})`}`);
    return null;
  }
};

export function checkBrand(brand) {
  const problems = [];
  for (const k of Object.keys(brand)) if (!BRAND_KEYS.includes(k)) problems.push(`brand.json: unknown setting "${k}" (known: ${BRAND_KEYS.join(', ')})`);
  // Optional: the closing line and the sender's name every email's sign-off uses (partials/sign-off.mjml).
  for (const k of ['signOff', 'sender']) {
    if (brand[k] !== undefined && (typeof brand[k] !== 'string' || !brand[k].trim())) problems.push(`brand.json: "${k}" must be text (or leave it out)`);
  }
  for (const k of ['name', 'url', 'assetBaseUrl', 'supportEmail', 'address', 'lang', 'fontFamily']) {
    if (typeof brand[k] !== 'string' || !brand[k].trim()) problems.push(`brand.json: "${k}" is required`);
  }
  if (brand.url && !/^https:\/\//.test(brand.url)) problems.push('brand.json: "url" must start with https://');
  if (brand.assetBaseUrl && !/^https:\/\/.+\/$/.test(brand.assetBaseUrl)) problems.push('brand.json: "assetBaseUrl" must be an https:// address ending in / (where assets/images/ is uploaded)');
  if (brand.dir && !['ltr', 'rtl'].includes(brand.dir)) problems.push('brand.json: "dir" is "ltr" or "rtl"');
  if (brand.supportEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brand.supportEmail)) problems.push('brand.json: "supportEmail" is not an email address');
  if (!Number.isInteger(brand.width) || brand.width < 480 || brand.width > 700) problems.push('brand.json: "width" is the email width in pixels, 480-700 (600 is the safe default)');
  if (!Number.isInteger(brand.radius) || brand.radius < 0 || brand.radius > 32) problems.push('brand.json: "radius" is a corner radius in pixels, 0-32');
  const logo = brand.logo ?? {};
  if (typeof logo.file !== 'string' || !Number.isInteger(logo.width) || !Number.isInteger(logo.height)) problems.push('brand.json: "logo" needs "file" (in assets/images/), "width" and "height" (the size it is shown at)');
  for (const mode of ['light', 'dark']) {
    const set = brand[mode];
    if (!set || typeof set !== 'object') {
      problems.push(`brand.json: "${mode}" colours are missing`);
      continue;
    }
    for (const k of COLOUR_KEYS) if (!/^#[0-9a-f]{6}$/i.test(set[k] ?? '')) problems.push(`brand.json: ${mode}.${k} must be a #rrggbb colour (got ${JSON.stringify(set[k])})`);
    for (const k of Object.keys(set)) if (!COLOUR_KEYS.includes(k)) problems.push(`brand.json: unknown colour ${mode}.${k} (known: ${COLOUR_KEYS.join(', ')})`);
  }
  try {
    new Intl.NumberFormat(brand.locale ?? 'en-GB');
    new Intl.DateTimeFormat(brand.locale ?? 'en-GB', { timeZone: brand.timeZone ?? 'UTC' });
  } catch (e) {
    problems.push(`brand.json: "locale" or "timeZone" is not valid (${e.message})`);
  }
  return problems;
}

export function checkProject(root = ROOT) {
  const problems = [];
  const brand = tryJson(join(root, 'brand.json'), problems);
  if (brand) {
    problems.push(...checkBrand(brand));
    if (brand.logo?.file && !existsSync(join(root, 'assets', 'images', brand.logo.file))) problems.push(`brand.json: the logo assets/images/${brand.logo.file} doesn't exist`);
  }
  const list = tryJson(join(root, 'emails.json'), problems);
  const emails = Array.isArray(list?.emails) ? list.emails : [];
  if (list && !Array.isArray(list.emails)) problems.push('emails.json: needs an "emails" list');
  const ids = new Set();
  for (const [i, e] of emails.entries()) {
    const where = `emails.json "${e.id ?? `#${i + 1}`}"`;
    for (const k of Object.keys(e)) if (!EMAIL_KEYS.includes(k)) problems.push(`${where}: unknown setting "${k}" (known: ${EMAIL_KEYS.join(', ')})`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id ?? '')) problems.push(`${where}: "id" must be kebab-case (it names emails/<id>.mjml)`);
    if (ids.has(e.id)) problems.push(`${where}: the id is used twice`);
    ids.add(e.id);
    if (!TYPES.includes(e.type)) problems.push(`${where}: "type" must be ${TYPES.join(' or ')} (marketing emails get the unsubscribe footer and headers)`);
    for (const k of ['subject', 'preheader']) if (typeof e[k] !== 'string' || !e[k].trim()) problems.push(`${where}: "${k}" is required`);
    if (!existsSync(join(root, 'emails', `${e.id}.mjml`))) problems.push(`${where}: emails/${e.id}.mjml is missing`);
    const propsFile = join(root, 'emails', `${e.id}.props.json`);
    if (!existsSync(propsFile)) {
      problems.push(`${where}: emails/${e.id}.props.json is missing (the preview data the checks render it with)`);
      continue;
    }
    const props = tryJson(propsFile, problems);
    if (!props) continue;
    if (typeof props.recipient?.email !== 'string') problems.push(`emails/${e.id}.props.json: needs "recipient": { "email": "…" } (the footer says who it was sent to)`);
    if (e.type === 'marketing' && !/^https:\/\//.test(props.unsubscribeUrl ?? '')) problems.push(`emails/${e.id}.props.json: a marketing email needs "unsubscribeUrl" (https://…)`);
  }
  const dir = join(root, 'emails');
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    const m = f.match(/^(.+?)(\.props\.json|\.mjml)$/);
    if (!m) problems.push(`emails/${f}: only <id>.mjml and <id>.props.json files belong in emails/`);
    else if (!ids.has(m[1])) problems.push(`emails/${f}: not in emails.json (add an entry with its type, subject and preheader, or remove the file)`);
  }
  return { problems, brand, emails };
}

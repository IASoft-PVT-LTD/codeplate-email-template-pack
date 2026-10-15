// `npm run build`: renders every email in emails.json with its preview data and writes, per email:
//   out/<id>.html   the HTML part to send (CSS inlined, images at brand.json's assetBaseUrl)
//   out/<id>.txt    the plain-text part
//   out/<id>.json   subject, preheader, extra headers (List-Unsubscribe for marketing), sizes
//   out/<id>.eml    the whole message, to open in Outlook, Apple Mail or Thunderbird (images inline)
// Your app sends the same thing by calling renderEmail(id, data) (src/render.mjs).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEml } from './eml.mjs';
import { createHandlebars, loadBrand, loadEmails, loadProps, renderEmail, ROOT } from './render.mjs';

export async function buildAll({ root = ROOT, only = null } = {}) {
  const brand = loadBrand(root);
  const emails = loadEmails(root);
  const hb = createHandlebars(brand, root);
  const out = join(root, 'out');
  mkdirSync(out, { recursive: true });
  // Files of emails that no longer exist would be confusing: remove them.
  const ids = new Set(emails.map((e) => e.id));
  for (const f of readdirSync(out)) {
    const id = f.replace(/\.(html|txt|json|eml)$/, '');
    if (id !== f && !ids.has(id)) rmSync(join(out, f), { force: true });
  }
  const results = [];
  for (const meta of emails) {
    if (only && !only.includes(meta.id)) continue;
    try {
      const data = loadProps(meta.id, root);
      const r = await renderEmail(meta.id, data, { root, brand, emails, hb });
      writeFileSync(join(out, `${meta.id}.html`), r.html);
      writeFileSync(join(out, `${meta.id}.txt`), r.text);
      const bytes = Buffer.byteLength(r.html, 'utf8');
      writeFileSync(join(out, `${meta.id}.json`), `${JSON.stringify({ id: meta.id, type: meta.type, subject: r.subject, preheader: r.preheader, headers: r.headers, htmlBytes: bytes, textBytes: Buffer.byteLength(r.text, 'utf8') }, null, 2)}\n`);
      writeFileSync(join(out, `${meta.id}.eml`), buildEml({
        from: `${brand.name} <${brand.supportEmail}>`, to: data.recipient?.email ?? 'preview@example.com',
        subject: r.subject, html: r.html, text: r.text, headers: r.headers, brand, root, boundarySeed: meta.id,
      }));
      results.push({ ...r, meta, data, bytes });
    } catch (e) {
      results.push({ id: meta.id, meta, error: e.userFacing ? e.message : (e.stack ?? String(e)) });
    }
  }
  return { brand, emails, results };
}

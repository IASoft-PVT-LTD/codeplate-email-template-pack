import { renderEmail, loadEmails, loadProps } from './src/render.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('out', { recursive: true });
for (const e of loadEmails()) {
  try {
    const r = await renderEmail(e.id, loadProps(e.id));
    writeFileSync(`out/${e.id}.html`, r.html); writeFileSync(`out/${e.id}.txt`, r.text);
    console.log(e.id, r.subject, '|', r.html.length, r.warnings);
  } catch (err) { console.log(e.id, 'ERR', err.stack); }
}

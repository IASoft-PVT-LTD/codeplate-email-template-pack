// The npm commands (see package.json):
//   npm run build                    every email → out/<id>.html, .txt, .json, .eml
//   npm run preview [-- id …]        build, then screenshots in shots/ (light, dark, phone) + problems
//   npm run lint                     the rules without a browser: settings, build, HTML, plain text
//   npm run contrast [-- fg bg]      brand.json colour pairs in light and dark, with passing shades
//   npm run images [-- name …]       assets/src/*.svg → assets/images/*.png
//   npm run new-email -- <id> [--marketing]   a new email: emails/<id>.mjml, .props.json, emails.json
//   npm run render -- <id> --data f.json      one email with other data → out/render/
//   npm run browser                  which browser the previews and checks use
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAll } from './build.mjs';
import { checkProject } from './config.mjs';
import { brandPairs, passingShade, ratio } from './contrast.mjs';
import { renderImages } from './images.mjs';
import { clearShots, inspectEmails } from './inspect.mjs';
import { checkHtml, checkMeta, checkText } from './lint.mjs';
import { browserPath } from './browser.mjs';
import { loadBrand, renderEmail, ROOT } from './render.mjs';

const [cmd, ...args] = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
let failed = false;
const fail = (msg) => {
  console.log(msg);
  failed = true;
};

async function build(only) {
  const { problems } = checkProject(ROOT);
  for (const p of problems) fail(p);
  const res = await buildAll({ root: ROOT, only: only.length ? only : null });
  for (const r of res.results) {
    if (r.error) fail(`${r.id}: ${r.error}`);
    else {
      for (const w of r.warnings) fail(w);
      console.log(`out/${r.id}.html (${(r.bytes / 1024).toFixed(1)} KB), .txt, .json, .eml  "${r.subject}"`);
    }
  }
  return res;
}

function lint({ results, brand }) {
  for (const r of results.filter((x) => !x.error)) {
    const ctx = { brand, meta: r.meta, data: r.data, root: ROOT, html: r.html };
    const all = [checkHtml(r.html, ctx), checkMeta(r), checkText(r.text, ctx)];
    for (const p of all.flatMap((x) => x.problems)) fail(`${r.id}: ${p}`);
    for (const w of all.flatMap((x) => x.warnings)) console.log(`${r.id}: warning: ${w}`);
  }
}

if (cmd === 'build') {
  await build(ids);
} else if (cmd === 'lint') {
  lint(await build(ids));
  if (!failed) console.log('No problems found (the browser checks run in `npm run preview` and `npm run check`).');
} else if (cmd === 'preview') {
  const res = await build(ids);
  lint(res);
  const items = res.results.filter((r) => !r.error).map((r) => ({ id: r.id, html: r.html }));
  if (!ids.length) clearShots(ROOT);
  const { reports, shots } = await inspectEmails(items, { brand: res.brand, root: ROOT });
  for (const [id, views] of Object.entries(reports)) for (const [view, ps] of Object.entries(views)) for (const p of ps) fail(`${id} (${view}): ${p}`);
  for (const s of shots) console.log(s.file.replace(ROOT, '.').replace(/\\/g, '/'));
  console.log('Open shots/contact-light.png, contact-dark.png and contact-mobile.png first, then shots/<id>/*.png for the emails you changed.');
} else if (cmd === 'contrast') {
  if (ids.length === 2) {
    const r = ratio(ids[0], ids[1]);
    console.log(`${ids[0]} on ${ids[1]}: ${r.toFixed(2)}:1 (${r >= 4.5 ? 'passes AA for text' : r >= 3 ? 'passes AA only for large text and graphics' : 'fails AA'})`);
    if (r < 4.5) console.log(`nearest shade of ${ids[0]} that passes 4.5:1: ${passingShade(ids[0], ids[1], 4.5) ?? 'none'}`);
  } else {
    const rows = brandPairs(loadBrand(ROOT));
    for (const r of rows) {
      const line = `${r.ok ? 'ok  ' : 'FAIL'} ${r.mode.padEnd(5)} ${r.what.padEnd(40)} ${r.fgHex} on ${r.bgHex}  ${r.ratio.toFixed(2)}:1 (needs ${r.need})`;
      if (r.ok) console.log(line);
      else fail(`${line}  → set ${r.fg} to ${r.suggest ?? '(no shade passes: change the background)'}`);
    }
    if (!failed) console.log('Every pair passes.');
  }
} else if (cmd === 'images') {
  const { done, problems } = await renderImages({ root: ROOT, only: ids.length ? ids : null });
  for (const d of done) console.log(d);
  for (const p of problems) fail(p);
} else if (cmd === 'render') {
  // One email with other data (a long name, an empty list, your ESP's merge tags) → out/render/.
  const id = ids[0];
  const i = args.indexOf('--data');
  const file = i >= 0 ? args[i + 1] : null;
  if (!id || !file) {
    fail('usage: npm run render -- <id> --data <file.json>   (writes out/render/<id>.html and .txt)');
  } else {
    const brand = loadBrand(ROOT);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const r = await renderEmail(id, data, { root: ROOT, brand });
    mkdirSync(join(ROOT, 'out', 'render'), { recursive: true });
    writeFileSync(join(ROOT, 'out', 'render', `${id}.html`), r.html);
    writeFileSync(join(ROOT, 'out', 'render', `${id}.txt`), r.text);
    console.log(`out/render/${id}.html and .txt  subject: "${r.subject}"`);
    for (const w of r.warnings) fail(w);
    // Merge tags like {{first_name}} or *|FNAME|* are expected here, so the rules only warn.
    const ctx = { brand, meta: { id, type: r.type }, data, root: ROOT, html: r.html };
    for (const p of [...checkHtml(r.html, ctx).problems, ...checkText(r.text, ctx).problems]) console.log(`note: ${p}`);
  }
} else if (cmd === 'browser') {
  try {
    console.log(browserPath());
  } catch (e) {
    fail(e.message);
  }
} else if (cmd === 'new-email') {
  const id = ids[0];
  const marketing = args.includes('--marketing');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id ?? '')) {
    fail('usage: npm run new-email -- <kebab-case-id> [--marketing]');
  } else if (existsSync(join(ROOT, 'emails', `${id}.mjml`))) {
    fail(`emails/${id}.mjml already exists`);
  } else {
    const listFile = join(ROOT, 'emails.json');
    const list = JSON.parse(readFileSync(listFile, 'utf8'));
    list.emails.push({ id, type: marketing ? 'marketing' : 'transactional', subject: 'TODO subject for {{user.firstName}}', preheader: 'TODO: the line the inbox shows after the subject, 40-130 characters long.', about: 'TODO: when this email is sent.' });
    writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`);
    writeFileSync(join(ROOT, 'emails', `${id}.mjml`), `{{!-- ${id}: TODO say when it is sent. Data: emails/${id}.props.json --}}
<mj-section>
  <mj-column>
    <mj-text mj-class="h1"><h1 style="margin:0;font-size:30px;font-weight:400;">TODO heading</h1></mj-text>
    <mj-text>Hi {{user.firstName}}, TODO the message.</mj-text>
    {{> button url=actionUrl label="TODO what the button does"}}
    {{> sign-off}}
  </mj-column>
</mj-section>
`);
    const props = { recipient: { email: 'maya.okafor@example.com' }, user: { firstName: 'Maya' }, actionUrl: 'https://app.pebblework.example/TODO' };
    if (marketing) props.unsubscribeUrl = 'https://pebblework.example/email/unsubscribe?u=TODO';
    writeFileSync(join(ROOT, 'emails', `${id}.props.json`), `${JSON.stringify(props, null, 2)}\n`);
    console.log(`Created emails/${id}.mjml, emails/${id}.props.json and its emails.json entry (${marketing ? 'marketing' : 'transactional'}). Replace every TODO, then npm run preview -- ${id}.`);
  }
} else {
  fail(`unknown command "${cmd ?? ''}": build, preview, lint, contrast, images, new-email, render, browser`);
}
process.exitCode = failed ? 1 : 0;

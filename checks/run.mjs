// The checks: one command that says whether every email still builds, fits and reads well.
//   npm ci && npm run check
// Needs Node 22+ and a Chromium-based browser (Chrome, Edge, Chromium; found by itself). Runs:
//   tools    the browser, and the pinned MJML installed
//   assets   assets.json matches the files in assets/ (pictures and their SVG sources)
//   emails   brand.json, emails.json and emails/ agree: settings, colours, every email has its
//            .mjml and .props.json, marketing emails have an unsubscribe URL in their data
//   unit     node --test tests/
//   build    every email renders with its preview data (no missing data, no MJML errors) into
//            out/<id>.html, .txt, .json and .eml
//   html     each HTML file: under Gmail's 102 KB clip limit, lang, charset, viewport, dark-mode
//            meta and styles, no tags or CSS mail apps drop, images https + PNG/JPG/GIF + alt +
//            width + file exists, links https/mailto/tel with real text and an inline colour,
//            layout tables role="presentation", unsubscribe link + address on marketing emails,
//            subject and preheader
//   text     each plain-text version: whole message, every link, no markup or leftovers
//   inspect  each email in the browser at 680px light, 680px dark and 375px: images load, WCAG AA
//            contrast in light and dark, inline colours and fonts, text ≥ 12px, no sideways
//            scrolling on a phone, buttons ≥ 40px tall, no cut-out logo vanishing into the
//            colour behind it, nothing loaded from outside assets/;
//            screenshots in shots/<id>/ and contact sheets in shots/
//   credit   README.md still carries the credit the CodePlate Free License asks for
// A failing step doesn't stop the later ones. The last line is CODEPLATE CHECKS: PASS or FAIL.
//   --skip=inspect   skip steps for a quick loop; always finish with a full run
import { readFileSync, readdirSync } from 'node:fs';
import { createRunner } from './shared/runner.mjs';
import { checkAssets } from './shared/assets.mjs';
import { requireTool } from './shared/find-tool.mjs';
import { checkProject } from '../src/config.mjs';
import { buildAll } from '../src/build.mjs';
import { checkHtml, checkMeta, checkText } from '../src/lint.mjs';
import { clearShots, inspectEmails } from '../src/inspect.mjs';
import { ROOT } from '../src/render.mjs';

const run = createRunner();
let browser = null;
let built = null;

const printWarnings = (id, warnings) => {
  for (const w of warnings) console.log(`${id}: warning: ${w}`);
};

await run.step('tools', () => {
  browser = requireTool('browser').path;
  console.log(`browser: ${browser}`);
  const pin = JSON.parse(readFileSync('codeplate.json', 'utf8')).stack.find((s) => s.name === 'mjml')?.version;
  const have = JSON.parse(readFileSync('node_modules/mjml/package.json', 'utf8')).version;
  console.log(`MJML ${have} (codeplate.json pins ${pin})`);
  if (have !== pin) {
    console.log('The installed MJML is not the pinned version: run `npm ci`.');
    return false;
  }
  return true;
});

await run.step('assets', () => {
  const problems = checkAssets('.');
  for (const p of problems) console.log(p);
  if (!problems.length) console.log('assets.json matches the files in assets/');
  return problems.length === 0;
});

await run.step('emails', () => {
  const { problems, emails } = checkProject(ROOT);
  for (const p of problems) console.log(p);
  if (!problems.length) console.log(`${emails.length} emails: ${emails.map((e) => `${e.id} (${e.type})`).join(', ')}`);
  return problems.length === 0;
});

await run.step('unit', () => run.sh(process.execPath, ['--test', '--test-reporter=dot', ...readdirSync('tests').filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/${f}`)]).ok);

const build = async () => {
  built ??= await buildAll({ root: ROOT });
  return built;
};

await run.step('build', async () => {
  const { results } = await build();
  let ok = true;
  for (const r of results) {
    if (r.error) {
      console.log(`${r.id}: ${r.error}`);
      ok = false;
      continue;
    }
    for (const w of r.warnings) {
      console.log(w);
      ok = false;
    }
    console.log(`out/${r.id}.html ${(r.bytes / 1024).toFixed(1)} KB, .txt, .json, .eml: "${r.subject}"`);
  }
  if (!results.length) console.log('No emails yet (emails.json lists none).');
  return ok;
});

await run.step('html', async () => {
  const { results, brand } = await build();
  let ok = true;
  for (const r of results.filter((x) => !x.error)) {
    const html = checkHtml(r.html, { brand, meta: r.meta, data: r.data, root: ROOT });
    const meta = checkMeta(r);
    for (const p of [...html.problems, ...meta.problems]) {
      console.log(`${r.id}: ${p}`);
      ok = false;
    }
    printWarnings(r.id, [...html.warnings, ...meta.warnings]);
    if (!html.problems.length && !meta.problems.length) console.log(`${r.id}: ${(html.bytes / 1024).toFixed(1)} KB of 102 KB, ${html.links.length} links`);
  }
  return ok;
});

await run.step('text', async () => {
  const { results, brand } = await build();
  let ok = true;
  for (const r of results.filter((x) => !x.error)) {
    const t = checkText(r.text, { brand, meta: r.meta, data: r.data, html: r.html });
    for (const p of t.problems) {
      console.log(`${r.id}: ${p}`);
      ok = false;
    }
    printWarnings(r.id, t.warnings);
    if (!t.problems.length) console.log(`out/${r.id}.txt: ${t.words} words`);
  }
  return ok;
});

await run.step('inspect', async () => {
  const { results, brand } = await build();
  const items = results.filter((x) => !x.error).map((r) => ({ id: r.id, html: r.html }));
  if (!items.length) {
    console.log('Nothing to inspect.');
    return results.length === 0;
  }
  clearShots(ROOT);
  const { reports, shots } = await inspectEmails(items, { brand, root: ROOT, browserPath: browser ?? undefined });
  let ok = true;
  for (const [id, views] of Object.entries(reports)) {
    for (const [view, problems] of Object.entries(views)) {
      for (const p of problems) {
        console.log(`${id} (${view}): ${p}`);
        ok = false;
      }
    }
  }
  console.log(`${items.length} emails x light, dark, mobile measured; ${shots.length} screenshots: shots/<id>/all.png (the three views side by side) per email, contact sheets in shots/contact-light.png, contact-dark.png, contact-mobile.png`);
  return ok;
}, { render: true });

await run.step('credit', () => {
  const credit = 'Built with CodePlate (codeplate.io)';
  const ok = readFileSync('README.md', 'utf8').includes(credit);
  console.log(ok ? `README.md carries the credit "${credit}"` : `README.md must keep the credit "${credit}" (CodePlate Free License; see AGENTS.md)`);
  return ok;
});

run.finish();

import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHtml, checkMeta, checkText, GMAIL_CLIP_BYTES } from '../src/lint.mjs';
import { renderEmail } from '../src/render.mjs';
import { DATA, makeProject } from './helpers.mjs';

const meta = { id: 'report', type: 'transactional' };
async function sample(opts = {}) {
  const p = makeProject(opts);
  const data = opts.data ?? DATA;
  const r = await renderEmail('report', data, { root: p.dir });
  return { ...r, ctx: { brand: p.brand, meta: { ...meta, type: opts.type ?? 'transactional' }, data, root: p.dir } };
}
const problemsOf = (html, ctx) => checkHtml(html, ctx).problems.join('\n');

test('a rendered email passes', async () => {
  const s = await sample();
  assert.deepEqual(checkHtml(s.html, s.ctx).problems, []);
  assert.deepEqual(checkText(s.text, { ...s.ctx, html: s.html }).problems, []);
  assert.deepEqual(checkMeta(s).problems, []);
});

test('Gmail clipping: 102 KB and over fails', async () => {
  const s = await sample();
  const filler = `<div style="color:#000;font-family:Arial">${'x'.repeat(GMAIL_CLIP_BYTES)}</div>`;
  assert.match(problemsOf(s.html.replace('</body>', `${filler}</body>`), s.ctx), /Gmail clips/);
});

test('images: alt, https, no SVG, width, the file exists', async () => {
  const s = await sample();
  const add = (img) => problemsOf(s.html.replace('</body>', `${img}</body>`), s.ctx);
  assert.match(add('<img src="https://cdn.example.com/a.png" width="10">'), /no alt attribute/);
  assert.match(add('<img src="https://cdn.example.com/a.png" alt="" width="10">'), /alt text is empty/);
  assert.doesNotMatch(add('<img src="https://cdn.example.com/a.png" alt="" role="presentation" width="10">'), /alt/);
  assert.match(add('<img src="/a.png" alt="A" width="10">'), /absolute https/);
  assert.match(add('<img src="https://cdn.example.com/a.svg" alt="A" width="10">'), /SVG/);
  assert.match(add('<img src="https://cdn.example.com/a.png" alt="A">'), /width attribute/);
  assert.match(add(`<img src="${s.ctx.brand.assetBaseUrl}nope.png" alt="A" width="10">`), /nope\.png doesn't exist/);
});

test('links: https, real text, inline colour', async () => {
  const s = await sample();
  const add = (a) => problemsOf(s.html.replace('</body>', `${a}</body>`), s.ctx);
  assert.match(add('<a href="http://example.com" style="color:#000">Pricing</a>'), /use https/);
  assert.match(add('<a href="#" style="color:#000">Pricing</a>'), /real destination/);
  assert.match(add('<a href="https://example.com" style="color:#000">click here</a>'), /say where the link goes/);
  assert.match(add('<a href="https://example.com">Pricing</a>'), /inline colour/);
  assert.match(add('<a href="https://example.com" style="color:#000"></a>'), /no text/);
});

test('CSS and tags mail apps drop', async () => {
  const s = await sample();
  const add = (x) => problemsOf(s.html.replace('</body>', `${x}</body>`), s.ctx);
  assert.match(add('<div style="color:var(--ink)">a</div>'), /CSS variables/);
  assert.match(add('<div style="display:flex">a</div>'), /flex/);
  assert.match(add('<div style="position:absolute">a</div>'), /position/);
  assert.match(add('<script>1</script>'), /<script>/);
  assert.match(add('<table><tr><td>layout</td></tr></table>'), /role="presentation"/);
  assert.doesNotMatch(add('<table><tr><th>A</th></tr><tr><td>1</td></tr></table>'), /role="presentation"/);
  assert.match(problemsOf(s.html.replace('</head>', '<style>@import url(https://fonts.example.com/x.css);</style></head>'), s.ctx), /@import/);
});

test('dark mode: the meta tags and the media query are required', async () => {
  const s = await sample();
  assert.match(problemsOf(s.html.replace(/<meta name="color-scheme"[^>]*>/, ''), s.ctx), /color-scheme/);
  assert.match(problemsOf(s.html.replace(/prefers-color-scheme/g, 'prefers-nothing'), s.ctx), /prefers-color-scheme: dark/);
});

test('template leftovers and bad values fail', async () => {
  const s = await sample();
  assert.match(problemsOf(s.html.replace('Hello Ada', 'Hello {{user.name}}'), s.ctx), /did not render/);
  assert.match(problemsOf(s.html.replace('Hello Ada', 'Hello undefined'), s.ctx), /"undefined"/);
  assert.match(problemsOf(s.html.replace('Hello Ada', 'Hello TODO'), s.ctx), /TODO/);
});

test('marketing emails need the unsubscribe link and the postal address', async () => {
  const data = { ...DATA, unsubscribeUrl: 'https://example.com/unsub' };
  const s = await sample({ type: 'marketing', data });
  assert.deepEqual(checkHtml(s.html, s.ctx).problems, []);
  assert.match(problemsOf(s.html.replace('>Unsubscribe<', '>Leave<'), s.ctx), /Unsubscribe/);
  assert.match(problemsOf(s.html.replace(s.ctx.brand.address, ''), s.ctx), /postal address/);
  assert.match(checkText(s.text.replace(data.unsubscribeUrl, ''), { ...s.ctx, html: s.html }).problems.join('\n'), /unsubscribe/);
});

test('plain text: every link, no markup', async () => {
  const s = await sample();
  const ctx = { ...s.ctx, html: s.html };
  assert.match(checkText(s.text.replace('https://app.example.com/report/1', ''), ctx).problems.join('\n'), /missing the link/);
  assert.match(checkText(`${s.text}<b>x</b>`, ctx).problems.join('\n'), /HTML tags/);
  assert.match(checkText(`${s.text} &amp;`, ctx).problems.join('\n'), /entities/);
  assert.match(checkText('', ctx).problems.join('\n'), /empty/);
});

test('subject and preheader', () => {
  assert.match(checkMeta({ subject: '', preheader: 'x'.repeat(50) }).problems.join(), /subject is empty/);
  assert.match(checkMeta({ subject: 'Hi', preheader: '' }).problems.join(), /preheader is empty/);
  assert.match(checkMeta({ subject: 'x'.repeat(120), preheader: 'x'.repeat(50) }).problems.join(), /under 70/);
  assert.equal(checkMeta({ subject: 'x'.repeat(80), preheader: 'x'.repeat(50) }).warnings.length, 1);
});

test('brand details typed into an email are a warning, not a failure', async () => {
  const { brand } = makeProject();
  const body = `<mj-section><mj-column><mj-text>Find us at ${brand.address}. Questions: ${brand.supportEmail}</mj-text>{{> sign-off}}</mj-column></mj-section>`;
  const s = await sample({ body });
  const r = checkHtml(s.html, s.ctx);
  assert.deepEqual(r.problems, []);
  const w = r.warnings.join('\n');
  assert.match(w, /emails\/report\.mjml types out brand\.json's address/);
  assert.match(w, /\{\{brand\.supportEmail\}\}/);
  const fine = await sample({ body: '<mj-section><mj-column><mj-text>Find us at {{brand.address}}.</mj-text></mj-column></mj-section>' });
  assert.doesNotMatch(checkHtml(fine.html, fine.ctx).warnings.join('\n'), /types out/);
});

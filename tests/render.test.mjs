import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEmail } from '../src/render.mjs';
import { BODY, DATA, makeProject } from './helpers.mjs';

test('renders subject, HTML and plain text from the data', async () => {
  const { dir } = makeProject();
  const r = await renderEmail('report', DATA, { root: dir });
  assert.equal(r.subject, 'Your report, Ada');
  assert.match(r.html, /Hello Ada/);
  assert.match(r.html, /<html lang="en"/);
  assert.deepEqual(r.warnings, []);
  assert.match(r.text, /Open the report \(https:\/\/app\.example\.com\/report\/1\)/);
  assert.doesNotMatch(r.text, /Three boards, one page/, 'the hidden preheader stays out of the plain text');
});

test('formats dates and money from the data with the brand locale, never the clock', async () => {
  const { dir } = makeProject();
  const r = await renderEmail('report', DATA, { root: dir });
  assert.match(r.text, /14 October 2026/);
  assert.match(r.text, /£12\.50/);
  assert.match(r.text, /3 boards/);
  await assert.rejects(renderEmail('report', { ...DATA, price: 12.5 }, { root: dir }), /whole minor units/);
});

test('missing data is an error that names the field, not an empty gap', async () => {
  const { dir } = makeProject();
  const { user, ...rest } = DATA;
  await assert.rejects(renderEmail('report', rest, { root: dir }), (e) => e.userFacing && /"user"|firstName/.test(e.message));
});

test('data is HTML-escaped', async () => {
  const { dir } = makeProject();
  const r = await renderEmail('report', { ...DATA, user: { firstName: '<script>x</script>' } }, { root: dir });
  assert.doesNotMatch(r.html, /<script>x/);
  assert.match(r.html, /&lt;script&gt;x/);
});

test('marketing emails get the unsubscribe footer and List-Unsubscribe headers', async () => {
  const { dir } = makeProject({ type: 'marketing' });
  const unsubscribeUrl = 'https://example.com/unsub?u=1';
  const r = await renderEmail('report', { ...DATA, unsubscribeUrl }, { root: dir });
  assert.equal(r.headers['List-Unsubscribe'], `<${unsubscribeUrl}>`);
  assert.equal(r.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(r.html, />Unsubscribe</);
  const t = makeProject();
  const tr = await renderEmail('report', DATA, { root: t.dir });
  assert.deepEqual(tr.headers, {});
  assert.doesNotMatch(tr.html, /Unsubscribe/);
});

test('MJML mistakes come back as warnings with the file', async () => {
  const { dir } = makeProject({ body: BODY.replace('<mj-text>Your', '<mj-text colour="red">Your') });
  const r = await renderEmail('report', DATA, { root: dir });
  assert.ok(r.warnings.some((w) => /emails\/report\.mjml/.test(w) && /colour/.test(w)), r.warnings.join('\n'));
});

test('data tables become aligned columns in the plain text', async () => {
  const body = `<mj-section><mj-column><mj-table css-class="ink data">
    <tr><th>Item</th><th>Amount</th></tr>
    {{#each items}}<tr><td>{{name}}</td><td>{{money amount "EUR"}}</td></tr>{{/each}}
  </mj-table>{{> sign-off}}</mj-column></mj-section>`;
  const { dir } = makeProject({ body });
  const r = await renderEmail('report', { ...DATA, items: [{ name: 'Seats', amount: 900 }, { name: 'Storage', amount: 100 }] }, { root: dir });
  assert.match(r.text, /Item\s+Amount\nSeats\s+€9\.00\nStorage\s+€1\.00/);
});

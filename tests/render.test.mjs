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

test('date styles with the time, in the brand locale and time zone', async () => {
  const body = '<mj-section><mj-column><mj-text>A:{{date at "fulldatetime"}}|B:{{date summer "fulldatetime"}}|C:{{date at "time"}}|D:{{date at "nonsense"}}</mj-text></mj-column></mj-section>';
  const data = { ...DATA, at: '2026-11-03T09:30:00Z', summer: '2026-07-14T09:30:00Z' };
  const { dir } = makeProject({ body, data, brand: { locale: 'en-IE', timeZone: 'Europe/Dublin' } });
  const r = await renderEmail('report', data, { root: dir });
  const text = r.text.replace(/\s+/g, ' '); // the plain text wraps long lines
  assert.match(text, /A:Tuesday 3 November 2026 at 09:30\|/);
  assert.match(text, /B:Tuesday 14 July 2026 at 10:30\|/, 'summer time is UTC+1 in Dublin');
  assert.match(text, /C:09:30\|/);
  assert.match(text, /D:3 November 2026/, 'an unknown style falls back to long');
  const us = makeProject({ body, data, brand: { locale: 'en-US', timeZone: 'America/New_York' } });
  const u = await renderEmail('report', data, { root: us.dir });
  assert.match(u.text.replace(/\s+/g, ' '), /A:Tuesday, November 3, 2026 at 4:30\sAM\|/);
});

test('the sign-off: the email\'s own data, then brand.json, then the default', async () => {
  const plain = makeProject();
  const d = await renderEmail('report', DATA, { root: plain.dir });
  assert.match(d.text, /Thanks,\s+The Pebblework team/);
  const branded = makeProject({ brand: { signOff: 'See you soon,', sender: 'Niamh and the workshop crew' } });
  const b = await renderEmail('report', DATA, { root: branded.dir });
  assert.match(b.text, /See you soon,\s+Niamh and the workshop crew/);
  const own = await renderEmail('report', { ...DATA, sender: 'Ciarán' }, { root: branded.dir });
  assert.match(own.text, /See you soon,\s+Ciarán/);
  assert.doesNotMatch(own.text, /workshop crew/);
});

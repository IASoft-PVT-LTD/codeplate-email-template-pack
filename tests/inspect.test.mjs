// Needs a browser (the same one the checks use); skipped when none is found.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { findTool } from '../checks/shared/find-tool.mjs';
import { inspectEmails } from '../src/inspect.mjs';
import { renderImages } from '../src/images.mjs';
import { renderEmail } from '../src/render.mjs';
import { BODY, DATA, makeProject } from './helpers.mjs';

const hasBrowser = !findTool('browser').error;

test('the browser catches dark-mode contrast, outside requests, stretched pictures and wide content', { skip: !hasBrowser && 'no browser found' }, async () => {
  const extra = [
    '<mj-image src="{{asset brand.logo.file}}" alt="Logo" width="300px" height="40px" />',
    '<mj-text><img src="https://tracker.example.com/open.gif" width="1" height="1" alt="" role="presentation"></mj-text>',
    '<mj-text><table role="presentation" width="900"><tr><td>wide</td></tr></table></mj-text>',
    '<mj-raw><p>Raw paragraph without colour</p></mj-raw>',
  ].join('\n');
  const body = BODY.replace('{{> sign-off}}', `{{> sign-off}}\n${extra}`);
  const { dir, brand } = makeProject({ body, brand: { dark: { muted: '#2a2f35' } } });
  const r = await renderEmail('report', DATA, { root: dir });
  const { reports } = await inspectEmails([{ id: 'report', html: r.html }], { brand, root: dir, screenshots: false });
  const all = (view) => reports.report[view].join('\n');
  assert.match(all('light'), /tracker\.example\.com/);
  assert.match(all('light'), /stretched/);
  assert.match(all('light'), /"Raw paragraph without colour" gets its colour only from the <style> block/);
  assert.match(all('dark'), /contrast .*We sent this to/);
  assert.match(all('mobile'), /wide on a 375px phone/);
});

test('a dark cut-out logo vanishes on the dark-mode page', { skip: !hasBrowser && 'no browser found' }, async () => {
  const { dir, brand } = makeProject();
  mkdirSync(join(dir, 'assets', 'src'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'src', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="88" height="88"><circle cx="44" cy="44" r="36" fill="none" stroke="#222831" stroke-width="10"/></svg>');
  writeFileSync(join(dir, 'assets.json'), JSON.stringify({ assets: [{ path: 'assets/images/logo.png', kind: 'image', width: 88, height: 88, use: 'test', license: 'CodePlate-original', credit: 'test' }] }));
  const drawn = await renderImages({ root: dir });
  assert.deepEqual(drawn.problems, []);
  const r = await renderEmail('report', DATA, { root: dir });
  const { reports } = await inspectEmails([{ id: 'report', html: r.html }], { brand, root: dir, screenshots: false });
  assert.match(reports.report.dark.join('\n'), /logo\.png: \d+% of the picture is nearly the colour behind it .* vanishes in dark mode/);
  assert.doesNotMatch(reports.report.light.join('\n'), /vanishes/);
});

test('the frame and a simple email pass in light, dark and on a phone', { skip: !hasBrowser && 'no browser found' }, async () => {
  const { dir, brand } = makeProject();
  const r = await renderEmail('report', DATA, { root: dir });
  const { reports } = await inspectEmails([{ id: 'report', html: r.html }], { brand, root: dir, screenshots: false });
  assert.deepEqual(reports.report, { light: [], dark: [], mobile: [] });
});

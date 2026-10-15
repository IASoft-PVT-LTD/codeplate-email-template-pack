import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { checkBrand, checkProject } from '../src/config.mjs';
import { brandPairs, passingShade, ratio } from '../src/contrast.mjs';
import { buildEml } from '../src/eml.mjs';
import { makeProject } from './helpers.mjs';

test('the project as made passes', () => {
  const { dir } = makeProject();
  assert.deepEqual(checkProject(dir).problems, []);
});

test('brand.json: colours, unknown settings, the asset address', () => {
  const { brand } = makeProject();
  assert.match(checkBrand({ ...brand, light: { ...brand.light, text: 'red' } }).join('\n'), /light\.text must be a #rrggbb/);
  assert.match(checkBrand({ ...brand, colour: '#000000' }).join('\n'), /unknown setting "colour"/);
  assert.match(checkBrand({ ...brand, assetBaseUrl: 'https://cdn.example.com/img' }).join('\n'), /ending in \//);
});

test('emails.json and emails/ must agree', () => {
  const { dir } = makeProject();
  writeFileSync(join(dir, 'emails', 'stray.mjml'), '<mj-section></mj-section>');
  assert.match(checkProject(dir).problems.join('\n'), /stray\.mjml: not in emails\.json/);
  const m = makeProject({ type: 'marketing' });
  assert.match(checkProject(m.dir).problems.join('\n'), /needs "unsubscribeUrl"/);
  const t = makeProject({ extra: { kind: 'x' } });
  assert.match(checkProject(t.dir).problems.join('\n'), /unknown setting "kind"/);
});

test('contrast: ratios and passing shades', () => {
  assert.equal(Math.round(ratio('#000000', '#ffffff')), 21);
  const shade = passingShade('#e0a526', '#ffffff', 4.5);
  assert.ok(ratio(shade, '#ffffff') >= 4.5);
  const { brand } = makeProject();
  assert.ok(brandPairs(brand).every((p) => p.ok));
  assert.ok(brandPairs({ ...brand, dark: { ...brand.dark, muted: '#30343a' } }).some((p) => !p.ok && p.fg === 'dark.muted'));
});

test('the .eml preview carries text, HTML and the pictures inline', () => {
  const { dir, brand } = makeProject();
  const html = `<html><body><img src="${brand.assetBaseUrl}${brand.logo.file}" alt=""><p>Hi</p></body></html>`;
  const eml = buildEml({ from: 'A <a@example.com>', to: 'b@example.com', subject: 'Héllo', html, text: 'Hi', brand, root: dir, boundarySeed: 't' });
  assert.match(eml, /Subject: =\?UTF-8\?B\?/);
  assert.match(eml, /multipart\/alternative/);
  assert.match(eml, /Content-ID: <img1\.t@preview>/);
  const htmlPart = eml.split('Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];
  assert.match(Buffer.from(htmlPart.replace(/\r\n/g, ''), 'base64').toString('utf8'), /src="cid:img1\.t@preview"/);
});

test('brand.json signOff and sender are optional text', () => {
  const { brand } = makeProject();
  assert.deepEqual(checkBrand({ ...brand, signOff: 'Cheers,', sender: 'The workshop' }), []);
  assert.match(checkBrand({ ...brand, sender: 42 }).join('\n'), /"sender" must be text/);
  assert.match(checkBrand({ ...brand, signOff: ' ' }).join('\n'), /"signOff" must be text/);
});

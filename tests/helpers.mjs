// A small project in a temp folder (the real partials and brand, one email of our own), so the
// tests keep passing however the user changes the sample emails.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../src/render.mjs';

export const BODY = `<mj-section><mj-column>
  <mj-text mj-class="h1"><h1 style="margin:0;">Hello {{user.firstName}}</h1></mj-text>
  <mj-text>Your report for {{date day}} is ready. It covers {{plural count "board" "boards"}} and costs {{money price "GBP"}}.</mj-text>
  {{> button url=actionUrl label="Open the report"}}
  {{> sign-off}}
</mj-column></mj-section>`;

export const DATA = {
  recipient: { email: 'test@example.com' },
  user: { firstName: 'Ada' },
  day: '2026-10-14',
  count: 3,
  price: 1250,
  actionUrl: 'https://app.example.com/report/1',
};

export function makeProject({ body = BODY, data = DATA, type = 'transactional', brand: patch = {}, extra = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'email-pack-test-'));
  cpSync(join(ROOT, 'partials'), join(dir, 'partials'), { recursive: true });
  mkdirSync(join(dir, 'assets', 'images'), { recursive: true });
  mkdirSync(join(dir, 'emails'), { recursive: true });
  const brand = JSON.parse(readFileSync(join(ROOT, 'brand.json'), 'utf8'));
  const merged = { ...brand, ...patch, light: { ...brand.light, ...patch.light }, dark: { ...brand.dark, ...patch.dark } };
  writeFileSync(join(dir, 'brand.json'), JSON.stringify(merged));
  cpSync(join(ROOT, 'assets', 'images', brand.logo.file), join(dir, 'assets', 'images', brand.logo.file));
  writeFileSync(join(dir, 'emails.json'), JSON.stringify({ emails: [{ id: 'report', type, subject: 'Your report, {{user.firstName}}', preheader: 'Three boards, one page, and the link to the full report inside.', ...extra }] }));
  writeFileSync(join(dir, 'emails', 'report.mjml'), body);
  writeFileSync(join(dir, 'emails', 'report.props.json'), JSON.stringify(data));
  return { dir, brand: merged };
}

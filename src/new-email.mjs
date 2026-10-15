// `npm run new-email -- <id> [--marketing]`: a new email with TODO markers, wired into
// emails.json. The preview data comes from brand.json (its site and domain), so a new email
// never starts out addressed to the sample company's customer.
//
//   newEmail(root, 'booking-reminder', { marketing: false }) -> { files: [...] }
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBrand, userError } from './render.mjs';

export const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Preview data for a new email, from brand.json's url.
export function starterProps(brand, { marketing = false } = {}) {
  let site = 'https://example.com';
  let domain = 'example.com';
  try {
    const u = new URL(brand.url);
    site = u.origin;
    domain = u.hostname.replace(/^www\./, '');
  } catch {
    // No usable brand.url: example.com stands in until it's set.
  }
  const props = { recipient: { email: `customer@${domain}` }, user: { firstName: 'TODO' }, actionUrl: `${site}/TODO` };
  if (marketing) props.unsubscribeUrl = `${site}/email/unsubscribe?u=TODO`;
  return props;
}

export function newEmail(root, id, { marketing = false } = {}) {
  if (!ID.test(id ?? '')) throw userError('usage: npm run new-email -- <kebab-case-id> [--marketing]');
  if (existsSync(join(root, 'emails', `${id}.mjml`))) throw userError(`emails/${id}.mjml already exists`);
  const brand = loadBrand(root);
  const listFile = join(root, 'emails.json');
  const list = JSON.parse(readFileSync(listFile, 'utf8'));
  list.emails.push({ id, type: marketing ? 'marketing' : 'transactional', subject: 'TODO subject for {{user.firstName}}', preheader: 'TODO: the line the inbox shows after the subject, 40-130 characters long.', about: 'TODO: when this email is sent.' });
  writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`);
  writeFileSync(join(root, 'emails', `${id}.mjml`), `{{!-- ${id}: TODO say when it is sent. Data: emails/${id}.props.json --}}
<mj-section>
  <mj-column>
    <mj-text mj-class="h1"><h1 style="margin:0;font-size:30px;font-weight:400;">TODO heading</h1></mj-text>
    <mj-text>Hi {{user.firstName}}, TODO the message.</mj-text>
    {{> button url=actionUrl label="TODO what the button does"}}
    {{> sign-off}}
  </mj-column>
</mj-section>
`);
  writeFileSync(join(root, 'emails', `${id}.props.json`), `${JSON.stringify(starterProps(brand, { marketing }), null, 2)}\n`);
  return { files: [`emails/${id}.mjml`, `emails/${id}.props.json`, 'emails.json'] };
}

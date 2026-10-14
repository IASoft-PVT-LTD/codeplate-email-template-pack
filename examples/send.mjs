// How your app sends these emails, shown with two sending services' HTTP APIs (no SDK needed).
// By default this only PRINTS the request it would make; nothing is sent.
//
//   npm run send -- resend password-reset --to you@example.com            (dry run: prints it)
//   npm run send -- postmark receipt --to you@example.com                  (dry run)
//   RESEND_API_KEY=… npm run send -- resend welcome --to you@example.com --from "Pebblework <hello@your-domain>" --send
//
// --send really sends, and needs the service's key in the environment (RESEND_API_KEY or
// POSTMARK_SERVER_TOKEN) and a sender address on a domain you have verified with that service.
// The email is rendered with its preview data (emails/<id>.props.json), the same way your app
// would call renderEmail(id, data) with real data. Other services and SMTP: docs/recipes/send-emails.md.
import { loadBrand, loadProps, renderEmail } from '../src/render.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const [provider, id] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const really = args.includes('--send');

const PROVIDERS = {
  // https://resend.com/docs/api-reference/emails/send-email
  resend: {
    keyEnv: 'RESEND_API_KEY',
    request: (m, key) => ({
      url: 'https://api.resend.com/emails',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: { from: m.from, to: [m.to], subject: m.subject, html: m.html, text: m.text, headers: m.headers },
    }),
  },
  // https://postmarkapp.com/developer/api/email-api
  postmark: {
    keyEnv: 'POSTMARK_SERVER_TOKEN',
    request: (m, key) => ({
      url: 'https://api.postmarkapp.com/email',
      headers: { 'X-Postmark-Server-Token': key, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: {
        From: m.from, To: m.to, Subject: m.subject, HtmlBody: m.html, TextBody: m.text,
        // Postmark keeps marketing mail on a separate "broadcast" stream.
        MessageStream: m.type === 'marketing' ? 'broadcast' : 'outbound',
        Headers: Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })),
      },
    }),
  },
};

const p = PROVIDERS[provider];
if (!p || !id) {
  console.log(`usage: npm run send -- <${Object.keys(PROVIDERS).join('|')}> <email-id> --to <address> [--from "Name <address>"] [--send]`);
  process.exit(2);
}
const brand = loadBrand();
const data = loadProps(id);
const to = opt('to') ?? data.recipient.email;
const email = await renderEmail(id, { ...data, recipient: { ...data.recipient, email: to } });
const from = opt('from') ?? `${brand.name} <${brand.supportEmail}>`;
const key = process.env[p.keyEnv];
const req = p.request({ ...email, from, to }, really ? key : `<${p.keyEnv}>`);

if (!really) {
  const shown = JSON.parse(JSON.stringify(req.body));
  for (const k of Object.keys(shown)) if (typeof shown[k] === 'string' && shown[k].length > 120) shown[k] = `${shown[k].slice(0, 80)}… (${shown[k].length} characters)`;
  console.log(`DRY RUN, nothing sent. ${provider} would receive:\nPOST ${req.url}\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${JSON.stringify(shown, null, 2)}`);
  console.log('\nAdd --send (with the key in the environment) to send it for real.');
} else {
  if (!key) {
    console.log(`Set ${p.keyEnv} first (from your ${provider} account). Never commit it.`);
    process.exit(1);
  }
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  console.log(`${provider} answered ${res.status}: ${await res.text()}`);
  process.exitCode = res.ok ? 0 : 1;
}

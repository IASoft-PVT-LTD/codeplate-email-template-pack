# Send the emails from the user's app

Use this when the user asks how their app sends these emails, or to wire one up. Never send real email yourself while working; give the user the code and let them run the first send.

## What every service needs

`renderEmail(id, data)` (`src/render.mjs`) returns everything: `subject`, `html`, `text`, and `headers` (`List-Unsubscribe` and `List-Unsubscribe-Post` for marketing emails). Every sending service takes those plus a From address on a domain they have verified with it (SPF and DKIM records; DMARC for bulk mail). The app passes real data in the same shape as `emails/<id>.props.json`.

```js
import { renderEmail } from './email-template-pack/src/render.mjs';
const email = await renderEmail('receipt', { recipient: { email: to }, customer, receipt, invoiceUrl, billingUrl });
```

The folder's `brand.json`, `emails.json`, `emails/` and `partials/` must ship with the app (the renderer reads them), along with `node_modules` for `mjml`, `handlebars` and `html-to-text`. Rendering takes milliseconds, so render per send; for very high volume, render once per locale and data shape and cache.

## Two worked examples (dry run by default)

```
npm run send -- resend password-reset --to you@example.com     prints the Resend API request
npm run send -- postmark newsletter --to you@example.com       prints the Postmark API request
```

`examples/send.mjs` builds the exact HTTP request each API expects (Resend: `POST https://api.resend.com/emails` with `from`, `to`, `subject`, `html`, `text`, `headers`; Postmark: `POST https://api.postmarkapp.com/email` with `From`, `To`, `Subject`, `HtmlBody`, `TextBody`, `MessageStream`, `Headers`). The user sends for real by setting `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN` in their environment and adding `--send` and `--from "Name <address@their-domain>"`. Keys never go in files in this folder.

## Other services

Each takes the same parts; map them like this (check the service's current API docs for its exact field names):

- **SendGrid** (`@sendgrid/mail` or `POST /v3/mail/send`): `content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }]` (plain text first), `subject`, `headers`.
- **Amazon SES** (`@aws-sdk/client-sesv2`, `SendEmailCommand`): `Content.Simple` with `Subject`, `Body.Html`, `Body.Text`, and `Headers` for List-Unsubscribe.
- **Mailgun** (`POST /v3/<domain>/messages`, form fields): `html`, `text`, `subject`, and `h:List-Unsubscribe` style header fields.
- **SMTP** (Nodemailer, MIT): `transporter.sendMail({ from, to, subject, html, text, headers })`.
- **Templates stored in the service** (Mailchimp, Brevo, SendGrid dynamic templates): see `esp-templates.md`.

## Before the first real send

1. Upload `assets/images/` to the `assetBaseUrl` folder (`pictures.md`).
2. Replace every `*.example` link in the props files' shapes with the app's real URLs (the app passes them).
3. Marketing emails: the unsubscribe URL must work with a click (GET) and with Gmail's one-click POST (`List-Unsubscribe-Post`), and the app must stop sending to that address.
4. Send one of each to the user's own inboxes (Gmail, Outlook, Apple Mail if they have them) from the service's test mode or a test list, and look at them on a phone and in dark mode.

## Verify

- `npm run send -- <provider> <id>` prints a request with the right subject, the HTML and text sizes, and the List-Unsubscribe headers for marketing emails.
- `npm run check` ends with `CODEPLATE CHECKS: PASS`.
- The user confirms the test sends arrived (not in spam) and look right; record the service and From address in `docs/project.md` (Sending).

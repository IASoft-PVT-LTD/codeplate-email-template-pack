# Email Template Pack

> **Free CodePlate template, v1.0.2.** This repository mirrors the zip on [codeplate.io](https://codeplate.io/t/email-template-pack/).
> Press **Use this template** to start your own repository from it, or [download the zip](https://codeplate.io/t/email-template-pack/).
> [All templates](https://codeplate.io/) · [Free License](https://codeplate.io/license/free/) · subscribers get it under the [Pro License](https://codeplate.io/license/pro/) with no credit.

Ten emails your product sends, written so they render everywhere: welcome, verify email, password reset, magic link, receipt, trial ending, order shipped, team invite, newsletter and product update. Each one comes out as HTML (styles inlined, under Gmail's 102 KB clip limit, with its own dark mode) and a plain-text version, ready for any sending service. Built for an AI agent to adapt: hand this folder to your agent and tell it about your product.

Built with CodePlate (codeplate.io)

## What's inside

- **`emails/`**: the ten emails as MJML with Handlebars placeholders, each with an example data file (`<id>.props.json`).
- **`brand.json`**: your name, logo, address, fonts, and the light and dark colours every email uses.
- **`partials/`**: the shared frame: header, footer (with the unsubscribe link on newsletters), buttons, dark-mode styles.
- **`src/render.mjs`**: `renderEmail(id, data)` returns `{ subject, html, text, headers }` for your app to send.
- **Checks**: size, dark mode, images, links, plain text, accessibility (lang, layout tables, WCAG contrast in light and dark), and screenshots at desktop, dark and phone sizes.

The sample brand, **Pebblework** (a planning app with a paper-planner shop), its people and addresses are made up.

## Get started

You need **Node.js 22 or newer** and **Chrome, Edge or Chromium** (Windows has Edge; or run `npx playwright install chromium`). No accounts or API keys.

```
npm ci
npm run check        ends with CODEPLATE CHECKS: PASS
npm run preview      screenshots in shots/ (contact-light.png, contact-dark.png, contact-mobile.png)
npm run build        out/<id>.html, .txt, .json and .eml for every email
```

Double-click `out/<id>.eml` to open an email in Outlook, Apple Mail or Thunderbird on your computer, with its pictures, without sending anything.

## Sending

Your app renders an email with real data and passes the HTML and text to your sending service:

```js
import { renderEmail } from './src/render.mjs';

const email = await renderEmail('password-reset', {
  recipient: { email: user.email },
  user: { firstName: user.firstName },
  resetUrl, expiresInMinutes: 30,
  request: { at: new Date().toISOString(), device: 'Firefox on Windows', location: 'Bristol, United Kingdom' },
});
// email.subject, email.html, email.text, email.headers → Resend, Postmark, SendGrid, SES, Mailgun, SMTP…
```

`npm run send -- resend password-reset` and `npm run send -- postmark receipt` print the exact API request (nothing is sent unless you add `--send` and your key). `docs/recipes/send-emails.md` covers the other services and SMTP. Upload `assets/images/` to the public https folder named in `brand.json` (`assetBaseUrl`) before your first send.

## What the checks can't see

They measure the email's own dark mode (as Apple Mail and other apps that support it show it), but Gmail and Outlook.com recolour emails in their own way. They reject the CSS Outlook for Windows can't handle, but don't run Outlook. They can't judge deliverability (that depends on your domain's SPF, DKIM and DMARC and your list). Before a big send, open the `.eml` files in the mail apps you have, send yourself a test, and consider a paid preview service such as Litmus or Email on Acid.

## How this template was made

This template was written largely by AI coding agents (Claude, by Anthropic). IASoft reviewed and tested the work. The template's checks run on every change.

## License

You can use and change this template to make your own emails, including commercially, and send the emails you make to anyone. If you share or publish the project itself, its documentation must keep the credit "Built with CodePlate (codeplate.io)". You can't resell the template itself. See LICENSE.md. MJML, Handlebars, html-to-text and htmlparser2 are MIT, domutils is BSD-2-Clause and Playwright is Apache-2.0; they install with `npm ci`. See CREDITS.md.

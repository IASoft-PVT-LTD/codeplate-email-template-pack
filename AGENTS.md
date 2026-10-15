# Email Template Pack: agent brief

You are making the user's emails, starting from this template: the account and order emails their product sends, and their newsletter. This brief tells you how the project works, what to ask before changing anything, the rules that keep emails readable in every inbox, and how to check every change. Read it all once. Then follow **Interview** before your first edit.

## Start here

This folder turns short templates into emails that work in Gmail, Outlook, Apple Mail and on phones. Each email is **MJML** (an email markup that compiles to the table-based HTML mail apps need; MJML 5.4, pinned in `package.json`) with **Handlebars** `{{placeholders}}` for the data, and comes out as HTML with the CSS inlined plus a plain-text version. It ships ten emails for a made-up planning app, **Pebblework**:

- **Transactional** (account and order emails people need): `welcome`, `verify-email`, `password-reset`, `magic-link` (sign-in link + code), `receipt` (line items, tax, total), `trial-ending`, `order-shipped` (tracking, parcel contents), `team-invite`.
- **Marketing** (sent to subscribers; they get an unsubscribe link and headers): `newsletter`, `product-update`.
- **One brand file**, `brand.json`: name, logo, postal address, fonts, width, corner radius, and two colour sets, `light` and `dark`. Every email takes its look from it through `partials/layout.mjml`.
- **Preview data** per email, `emails/<id>.props.json`: the checks render every email with it, and it documents what data your app must pass.
- **Outputs** in `out/`: `<id>.html` and `<id>.txt` (the two parts to send), `<id>.json` (subject, preheader, headers), and `<id>.eml` to open in a real mail app. The user's app sends emails by calling `renderEmail(id, data)` from `src/render.mjs`; `examples/send.mjs` shows Resend and Postmark (dry run by default).

```
npm run preview                   build + screenshots: shots/contact-light.png, contact-dark.png, contact-mobile.png, shots/<id>/*.png
npm run preview -- <id>           one email; prints shots/<id>/all.png (light, dark, phone side by side) last
npm run preview -- receipt        just one email
npm run build                     out/<id>.html, .txt, .json, .eml for every email
npm run lint                      the rules without a browser (instant)
npm run contrast                  brand.json's colour pairs in light and dark, with a passing shade for any that fail
npm run images                    draw assets/src/*.svg into assets/images/*.png
npm run new-email -- <id>         a new email with its data file and emails.json entry (--marketing for a newsletter-type email)
npm run render -- <id> --data f.json   one email with other data (long names, empty lists, merge tags) → out/render/
npm run send -- resend <id>       print what would be sent to Resend (or postmark); nothing is sent without --send
```

**Verify any change** with one command from this folder. It must end with `CODEPLATE CHECKS: PASS`:

```
npm ci && npm run check
```

(`npm ci` only the first time and after `package.json` changes.) It needs **Node 22 or newer** and a **Chromium-based browser** (Chrome, Edge or Chromium): the checks open every email in it to measure contrast and take the screenshots. `npm run browser` prints the one it found. It looks at `CHROME_PATH`, then PATH, then the usual install folders, then Playwright's Chromium. None found: Windows has Edge; on macOS install Google Chrome; on Linux `sudo apt install chromium-browser`; on any OS `npx playwright install chromium`. Write the browser path in `docs/project.md` once it works.

MJML's components (`mj-section`, `mj-column`, `mj-text`, `mj-button`, `mj-image`, `mj-table`, `mj-divider`, `mj-group`, `mj-spacer`) and their attributes are documented at https://documentation.mjml.io/ ; Handlebars at https://handlebarsjs.com/guide/ . **Common pitfalls** lists the usual mistakes.

## Interview

Before you change anything, read `docs/project.md`.

- **If it still contains `<!-- codeplate:project-stub -->`, interview the user first.** Ask only what you need, in one short message, and suggest defaults so they can say "yes":
  1. **The sender.** Product or company name, website, the support address replies should go to, and the postal address for the footer (marketing emails must carry one by law; transactional ones usually show it too).
  2. **Which emails.** Which of the ten they need, which they don't, and any others (e.g. "payment failed", "weekly digest"). For each: when it is sent and what it must say. Offer to remove the ones they don't need.
  3. **The brand.** Logo (a square PNG or SVG mark, readable on light and dark), colours (main, accent), and the tone of voice. Fonts: email uses the system fonts of each device (web fonts don't load in Gmail or Outlook); offer a sans or serif system stack. If a brand colour is too light to read as text, say you'll use a darker shade for text (`npm run contrast` finds it).
  4. **Sending.** Which service or library sends their email (Resend, Postmark, SendGrid, Amazon SES, Mailgun, SMTP via Nodemailer…), the From address, and where their images will be hosted (`assetBaseUrl`: any public https folder, e.g. their website's `/email-assets/`). Their app passes the real data; the props files are only examples.
  5. **Language and region.** The language of the emails (`lang`), date and money format (`locale`, `timeZone`, currencies).

  Then replace the stub in `docs/project.md` with their answers as short decisions, and remove the marker.
- **Otherwise, the project has started.** `docs/project.md` holds the decisions made so far. Follow them, and add new decisions as the user makes them.

Work in small steps: rebrand first (`rebrand.md`), remove the emails they don't need (`remove-an-email.md`), then rewrite the copy email by email, `npm run check`, look at the screenshots (**Seeing your work**), then the next change.

`README.md` and `codeplate.json` describe the template. Once the user's emails exist, rewrite `README.md` for them (how to preview, how their app sends), and leave `codeplate.json` and `LICENSE.md` in place. `LICENSE.md` (the CodePlate Free License) asks for the credit "Built with CodePlate (codeplate.io)" in the documentation of the project if they share or publish it: **keep that line in `README.md`**; the `credit` check looks for it. The emails themselves are their own and don't need it.

## Architecture

`emails/<id>.mjml` (Handlebars + MJML) is wrapped in `partials/layout.mjml` and filled with the data plus `brand.json` → MJML source → MJML compiles it to email HTML with the styles inlined → `html-to-text` makes the plain-text version. The same function, `renderEmail` in `src/render.mjs`, is used by the checks, `npm run build` and the user's app. See `docs/architecture.md`.

| Path | What lives there |
|---|---|
| `brand.json` | The **brand**: `name`, `url`, `assetBaseUrl` (where `assets/images/` is uploaded), `logo` (`file`, shown `width`/`height`), `supportEmail`, `address`, `lang`, `dir`, `locale`, `timeZone`, `fontFamily`, `headingFontFamily`, `width` (600), `radius`, `signOff` and `sender` (optional: how every email signs off), and colours `light` and `dark` (`page`, `card`, `text`, `muted`, `primary`, `onPrimary`, `accent`, `border`, `panel`, `link`). Unknown settings fail the checks. |
| `emails.json` | Every email: `id`, `type` (`transactional` or `marketing`), `subject`, `preheader` (both may use `{{data}}`), `about` (when it's sent). |
| `emails/<id>.mjml` | **The emails.** The inside of the layout: `mj-section`s with the content. Uses the partials and the `mj-class`es the layout defines. |
| `emails/<id>.props.json` | Each email's preview data: every value its placeholders use. Your app passes the same shape. |
| `partials/layout.mjml` | The frame: `<head>` (title, preheader, colour-scheme meta, default attributes from `brand.json`, the `mj-class`es `h1`, `h2`, `muted`, `panel`, `eyebrow`, and the **dark-mode styles**), then the header, the email, the footer. |
| `partials/header.mjml`, `footer.mjml` | The logo and name above the card; why they got it, support address, postal address and, for marketing emails, the unsubscribe links below it. |
| `partials/button.mjml`, `fallback-link.mjml`, `sign-off.mjml` | `{{> button url=… label="…"}}`, the "button not working?" link, the closing lines (`signOff`, `sender` in the data, optional). |
| `assets/images/` | Pictures emails use, as PNG/JPG/GIF at twice the size they're shown. `assets/src/*.svg` are sources that `npm run images` draws into PNGs. All listed in `assets.json`. |
| `src/render.mjs` | `renderEmail(id, data)` and the Handlebars helpers: `asset`, `money`, `date`, `plural`, `eq`. |
| `src/lint.mjs`, `src/inspect.mjs`, `src/config.mjs` | The rules: the HTML and plain text (no browser), the browser measurements and screenshots, the settings files. |
| `src/build.mjs`, `src/eml.mjs`, `src/cli.mjs`, `src/browser.mjs`, `src/images.mjs`, `src/contrast.mjs` | `npm run build`, the `.eml` previews, the npm commands, finding and driving the browser, drawing PNGs, the colour pairs. |
| `examples/send.mjs` | Sending through Resend's or Postmark's API (dry run unless `--send`). |
| `checks/run.mjs`, `checks/shared/` | The checks; `shared/` is CodePlate's tool finder, check runner and `assets.json` check (don't edit it). |
| `tests/` | `node --test` unit tests: rendering, the rules, settings, contrast, the `.eml` file, and the browser checks on purpose-built bad emails. They build small projects in a temp folder, so they keep passing whatever the user's emails are. |

## Rules

1. **Look and feel live in `brand.json` and `partials/layout.mjml`.** Colours, fonts, width and radius come from `brand.json`; component defaults and the `mj-class`es from the layout. In an email, use `mj-class="h1"`, `"muted"`, `"panel"`, `"eyebrow"` and the partials, not new colours. A one-off look that repeats becomes an `mj-class` in the layout.
2. **Every colour has a dark-mode twin.** A new colour in light mode needs its `dark` value and a rule in the layout's `@media (prefers-color-scheme: dark)` block, keyed on a `css-class`; the checks measure contrast in both modes. Text and links always carry their colour inline (MJML attributes or `style="color:…"`): Gmail with non-Google accounts and some Outlooks drop the `<style>` block.
3. **Every value comes from the data.** Names, dates, amounts, links and codes are `{{placeholders}}`, with an example in `emails/<id>.props.json`. Missing data is an error on purpose (an email must never go out as "Hi ,"); optional parts are wrapped in `{{#if x}}`. Money is whole minor units (`4900` = £49.00) through `{{money amount currency}}`, dates are ISO strings through `{{date …}}`; the billing system works out totals, never the template.
4. **Marketing emails carry the unsubscribe link and the postal address.** Mark them `"type": "marketing"` in `emails.json`, pass `unsubscribeUrl` (and optionally `preferencesUrl`); the footer and the `List-Unsubscribe` headers follow. Never send a marketing email as `transactional` to skip this: it's the law in most countries and Gmail and Yahoo require one-click unsubscribe from bulk senders.
5. **Stay under Gmail's 102 KB.** Gmail hides everything after 102 KB of HTML behind "View entire message", including the footer. The checks fail at 102 KB and warn at 80 KB; sending services' tracking links add more. Long newsletters: shorten or link out.
6. **Pictures are PNG, JPG or GIF files in `assets/images/`, with alt text and a width.** Use `{{asset "file.png"}}` for the address (it becomes `assetBaseUrl` + file), draw them at twice the size shown, and list them in `assets.json`. No SVG (Gmail and Outlook don't show it), no text that matters inside pictures (many people have images off), no picture-only emails. Only pictures the user owns or made, or CC0 ones.
7. **Links are absolute `https://` (or `mailto:`/`tel:`) with words that say where they go.** "Download the invoice", not "Click here". Security emails (verify, reset, invite) also print the link (`{{> fallback-link url=…}}`). Every link appears in the plain-text version automatically; don't hide links in pictures.
8. **Use what ships.** MJML, Handlebars, html-to-text, htmlparser2/domutils and playwright-core are pinned exactly in `package.json` with `package-lock.json`. No web fonts, tracking pixels, external CSS or scripts in templates (the checks block and report any outside request); the sending service adds tracking if the user wants it.
9. **Never weaken a check to make it pass.** Raising a limit, deleting a rule or sending a marketing email as transactional isn't a fix. If the user deliberately wants something the checks reject, explain the cost (clipping, spam folders, unreadable in dark mode) and record their decision in `docs/project.md`.
10. **Never send real email from this project while working.** Use `npm run build`, `npm run preview`, the `.eml` files and `npm run send` without `--send`. Real sends are the user's to make, with their own keys, which never go in files here.

## Verify

After every change:

1. **Run the full `npm run check`, every time.** The last line must be `CODEPLATE CHECKS: PASS`. It runs these steps (about 10 seconds) and lists each one's result and time:
   - `tools`: the browser, and the pinned MJML installed
   - `assets`: `assets.json` matches `assets/`
   - `emails`: `brand.json`, `emails.json` and `emails/` agree (settings, colours, each email's `.mjml` and `.props.json`, marketing emails have `unsubscribeUrl`)
   - `unit`: `node --test tests/`
   - `build`: every email renders with its data, with no MJML errors, into `out/`
   - `html`: under 102 KB; `lang`, charset, viewport; dark-mode meta tags and styles; no tags or CSS mail apps drop; images https + PNG/JPG/GIF + alt + width + the file exists; links https/mailto/tel with real text and an inline colour; layout tables `role="presentation"`; marketing: unsubscribe link and address; subject and preheader; no `{{`, `undefined` or `TODO` left; a warning (not a failure) when an email types out `brand.json`'s address or support email instead of `{{brand.address}}`, `{{brand.supportEmail}}`
   - `text`: the plain-text version has the whole message and every link, and no markup
   - `inspect`: each email in the browser in light (680 px), dark and on a 375 px phone: pictures load, keep their shape and don't vanish into the colour behind them (a dark cut-out logo on the dark page), WCAG AA contrast for every piece of text in light **and** dark, inline colours and fonts, text ≥ 12 px, no sideways scrolling, buttons ≥ 40 px tall, nothing loaded from outside `assets/`; screenshots, `shots/<id>/all.png` per email and contact sheets in `shots/`
   - `credit`, then `budget` (under the 90 seconds in `codeplate.json`)

   While you work, `npm run lint` (instant) and `npm run preview -- <id>` are fine. Then the full check before you report. A failing step repeats the end of its output above the summary.
2. **Look at the emails.** Open the three contact sheets, then `shots/<id>/all.png` of every email you changed: light, dark and phone side by side in one picture, so none of the three gets skipped (**Seeing your work**). The checks can't judge copy, hierarchy or whether it looks like the user's brand; you can.
3. **Tell the user** what changed, show the screenshots, and give the file paths (`out/<id>.html`/`.txt` to send, `out/<id>.eml` to open in their own mail app). Say what the checks can't see: Gmail's and Outlook.com's own dark mode, Outlook for Windows' layout engine, and their sending service's changes (see **What the checks can't see**). Suggest they send themselves a test from their sending service before the first real send.

## Recipes

Step-by-step guides for common requests. Follow the matching recipe when one fits; each ends with its own verification.

- `docs/recipes/rebrand.md`: their name, logo, colours (light and dark), fonts, address and asset folder.
- `docs/recipes/edit-an-email.md`: change the words, sections, buttons, panels, lists and pictures of one email.
- `docs/recipes/add-an-email.md`: a new email ("payment failed", "weekly digest"): `npm run new-email`, data, subject and preheader.
- `docs/recipes/remove-an-email.md`: take out the emails they don't need.
- `docs/recipes/dark-mode.md`: how dark mode works here, adding a colour, a logo for dark backgrounds, what Gmail does.
- `docs/recipes/tables-and-money.md`: receipts, invoices and order tables; money, tax lines, dates, currencies.
- `docs/recipes/pictures.md`: their pictures, drawing PNGs from SVG, sizes, hosting them (`assetBaseUrl`).
- `docs/recipes/send-emails.md`: sending from their app with Resend, Postmark, SendGrid, Amazon SES, Mailgun or SMTP; headers; testing.
- `docs/recipes/esp-templates.md`: when their service wants templates stored on its side (Mailchimp, Brevo, SendGrid dynamic templates): exporting HTML with the service's merge tags.
- `docs/recipes/languages.md`: another language, right-to-left, date and money formats, one email in several languages.

`docs/customization-map.md` answers "I want to change X — which file?" for everything else.

## Seeing your work

You can't open an inbox, but you can look at every email the way three readers would:

```
npm run preview                   → shots/contact-light.png, contact-dark.png, contact-mobile.png
                                    shots/<id>/light.png, dark.png, mobile.png (full length)
                                    shots/<id>/all.png (the three side by side)
npm run preview -- newsletter     just that email; prints shots/newsletter/all.png last
```

- **Open the contact sheets first**: all emails side by side, in light, in dark and at phone width. Check they look like one family (same header, footer, buttons, spacing), that nothing looks unlike the rest, and that dark mode reads as dark everywhere.
- **Then open `shots/<id>/all.png` for each email you changed** (light, dark and phone in one picture; the single PNGs are there for a closer look): copy, wrapping, button labels, table columns, picture crops, the footer. In `dark.png`, look for pictures with white boxes around them and logos that vanish; on `mobile.png`, for columns that stack in a sensible order and tables that still fit.
- **The real thing:** `out/<id>.eml` opens in Outlook, Apple Mail or Thunderbird on this computer (double-click it), with the pictures attached, so the user can see their own mail app's rendering without sending anything. `out/<id>.txt` is what people who read plain text get.
- `out/<id>.json` holds the subject, preheader, headers and sizes; read it to check what the inbox list will show.

## What the checks can't see

Say this plainly to the user when you report:

- **Gmail (web and apps) and Outlook.com** apply their own dark mode: they ignore the email's dark styles and recolour it themselves (partly or fully inverted). The checks measure the email's own dark mode (Apple Mail on Mac, iPhone and iPad, and other apps that support it), not Gmail's.
- **Outlook for Windows** (the desktop app that uses Word to draw email) supports a small subset of CSS. MJML writes the Outlook-specific tables and conditional comments for it, and the checks reject the CSS it can't handle, but nothing here runs Outlook itself. Open `out/<id>.eml` in Outlook if they have it, or use a paid preview service (Litmus, Email on Acid) before a big send.
- **Spam filtering and deliverability** depend on the sending domain (SPF, DKIM, DMARC), its reputation and the list, not on the template.
- The screenshots use the fonts of this computer; each reader's device uses its own system fonts.

## Common pitfalls

- **Text outside `mj-text`** (directly in `mj-column` or `mj-section`) is dropped by MJML with a warning, which fails the `build` step. All text goes in `mj-text`, `mj-button` or `mj-table`.
- **`{{> partial}}` inside an attribute** doesn't work; partials make whole components. Labels with data: pass the data (`label=feature.cta`) or write the `mj-button` yourself.
- **`{{{triple}}}` braces** skip HTML escaping; only use them for values from `brand.json`, never for user data (a name like `<script>` would end up in the email).
- **Inside `{{#each}}`**, top-level values need `@root.` (`{{@root.brand.light.border}}`) or `../`.
- **A new colour that only works in light mode**: add its dark value and a rule in the layout's dark block, or the `inspect` step fails dark contrast.
- **Columns side by side on phones**: `mj-column`s stack under 480 px; wrap them in `mj-group` to keep them side by side (only for small things like the trial email's numbers).
- **`height` on `mj-image`**: leave it out (it defaults to `auto`); a fixed height stretches the picture on phones, and the checks catch it.
- **MJML's font imports**: font stacks naming Roboto, Open Sans and others used to pull Google Fonts in; `src/render.mjs` turns that off (`fonts: {}`), and the checks reject any outside request anyway.
- **Windows paths in Git Bash**: keep the quotes in `npm test`'s glob, as the npm script does.

# Customization map

"I want to change X — which file?"

| I want to change… | Edit | Notes |
|---|---|---|
| Company name, website, support address, postal address | `brand.json` (`name`, `url`, `supportEmail`, `address`) | `rebrand.md` |
| Colours | `brand.json` `light` and `dark` | `npm run contrast` measures every pair; `rebrand.md`, `dark-mode.md` |
| Fonts | `brand.json` `fontFamily`, `headingFontFamily` (system font stacks) | web fonts don't load in Gmail or Outlook |
| The logo | `assets/images/<file>.png` (or `assets/src/logo.svg` + `npm run images`), `brand.json` `logo`, `assets.json` | `rebrand.md`, `pictures.md` |
| Where pictures are hosted | `brand.json` `assetBaseUrl` | upload `assets/images/` there; `pictures.md` |
| Email width, corner radius | `brand.json` `width`, `radius` | 600 px is the safe width |
| One email's words, sections, buttons | `emails/<id>.mjml` | `edit-an-email.md` |
| A subject line or preheader | `emails.json` | `{{data}}` works in both |
| The example data an email is previewed with | `emails/<id>.props.json` | your app passes the same shape |
| Add an email | `npm run new-email -- <id>` | `add-an-email.md` |
| Remove an email | `emails.json` entry + `emails/<id>.mjml` + `.props.json` | `remove-an-email.md` |
| Header (logo + name) | `partials/header.mjml` | every email |
| Footer (why, support, address, unsubscribe) | `partials/footer.mjml` | every email; marketing emails show the unsubscribe links |
| Button look | `brand.json` colours, `radius`; `mj-button` defaults in `partials/layout.mjml` | keep ≥ 40 px tall |
| Heading, muted, panel, eyebrow styles | the `mj-class`es in `partials/layout.mjml` | `edit-an-email.md` |
| Dark-mode colours of a new style | `partials/layout.mjml` dark block + `brand.json` `dark` | `dark-mode.md` |
| Money, date formats, time zone | `brand.json` `locale`, `timeZone`; `{{money}}`, `{{date}}` in `src/render.mjs` | `tables-and-money.md`, `languages.md` |
| Language of the emails | `brand.json` `lang` (and `dir`), the copy in `emails/`, `emails.json`, `partials/` | `languages.md` |
| The receipt's table, tax lines | `emails/receipt.mjml`, `receipt.props.json` | `tables-and-money.md` |
| What the plain-text version skips | `css-class="text-skip"` on a component; `TEXT_OPTIONS` in `src/render.mjs` | |
| Sending from the app | the app's code calling `renderEmail`; `examples/send.mjs` | `send-emails.md` |
| Templates stored in a sending service | `npm run render -- <id> --data <merge-tags.json>` | `esp-templates.md` |
| A check's rules | `src/lint.mjs`, `src/inspect.mjs`, `src/config.mjs` | never weaken one to pass; add rules instead |

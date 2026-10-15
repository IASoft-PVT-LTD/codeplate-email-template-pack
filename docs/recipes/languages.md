# Languages, right-to-left, date and money formats

Use this when the emails must be in another language, in several languages, or use another country's formats.

## One language for all emails

1. `brand.json`: `lang` (`"de"`, `"fr-CA"`: screen readers pick their voice from it), `dir` (`"rtl"` for Arabic, Hebrew, Persian), `locale` (dates and money: `"de-DE"` → `14. Oktober 2026`, `58,80 €`), `timeZone` (`"Europe/Berlin"`).
2. Translate every email's copy in `emails/*.mjml`, the subjects and preheaders in `emails.json`, and the fixed text in `partials/` (`footer.mjml`: "We sent this to…", "Unsubscribe"; `fallback-link.mjml`; `sign-off.mjml`; `header.mjml` has none). The footer's unsubscribe link is found by the checks by the word "Unsubscribe": in another language, keep the link's text as their word for it and change the `/unsubscribe/i` test in `src/lint.mjs` (`checkHtml`) to match it (e.g. `/abmelden|unsubscribe/i`).
3. **Right-to-left:** with `dir: "rtl"`, MJML sets the direction; buttons and `mj-image`s are `align="left"` by default in `partials/layout.mjml`: change the `mj-button` default to `align="right"`, and `padding-left` in list styles to `padding-right`.
4. Fonts: the system stacks cover most scripts; for CJK add `'Hiragino Sans', 'Noto Sans CJK JP', 'Yu Gothic', sans-serif`-style stacks to `fontFamily`.

## Several languages

Keep one email per language: `emails/welcome.mjml` (English) and `emails/welcome-de.mjml` (German), each in `emails.json` with its own subject and props file. The app picks `welcome-de` for German users. One limitation: `lang`, `locale` and the footer partial come from `brand.json` and `partials/`, shared by all emails. For a second language, pass `lang` in the data and make the layout read `{{#if lang}}{{lang}}{{else}}{{brand.lang}}{{/if}}`, and use `{{#if (eq lang "de")}}…{{else}}…{{/if}}` in the footer. Money and dates follow `brand.locale`; if they must differ per language, add a `locale` argument to the helpers in `src/render.mjs` (with a unit test in `tests/render.test.mjs`).

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (`html` checks `<html lang>` against `brand.json`).
- `npm run preview`; open the contact sheets: text in the right language everywhere, including footer and buttons; right-to-left emails aligned right.
- Read the `.txt` files: dates and amounts in the local format.

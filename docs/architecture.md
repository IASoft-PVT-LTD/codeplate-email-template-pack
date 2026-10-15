# Architecture

## The flow

```
emails.json (subject, preheader, type) ─┐
brand.json ─────────────────────────────┤
emails/<id>.props.json (or your data) ──┤
                                        ▼
emails/<id>.mjml ── wrapped in partials/layout.mjml ── Handlebars (strict) ──> MJML source
                    (header, footer, button, …)                                    │
                                                                                   ▼
                                                     MJML 5 (validation "soft", no font imports)
                                                                                   │
                                                     out/<id>.html  <──────────────┤ email HTML, styles inlined
                                                     out/<id>.txt   <── html-to-text
                                                     out/<id>.json, out/<id>.eml (src/build.mjs, src/eml.mjs)
```

1. **`renderEmail(id, data)`** (`src/render.mjs`) finds the email in `emails.json`, adds `brand` (from `brand.json`), `marketing` (true for `type: "marketing"`) and `email: { id, type }` to the data, and fills the **subject** and **preheader** first.
2. It wraps `emails/<id>.mjml` as `{{#> layout}} … {{/layout}}`, so every email gets `partials/layout.mjml` around it, and fills the whole thing with Handlebars in **strict mode**: a placeholder with no value throws an error naming it. `{{#if x}}` blocks don't throw, so optional parts stay optional.
3. **MJML** compiles the result to HTML: tables for layout, Outlook conditional comments, CSS inlined from the component attributes, the `<mj-style>` block kept in `<head>` (dark mode, small screens). MJML's own warnings come back as `warnings` (the `build` check fails on them). `fonts: {}` stops MJML importing Google Fonts for stacks that name Roboto or Open Sans.
4. **html-to-text** makes the plain-text part: the hidden preheader, pictures and anything with `css-class="text-skip"` are left out, links become `text (https://…)`, tables with header cells become aligned columns.
5. It returns `{ id, type, subject, preheader, html, text, headers, mjml, warnings }`. Marketing emails get `List-Unsubscribe: <unsubscribeUrl>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` in `headers` (your unsubscribe URL must accept a POST for one-click to work).

## The data every email gets

| Name | What |
|---|---|
| your data | everything in `emails/<id>.props.json` (or what your app passes): `recipient.email` is always needed (the footer says who it was sent to); marketing emails need `unsubscribeUrl`, and may pass `preferencesUrl` |
| `brand` | `brand.json` as it is: `{{brand.name}}`, `{{brand.light.text}}`, `{{brand.dark.card}}` … |
| `subject`, `preheader` | filled from `emails.json` (the layout uses them for `<title>` and the hidden preview text) |
| `marketing` | `true` for `type: "marketing"` |
| `email` | `{ id, type }` |
| `sender`, `signOff` | optional, used by `partials/sign-off.mjml` ("Thanks," / "The {{brand.name}} team" otherwise) |

## Helpers

| Helper | Example | Gives |
|---|---|---|
| `asset` | `{{asset "parcel.png"}}` | `brand.assetBaseUrl` + file: the public address of a file in `assets/images/` |
| `money` | `{{money 5880 "GBP"}}` | `£58.80` in `brand.locale`; amounts are whole minor units; floats throw |
| `date` | `{{date "2026-10-14"}}`, `{{date at "datetime"}}`, `{{date d "full"}}` | `14 October 2026`, `14 Oct 2026, 09:42`, `Friday, 16 October 2026`, in `brand.locale` and `brand.timeZone` |
| `plural` | `{{plural 3 "day" "days"}}` | `3 days` |
| `eq` | `{{#if (eq status "late")}}` | a comparison for `#if` |

## The layout and dark mode

`partials/layout.mjml` sets the defaults for each MJML component from `brand.json` (`mj-attributes`): every `mj-section` is a white card (`css-class="card"`), every `mj-text` has the body colour and font inline (`css-class="ink"`), every `mj-button` the primary colour (`css-class="btn"`). The `mj-class`es `h1`, `h2`, `muted`, `panel` and `eyebrow` are the named styles emails use.

Dark mode is a `@media (prefers-color-scheme: dark)` block that re-colours by those classes with `!important` (inline styles win otherwise): `.page`/`.head`/`.foot` → `dark.page`, `.card` → `dark.card`, `.panel` → `dark.panel`, `.ink` text → `dark.text`, links → `dark.link`, `.muted` → `dark.muted`, `.eyebrow` → `dark.accent`, `.btn` → `dark.primary` with `dark.onPrimary` text, `.rule` dividers → `dark.border`. The `color-scheme` and `supported-color-schemes` meta tags tell Apple Mail the email handles dark mode itself, so it doesn't invert it.

## Checks

`checks/run.mjs` runs the steps in AGENTS.md "Verify" with CodePlate's shared runner (`checks/shared/runner.mjs`: timings, the 90-second budget, the final line). `src/config.mjs` checks the settings files, `src/lint.mjs` the HTML and text with htmlparser2 (no browser), `src/inspect.mjs` opens each email in the browser (`src/browser.mjs`: playwright-core with the browser `checks/shared/find-tool.mjs` finds). In the browser, image addresses under `assetBaseUrl` are served from `assets/images/` and every other request is blocked and reported; contrast is measured for every visible piece of text against the colour actually behind it, in light and in dark.

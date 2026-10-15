# Rebrand: name, logo, colours, fonts, address

Use this first, when the user's brand replaces Pebblework's, or when their brand changes.

## Steps

1. **Sender details** in `brand.json`: `name`, `url` (their website, https), `supportEmail` (where replies and questions go), `address` (one line: company, street, town, postcode, country; marketing emails must show it). How every email signs off: `signOff` ("Thanks," by default) and `sender` ("The <name> team" by default), e.g. `"sender": "Niamh and the workshop crew"`; one email can still pass its own `signOff` or `sender` in its data. Don't edit `partials/sign-off.mjml` for this. Keep `lang`, `locale` and `timeZone` for now (`languages.md` changes them).

2. **Logo.** Email needs a PNG (Gmail and Outlook don't show SVG):
   - They have an SVG: save it as `assets/src/logo.svg` (replacing Pebblework's), then `npm run images`, which draws `assets/images/logo.png` at the size `assets.json` gives it (88x88 for a 44 px mark).
   - They have a PNG or JPG: put it in `assets/images/` at twice the size it is shown (a 44 px tall mark → 88 px), and remove `assets/src/logo.svg` and its `assets.json` entry.
   - Set `brand.json` `logo`: `file`, and the `width` and `height` it is shown at. Update its `assets.json` entry (pixel size, `use`, `license: "user-owned"`, `credit`: their company) and `CREDITS.md`. Files the user gave you are always `license: "user-owned"` with their name or company as `credit`; `CodePlate-original` stays only on Pebblework's pictures you keep, credited "CodePlate", and the `assets` check refuses it with any other credit.
   - The header shows the logo **and the name as text** (`partials/header.mjml`), so the logo is marked decorative. A wordmark-only logo: show it bigger, give it `alt="{{brand.name}}"` without `role="presentation"`, and remove the `<span>` with the name.
   - **Dark mode:** the logo sits on `page` in light and `dark.page` in dark. A dark logo on a transparent background vanishes in dark mode (the `inspect` check fails with "vanishes in dark mode"); give it a solid background shape (like Pebblework's rounded square) or a light outline in the SVG, and redraw. Look at `shots/*/dark.png`.

3. **Colours** in `brand.json`, both `light` and `dark`:
   - `page` (around the card), `card` (the email's background), `panel` (boxes inside the card), `text`, `muted` (notes, footer), `primary` (buttons), `onPrimary` (button text), `accent` (eyebrow labels), `border` (dividers, table lines), `link`.
   - Use their colours for `primary`, `accent` and `link`; keep the neutrals unless they have their own.
   - Dark set: same hues, lighter for text and buttons, near-black for `page`/`card` (not pure black: `#121417`-ish reads better). A dark `primary` usually needs a light `onPrimary` swap: Pebblework uses a light green button with dark text in dark mode.

4. **Measure them:** `npm run contrast` lists every pair the layout draws (light and dark) and, for a pair that fails, the nearest shade that passes. A pale brand colour (yellow, mustard, light orange) fails as text: keep it for buttons only if `onPrimary` reaches 4.5:1 on it, and use the suggested darker shade for `link` and `accent`. Tell the user what you changed and why.

5. **Fonts:** `fontFamily` (body) and `headingFontFamily` (headings) are **system font stacks**: each device uses the first font it has. Web fonts don't load in Gmail or Outlook, and the checks reject `@font-face` and `@import`. Offer a sans stack (the default), a serif stack (`Georgia, 'Times New Roman', Times, serif`, the default for headings) or a rounded one (`'Trebuchet MS', 'Segoe UI', sans-serif`). If they insist on a brand font, put text in that font only into pictures that don't carry meaning (`pictures.md`).

6. **Width and corners:** `width` (600 is the safe default; 480-700 allowed) and `radius` (buttons, panels, pictures).

7. **Pictures and copy that name Pebblework:** `assets/src/*.svg`, `emails/*.mjml` and `*.props.json` (example URLs on `pebblework.example`, names), `emails.json` subjects. Replace with theirs or remove (`remove-an-email.md`).

8. **Record it** in `docs/project.md` (Brand, Sender).

## Verify

- `npm run contrast` ends with "Every pair passes".
- `npm run check` ends with `CODEPLATE CHECKS: PASS` (`emails` validates `brand.json`; `inspect` measures contrast in light and dark).
- `npm run preview`, then open `shots/contact-light.png` and `contact-dark.png`: their logo and name in every header, their colours on buttons, labels and links, no Pebblework left, the logo clearly visible on dark.

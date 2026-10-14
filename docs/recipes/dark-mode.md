# Dark mode

Use this when the user asks about dark mode, adds a colour or a style, or something looks wrong in `shots/*/dark.png`.

## How it works here

- `partials/layout.mjml` declares `<meta name="color-scheme" content="light dark">`, `supported-color-schemes`, and `:root { color-scheme: light dark; }`: "this email has its own dark mode, don't invert it".
- A `@media (prefers-color-scheme: dark)` block re-colours by **class** with `!important`, using `brand.json` `dark`: `.page`, `.head`, `.foot` (around the card), `.card`, `.panel`, `.ink` (text), `.muted`, `.eyebrow`, `.btn`, `.rule`. MJML puts a component's `css-class` on its wrapper, and the layout gives every component its class by default.
- **Who honours it:** Apple Mail on macOS and iOS, and other apps that support `prefers-color-scheme` (support changes; check caniemail.com for a given app). The checks' `dark` view is this mode.
- **Who doesn't:** Gmail (web, Android, iOS) and Outlook.com recolour emails themselves (partly or fully inverted) and ignore these styles; Outlook for Windows does its own. You can't control them; the light design's contrast is what protects those readers. Say so to the user.

## Steps: a new colour or style

1. Add the colour to both `brand.json` sets if it's a brand colour (new keys must be added to `COLOUR_KEYS` in `src/config.mjs`, or the check rejects them as unknown; and to `PAIRS` in `src/contrast.mjs` if it's text).
2. In `partials/layout.mjml`, give the style an `mj-class` with a `css-class` (e.g. `<mj-class name="note" color="{{brand.light.accent}}" css-class="note" />`) and add its dark rule inside the `@media (prefers-color-scheme: dark)` block: `.note div { color: {{brand.dark.accent}} !important; }`. Target the inner element that carries the inline colour (`div` for `mj-text`, `td`/`a` for buttons, `p` for dividers).
3. Use the `mj-class` in the email.

## Pictures in dark mode

- Pictures keep their colours. A transparent PNG with dark lines vanishes on the dark card: give it a background shape, a light outline, or a solid background colour that suits both modes (Pebblework's logo is a green rounded square).
- A full picture with a white background shows as a white box in dark mode: use a soft background colour in the picture (the newsletter header uses green-grey) or round its corners (`border-radius` on `mj-image`).
- Swapping a picture for dark mode (`<picture>` or show/hide tricks) only works in some clients and is not used here.

## Verify

- `npm run contrast` ends with "Every pair passes" (both sets).
- `npm run check` ends with `CODEPLATE CHECKS: PASS`: the `inspect` step fails if the page stays light in dark mode, or any text drops below AA contrast in dark.
- Open `shots/contact-dark.png`, then `shots/<id>/dark.png` for changed emails: no white boxes, no vanishing logos, buttons and labels in the dark colours.

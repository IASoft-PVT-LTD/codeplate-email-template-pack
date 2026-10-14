# Pictures

Use this when the user gives you a logo, product shots or illustrations for their emails, or asks for a header picture.

## Rules

- **PNG, JPG or GIF only.** Gmail and Outlook don't show SVG; WebP doesn't show in Outlook for Windows.
- **Twice the size it's shown**, so it's sharp on phones and retina screens: shown 528 px wide (the card's width inside its padding) → 1056 px file; full width 600 → 1200. Under ~200 KB each (JPG for photos, PNG for flat drawings).
- **Alt text that says what it shows**, because many readers have images off and screen readers read it. Purely decorative pictures (a logo next to the name) get `alt=""` and `role="presentation"`.
- **Never put words that matter in a picture**: prices, dates, the call to action. Headlines in pictures disappear with images off, and can't be read by screen readers or translated.
- **Only pictures the user owns or made, or CC0** ones, listed in `assets.json` and `CREDITS.md`.

## Steps

1. Put the file in `assets/images/` with a short lowercase name (`spring-sale.jpg`).
2. Add it to `assets.json`: `path`, `kind: "image"`, `width` and `height` in pixels (PNG sizes are checked), `use` (which email, shown at what size), `license` (`CodePlate-original` for their own, `CC0-1.0`), `credit`, and `source` (a link) for CC0. Add a line to `CREDITS.md`.
3. Use it: `<mj-image src="{{asset "spring-sale.jpg"}}" alt="Three planners in spring colours" width="528px" />`. Leave out `height` (a fixed height stretches it on phones). `href="…"` makes it a link: give the same link a text button too, as picture-only links vanish with images off.
4. **Drawn from SVG:** keep the source as `assets/src/<name>.svg` (listed in `assets.json` with its viewBox size), add the PNG's entry with the pixel size you want, and run `npm run images` (or `npm run images -- <name>`). Edit the SVG, re-run, look at the PNG.
5. **Hosting:** before the first real send, upload `assets/images/` to a public https folder (their website, a CDN, an S3 or R2 bucket) and set `brand.json` `assetBaseUrl` to it, ending in `/`. Every `{{asset}}` address then points there. The checks serve `assets/images/` locally under that address, so previews work before the upload.

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (`assets` checks the file and its size, `html` the alt text, width, format and that the file exists, `inspect` that it loads and isn't stretched).
- `npm run preview -- <id>`; open `shots/<id>/light.png`, `dark.png` and `mobile.png`: sharp, not stretched, no white box around it in dark mode.
- After uploading, open one picture's address (`assetBaseUrl` + file) in a browser to confirm it's public.

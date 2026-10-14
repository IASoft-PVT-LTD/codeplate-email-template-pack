# Remove an email

Use this when the user doesn't need some of the ten emails (a SaaS without a shop doesn't need `order-shipped`; a shop without trials doesn't need `trial-ending`).

## Steps

1. Confirm the list with the user, and record it in `docs/project.md` (Removed emails, with why).
2. For each email `<id>`:
   - delete its entry from `emails.json`;
   - delete `emails/<id>.mjml` and `emails/<id>.props.json`.
3. **Pictures only that email used:** `parcel.png` (order-shipped), `newsletter-hero.png` (newsletter), `product-update.png` (product-update). Delete `assets/images/<name>.png`, `assets/src/<name>.svg` and both `assets.json` entries, and its line in `CREDITS.md`. Search first: `grep -r "<name>.png" emails partials`.
4. `npm run build` removes the email's old files from `out/`; `npm run preview` (without an id) clears `shots/`.

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (`emails` fails while a file in `emails/` has no `emails.json` entry; `assets` fails while `assets.json` lists a deleted picture or a picture isn't listed).
- `shots/contact-light.png` shows only the emails they kept.

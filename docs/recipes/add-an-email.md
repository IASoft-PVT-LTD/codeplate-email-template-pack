# Add an email

Use this when the user needs an email the pack doesn't have: "payment failed", "weekly digest", "account deleted", "event reminder".

## Steps

1. **Decide with the user:** when it is sent and by what (a signup, a failed charge, a schedule), its job and its one action, and whether it's **transactional** (the person needs it because of something they did or own: account, security, orders, billing) or **marketing** (news, offers, digests they subscribed to). When in doubt it's marketing: it then gets the unsubscribe footer.
2. **Create it:** `npm run new-email -- payment-failed` (add `--marketing` for a marketing email). This writes `emails/payment-failed.mjml`, `emails/payment-failed.props.json` and an `emails.json` entry, all with `TODO`s.
3. **Start from the closest existing email** if one fits (copy the sections of `receipt.mjml` for anything with amounts, `password-reset.mjml` for a security link, `newsletter.mjml` for a digest), then write the content (`edit-an-email.md`).
4. **`emails.json`:** the subject (under ~50 characters reads fully on phones), preheader, `about` (when it is sent). Replace every `TODO`: the checks fail while one is left.
5. **Brand details come from `brand.json`:** write `{{brand.address}}`, `{{brand.supportEmail}}`, `{{brand.name}}` and `{{brand.url}}`, never retype them (they go stale when the brand changes; `npm run lint` warns when an email types out the address or support email). Lists, panels and the printed-out link (`{{> fallback-link url=…}}`) use the markup in the table in `edit-an-email.md`.
6. **`emails/<id>.props.json`:** `npm run new-email` starts it from `brand.json` (`customer@<their domain>`, links on their site, `TODO` for the name); replace each with realistic example data for every placeholder (a long-ish name, real-looking amounts). Marketing emails need `unsubscribeUrl` (and optionally `preferencesUrl`).
7. **Their app:** tell the user the event that sends it and the data to pass; record it in `docs/project.md` (Emails).

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (the new email is built, linted and screenshotted with the rest).
- `npm run preview -- <id>`; open `shots/<id>/all.png` (the last line it prints: light, dark and phone side by side), and `shots/contact-light.png` to see it next to the others: same header, footer and button style.

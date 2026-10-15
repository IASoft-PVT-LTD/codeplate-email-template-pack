# Templates stored in the sending service

Use this when the user's newsletter tool or sending service keeps the templates itself and fills in the data at send time (Mailchimp, Brevo, Mailjet, SendGrid dynamic templates, Postmark templates, Customer.io), instead of their app sending finished HTML.

## Steps

1. **Find the service's merge-tag syntax** in its docs, for example `*|FNAME|*` and `*|UNSUB|*` (Mailchimp), `{{ contact.FIRSTNAME }}` (Brevo), `{{first_name}}` (SendGrid dynamic templates, Postmark). Ask the user which service.
2. **Write a data file with merge tags as the values**, outside `emails/` (the checks only allow `.mjml` and `.props.json` there), e.g. `esp/newsletter.json`: copy `emails/newsletter.props.json` and replace each value the service fills in with its tag (`"recipient": { "email": "*|EMAIL|*" }`, `"unsubscribeUrl": "*|UNSUB|*"`). Keep fixed content (the issue's stories) as text, or use the service's own blocks.
3. **Render it:** `npm run render -- newsletter --data esp/newsletter.json` writes `out/render/newsletter.html` and `.txt`. It prints notes where a merge tag breaks a rule (an unsubscribe link that isn't `https://` yet): expected here, as the service fills it in.
4. **Merge tags that collide with Handlebars:** values like `{{first_name}}` pass through untouched (Handlebars doesn't re-read values). Merge tags can't go into `{{money}}` or `{{date}}` (they need real values): put the service's own formatted fields in the data instead, or leave those emails to the app.
5. **Paste or upload** `out/render/<id>.html` as a "code your own" / custom HTML template in the service, and the `.txt` as its plain-text version if the service takes one. Many services add their own unsubscribe footer and tracking; tell the user to check the final size stays under 102 KB.
6. Record in `docs/project.md` which emails live in the service, so later edits are re-rendered and re-uploaded.

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (the normal emails still pass; `esp/` files aren't checked).
- Open `out/render/<id>.html` in a browser: merge tags show as text where names and links go, nothing else changed.
- The service's own preview and test send fill the tags in.

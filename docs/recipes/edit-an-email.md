# Edit an email

Use this to change what one email says or how it is laid out: new copy, another button, a panel, a list, a picture.

## The building blocks

An email file (`emails/<id>.mjml`) is a list of `mj-section`s (rows; each is a white card by default) holding `mj-column`s (stack on phones) holding content:

| You want | Write |
|---|---|
| Main heading (one per email) | `<mj-text mj-class="h1"><h1 style="margin:0;font-size:30px;font-weight:400;">…</h1></mj-text>` |
| Sub-heading | `<mj-text mj-class="h2"><h2 style="margin:0;font-size:21px;font-weight:400;">…</h2></mj-text>` |
| Small label above the heading | `<mj-text mj-class="eyebrow">RECEIPT {{receipt.number}}</mj-text>` |
| A paragraph | `<mj-text>…</mj-text>` (`<strong>`, `<br>`, links inside) |
| A note in grey | `<mj-text mj-class="muted">…</mj-text>` |
| A link in text | `<a href="{{url}}" style="color:{{brand.light.link}};">words that say where it goes</a>` (the inline colour is required) |
| A button | `{{> button url=resetUrl label="Choose a new password"}}` |
| The link printed out too (security emails) | `{{> fallback-link url=resetUrl}}` |
| A tinted box | a section `<mj-section padding="8px 36px">` with `<mj-column mj-class="panel">` and `mj-text`s with `padding="… 22px"` inside |
| A divider | `<mj-divider />` |
| A list | `<mj-text><ul style="margin:0;padding:0 0 0 20px;"><li style="margin:0 0 10px;">…</li></ul></mj-text>` |
| A picture | `<mj-image src="{{asset "file.png"}}" alt="what it shows" width="528px" />` (no `height`; `pictures.md`) |
| Two columns (stack on phones) | two `mj-column`s in one `mj-section` |
| Side by side even on phones | `mj-column`s inside `<mj-group>` (small items only) |
| A table of items | `tables-and-money.md` |
| The closing lines | `{{> sign-off}}` (`signOff`, `sender` in the data change them for this email; `brand.json` `signOff`, `sender` for every email) |

## Steps

1. **Agree the words** with the user: subject, preheader (the grey line after the subject in the inbox, 40-130 characters, says something the subject doesn't), heading, the one action, and anything people must know (expiry times, what happens if they do nothing). One email, one job; one main button.
2. **Edit `emails/<id>.mjml`.** Keep all text in `mj-text`, `mj-button` or `mj-table`. Use the `mj-class`es and partials above rather than colours and sizes of your own (Rules 1-2 in AGENTS.md).
3. **New data?** Every new `{{placeholder}}` needs a value in `emails/<id>.props.json` (an example the user's app will replace) or the build fails naming it. Optional parts: `{{#if field}} … {{/if}}`. Lists: `{{#each items}} … {{/each}}`, with `{{@root.brand…}}` for brand values inside.
4. **Subject and preheader** are in `emails.json`, not the `.mjml` file.
5. Tell the user which data their app must now pass (the props file is the list).

## Verify

- `npm run lint` while editing (instant), then `npm run check` ends with `CODEPLATE CHECKS: PASS`.
- `npm run preview -- <id>`; open `shots/<id>/all.png` (the last line it prints: light, dark and phone side by side): the copy reads well, one clear button, nothing cramped on the phone, dark mode consistent.
- Read `out/<id>.txt`: the plain-text version says the same and has every link.

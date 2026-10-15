# Tables and money: receipts, invoices, orders

Use this for anything with line items, amounts, tax or dates: the receipt, an invoice, an order confirmation, a usage summary.

## Rules

- **The email shows amounts; it never works them out.** The billing system (Stripe, Paddle, their shop) knows the real totals, tax and rounding. Pass them in the data: `subtotal`, `tax`, `total`, each line's `amount`.
- **Amounts are whole minor units** (pence, cents: `5880` = £58.80) with a currency code; `{{money amount "GBP"}}` formats them in `brand.json` `locale`. Decimal amounts (`58.8`) throw, because floating-point money goes wrong. Currencies without minor units (JPY) work: `{{money 1200 "JPY"}}` → JP¥1,200 in `en-GB` (¥1,200 in `ja-JP`).
- **Dates are ISO strings** in the data (`"2026-10-14"` or `"2026-10-14T08:42:00Z"`), formatted by `{{date x}}` (`14 October 2026`), `{{date x "datetime"}}` (`14 Oct 2026, 09:42`), `{{date x "fulldatetime"}}` (`Wednesday 14 October 2026 at 09:42`, for bookings and appointments), `{{date x "time"}}` (`09:42`), `"full"`, `"medium"` or `"short"`, in `brand.json` `locale` and `timeZone` (the exact words follow the locale: `en-US` writes `Wednesday, October 14, 2026 at 9:42 AM`). Don't add a style to `src/render.mjs` for one email; if none fits, ask. Never "today": the email must say what the data says.

## Steps: a table

1. Use `mj-table` with `css-class="ink data"` and a header row of `<th scope="col">` cells: screen readers read it as a table, and the plain-text version lays it out in columns. (Layout tables get `role="presentation"`; MJML does that for its own.)
2. Copy the structure from `emails/receipt.mjml`: one header row, `{{#each receipt.items}}` rows, then the totals rows with `colspan`. Inside `{{#each}}`, brand values need `@root.` (`{{@root.brand.light.border}}`) and top-level data too (`{{money amount @root.receipt.currency}}`).
3. Keep it to three or four columns: a phone is 375 px wide. Put `white-space:nowrap` on amount cells and header cells so `£1,245.00` and `Qty` don't break; long descriptions wrap by themselves. More detail belongs in the PDF invoice (link it with a button).
4. Optional lines (tax, discount, shipping): wrap the row in `{{#if receipt.tax}} … {{/if}}`; pass `0` or leave it out.
5. Update `emails/<id>.props.json` with realistic items (one long description, to see the wrap).

## Verify

- `npm run check` ends with `CODEPLATE CHECKS: PASS` (`html` accepts a table with `<th>`; `inspect` fails if the table is wider than a 375 px phone).
- `npm run preview -- receipt`; open `shots/receipt/mobile.png`: columns fit, amounts on one line, totals line up. Read `out/receipt.txt`: the items as aligned columns.
- Try a long order: `npm run render -- receipt --data <file with 12 items>` and open `out/render/receipt.html`; check the size stays far under 102 KB.

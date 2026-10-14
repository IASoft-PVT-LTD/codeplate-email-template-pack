# Credits

- **Pictures** (`assets/images/logo.png`, `newsletter-hero.png`, `product-update.png`, `parcel.png`) and their sources (`assets/src/*.svg`) are original, drawn for CodePlate. Replace them with your own.
- **MJML** (MIT, https://mjml.io) compiles the emails to email-safe HTML; **Handlebars** (MIT, https://handlebarsjs.com) fills in the data; **html-to-text** (MIT) makes the plain-text versions; **htmlparser2** (MIT) and **domutils** (BSD-2-Clause) read the HTML for the checks; **Playwright** (`playwright-core`, Apache-2.0) drives the browser for the screenshots. They are installed by `npm ci`, not part of this folder.

No fonts ship with this template: emails use each device's system fonts (the `fontFamily` stacks in `brand.json`), because Gmail and Outlook don't load web fonts.

The sample company Pebblework, its customers, addresses, numbers and links (`*.example` domains) are made up.

When you add assets, list each one in `assets.json` (path, size, where it's used, licence, credit) and here, with its author, licence and a link to its source. Only use pictures you own or made, or CC0 ones.

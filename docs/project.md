# Project decisions

<!-- codeplate:project-stub -->

This file is still the template stub. The agent replaces it after interviewing the user (see "Interview" in AGENTS.md), then adds every later decision here, so a future session knows what was agreed.

Suggested layout once filled in:

- **Who and what:** the product or company, what its emails are for
- **Browser:** the browser path that works on this computer
- **Sender:** From name and address, reply/support address, postal address, website
- **Emails:** one line each: id, type (transactional/marketing), when it is sent, who triggers it
- **Removed / added emails:** and why
- **Brand:** logo file (and how it looks on dark), colours light and dark (which shades are used for text and why), fonts (system stacks), width, radius
- **Sending:** the service or library, how the app calls `renderEmail`, where images are hosted (`assetBaseUrl`), List-Unsubscribe handling
- **Language and formats:** lang, locale, time zone, currencies
- **Open questions:**
- **Log:** one dated line per notable change

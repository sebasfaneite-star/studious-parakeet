# UCKER Sales HQ

The UCKER sales team app: leads, visits, clients, sales, invoices and goals, in English and Spanish. It uses the UCKER look (white, black and pink), installs on phones like a regular app, and works offline.

**App link:** https://sebasfaneite-star.github.io/studious-parakeet/

## Install it on your phone
- **iPhone:** open the link in **Safari** → Share → **Add to Home Screen**.
- **Android:** open the link in **Chrome** → ⋮ → **Install app**.
- **Computer:** click the install icon in the address bar.

## What's inside
- **Dashboard:** today, this week and this month against the goal; what it takes to sell out the stock by the sell-by date; pipeline and follow-ups; stock by size; money owed; recurring clients; team table.
- **Log a visit:** place, quote, cases and size. Prices fill in from the price tiers, and quotes below the floor price get flagged.
- **Leads:** 4,609 Miami-area businesses (medical, dental, beauty, food and more), sorted closest and easiest first. Each lead has call and directions buttons, and you can build today's route in Google Maps.
- **Clients and sales:** recurring reorders, payment status, and PDF invoices you can send on WhatsApp.
- **Goals:** stock push dates, stock by size, prices and tax, invoice details and payment options. Preloaded with the current UCKER settings.
- **ES / EN** button switches the whole app between Spanish and English.

## Shopify payments
- **Card payment link:** open a sale → **Invoice**. Create an invoice or payment link for the amount in the Shopify app, paste it in, and tap **Save link**. It's printed on the PDF invoice and added to the WhatsApp message.
- **Tap to Pay:** charge the customer with Tap to Pay in the Shopify app, then tap **Mark paid** on the sale in Sales HQ.

## Where the data lives
- The leads and the starting goals/settings come from `data/leads.json` and `data/settings.json` in this repository. **This repository is public, so don't add customer, sales or cost data to these files.**
- Each rep's visits, clients, sales and setting changes are saved **on their own phone**. Under **Goals → This phone**, reps can set their name and use **Download backup** / **Restore backup** to move data to a new phone.
- If a rep saves changes on the Goals page, their phone keeps those values instead of later updates to `data/settings.json`.

## Updating the app
Edit the files, commit, and push to `main`. GitHub Pages republishes in about a minute. Bump `VERSION` in `sw.js` so installed apps pick up the new version.

## Files
- `index.html`: the app.
- `local-db.js`: the on-device storage layer.
- `data/`: leads and default settings.
- `vendor/jspdf.umd.min.js`: the PDF invoice library (MIT license).
- `manifest.webmanifest`, `sw.js`, `icons/`: install and offline support.

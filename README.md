# Ucker Sales HQ

A sales app for the Ucker team: dashboard, deal pipeline, contacts, follow-up tasks, and Shopify payment collection. It installs on phones like a regular app and works offline.

## Install it on your phone
1. Open the app link (see "Hosting" below).
2. **iPhone:** in Safari, tap Share → **Add to Home Screen**.
   **Android:** in Chrome, tap ⋮ → **Install app**.
   **Computer:** click the install icon in the address bar.

## Features
- **Home:** open pipeline, won this month, win rate, monthly goal progress, follow-ups due.
- **Pipeline:** deals by stage (Lead → Qualified → Proposal → Negotiation → Won/Lost), search and filter.
- **Contacts:** one-tap call, text and email.
- **Tasks:** follow-ups with due dates, plus overdue and today views.
- **Collect payment** (open a deal → 💳):
  - **Shopify checkout link:** pick products from your store, or paste a Shopify invoice link, then text, email or share it. The customer pays through Shopify checkout.
  - **Tap to Pay:** copy the amount, take the payment with Tap to Pay in the **Shopify** app, then mark the deal paid.
- **More:** your name, monthly goal, currency, Shopify connection, backup/import, CSV export.

## Connecting Shopify
In the app, go to **More → Shopify payments**:
- **Store domain:** `your-store.myshopify.com`
- **Storefront API token** (optional, lets reps search products in the app): in Shopify admin go to *Settings → Apps and sales channels → Develop apps → Create an app*, turn on the Storefront API scopes `unauthenticated_read_product_listings` and `unauthenticated_write_checkouts`, install the app, then copy the **Storefront access token**.

> Use a **Storefront** token only. Never put an **Admin API** token in this app.

Tap to Pay happens in the **Shopify** app (Apple and Google don't let web apps use the phone's NFC chip for payments). Each rep needs the Shopify app installed, signed in to your store, with Tap to Pay set up.

## Data
Each rep's deals, contacts and tasks are saved **on their own device**. Use *More → Export backup* to move data or share it. A shared team database would need a backend (for example Supabase or Firebase) and can be added later.

## Hosting (GitHub Pages)
Repo → **Settings → Pages → Deploy from a branch → `main` / root**. The app will be live at `https://<your-username>.github.io/ucker-sales-hq/`. Share that link with the team.

## Updating
After changing files, bump `VERSION` in `sw.js` so installed apps pick up the new version.

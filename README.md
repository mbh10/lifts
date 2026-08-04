# Lifts

A configurable strength-training web app hosted on GitHub Pages with Supabase authentication and cloud storage.

## Repository structure

```text
lifts/
├── index.html
├── assets/
│   └── css/
│       └── styles.css
├── src/
│   ├── app.js
│   ├── auth.js
│   ├── config.js
│   ├── database.js
│   ├── reports.js
│   └── supabase-client.js
├── supabase/
│   └── database-upgrade.sql
└── docs/
    └── DEVELOPMENT.md
```

## Deploy to GitHub Pages

1. Upload the contents of this folder to the root of the `lifts` repository.
2. In GitHub, open **Settings → Pages**.
3. Select **Deploy from a branch**.
4. Select `main` and `/(root)`.
5. Open `https://mbh10.github.io/lifts/` after deployment finishes.

## Supabase configuration

The browser-safe project URL and publishable key are stored in `src/config.js`.

Never put a database password, secret key, or service-role key in this repository.

Run `supabase/database-upgrade.sql` in the Supabase SQL Editor when setting up or upgrading the database.

## Editing the app

- Page markup: `index.html`
- Styling: `assets/css/styles.css`
- Main workout and UI logic: `src/app.js`
- Authentication: `src/auth.js`
- Database operations: `src/database.js`
- Charts and exports: `src/reports.js`

After changing JavaScript or CSS, increase the version query in `index.html` from `v=5.0.0` to another value, such as `v=5.0.1`. This helps iPhone Safari load the newest files instead of an older cached copy.

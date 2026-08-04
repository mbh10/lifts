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

## Version 5.1
Adds a sticky workout header, Take a Break MM:SS countdown, ding/vibration at zero, and a Next Set prompt naming the next warmup or working set. No database migration is required.


## V5.3
Progress Report workout cards now include a guarded Delete action. Deleting a workout removes it from reports and charts but does not roll back current progression settings.


## Version 5.4
Workout history can only be deleted newest-first. Deleting the latest workout restores exercise weights, failure counts, workout count, and the next A/B day to the state after the last remaining workout.


## Version 5.5

Fixes empty workout-day scheduling. If only A or B is configured, that day repeats. If neither day is configured, the app directs the user to Settings. Also adds duplicate exercise-name validation and safer exercise removal warnings.

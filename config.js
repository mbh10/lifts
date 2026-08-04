# Development notes

## Test locally

Because the app uses JavaScript modules, do not open `index.html` directly from File Explorer. Run a local web server from the repository folder.

### Visual Studio Code

Install the **Live Server** extension, right-click `index.html`, then select **Open with Live Server**.

### Python alternative

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Safe release process

1. Test the change locally.
2. Commit it to GitHub.
3. Wait for GitHub Pages to finish deploying.
4. Open the site in Safari and refresh once.
5. For stubborn iPhone caching, increase the `?v=` number on the CSS and app script references in `index.html`.

## Data safety

Workout records are stored in Supabase and protected by Row Level Security. The publishable key is safe to use in browser code only while the RLS policies remain enabled and correct.

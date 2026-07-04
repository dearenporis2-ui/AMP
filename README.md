# AMP — SPA Conversion

Converted from 6 separate HTML pages + auth.js into a single-page app with
hash-based routing. Firebase now initializes once per session instead of
once per page, and switching screens no longer triggers a full reload.

## Why hash routing specifically

GitHub Pages serves static files with no server-side rewrite rules, so a
"real" URL router (`/dashboard`, `/panel`) would 404 on refresh unless you
add a workaround GitHub Pages doesn't support out of the box. Hash routes
(`#/dashboard`, `#/panel`) live entirely in the browser — the server only
ever sees a request for `index.html`, so this needs zero server config and
fits a drag-and-drop deploy workflow with no build step.

## New file set (5 files total)

- `index.html` — empty shell, just a mount point + one script tag
- `app.js` — the router, every view (landing, signup, login, role-select,
  dashboard, onboarding, panel), and all auth logic. This replaces
  `auth.js` entirely — don't keep both.
- `style.css` — unchanged from before
- `firebase-config.js` — unchanged from before
- `firestore.rules` — unchanged from before (no data-shape changes, only
  the frontend structure changed)

## Migration steps for your repo

1. **Delete these files** from the repo — they're fully replaced:
   - `login.html`
   - `signup.html`
   - `dashboard.html`
   - `artist-onboarding.html`
   - `artist-panel.html`
   - `role-select.html`
   - `auth.js`
2. **Upload/overwrite** `index.html` and `style.css` with the new versions.
3. **Add** `app.js` as a new file.
4. Leave `firebase-config.js` and `firestore.rules` as they are — no changes.
5. Hard-refresh (Ctrl+Shift+R) after it's live to bust GitHub's CDN cache.

## Routes, for reference

| Hash | Screen |
|---|---|
| `#/` | Landing (Google / signup / login) |
| `#/signup` | Email/password signup with role picker |
| `#/login` | Email/password login |
| `#/role-select` | First-time Google sign-in only — pick Fan or Artist |
| `#/dashboard` | Fan dashboard |
| `#/onboarding` | Artist profile setup (first time only) |
| `#/panel` | Artist Publishing Control Panel |

Navigating to a protected route while signed out bounces back to `#/`
automatically. Landing on `#/` while already signed in skips straight to
the right dashboard/panel instead of showing the choice screen again.

[Uploading README.md…]()
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

## Activating an artist

New artists are invisible to fans by default — they can sign up, log in, and
manage their own catalog privately, but nothing they publish (tracks or
concerts) shows up anywhere public until you activate them. This is the
`isActive` flag from the original blueprint, now actually enforced on the
fan-facing views (it wasn't being filtered on before this pass — a real gap,
not just an oversight left in on purpose).

**To activate an artist right now** (no in-app admin panel exists yet):
1. Firebase Console → **Firestore Database** → `users` collection
2. Find their document (search by `email` or `displayName` field)
3. Open `artistMetadata` → set `isActive` to `true`
4. Optionally also set `isVerified` to `true` — this is a separate, purely
   editorial "this is a real trusted local artist" badge. `isActive` alone
   shows a "Live on AMP" badge on their panel; both together shows "Pro".

The artist sees their own status update automatically — the small dot next
to their status badge in the panel header pulses while `isActive` is false
("Awaiting approval") and turns solid the moment you flip it, no refresh
needed beyond their next page load.

**Worth knowing:** doing this by hand in the Firestore console works fine at
your current scale, but doesn't scale past a handful of artists — a real
in-app Admin panel (restricted to your `isAdmin` account) that lists pending
signups with one-click activate is a natural next build once you're
onboarding artists regularly instead of one at a time.

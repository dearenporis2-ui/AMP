# AMP — Stage I Build

Auth shell + security rules, built against the finalized v2 blueprint.

## What's in this pass

- `index.html` — landing choice screen (Create account / Log in)
- `signup.html` — Fan/Artist role picker + account creation
- `login.html` — login, routes by role
- `js/firebase-config.js` — **placeholder config, needs your real AMP Firebase keys**
- `js/auth.js` — signup/login logic; creates the Auth account first, then writes the Firestore `users` doc while authenticated (same ordering fix that avoided permission errors on Stash)
- `firestore.rules` — full security rules for all 8 collections (users, payments, reports, concerts, albums, tracks, follows, playlists), enforcing the split `isVerified`/`isActive` flags and the `fanId_artistId` composite key on follows

## Before this runs

1. Create the AMP Firebase project (separate from `stash-77055`, or a new project — your call) with Auth (Email/Password) and Firestore enabled.
2. Drop the real config values into `js/firebase-config.js`.
3. Deploy `firestore.rules` to that project.
4. Signup currently redirects to `dashboard.html` / `artist-onboarding.html` — neither exists yet. That's next: the Fan Dashboard and the Artist onboarding + Publishing Control Panel, per Stage II of the roadmap.

## Known gap to flag

The rules currently trust a `users/{uid}.isAdmin` field the same way Stash does — set that manually in the Firebase Console for your admin account once the project exists.

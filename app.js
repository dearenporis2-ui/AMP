// app.js — AMP single-page app.
// Hash-based routing (#/dashboard, #/panel, etc.) on purpose: GitHub Pages
// can't do server-side URL rewrites without extra config, and hash routing
// needs none, so navigation never triggers a real page reload or a fresh
// Firebase re-initialization. Firebase Auth initializes exactly once, and
// onAuthStateChanged runs its check exactly once per session, not once per click.

import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUD_NAME = "dflbqacnt";
const UPLOAD_PRESET = "amp_media";

const PLAY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5-10-5.5z"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3.2" height="11" rx="1"/><rect x="9.3" y="2.5" width="3.2" height="11" rx="1"/></svg>`;
const VOLUME_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h2.5L8 3v10L4.5 10H2V6z" fill="currentColor" stroke="none"/><path d="M10.5 5.5a4 4 0 0 1 0 5"/><path d="M12.3 3.7a6.8 6.8 0 0 1 0 8.6"/></svg>`;
const EQ_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="13" x2="3" y2="7"/><circle cx="3" cy="5" r="1.5" fill="currentColor" stroke="none"/><line x1="8" y1="13" x2="8" y2="3"/><circle cx="8" cy="9" r="1.5" fill="currentColor" stroke="none"/><line x1="13" y1="13" x2="13" y2="9"/><circle cx="13" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>`;
const HEART_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 13.5s-5.5-3.3-5.5-7A3.2 3.2 0 0 1 8 4.3 3.2 3.2 0 0 1 13.5 6.5c0 3.7-5.5 7-5.5 7z"/></svg>`;
const HEART_FILLED_ICON = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 13.5s-5.5-3.3-5.5-7A3.2 3.2 0 0 1 8 4.3 3.2 3.2 0 0 1 13.5 6.5c0 3.7-5.5 7-5.5 7z"/></svg>`;
const SEARCH_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><line x1="10.3" y1="10.3" x2="14" y2="14"/></svg>`;
const HOME_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L8 2l6 5.5"/><path d="M3.5 6.5V14h9V6.5"/></svg>`;

const view = document.getElementById("view");

let currentUser = null;
let currentUserDoc = null; // cached users/{uid} Firestore data
let authReady = false;

const GOOGLE_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
  <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
</svg>`;

// ==========================================================================
// Router
// ==========================================================================

function navigate(path) {
  if (location.hash === `#${path}`) {
    renderRoute(); // same hash already — force a re-render after a state change
  } else {
    location.hash = path;
  }
}

window.addEventListener("hashchange", renderRoute);

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  authReady = true;
  currentUserDoc = null;

  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    currentUserDoc = snap.exists() ? snap.data() : null;
  }

  renderRoute();
});

const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/panel", "/role-select", "/search"];

function renderRoute() {
  const path = location.hash.replace(/^#/, "") || "/";

  if (!authReady) {
    renderLoading();
    return;
  }

  const isArtistProfileRoute = path.startsWith("/artist/");
  const isPlaylistRoute = path.startsWith("/playlist/");

  if ((PROTECTED_ROUTES.includes(path) || isArtistProfileRoute || isPlaylistRoute) && !currentUser) {
    navigate("/");
    return;
  }

  if (isArtistProfileRoute) {
    renderArtistProfile(path.slice("/artist/".length));
    return;
  }

  if (isPlaylistRoute) {
    renderPlaylist(path.slice("/playlist/".length));
    return;
  }

  switch (path) {
    case "/":
      renderLanding();
      break;
    case "/login":
      renderLogin();
      break;
    case "/signup":
      renderSignup();
      break;
    case "/role-select":
      renderRoleSelect();
      break;
    case "/dashboard":
      renderDashboard();
      break;
    case "/onboarding":
      renderOnboarding();
      break;
    case "/panel":
      renderPanel();
      break;
    case "/search":
      renderSearch();
      break;
    default:
      renderLanding();
  }
}

// ==========================================================================
// Shared helpers
// ==========================================================================

function setLoading(btn, isLoading, label) {
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.dataset.defaultLabel = btn.dataset.defaultLabel || btn.textContent;
    btn.textContent = label || "Please wait…";
  } else {
    btn.textContent = btn.dataset.defaultLabel || btn.textContent;
  }
}

function showError(formEl, message) {
  const errorEl = formEl.querySelector("[data-error]");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function friendlyAuthError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try logging in instead.";
  if (code.includes("weak-password")) return "Choose a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("popup-closed-by-user")) return "Sign-in window closed before finishing.";
  if (code.includes("unauthorized-domain")) return "This domain isn't authorized for Google sign-in yet.";
  return "Something went wrong. Please try again.";
}

function blankArtistMetadata() {
  return {
    bio: null,
    genres: [],
    profileImage: null,
    bannerImage: null,
    bookingWhatsApp: null,
    isVerified: false,
    isActive: false,
    subscriptionExpires: null
  };
}

async function refreshUserDoc() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  currentUserDoc = snap.exists() ? snap.data() : null;
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
}

// ==========================================================================
// Views
// ==========================================================================

function renderLoading() {
  view.innerHTML = `<div class="screen"><p class="tagline">Loading…</p></div>`;
}

function renderLanding() {
  if (currentUser && currentUserDoc) {
    navigate(currentUserDoc.role === "ARTIST" ? "/panel" : "/dashboard");
    return;
  }
  if (currentUser && !currentUserDoc) {
    navigate("/role-select");
    return;
  }

  view.innerHTML = `
    <div class="screen">
      <div class="card">
        <p class="brand"><span class="brand-mark">AMP</span></p>
        <p class="tagline">Your gateway to local sounds and live music.</p>
        <div class="choice-stack">
          <button type="button" class="btn btn-google" id="google-btn" data-default-label="Continue with Google">
            ${GOOGLE_ICON_SVG} Continue with Google
          </button>
          <div class="divider"><span>or</span></div>
          <a class="btn btn-primary" href="#/signup">Create an account</a>
          <a class="btn btn-secondary" href="#/login">Log in with email</a>
        </div>
      </div>
    </div>`;

  document.getElementById("google-btn").addEventListener("click", (e) => handleGoogleSignIn(e.currentTarget));
}

function renderSignup() {
  view.innerHTML = `
    <div class="screen">
      <div class="card">
        <p class="eyebrow">Join AMP</p>
        <h1>Create your account</h1>
        <p class="tagline" style="text-align:left; margin-bottom:20px;">Fans stream and follow for free. Artists publish music and shows.</p>
        <form id="signup-form" novalidate>
          <div class="role-picker">
            <input type="radio" id="role-fan" name="role" value="FAN" checked />
            <label for="role-fan">I'm a fan</label>
            <input type="radio" id="role-artist" name="role" value="ARTIST" />
            <label for="role-artist">I'm an artist</label>
          </div>
          <div data-error hidden></div>
          <div class="field"><label for="displayName">Name</label><input type="text" id="displayName" name="displayName" required /></div>
          <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" required /></div>
          <div class="field"><label for="password">Password</label><input type="password" id="password" name="password" required minlength="6" /></div>
          <button type="submit" class="btn btn-primary" data-submit data-default-label="Create account">Create account</button>
        </form>
        <div class="divider" style="margin-top:20px;"><span>or</span></div>
        <button type="button" class="btn btn-google" id="google-btn" data-default-label="Continue with Google">${GOOGLE_ICON_SVG} Continue with Google</button>
        <p class="form-footer">Already have an account? <a href="#/login">Log in</a></p>
      </div>
    </div>`;

  document.getElementById("signup-form").addEventListener("submit", handleSignup);
  document.getElementById("google-btn").addEventListener("click", (e) => handleGoogleSignIn(e.currentTarget));
}

function renderLogin() {
  view.innerHTML = `
    <div class="screen">
      <div class="card">
        <p class="eyebrow">Welcome back</p>
        <h1>Log in</h1>
        <p class="tagline" style="text-align:left; margin-bottom:20px;">Pick up your feed, your playlists, your shows.</p>
        <form id="login-form" novalidate>
          <div data-error hidden></div>
          <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" required /></div>
          <div class="field"><label for="password">Password</label><input type="password" id="password" name="password" required /></div>
          <button type="submit" class="btn btn-primary" data-submit data-default-label="Log in">Log in</button>
        </form>
        <div class="divider" style="margin-top:20px;"><span>or</span></div>
        <button type="button" class="btn btn-google" id="google-btn" data-default-label="Continue with Google">${GOOGLE_ICON_SVG} Continue with Google</button>
        <p class="form-footer">New to AMP? <a href="#/signup">Create an account</a></p>
      </div>
    </div>`;

  document.getElementById("login-form").addEventListener("submit", handleLogin);
  document.getElementById("google-btn").addEventListener("click", (e) => handleGoogleSignIn(e.currentTarget));
}

function renderRoleSelect() {
  view.innerHTML = `
    <div class="screen">
      <div class="card">
        <p class="eyebrow">Almost there</p>
        <h1>How will you use AMP?</h1>
        <p class="tagline" style="text-align:left; margin-bottom:20px;">This can't be changed later without contacting support, so pick the one that fits.</p>
        <div class="choice-stack">
          <button type="button" class="btn btn-primary" id="fan-btn" data-default-label="I'm a fan">I'm a fan</button>
          <button type="button" class="btn btn-secondary" id="artist-btn" data-default-label="I'm an artist">I'm an artist</button>
        </div>
      </div>
    </div>`;

  document.getElementById("fan-btn").addEventListener("click", (e) => completeRoleSelection("FAN", e.currentTarget));
  document.getElementById("artist-btn").addEventListener("click", (e) => completeRoleSelection("ARTIST", e.currentTarget));
}

// ==========================================================================
// App frame — persistent sidebar + library, shared by every signed-in view
// ==========================================================================

function mountAppFrame(activeKey, contentHtml) {
  view.innerHTML = `
    <div class="app-frame">
      <aside class="sidebar">
        <div class="sidebar-brand"><span class="brand-mark small">AMP</span></div>
        <nav class="sidebar-nav">
          <button type="button" class="sidebar-nav-item${activeKey === "home" ? " active" : ""}" id="nav-home">${HOME_ICON}<span>Home</span></button>
          <button type="button" class="sidebar-nav-item${activeKey === "search" ? " active" : ""}" id="nav-search">${SEARCH_ICON}<span>Search</span></button>
        </nav>
        <div class="sidebar-library">
          <div class="sidebar-library-header">
            <span>Your Library</span>
            <button type="button" class="btn-icon-only" id="create-playlist-btn" title="Create playlist">+</button>
          </div>
          <div id="sidebar-playlists" class="sidebar-playlists"><p class="empty-state" style="padding:4px 2px;">Loading…</p></div>
        </div>
      </aside>
      <div class="app-main">
        <header class="app-topbar">
          <span class="user-chip">${currentUserDoc?.displayName || currentUser.email}</span>
          <button type="button" class="btn-ghost" id="signout-btn">Sign out</button>
        </header>
        <div class="app-content">${contentHtml}</div>
      </div>
    </div>`;

  document.getElementById("nav-home").addEventListener("click", () => navigate("/dashboard"));
  document.getElementById("nav-search").addEventListener("click", () => navigate("/search"));
  document.getElementById("signout-btn").addEventListener("click", handleSignOut);
  document.getElementById("create-playlist-btn").addEventListener("click", createPlaylist);
  loadSidebarPlaylists();
}

async function loadSidebarPlaylists() {
  const container = document.getElementById("sidebar-playlists");
  if (!container) return;

  const snap = await getDocs(query(collection(db, "playlists"), where("ownerId", "==", currentUser.uid)));
  const playlists = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!playlists.length) {
    container.innerHTML = `<p class="empty-state" style="padding:4px 2px;">No playlists yet.</p>`;
    return;
  }

  container.innerHTML = playlists
    .map((p) => `<button type="button" class="sidebar-playlist-item" data-playlist-id="${p.id}">${p.title}</button>`)
    .join("");
  container.querySelectorAll(".sidebar-playlist-item").forEach((btn) => {
    btn.addEventListener("click", () => navigate(`/playlist/${btn.dataset.playlistId}`));
  });
}

async function createPlaylist() {
  const name = prompt("Playlist name");
  if (!name || !name.trim()) return;

  await addDoc(collection(db, "playlists"), {
    ownerId: currentUser.uid,
    title: name.trim(),
    trackIds: [],
    updatedAt: serverTimestamp()
  });
  loadSidebarPlaylists();
}

async function renderPlaylist(playlistId) {
  const snap = await getDoc(doc(db, "playlists", playlistId));
  if (!snap.exists() || snap.data().ownerId !== currentUser.uid) {
    navigate("/dashboard");
    return;
  }
  const playlist = snap.data();
  await loadMyFavorites();

  mountAppFrame(
    "library",
    `
    <section class="dash-col">
      <p class="eyebrow">Playlist</p>
      <h1>${playlist.title}</h1>
      <div id="playlist-tracks" class="stack" style="margin-top:18px;">
        <p class="empty-state">This playlist is empty — add tracks from Search or Discover.</p>
      </div>
    </section>`
  );

  const trackIds = playlist.trackIds || [];
  if (!trackIds.length) return;

  const trackDocs = await Promise.all(trackIds.map((id) => getDoc(doc(db, "tracks", id))));
  const tracks = trackDocs.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
  if (!tracks.length) return;

  const artistInfo = await fetchArtistInfo([...new Set(tracks.map((t) => t.artistId))]);
  const albumArt = await fetchAlbumArt([...new Set(tracks.map((t) => t.albumId))]);
  const list = document.getElementById("playlist-tracks");
  list.innerHTML = tracks
    .map((t) => trackRowHtml(t, artistInfo[t.artistId]?.name, albumArt[t.albumId], t.artistId))
    .join("");
  wirePlayButtons(list);
}

function renderDashboard() {
  if (currentUserDoc?.role === "ARTIST") {
    navigate("/panel");
    return;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (currentUserDoc?.displayName || "").split(" ")[0] || "";

  mountAppFrame(
    "home",
    `
    <div class="hero-banner">
      <p class="eyebrow">${greeting}</p>
      <h1>${firstName}</h1>
    </div>
    <div class="dash-grid">
    <section class="dash-col">
      <p class="eyebrow">Live Grid</p>
      <h2>Upcoming shows</h2>
      <div id="concerts-list" class="card-row">
        <p class="empty-state">No shows on the board yet — follow some artists and they'll turn up here the moment one's announced.</p>
      </div>
    </section>
    <section class="dash-col">
      <p class="eyebrow">Following</p>
      <h2>New from artists you follow</h2>
      <div id="concert-alert-banner"></div>
      <div id="following-list" class="stack">
        <p class="empty-state">You're not following anyone yet. Search for an artist and hit Follow to start building your feed.</p>
      </div>
    </section>
    <section class="dash-col" style="grid-column: 1 / -1;">
      <p class="eyebrow">Jump back in</p>
      <h2>Recently played</h2>
      <div id="recent-plays-list" class="stack">
        <p class="empty-state">Nothing played yet this session.</p>
      </div>
    </section>
    <section class="dash-col" style="grid-column: 1 / -1;">
      <p class="eyebrow">Discover</p>
      <h2>New on AMP</h2>
      <div id="browse-tracks-list" class="card-row">
        <p class="empty-state">No tracks published yet.</p>
      </div>
    </section>
    </div>`
  );

  loadDashboardData();
}

async function loadDashboardData() {
  await loadMyFavorites();

  const concertsSnap = await getDocs(query(collection(db, "concerts")));
  if (!concertsSnap.empty) {
    const concerts = concertsSnap.docs.map((d) => d.data());
    const artistInfo = await fetchArtistInfo([...new Set(concerts.map((c) => c.artistId))]);
    // Only artists an admin has activated show up on the public Live Grid —
    // this is the actual visibility gate, not just cosmetic filtering.
    const visible = concerts.filter((c) => artistInfo[c.artistId]?.active);

    if (visible.length) {
      document.getElementById("concerts-list").innerHTML = visible.map((c) => concertCardHtml(c)).join("");
    }
  }

  const followsSnap = await getDocs(query(collection(db, "follows"), where("fanId", "==", currentUser.uid)));
  if (!followsSnap.empty) {
    const artistIds = followsSnap.docs.map((d) => d.data().artistId);
    await renderFollowingSection(artistIds);
  }

  renderRecentPlays();

  await loadBrowseTracks("browse-tracks-list");
}

async function renderFollowingSection(artistIds) {
  // Firestore's `in` operator caps at 10 values — fine at this platform's
  // current scale, but a fan following more than 10 artists would only see
  // concerts for the first 10 here. Worth revisiting if that ever becomes real.
  const capped = artistIds.slice(0, 10);
  const artistInfo = await fetchArtistInfo(capped);
  const concertsSnap = await getDocs(query(collection(db, "concerts"), where("artistId", "in", capped)));
  const concertsByArtist = {};
  concertsSnap.docs.forEach((d) => {
    const c = d.data();
    const when = c.eventDate?.toDate ? c.eventDate.toDate() : null;
    if (!when || when.getTime() < Date.now()) return; // only upcoming shows
    if (!concertsByArtist[c.artistId] || when < concertsByArtist[c.artistId]) {
      concertsByArtist[c.artistId] = when;
    }
  });

  const list = document.getElementById("following-list");
  list.innerHTML = capped
    .map((aid) => {
      const info = artistInfo[aid];
      if (!info) return "";
      const nextShow = concertsByArtist[aid];
      const sub = nextShow ? `Next show ${nextShow.toLocaleDateString()}` : "No upcoming shows";
      return `
        <div class="list-item">
          <button type="button" class="artist-link" data-artist-id="${aid}"><strong>${info.name}</strong></button>
          <span class="meta">${sub}</span>
        </div>`;
    })
    .join("");
  wireArtistLinks(list);

  renderConcertAlertBanner(capped, concertsByArtist);
}

function renderRecentPlays() {
  const list = document.getElementById("recent-plays-list");
  if (!list) return;

  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem("amp_recent_plays") || "[]");
  } catch {
    recent = [];
  }
  if (!recent.length) return; // leave the default empty-state message

  list.innerHTML = recent
    .map((t) => trackRowHtml(t, t.artistLabel, t.coverArt, t.artistId))
    .join("");
  wirePlayButtons(list);
}

function recordRecentPlay(track) {
  try {
    let recent = JSON.parse(localStorage.getItem("amp_recent_plays") || "[]");
    recent = recent.filter((r) => r.id !== track.id);
    recent.unshift({
      id: track.id,
      title: track.title,
      duration: track.duration,
      artistLabel: track.artistLabel,
      coverArt: track.coverArt,
      artistId: track.artistId
    });
    localStorage.setItem("amp_recent_plays", JSON.stringify(recent.slice(0, 6)));
  } catch {
    // Non-critical — recent plays are a convenience feature, never worth failing playback over.
  }
}

// ---------- Concert alerts (in-app only — see README for the real-push caveat) ----------

function renderConcertAlertBanner(artistIds, concertsByArtist) {
  const banner = document.getElementById("concert-alert-banner");
  if (!banner) return;

  const soon = Object.entries(concertsByArtist).filter(
    ([, date]) => date.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
  );

  if (typeof Notification === "undefined") {
    banner.innerHTML = "";
    return;
  }

  if (Notification.permission === "granted") {
    banner.innerHTML = "";
    if (soon.length && !sessionStorage.getItem("amp_concert_alert_shown")) {
      new Notification("Upcoming show on AMP", { body: "A followed artist has a show coming up this week." });
      sessionStorage.setItem("amp_concert_alert_shown", "1");
    }
    return;
  }

  if (Notification.permission === "denied") {
    banner.innerHTML = "";
    return;
  }

  banner.innerHTML = `<button type="button" class="btn-ghost eq-save-btn" id="enable-alerts-btn" style="margin-bottom:12px;">Enable show alerts</button>`;
  document.getElementById("enable-alerts-btn").addEventListener("click", async () => {
    const perm = await Notification.requestPermission();
    if (perm === "granted") renderConcertAlertBanner(artistIds, concertsByArtist);
  });
}

// ---------- Shared: artist activation status + album art lookups ----------
// Firestore can't join, so these fetch the small set of unique artists/albums
// referenced by whatever list is on screen, once per render, rather than once
// per track — keeps the read count sane on a busy discover list.

async function fetchArtistInfo(artistIds) {
  const info = {};
  await Promise.all(
    artistIds.map(async (aid) => {
      const snap = await getDoc(doc(db, "users", aid));
      if (snap.exists()) {
        const data = snap.data();
        info[aid] = { name: data.displayName || "Unknown artist", active: data.artistMetadata?.isActive === true };
      } else {
        info[aid] = { name: "Unknown artist", active: false };
      }
    })
  );
  return info;
}

async function fetchAlbumArt(albumIds) {
  const map = {};
  await Promise.all(
    albumIds.filter(Boolean).map(async (id) => {
      const snap = await getDoc(doc(db, "albums", id));
      map[id] = snap.exists() ? snap.data().coverArt || null : null;
    })
  );
  return map;
}

function renderOnboarding() {
  view.innerHTML = `
    <div class="screen">
      <div class="card" style="max-width:460px;">
        <p class="eyebrow">Artist setup</p>
        <h1>Tell fans about your sound</h1>
        <p class="tagline" style="text-align:left; margin-bottom:20px;">This shows on your public profile. You can edit it any time from your panel.</p>
        <form id="onboarding-form" novalidate>
          <div data-error hidden></div>
          <div class="field"><label for="bio">Bio</label><input type="text" id="bio" name="bio" placeholder="A line or two about your sound" /></div>
          <div class="field"><label for="genres">Genres</label><input type="text" id="genres" name="genres" placeholder="Sega, Reggae, Fusion — comma separated" /></div>
          <div class="field"><label for="bookingWhatsApp">Booking WhatsApp number</label><input type="tel" id="bookingWhatsApp" name="bookingWhatsApp" placeholder="+2481234567" /></div>
          <button type="submit" class="btn btn-primary" data-submit data-default-label="Continue to your panel">Continue to your panel</button>
          <button type="button" class="btn btn-secondary" id="skip-btn">Skip for now</button>
        </form>
      </div>
    </div>`;

  document.getElementById("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector("[data-submit]");
    submitBtn.disabled = true;

    const bio = form.bio.value.trim() || null;
    const genres = form.genres.value.trim()
      ? form.genres.value.split(",").map((g) => g.trim()).filter(Boolean)
      : [];
    const bookingWhatsApp = form.bookingWhatsApp.value.trim() || null;

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        "artistMetadata.bio": bio,
        "artistMetadata.genres": genres,
        "artistMetadata.bookingWhatsApp": bookingWhatsApp
      });
      await refreshUserDoc();
      navigate("/panel");
    } catch (err) {
      console.error("Couldn't save profile:", err);
      showError(form, "Couldn't save your profile. Please try again.");
      submitBtn.disabled = false;
    }
  });

  document.getElementById("skip-btn").addEventListener("click", () => navigate("/panel"));
}

function renderPanel() {
  if (currentUserDoc?.role !== "ARTIST") {
    navigate("/dashboard");
    return;
  }

  const meta = currentUserDoc.artistMetadata || {};
  let badgeHtml;
  if (meta.isActive && meta.isVerified) {
    badgeHtml = `<span class="badge badge-pro">Pro</span>`;
  } else if (meta.isActive) {
    badgeHtml = `<span class="badge badge-live"><span class="status-dot"></span>Live on AMP</span>`;
  } else {
    badgeHtml = `<span class="badge badge-pending"><span class="status-dot pulsing"></span>Awaiting approval</span>`;
  }

  mountAppFrame(
    "home",
    `
    <div class="panel-status-row">${badgeHtml}</div>
    <div class="panel-layout">
    <section class="dash-col">
      <p class="eyebrow">Publish</p>
      <h2>Announce a show</h2>
      <form id="concert-form" novalidate>
        <div data-error hidden></div>
        <div class="field"><label for="venueName">Venue</label><input type="text" id="venueName" name="venueName" required /></div>
        <div class="field"><label for="eventDate">Date &amp; time</label><input type="datetime-local" id="eventDate" name="eventDate" required /></div>
        <div class="field"><label for="description">Details</label><input type="text" id="description" name="description" placeholder="What should fans know?" /></div>
        <div class="field"><label for="ticketLink">Ticket link (optional)</label><input type="url" id="ticketLink" name="ticketLink" placeholder="https://…" /></div>
        <div class="field"><label for="bannerFile">Event banner (optional)</label><input type="file" id="bannerFile" name="bannerFile" accept="image/*" /></div>
        <button type="submit" class="btn btn-primary" data-submit data-default-label="Publish to the Live Grid">Publish to the Live Grid</button>
      </form>
    </section>
    <section class="dash-col">
      <p class="eyebrow">Your shows</p>
      <h2>Published concerts</h2>
      <div id="my-concerts" class="stack">
        <p class="empty-state">Nothing published yet — your first show will appear here.</p>
      </div>
    </section>
    <section class="dash-col" style="grid-column: 1 / -1;">
      <p class="eyebrow">Music</p>
      <h2>Albums &amp; tracks</h2>

      <form id="album-form" class="album-form-inline">
        <div data-error hidden></div>
        <div class="field"><label for="albumTitle">Album title</label><input type="text" id="albumTitle" name="albumTitle" required /></div>
        <div class="field"><label for="releaseYear">Release year</label><input type="number" id="releaseYear" name="releaseYear" min="1950" max="2100" /></div>
        <div class="field"><label for="coverArtFile">Cover art (optional)</label><input type="file" id="coverArtFile" name="coverArtFile" accept="image/*" /></div>
        <label class="checkbox-row"><input type="checkbox" id="isExclusive" name="isExclusive" /> Platform-exclusive (unreleased elsewhere)</label>
        <button type="submit" class="btn btn-secondary" data-submit data-default-label="Create album">Create album</button>
      </form>

      <div id="albums-list" class="stack" style="margin-top:20px;">
        <p class="empty-state">No albums yet — create one above, then upload tracks into it.</p>
      </div>
    </section>
    </div>`
  );

  loadMyConcerts();
  loadMyFavorites().then(loadAlbums);

  document.getElementById("album-form").addEventListener("submit", handleCreateAlbum);

  document.getElementById("concert-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector("[data-submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing…";

    try {
      let bannerImage = null;
      const file = form.bannerFile.files[0];
      if (file) bannerImage = await uploadToCloudinary(file);

      await addDoc(collection(db, "concerts"), {
        artistId: currentUser.uid,
        venueName: form.venueName.value.trim(),
        eventDate: Timestamp.fromDate(new Date(form.eventDate.value)),
        description: form.description.value.trim() || null,
        ticketLink: form.ticketLink.value.trim() || null,
        bannerImage,
        interestedCount: 0
      });

      renderPanel(); // re-render this same view to refresh the concert list
    } catch (err) {
      console.error("Couldn't publish concert:", err);
      showError(form, "Something went wrong publishing that. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish to the Live Grid";
    }
  });
}

// ---------- Follow / unfollow ----------

async function isFollowing(artistId) {
  const followId = `${currentUser.uid}_${artistId}`;
  const snap = await getDoc(doc(db, "follows", followId));
  return snap.exists();
}

async function toggleFollow(artistId, btn) {
  const followId = `${currentUser.uid}_${artistId}`;
  const ref = doc(db, "follows", followId);
  btn.disabled = true;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
      btn.textContent = "Follow";
      btn.classList.remove("btn-following");
    } else {
      await setDoc(ref, { followId, fanId: currentUser.uid, artistId, timestamp: serverTimestamp() });
      btn.textContent = "Following";
      btn.classList.add("btn-following");
    }
  } catch (err) {
    console.error("Couldn't update follow status:", err);
  } finally {
    btn.disabled = false;
  }
}

// ---------- Artist profile ----------

async function renderArtistProfile(artistId) {
  view.innerHTML = `<div class="screen"><p class="tagline">Loading…</p></div>`;

  const artistSnap = await getDoc(doc(db, "users", artistId));
  if (!artistSnap.exists() || artistSnap.data().role !== "ARTIST") {
    view.innerHTML = `<div class="screen"><div class="card"><p class="tagline">Artist not found.</p><a class="btn btn-secondary" href="#/dashboard">Back to dashboard</a></div></div>`;
    return;
  }

  const artist = artistSnap.data();
  const meta = artist.artistMetadata || {};

  if (!meta.isActive) {
    view.innerHTML = `<div class="screen"><div class="card"><p class="tagline">This artist isn't public yet — check back soon.</p><a class="btn btn-secondary" href="#/dashboard">Back to dashboard</a></div></div>`;
    return;
  }

  await loadMyFavorites();
  const [alreadyFollowing, followerCount] = await Promise.all([isFollowing(artistId), getFollowerCount(artistId)]);
  const genresHtml = (meta.genres || []).map((g) => `<span class="genre-tag">${g}</span>`).join("");
  const avatarHtml = meta.profileImage
    ? `<div class="profile-avatar" style="background-image:url('${meta.profileImage}')"></div>`
    : `<div class="profile-avatar profile-avatar-placeholder"></div>`;

  mountAppFrame(
    "",
    `
    <div class="profile-layout">
    <section class="dash-col profile-header">
      <div class="profile-header-row">
        ${avatarHtml}
        <div class="profile-header-text">
          <p class="eyebrow">${meta.isVerified ? "✓ Verified Artist" : "Artist"}</p>
          <h1>${artist.displayName}</h1>
          <p class="meta">${followerCount} follower${followerCount === 1 ? "" : "s"}</p>
          ${meta.bio ? `<p class="tagline" style="text-align:left;">${meta.bio}</p>` : ""}
          <div class="genre-tags">${genresHtml}</div>
          <button type="button" class="btn ${alreadyFollowing ? "btn-secondary btn-following" : "btn-primary"} profile-follow-btn" id="follow-btn">
            ${alreadyFollowing ? "Following" : "Follow"}
          </button>
        </div>
      </div>
    </section>

    <section class="dash-col">
      <p class="eyebrow">Shows</p>
      <h2>Upcoming</h2>
      <div id="profile-concerts" class="stack">
        <p class="empty-state">No shows announced right now.</p>
      </div>
    </section>

    <section class="dash-col" style="grid-column: 1 / -1;">
      <p class="eyebrow">Music</p>
      <h2>Popular</h2>
      <div id="profile-tracks" class="stack">
        <p class="empty-state">No tracks published yet.</p>
      </div>
    </section>
    </div>`
  );

  document.getElementById("follow-btn").addEventListener("click", (e) => toggleFollow(artistId, e.currentTarget));

  // Upcoming concerts for this artist
  const concertsSnap = await getDocs(query(collection(db, "concerts"), where("artistId", "==", artistId)));
  const upcoming = concertsSnap.docs
    .map((d) => d.data())
    .filter((c) => c.eventDate?.toDate && c.eventDate.toDate().getTime() > Date.now())
    .sort((a, b) => a.eventDate.toDate() - b.eventDate.toDate());
  if (upcoming.length) {
    document.getElementById("profile-concerts").innerHTML = upcoming
      .map((c) => `<div class="list-item"><strong>${c.venueName}</strong><span class="meta">${c.eventDate.toDate().toLocaleDateString()} · ${c.description || ""}</span></div>`)
      .join("");
  }

  // Tracks, ranked by play count — closest honest equivalent to a "Popular" list
  const tracksSnap = await getDocs(query(collection(db, "tracks"), where("artistId", "==", artistId)));
  if (!tracksSnap.empty) {
    const tracks = tracksSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    const albumArt = await fetchAlbumArt([...new Set(tracks.map((t) => t.albumId))]);
    const tracksList = document.getElementById("profile-tracks");
    tracksList.innerHTML = tracks.map((t) => trackRowHtml(t, null, albumArt[t.albumId], artistId)).join("");
    wirePlayButtons(tracksList);
  }
}

async function getFollowerCount(artistId) {
  const snap = await getDocs(query(collection(db, "follows"), where("artistId", "==", artistId)));
  return snap.size;
}

// ---------- Search ----------

function renderSearch() {
  mountAppFrame(
    "search",
    `
    <div class="search-input-wrap">
      ${SEARCH_ICON}
      <input type="text" id="search-input" placeholder="Search artists or tracks…" autofocus />
    </div>
    <div id="search-results" class="stack" style="margin-top:20px;">
      <p class="empty-state">Start typing to search AMP.</p>
    </div>`
  );

  let debounceHandle = null;
  document.getElementById("search-input").addEventListener("input", (e) => {
    clearTimeout(debounceHandle);
    const term = e.target.value.trim();
    if (!term) {
      document.getElementById("search-results").innerHTML = `<p class="empty-state">Start typing to search AMP.</p>`;
      return;
    }
    debounceHandle = setTimeout(() => performSearch(term), 300);
  });
}

async function performSearch(term) {
  const resultsEl = document.getElementById("search-results");
  resultsEl.innerHTML = `<p class="empty-state">Searching…</p>`;
  const lower = term.toLowerCase();

  await loadMyFavorites();

  // Artists — client-side substring filter. Fine at this platform's current
  // scale; a full collection scan on every keystroke would need a real
  // search index (e.g. Algolia) if the artist roster grows substantially.
  const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "ARTIST")));
  const artists = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.artistMetadata?.isActive === true && a.displayName?.toLowerCase().includes(lower));

  const tracksSnap = await getDocs(query(collection(db, "tracks")));
  const allTracks = tracksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const titleMatches = allTracks.filter((t) => t.title?.toLowerCase().includes(lower));
  const artistInfo = await fetchArtistInfo([...new Set(titleMatches.map((t) => t.artistId))]);
  const visibleTracks = titleMatches.filter((t) => artistInfo[t.artistId]?.active);
  const albumArt = await fetchAlbumArt([...new Set(visibleTracks.map((t) => t.albumId))]);

  if (!artists.length && !visibleTracks.length) {
    resultsEl.innerHTML = `<p class="empty-state">No matches for "${term}".</p>`;
    return;
  }

  let html = "";
  if (artists.length) {
    html += `<p class="eyebrow" style="margin-top:4px;">Artists</p>`;
    html += artists
      .map((a) => `<div class="list-item"><button type="button" class="artist-link" data-artist-id="${a.id}"><strong>${a.displayName}</strong></button></div>`)
      .join("");
  }
  if (visibleTracks.length) {
    html += `<p class="eyebrow" style="margin-top:16px;">Tracks</p>`;
    html += visibleTracks
      .map((t) => trackRowHtml(t, artistInfo[t.artistId].name, albumArt[t.albumId], t.artistId))
      .join("");
  }

  resultsEl.innerHTML = html;
  wirePlayButtons(resultsEl);
}

async function loadMyConcerts() {
  const snap = await getDocs(query(collection(db, "concerts"), where("artistId", "==", currentUser.uid)));
  if (snap.empty) return;

  const list = document.getElementById("my-concerts");
  list.innerHTML = "";
  snap.forEach((docSnap) => {
    const c = docSnap.data();
    const when = c.eventDate?.toDate ? c.eventDate.toDate().toLocaleString() : "";
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<strong>${c.venueName}</strong><span class="meta">${when}</span>`;
    list.appendChild(item);
  });
}

// ---------- Shared playback engine ----------
// One persistent <audio> element for the whole app (not a new Audio() per
// track) — this is required for the equalizer: createMediaElementSource
// can only be called once per element, so every track has to reuse the
// same element via .src, not spin up a fresh one.

const player = new Audio();
player.crossOrigin = "anonymous"; // needed for Web Audio to read Cloudinary's cross-origin stream

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_FREQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const BAND_GROUPS = { bass: [0, 1, 2, 3], mid: [4, 5, 6], treble: [7, 8, 9] };
const BUILT_IN_PRESETS = [
  { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass Boost", gains: [8, 7, 6, 4, 1, 0, 0, -1, -1, -1] },
  { name: "Vocal Clarity", gains: [-2, -2, -1, 0, 2, 4, 4, 2, 0, -1] }
];

let audioCtx = null;
let eqFilters = []; // 10 chained BiquadFilterNodes, one per EQ_FREQUENCIES entry
let currentTrackId = null;
let currentPlayBtn = null;
let currentTrackMeta = null;
let isSeeking = false;

const trackCache = {}; // trackId -> track data, populated as rows render

function initAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(player);

  eqFilters = EQ_FREQUENCIES.map((freq) => {
    const f = audioCtx.createBiquadFilter();
    f.type = "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.4;
    f.gain.value = 0;
    return f;
  });

  let node = source;
  eqFilters.forEach((f) => {
    node.connect(f);
    node = f;
  });
  node.connect(audioCtx.destination);
}

function setBtnPlaying(btn, isPlaying) {
  if (btn) btn.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
}

function playTrack(track, artistLabel, btn) {
  initAudioGraph();
  if (audioCtx.state === "suspended") audioCtx.resume();

  if (currentTrackId === track.id) {
    if (player.paused) player.play();
    else player.pause();
    return;
  }

  if (currentPlayBtn) setBtnPlaying(currentPlayBtn, false);

  currentTrackId = track.id;
  currentPlayBtn = btn;
  currentTrackMeta = { title: track.title, artistLabel };

  player.src = track.audioUrl;
  player.currentTime = 0;
  player.play();

  document.getElementById("player-bar").hidden = false;
  document.getElementById("player-track-title").textContent = track.title;
  document.getElementById("player-track-artist").textContent = artistLabel || "";
  styleRangeFill(document.getElementById("player-seek"), 0);

  const artEl = document.querySelector(".player-art");
  if (track.coverArt) {
    artEl.style.backgroundImage = `url('${track.coverArt}')`;
    artEl.classList.remove("player-art-placeholder");
  } else {
    artEl.style.backgroundImage = "none";
    artEl.classList.add("player-art-placeholder");
  }

  incrementPlayCount(track.id);
  recordRecentPlay(track);
}

function styleRangeFill(el, pct, vertical = false) {
  if (!el) return;
  const dir = vertical ? "to top" : "to right";
  const color = vertical ? "var(--sunset)" : "var(--hibiscus)";
  el.style.background = `linear-gradient(${dir}, ${color} ${pct}%, var(--surface-raised) ${pct}%)`;
}

player.addEventListener("play", () => setBtnPlaying(currentPlayBtn, true));
player.addEventListener("pause", () => setBtnPlaying(currentPlayBtn, false));
player.addEventListener("ended", () => setBtnPlaying(currentPlayBtn, false));

player.addEventListener("timeupdate", () => {
  if (isSeeking || !player.duration) return;
  const pct = (player.currentTime / player.duration) * 100;
  document.getElementById("player-seek").value = pct;
  styleRangeFill(document.getElementById("player-seek"), pct);
  document.getElementById("player-current-time").textContent = formatDuration(player.currentTime);
});

player.addEventListener("loadedmetadata", () => {
  document.getElementById("player-duration").textContent = formatDuration(player.duration);
});

// ---------- EQ: shared helpers between the quick panel and advanced view ----------

function currentGains() {
  // Before the audio graph exists (nothing's played yet), treat everything as flat.
  return eqFilters.length ? eqFilters.map((f) => f.gain.value) : new Array(10).fill(0);
}

function setBandGain(index, value) {
  initAudioGraph();
  eqFilters[index].gain.value = value;
}

function setGroupGain(indices, value) {
  initAudioGraph();
  indices.forEach((i) => { eqFilters[i].gain.value = value; });
}

function resetAllBands() {
  initAudioGraph();
  eqFilters.forEach((f) => { f.gain.value = 0; });
  syncQuickPanelFromFilters();
  if (!document.getElementById("eq-advanced").hidden) renderAdvancedGraph();
}

function syncQuickPanelFromFilters() {
  const gains = currentGains();
  const avg = (indices) => indices.reduce((sum, i) => sum + gains[i], 0) / indices.length;

  const bassEl = document.getElementById("eq-bass");
  const midEl = document.getElementById("eq-mid");
  const trebleEl = document.getElementById("eq-treble");
  const bassValue = document.getElementById("eq-bass-value");
  const midValue = document.getElementById("eq-mid-value");
  const trebleValue = document.getElementById("eq-treble-value");

  const bassAvg = Math.round(avg(BAND_GROUPS.bass));
  const midAvg = Math.round(avg(BAND_GROUPS.mid));
  const trebleAvg = Math.round(avg(BAND_GROUPS.treble));

  bassEl.value = bassAvg;
  midEl.value = midAvg;
  trebleEl.value = trebleAvg;
  bassValue.textContent = `${bassAvg > 0 ? "+" : ""}${bassAvg}dB`;
  midValue.textContent = `${midAvg > 0 ? "+" : ""}${midAvg}dB`;
  trebleValue.textContent = `${trebleAvg > 0 ? "+" : ""}${trebleAvg}dB`;
  styleRangeFill(bassEl, ((bassAvg + 15) / 30) * 100, true);
  styleRangeFill(midEl, ((midAvg + 15) / 30) * 100, true);
  styleRangeFill(trebleEl, ((trebleAvg + 15) / 30) * 100, true);
}

// ---------- Advanced 10-band graphic EQ ----------

const EQ_GRAPH_W = 760;
const EQ_GRAPH_H = 260;
const EQ_MARGIN_X = 30;

function eqFreqX(i) {
  return EQ_MARGIN_X + (i * (EQ_GRAPH_W - 2 * EQ_MARGIN_X)) / (EQ_FREQUENCIES.length - 1);
}

function eqGainY(gain) {
  return EQ_GRAPH_H / 2 - (gain / 15) * (EQ_GRAPH_H / 2 - 12);
}

function eqYToGain(y) {
  const raw = ((EQ_GRAPH_H / 2 - y) / (EQ_GRAPH_H / 2 - 12)) * 15;
  return Math.max(-15, Math.min(15, raw));
}

function renderAdvancedFreqLabels() {
  const container = document.getElementById("eq-advanced-freqs");
  container.innerHTML = EQ_FREQUENCIES.map((_, i) => {
    const pct = (eqFreqX(i) / EQ_GRAPH_W) * 100;
    return `<span class="eq-freq-label" style="left:${pct}%">${EQ_FREQ_LABELS[i]}</span>`;
  }).join("");
}

function renderAdvancedGraph() {
  const svg = document.getElementById("eq-advanced-graph");
  const gains = currentGains();
  const points = gains.map((g, i) => ({ x: eqFreqX(i), y: eqGainY(g) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const zeroY = eqGainY(0);

  const gridlines = EQ_FREQUENCIES.map((_, i) => {
    const x = eqFreqX(i);
    return `<line x1="${x}" y1="0" x2="${x}" y2="${EQ_GRAPH_H}" class="eq-gridline" />`;
  }).join("");

  svg.innerHTML = `
    ${gridlines}
    <line x1="0" y1="${zeroY}" x2="${EQ_GRAPH_W}" y2="${zeroY}" class="eq-zeroline" />
    <path d="${pathD}" class="eq-curve-path" />
    ${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="9" class="eq-node" data-index="${i}"></circle>`).join("")}
  `;

  svg.querySelectorAll(".eq-node").forEach((node) => {
    node.addEventListener("pointerdown", startEqDrag);
  });
}

function updateGraphLive() {
  const svg = document.getElementById("eq-advanced-graph");
  const gains = currentGains();
  const points = gains.map((g, i) => ({ x: eqFreqX(i), y: eqGainY(g) }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const path = svg.querySelector(".eq-curve-path");
  if (path) path.setAttribute("d", pathD);

  points.forEach((p, i) => {
    const node = svg.querySelector(`.eq-node[data-index="${i}"]`);
    if (node) node.setAttribute("cy", p.y);
  });
}

function startEqDrag(e) {
  e.preventDefault();
  const node = e.currentTarget;
  const index = Number(node.dataset.index);

  function onMove(ev) {
    ev.preventDefault();
    const svg = document.getElementById("eq-advanced-graph");
    const rect = svg.getBoundingClientRect();
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const y = ((clientY - rect.top) / rect.height) * EQ_GRAPH_H;
    setBandGain(index, eqYToGain(y));
    updateGraphLive(); // only moves the existing dot/path — never recreates them mid-drag
    syncQuickPanelFromFilters();
  }
  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  // Window-level, not node-level: an SVG shape can trigger a native
  // "drag image" gesture mid-drag in some browsers, which cancels pointer
  // capture on the element itself. Listening on window sidesteps that —
  // the drag keeps tracking regardless of what the pointer is technically over.
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function loadSavedPresets() {
  try {
    return JSON.parse(localStorage.getItem("amp_eq_presets") || "[]");
  } catch {
    return [];
  }
}

function savePreset(name, gains) {
  const saved = loadSavedPresets().filter((p) => p.name !== name);
  saved.push({ name, gains });
  localStorage.setItem("amp_eq_presets", JSON.stringify(saved));
  renderPresetList();
}

function applyPreset(gains) {
  initAudioGraph();
  gains.forEach((g, i) => { eqFilters[i].gain.value = g; });
  renderAdvancedGraph();
  syncQuickPanelFromFilters();
}

function renderPresetList() {
  const container = document.getElementById("eq-advanced-presets");
  const all = [...BUILT_IN_PRESETS, ...loadSavedPresets()];
  container.innerHTML = all
    .map((p) => `<button type="button" class="eq-preset-chip" data-gains='${JSON.stringify(p.gains)}'>${p.name}</button>`)
    .join("");
  container.querySelectorAll(".eq-preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => applyPreset(JSON.parse(chip.dataset.gains)));
  });
}

function initAdvancedEq() {
  const openBtn = document.getElementById("eq-advanced-open");
  const backBtn = document.getElementById("eq-advanced-back");
  const resetBtn = document.getElementById("eq-advanced-reset");
  const saveBtn = document.getElementById("eq-advanced-save");
  const overlay = document.getElementById("eq-advanced");
  const eqPanel = document.getElementById("eq-panel");

  renderAdvancedFreqLabels();
  renderPresetList();

  openBtn.addEventListener("click", () => {
    eqPanel.hidden = true;
    overlay.hidden = false;
    initAudioGraph();
    renderAdvancedGraph();
  });

  backBtn.addEventListener("click", () => {
    overlay.hidden = true;
    eqPanel.hidden = false;
  });

  resetBtn.addEventListener("click", resetAllBands);

  saveBtn.addEventListener("click", () => {
    const name = document.getElementById("eq-preset-name").value.trim() || "Custom";
    savePreset(name, currentGains());
  });
}

function initPlayerBarControls() {
  const playPauseBtn = document.getElementById("player-playpause");
  const seekEl = document.getElementById("player-seek");
  const volumeEl = document.getElementById("player-volume");
  const eqToggle = document.getElementById("player-eq-toggle");
  const eqPanel = document.getElementById("eq-panel");
  const eqReset = document.getElementById("eq-reset");
  const bassEl = document.getElementById("eq-bass");
  const midEl = document.getElementById("eq-mid");
  const trebleEl = document.getElementById("eq-treble");
  const bassValue = document.getElementById("eq-bass-value");
  const midValue = document.getElementById("eq-mid-value");
  const trebleValue = document.getElementById("eq-treble-value");

  // Seed icons — HTML ships with empty containers so app.js owns all iconography.
  setBtnPlaying(playPauseBtn, false);
  document.querySelector(".icon-volume").innerHTML = VOLUME_ICON;
  document.querySelector(".icon-eq").innerHTML = EQ_ICON;
  styleRangeFill(seekEl, 0);
  styleRangeFill(volumeEl, 100);
  styleRangeFill(bassEl, 50, true);
  styleRangeFill(midEl, 50, true);
  styleRangeFill(trebleEl, 50, true);

  playPauseBtn.addEventListener("click", () => {
    if (!currentTrackId) return;
    if (player.paused) player.play();
    else player.pause();
  });
  player.addEventListener("play", () => setBtnPlaying(playPauseBtn, true));
  player.addEventListener("pause", () => setBtnPlaying(playPauseBtn, false));
  player.addEventListener("ended", () => setBtnPlaying(playPauseBtn, false));

  seekEl.addEventListener("input", () => {
    isSeeking = true;
    styleRangeFill(seekEl, seekEl.value);
  });
  seekEl.addEventListener("change", () => {
    if (player.duration) player.currentTime = (seekEl.value / 100) * player.duration;
    isSeeking = false;
  });

  volumeEl.addEventListener("input", () => {
    player.volume = volumeEl.value / 100;
    styleRangeFill(volumeEl, volumeEl.value);
  });

  eqToggle.addEventListener("click", () => {
    eqPanel.hidden = !eqPanel.hidden;
    if (!eqPanel.hidden) syncQuickPanelFromFilters();
  });

  function eqFillPct(value) {
    return ((Number(value) + 15) / 30) * 100;
  }

  bassEl.addEventListener("input", () => {
    setGroupGain(BAND_GROUPS.bass, Number(bassEl.value));
    bassValue.textContent = `${bassEl.value > 0 ? "+" : ""}${bassEl.value}dB`;
    styleRangeFill(bassEl, eqFillPct(bassEl.value), true);
  });
  midEl.addEventListener("input", () => {
    setGroupGain(BAND_GROUPS.mid, Number(midEl.value));
    midValue.textContent = `${midEl.value > 0 ? "+" : ""}${midEl.value}dB`;
    styleRangeFill(midEl, eqFillPct(midEl.value), true);
  });
  trebleEl.addEventListener("input", () => {
    setGroupGain(BAND_GROUPS.treble, Number(trebleEl.value));
    trebleValue.textContent = `${trebleEl.value > 0 ? "+" : ""}${trebleEl.value}dB`;
    styleRangeFill(trebleEl, eqFillPct(trebleEl.value), true);
  });

  eqReset.addEventListener("click", resetAllBands);

  initAdvancedEq();
}

initPlayerBarControls();

async function incrementPlayCount(trackId) {
  if (!trackId) return;
  try {
    const ref = doc(db, "tracks", trackId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { playCount: (snap.data().playCount || 0) + 1 });
    }
  } catch (err) {
    console.error("Couldn't update play count:", err);
    // Non-critical — playback already succeeded, so this fails silently.
  }
}

function trackRowHtml(track, artistLabel, coverArt, artistId) {
  trackCache[track.id] = { ...track, artistLabel, coverArt };
  const thumbHtml = coverArt
    ? `<div class="track-thumb" style="background-image:url('${coverArt}')"></div>`
    : `<div class="track-thumb track-thumb-placeholder"></div>`;
  const isFav = myFavoriteTrackIds.has(track.id);
  const artistHtml = artistLabel
    ? `<button type="button" class="artist-link" data-artist-id="${artistId}">${artistLabel}</button> · `
    : "";
  return `
    <div class="list-item track-row">
      <div class="track-row-main">
        ${thumbHtml}
        <div>
          <strong>${track.title}</strong>
          <span class="meta">${artistHtml}${track.duration || ""}</span>
        </div>
      </div>
      <div class="track-row-actions">
        <button type="button" class="btn-heart${isFav ? " is-favorited" : ""}" data-track-id="${track.id}">${isFav ? HEART_FILLED_ICON : HEART_ICON}</button>
        <button type="button" class="btn-play" data-track-id="${track.id}">${PLAY_ICON}</button>
      </div>
    </div>`;
}

// ---------- Card-style renderers (home dashboard's Live Grid + Discover rows) ----------
// Distinct from trackRowHtml: this is the image-forward "card" presentation
// from the reference design, used only where a horizontal card row makes
// sense. Everywhere else (search, playlists, artist "Popular") stays a list —
// matches how the reference itself treats those as lists, not cards.

function trackCardHtml(track, artistLabel, coverArt, artistId) {
  trackCache[track.id] = { ...track, artistLabel, coverArt };
  const artClass = coverArt ? "track-card-art" : "track-card-art track-card-art-placeholder";
  const artStyle = coverArt ? ` style="background-image:url('${coverArt}')"` : "";
  return `
    <div class="track-card">
      <div class="${artClass}"${artStyle}>
        <button type="button" class="track-card-play btn-play" data-track-id="${track.id}">${PLAY_ICON}</button>
      </div>
      <strong class="track-card-title">${track.title}</strong>
      <span class="meta">${artistLabel ? `<button type="button" class="artist-link" data-artist-id="${artistId}">${artistLabel}</button>` : ""}</span>
    </div>`;
}

function concertCardHtml(concert) {
  const artClass = concert.bannerImage ? "track-card-art" : "track-card-art track-card-art-placeholder";
  const artStyle = concert.bannerImage ? ` style="background-image:url('${concert.bannerImage}')"` : "";
  return `
    <div class="track-card">
      <div class="${artClass}"${artStyle}></div>
      <strong class="track-card-title">${concert.venueName}</strong>
      <span class="meta">${concert.description || ""}</span>
    </div>`;
}

function wirePlayButtons(container) {
  container.querySelectorAll(".btn-play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const track = trackCache[btn.dataset.trackId];
      if (track) playTrack(track, track.artistLabel, btn);
    });
  });
  container.querySelectorAll(".btn-heart").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.trackId, btn));
  });
  wireArtistLinks(container);
}

function wireArtistLinks(container) {
  container.querySelectorAll(".artist-link").forEach((btn) => {
    btn.addEventListener("click", () => navigate(`/artist/${btn.dataset.artistId}`));
  });
}

// ---------- Favorites (heart) ----------
// Cached in memory per view load rather than re-queried on every render —
// refreshed by loadMyFavorites(), called once at the top of any screen that
// shows track rows, so the heart's filled/empty state is accurate everywhere.

let myFavoriteTrackIds = new Set();
let myFavoritePlaylistId = null;

async function loadMyFavorites() {
  const snap = await getDocs(query(collection(db, "playlists"), where("ownerId", "==", currentUser.uid)));
  if (snap.empty) {
    myFavoriteTrackIds = new Set();
    myFavoritePlaylistId = null;
    return;
  }
  myFavoritePlaylistId = snap.docs[0].id;
  myFavoriteTrackIds = new Set(snap.docs[0].data().trackIds || []);
}

async function toggleFavorite(trackId, btn) {
  const isFav = myFavoriteTrackIds.has(trackId);
  btn.disabled = true;

  try {
    if (myFavoritePlaylistId) {
      await updateDoc(doc(db, "playlists", myFavoritePlaylistId), {
        trackIds: isFav ? arrayRemove(trackId) : arrayUnion(trackId),
        updatedAt: serverTimestamp()
      });
    } else {
      const ref = await addDoc(collection(db, "playlists"), {
        ownerId: currentUser.uid,
        title: "Liked Songs",
        trackIds: [trackId],
        updatedAt: serverTimestamp()
      });
      myFavoritePlaylistId = ref.id;
    }

    if (isFav) myFavoriteTrackIds.delete(trackId);
    else myFavoriteTrackIds.add(trackId);

    const stillFav = myFavoriteTrackIds.has(trackId);
    btn.innerHTML = stillFav ? HEART_FILLED_ICON : HEART_ICON;
    btn.classList.toggle("is-favorited", stillFav);
  } catch (err) {
    console.error("Couldn't update favorites:", err);
  } finally {
    btn.disabled = false;
  }
}

async function loadBrowseTracks(containerId) {
  const snap = await getDocs(query(collection(db, "tracks")));
  if (snap.empty) return; // leave the default empty-state message in place

  const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const artistInfo = await fetchArtistInfo([...new Set(tracks.map((t) => t.artistId))]);
  const albumArt = await fetchAlbumArt([...new Set(tracks.map((t) => t.albumId))]);

  // Same activation gate as concerts — an artist an admin hasn't activated
  // yet doesn't surface here, even though the track document already exists.
  const visible = tracks.filter((t) => artistInfo[t.artistId]?.active);

  const list = document.getElementById(containerId);
  if (!visible.length) return; // leave the default empty-state message in place

  list.innerHTML = visible.map((t) => trackCardHtml(t, artistInfo[t.artistId].name, albumArt[t.albumId], t.artistId)).join("");
  wirePlayButtons(list);
}



const holdingPens = {}; // albumId -> [{ file, title }]

async function loadAlbums() {
  const snap = await getDocs(query(collection(db, "albums"), where("artistId", "==", currentUser.uid)));
  const container = document.getElementById("albums-list");

  if (snap.empty) return; // leave the default empty-state message in place

  container.innerHTML = "";
  for (const docSnap of snap.docs) {
    const album = { id: docSnap.id, ...docSnap.data() };
    const card = document.createElement("div");
    card.className = "album-card";
    card.dataset.albumId = album.id;
    card.innerHTML = `
      <div class="album-head">
        <strong>${album.title}</strong>
        <span class="meta">${album.releaseYear || ""}${album.isExclusive ? " · Exclusive" : ""}</span>
      </div>
      <div class="track-list" id="tracks-${album.id}"><p class="empty-state">Loading tracks…</p></div>
      <div class="ingestion-pen">
        <input type="file" accept="audio/*" multiple class="track-file-input" data-album-id="${album.id}" />
        <div class="holding-pen-rows" id="pen-${album.id}"></div>
        <button type="button" class="btn btn-secondary upload-tracks-btn" data-album-id="${album.id}" style="display:none; margin-top:10px;">Upload tracks</button>
      </div>`;
    container.appendChild(card);
    loadTracksForAlbum(album.id, album.coverArt);
  }

  container.querySelectorAll(".track-file-input").forEach((input) => {
    input.addEventListener("change", handleFilesSelected);
  });
  container.querySelectorAll(".upload-tracks-btn").forEach((btn) => {
    btn.addEventListener("click", handleUploadTracks);
  });
}

async function loadTracksForAlbum(albumId, coverArt) {
  const snap = await getDocs(query(collection(db, "tracks"), where("albumId", "==", albumId)));
  const list = document.getElementById(`tracks-${albumId}`);
  if (!list) return;

  if (snap.empty) {
    list.innerHTML = `<p class="empty-state">No tracks yet — add some below.</p>`;
    return;
  }
  const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.innerHTML = tracks.map((t) => trackRowHtml(t, null, coverArt, currentUser.uid)).join("");
  wirePlayButtons(list);
}

function handleFilesSelected(e) {
  const albumId = e.target.dataset.albumId;
  const files = Array.from(e.target.files);
  holdingPens[albumId] = files.map((file) => ({
    file,
    title: file.name.replace(/\.[^/.]+$/, "")
  }));
  renderHoldingPen(albumId);
}

function renderHoldingPen(albumId) {
  const items = holdingPens[albumId] || [];
  const pen = document.getElementById(`pen-${albumId}`);
  const uploadBtn = document.querySelector(`.upload-tracks-btn[data-album-id="${albumId}"]`);

  pen.innerHTML = items
    .map(
      (item, idx) => `
      <div class="pen-row">
        <input type="text" class="pen-title-input" data-album-id="${albumId}" data-idx="${idx}" value="${item.title}" />
        <span class="meta">${item.file.name}</span>
      </div>`
    )
    .join("");

  pen.querySelectorAll(".pen-title-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      holdingPens[albumId][idx].title = e.target.value;
    });
  });

  uploadBtn.style.display = items.length ? "block" : "none";
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function handleUploadTracks(e) {
  const albumId = e.currentTarget.dataset.albumId;
  const items = holdingPens[albumId] || [];
  if (!items.length) return;

  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = `Uploading 0/${items.length}…`;
  let done = 0;

  try {
    // Throttled 3-channel upload stream — matches the Ingestion Holding
    // Pen spec, so a full album drop doesn't fire a dozen uploads at once.
    await mapWithConcurrency(items, 3, async (item) => {
      const [audioUrl, durationSeconds] = await Promise.all([
        uploadToCloudinary(item.file),
        getAudioDuration(item.file)
      ]);
      await addDoc(collection(db, "tracks"), {
        albumId,
        artistId: currentUser.uid,
        title: item.title,
        audioUrl,
        duration: formatDuration(durationSeconds),
        playCount: 0
      });
      done++;
      btn.textContent = `Uploading ${done}/${items.length}…`;
    });

    delete holdingPens[albumId];
    document.querySelector(`.track-file-input[data-album-id="${albumId}"]`).value = "";
    document.getElementById(`pen-${albumId}`).innerHTML = "";
    btn.style.display = "none";
    const albumSnap = await getDoc(doc(db, "albums", albumId));
    loadTracksForAlbum(albumId, albumSnap.exists() ? albumSnap.data().coverArt : null);
  } catch (err) {
    console.error("Track upload failed:", err);
    alert("Some tracks didn't upload. Please try again.");
    btn.disabled = false;
    btn.textContent = "Upload tracks";
  }
}

async function handleCreateAlbum(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("[data-submit]");
  submitBtn.disabled = true;

  try {
    let coverArt = null;
    const file = form.coverArtFile.files[0];
    if (file) coverArt = await uploadToCloudinary(file);

    await addDoc(collection(db, "albums"), {
      artistId: currentUser.uid,
      title: form.albumTitle.value.trim(),
      releaseYear: form.releaseYear.value ? Number(form.releaseYear.value) : null,
      coverArt,
      isExclusive: form.isExclusive.checked
    });

    form.reset();
    loadAlbums();
  } catch (err) {
    console.error("Couldn't create album:", err);
    showError(form, "Something went wrong creating that album. Please try again.");
  } finally {
    submitBtn.disabled = false;
  }
}

// ==========================================================================
// Auth actions
// ==========================================================================

async function handleSignup(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("[data-submit]");
  setLoading(submitBtn, true);

  const displayName = form.displayName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const role = form.querySelector('input[name="role"]:checked')?.value;

  if (!role) {
    showError(form, "Choose whether you're joining as a fan or an artist.");
    setLoading(submitBtn, false);
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const userDoc = {
      userId: credential.user.uid,
      role,
      email,
      displayName,
      createdAt: serverTimestamp()
    };
    if (role === "ARTIST") userDoc.artistMetadata = blankArtistMetadata();

    await setDoc(doc(db, "users", credential.user.uid), userDoc);
    currentUser = credential.user;
    currentUserDoc = userDoc;
    navigate(role === "ARTIST" ? "/onboarding" : "/dashboard");
  } catch (err) {
    console.error("Signup failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(submitBtn, false);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("[data-submit]");
  setLoading(submitBtn, true);

  try {
    const credential = await signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
    const snap = await getDoc(doc(db, "users", credential.user.uid));

    if (!snap.exists()) {
      showError(form, "We couldn't find a profile for this account. Contact support.");
      setLoading(submitBtn, false);
      return;
    }

    currentUser = credential.user;
    currentUserDoc = snap.data();
    navigate(currentUserDoc.role === "ARTIST" ? "/panel" : "/dashboard");
  } catch (err) {
    console.error("Login failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(submitBtn, false);
  }
}

async function handleGoogleSignIn(buttonEl) {
  const provider = new GoogleAuthProvider();
  setLoading(buttonEl, true, "Connecting…");

  try {
    const result = await signInWithPopup(auth, provider);
    const snap = await getDoc(doc(db, "users", result.user.uid));
    currentUser = result.user;

    if (snap.exists()) {
      currentUserDoc = snap.data();
      navigate(currentUserDoc.role === "ARTIST" ? "/panel" : "/dashboard");
    } else {
      currentUserDoc = null;
      navigate("/role-select");
    }
  } catch (err) {
    console.error("Google sign-in failed:", err);
    setLoading(buttonEl, false);
    alert(friendlyAuthError(err));
  }
}

async function completeRoleSelection(role, buttonEl) {
  if (!currentUser) {
    navigate("/");
    return;
  }
  setLoading(buttonEl, true);

  try {
    const userDoc = {
      userId: currentUser.uid,
      role,
      email: currentUser.email,
      displayName: currentUser.displayName || "",
      createdAt: serverTimestamp()
    };
    if (role === "ARTIST") userDoc.artistMetadata = blankArtistMetadata();

    await setDoc(doc(db, "users", currentUser.uid), userDoc);
    currentUserDoc = userDoc;
    navigate(role === "ARTIST" ? "/onboarding" : "/dashboard");
  } catch (err) {
    console.error("Couldn't finish account setup:", err);
    setLoading(buttonEl, false);
    alert("Something went wrong finishing your setup. Please try again.");
  }
}

async function handleSignOut() {
  await signOut(auth);
  currentUser = null;
  currentUserDoc = null;
  navigate("/");
}

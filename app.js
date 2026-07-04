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
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUD_NAME = "dflbqacnt";
const UPLOAD_PRESET = "amp_media";

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

const PROTECTED_ROUTES = ["/dashboard", "/onboarding", "/panel", "/role-select"];

function renderRoute() {
  const path = location.hash.replace(/^#/, "") || "/";

  if (!authReady) {
    renderLoading();
    return;
  }

  if (PROTECTED_ROUTES.includes(path) && !currentUser) {
    navigate("/");
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

function renderDashboard() {
  if (currentUserDoc?.role === "ARTIST") {
    navigate("/panel");
    return;
  }

  view.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <span class="brand-mark small">AMP</span>
        <div class="topbar-right">
          <span class="user-chip">${currentUserDoc?.displayName || currentUser.email}</span>
          <button type="button" class="btn-ghost" id="signout-btn">Sign out</button>
        </div>
      </header>
      <main class="dash-grid">
        <section class="dash-col">
          <p class="eyebrow">Live Grid</p>
          <h2>Upcoming shows</h2>
          <div id="concerts-list" class="stack">
            <p class="empty-state">No shows on the board yet — follow some artists and they'll turn up here the moment one's announced.</p>
          </div>
        </section>
        <section class="dash-col">
          <p class="eyebrow">Following</p>
          <h2>New from artists you follow</h2>
          <div id="following-list" class="stack">
            <p class="empty-state">You're not following anyone yet. Find an artist's profile and hit Follow to start building your feed.</p>
          </div>
        </section>
        <section class="dash-col">
          <p class="eyebrow">Your library</p>
          <h2>Favorites</h2>
          <div id="playlist-list" class="stack">
            <p class="empty-state">Tap the heart on any track to start your favorites.</p>
          </div>
        </section>
        <section class="dash-col" style="grid-column: 1 / -1;">
          <p class="eyebrow">Discover</p>
          <h2>Tracks on AMP</h2>
          <div id="browse-tracks-list" class="stack">
            <p class="empty-state">No tracks published yet.</p>
          </div>
        </section>
      </main>
    </div>`;

  document.getElementById("signout-btn").addEventListener("click", handleSignOut);
  loadDashboardData();
}

async function loadDashboardData() {
  const concertsSnap = await getDocs(query(collection(db, "concerts")));
  if (!concertsSnap.empty) {
    const list = document.getElementById("concerts-list");
    list.innerHTML = "";
    concertsSnap.forEach((docSnap) => {
      const c = docSnap.data();
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<strong>${c.venueName}</strong><span class="meta">${c.description || ""}</span>`;
      list.appendChild(item);
    });
  }

  const followsSnap = await getDocs(query(collection(db, "follows"), where("fanId", "==", currentUser.uid)));
  if (!followsSnap.empty) {
    document.getElementById("following-list").innerHTML =
      `<p class="empty-state">Following ${followsSnap.size} artist${followsSnap.size === 1 ? "" : "s"} — new releases will surface here.</p>`;
  }

  const playlistSnap = await getDocs(query(collection(db, "playlists"), where("ownerId", "==", currentUser.uid)));
  if (!playlistSnap.empty) {
    const trackCount = playlistSnap.docs[0].data().trackIds?.length || 0;
    document.getElementById("playlist-list").innerHTML =
      `<p class="empty-state">${trackCount} track${trackCount === 1 ? "" : "s"} saved.</p>`;
  }

  await loadBrowseTracks("browse-tracks-list");
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
  let badgeHtml = `<span class="badge">Pending verification</span>`;
  if (meta.isVerified && meta.isActive) badgeHtml = `<span class="badge badge-pro">Pro</span>`;
  else if (!meta.isActive) badgeHtml = `<span class="badge">Inactive — billing needed</span>`;

  view.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <span class="brand-mark small">AMP</span>
        <div class="topbar-right">${badgeHtml}<button type="button" class="btn-ghost" id="signout-btn">Sign out</button></div>
      </header>
      <main class="panel-layout">
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
      </main>
    </div>`;

  document.getElementById("signout-btn").addEventListener("click", handleSignOut);
  loadMyConcerts();
  loadAlbums();

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

let audioCtx = null;
let bassFilter, midFilter, trebleFilter;
let currentTrackId = null;
let currentPlayBtn = null;
let currentTrackMeta = null;
let isSeeking = false;

const trackCache = {}; // trackId -> track data, populated as rows render

function initAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(player);

  bassFilter = audioCtx.createBiquadFilter();
  bassFilter.type = "lowshelf";
  bassFilter.frequency.value = 200;

  midFilter = audioCtx.createBiquadFilter();
  midFilter.type = "peaking";
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 0.7;

  trebleFilter = audioCtx.createBiquadFilter();
  trebleFilter.type = "highshelf";
  trebleFilter.frequency.value = 4000;

  source.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(audioCtx.destination);
}

function setBtnPlaying(btn, isPlaying) {
  if (btn) btn.textContent = isPlaying ? "⏸" : "▶";
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

  incrementPlayCount(track.id);
}

player.addEventListener("play", () => setBtnPlaying(currentPlayBtn, true));
player.addEventListener("pause", () => setBtnPlaying(currentPlayBtn, false));
player.addEventListener("ended", () => setBtnPlaying(currentPlayBtn, false));

player.addEventListener("timeupdate", () => {
  if (isSeeking || !player.duration) return;
  document.getElementById("player-seek").value = (player.currentTime / player.duration) * 100;
  document.getElementById("player-current-time").textContent = formatDuration(player.currentTime);
});

player.addEventListener("loadedmetadata", () => {
  document.getElementById("player-duration").textContent = formatDuration(player.duration);
});

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

  playPauseBtn.addEventListener("click", () => {
    if (!currentTrackId) return;
    if (player.paused) player.play();
    else player.pause();
  });
  player.addEventListener("play", () => setBtnPlaying(playPauseBtn, true));
  player.addEventListener("pause", () => setBtnPlaying(playPauseBtn, false));
  player.addEventListener("ended", () => setBtnPlaying(playPauseBtn, false));

  seekEl.addEventListener("input", () => { isSeeking = true; });
  seekEl.addEventListener("change", () => {
    if (player.duration) player.currentTime = (seekEl.value / 100) * player.duration;
    isSeeking = false;
  });

  volumeEl.addEventListener("input", () => {
    player.volume = volumeEl.value / 100;
  });

  eqToggle.addEventListener("click", () => {
    eqPanel.hidden = !eqPanel.hidden;
  });

  bassEl.addEventListener("input", () => { initAudioGraph(); bassFilter.gain.value = Number(bassEl.value); });
  midEl.addEventListener("input", () => { initAudioGraph(); midFilter.gain.value = Number(midEl.value); });
  trebleEl.addEventListener("input", () => { initAudioGraph(); trebleFilter.gain.value = Number(trebleEl.value); });

  eqReset.addEventListener("click", () => {
    bassEl.value = 0; midEl.value = 0; trebleEl.value = 0;
    if (bassFilter) bassFilter.gain.value = 0;
    if (midFilter) midFilter.gain.value = 0;
    if (trebleFilter) trebleFilter.gain.value = 0;
  });
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

function trackRowHtml(track, artistLabel) {
  trackCache[track.id] = { ...track, artistLabel };
  return `
    <div class="list-item track-row">
      <div>
        <strong>${track.title}</strong>
        <span class="meta">${artistLabel ? artistLabel + " · " : ""}${track.duration || ""}</span>
      </div>
      <button type="button" class="btn-play" data-track-id="${track.id}">▶</button>
    </div>`;
}

function wirePlayButtons(container) {
  container.querySelectorAll(".btn-play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const track = trackCache[btn.dataset.trackId];
      if (track) playTrack(track, track.artistLabel, btn);
    });
  });
}

async function loadBrowseTracks(containerId) {
  const snap = await getDocs(query(collection(db, "tracks")));
  if (snap.empty) return; // leave the default empty-state message in place

  const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const artistIds = [...new Set(tracks.map((t) => t.artistId))];
  const artistNames = {};

  await Promise.all(
    artistIds.map(async (aid) => {
      const aSnap = await getDoc(doc(db, "users", aid));
      artistNames[aid] = aSnap.exists() ? aSnap.data().displayName || "Unknown artist" : "Unknown artist";
    })
  );

  const list = document.getElementById(containerId);
  list.innerHTML = tracks.map((t) => trackRowHtml(t, artistNames[t.artistId])).join("");
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
    loadTracksForAlbum(album.id);
  }

  container.querySelectorAll(".track-file-input").forEach((input) => {
    input.addEventListener("change", handleFilesSelected);
  });
  container.querySelectorAll(".upload-tracks-btn").forEach((btn) => {
    btn.addEventListener("click", handleUploadTracks);
  });
}

async function loadTracksForAlbum(albumId) {
  const snap = await getDocs(query(collection(db, "tracks"), where("albumId", "==", albumId)));
  const list = document.getElementById(`tracks-${albumId}`);
  if (!list) return;

  if (snap.empty) {
    list.innerHTML = `<p class="empty-state">No tracks yet — add some below.</p>`;
    return;
  }
  const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.innerHTML = tracks.map((t) => trackRowHtml(t)).join("");
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
    loadTracksForAlbum(albumId);
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

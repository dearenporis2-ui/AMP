// js/auth.js
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Shared helpers ----------

function showError(formEl, message) {
  const errorEl = formEl?.querySelector("[data-error]");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function setLoading(el, isLoading, label) {
  if (!el) return;
  el.disabled = isLoading;
  if (isLoading) {
    el.dataset.defaultLabel = el.dataset.defaultLabel || el.textContent;
    el.textContent = label || "Please wait…";
  } else {
    el.textContent = el.dataset.defaultLabel || el.textContent;
  }
}

function blankArtistMetadata() {
  // Matches the v2 schema exactly: split verification flags, no billing
  // record exists yet, so isVerified and isActive both start false.
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

function buildUserDoc(user, role) {
  const userDoc = {
    userId: user.uid,
    role,
    email: user.email,
    displayName: user.displayName || "",
    createdAt: serverTimestamp()
  };
  if (role === "ARTIST") {
    userDoc.artistMetadata = blankArtistMetadata();
  }
  return userDoc;
}

// ---------- Email/Password signup ----------
// Order matters: create the Auth account FIRST, then write the Firestore
// user doc while the client is authenticated as that new user. Writing to
// Firestore before auth resolves — or before the account exists — trips
// permission errors under the security rules.

export async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
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
    const userDoc = buildUserDoc(credential.user, role);
    userDoc.displayName = displayName; // prefer the typed name over Auth's blank displayName

    await setDoc(doc(db, "users", credential.user.uid), userDoc);
    window.location.href = role === "ARTIST" ? "artist-onboarding.html" : "dashboard.html";
  } catch (err) {
    console.error("Signup failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(submitBtn, false);
  }
}

// ---------- Email/Password login ----------

export async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector("[data-submit]");
  setLoading(submitBtn, true);

  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userSnap = await getDoc(doc(db, "users", credential.user.uid));

    if (!userSnap.exists()) {
      showError(form, "We couldn't find a profile for this account. Contact support.");
      setLoading(submitBtn, false);
      return;
    }

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Login failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(submitBtn, false);
  }
}

// ---------- Google Sign-In ----------
// Works for both first-time and returning users. After the popup resolves,
// check whether a users/{uid} doc already exists: if yes, route by role.
// If no, this is their very first sign-in — send them to pick Fan/Artist
// before any user doc gets created.

export async function handleGoogleSignIn(buttonEl) {
  const provider = new GoogleAuthProvider();
  setLoading(buttonEl, true, "Connecting…");

  try {
    const result = await signInWithPopup(auth, provider);
    const userSnap = await getDoc(doc(db, "users", result.user.uid));

    if (userSnap.exists()) {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "role-select.html";
    }
  } catch (err) {
    console.error("Google sign-in failed:", err);
    setLoading(buttonEl, false);
    alert("Sign-in didn't go through. Please try again.");
  }
}

// ---------- First-time role selection (Google-auth path only) ----------
// Email/password signup already collects the role in the form itself, so
// this page is only ever reached via a brand-new Google account.

export async function completeRoleSelection(role, buttonEl) {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  setLoading(buttonEl, true);

  try {
    await setDoc(doc(db, "users", user.uid), buildUserDoc(user, role));
    window.location.href = role === "ARTIST" ? "artist-onboarding.html" : "dashboard.html";
  } catch (err) {
    console.error("Couldn't finish account setup:", err);
    setLoading(buttonEl, false);
    alert("Something went wrong finishing your setup. Please try again.");
  }
}

// ---------- Route guarding (used on protected pages later) ----------

export function requireAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    onReady(user);
  });
}

export async function handleSignOut() {
  await signOut(auth);
  window.location.href = "index.html";
}

// ---------- Error copy ----------

function friendlyAuthError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try logging in instead.";
  if (code.includes("weak-password")) return "Choose a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Email or password is incorrect.";
  }
  if (code.includes("popup-closed-by-user")) return "Sign-in window closed before finishing.";
  return "Something went wrong. Please try again.";
}

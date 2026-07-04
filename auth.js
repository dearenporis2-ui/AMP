// js/auth.js
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Shared helpers ----------

function showError(formEl, message) {
  const errorEl = formEl.querySelector("[data-error]");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
}

function setLoading(formEl, isLoading) {
  const btn = formEl.querySelector("[data-submit]");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Please wait…" : btn.dataset.defaultLabel || btn.textContent;
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

// ---------- Signup ----------
// Order matters: create the Auth account FIRST, then write the Firestore
// user doc while the client is authenticated as that new user. Writing to
// Firestore before auth resolves — or before the account exists — trips
// permission errors under the security rules.

export async function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  setLoading(form, true);

  const displayName = form.displayName.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const role = form.querySelector('input[name="role"]:checked')?.value;

  if (!role) {
    showError(form, "Choose whether you're joining as a fan or an artist.");
    setLoading(form, false);
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const userDoc = {
      userId: uid,
      role,
      email,
      displayName,
      createdAt: serverTimestamp()
    };

    if (role === "ARTIST") {
      userDoc.artistMetadata = blankArtistMetadata();
    }

    // Runs after auth has resolved, with the new user already signed in —
    // this is the ordering that avoids the permission errors seen on Stash.
    await setDoc(doc(db, "users", uid), userDoc);

    window.location.href = role === "ARTIST" ? "artist-onboarding.html" : "dashboard.html";
  } catch (err) {
    console.error("Signup failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(form, false);
  }
}

// ---------- Login ----------

export async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  setLoading(form, true);

  const email = form.email.value.trim();
  const password = form.password.value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userSnap = await getDoc(doc(db, "users", credential.user.uid));

    if (!userSnap.exists()) {
      showError(form, "We couldn't find a profile for this account. Contact support.");
      setLoading(form, false);
      return;
    }

    const { role } = userSnap.data();
    window.location.href = role === "ARTIST" ? "dashboard.html" : "dashboard.html";
  } catch (err) {
    console.error("Login failed:", err);
    showError(form, friendlyAuthError(err));
    setLoading(form, false);
  }
}

// ---------- Route guarding (used on protected pages later) ----------

export function requireAuth(onReady) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    onReady(user);
  });
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
  return "Something went wrong. Please try again.";
}

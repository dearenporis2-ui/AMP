// js/firebase-config.js
// Replace the placeholder values below with your AMP Firebase project's
// web app config (Firebase Console → Project Settings → General → Your apps).
//
// This file is imported as an ES module by auth.js and every other page script.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// No Firebase Storage import — as of Feb 2026, Cloud Storage for Firebase requires
// the paid Blaze plan even for the default bucket. Cloudinary handles all media
// (images AND audio, uploaded as a "video" resource_type) instead, so Firebase
// stays on the free Spark plan (Auth + Firestore only).

const firebaseConfig = {
  apiKey: "AIzaSyAqtfXKkzVDuOICL3cFhB5rF_Mt3x3fJyE",
  authDomain: "artist-management-c6bc7.firebaseapp.com",
  projectId: "artist-management-c6bc7",
  storageBucket: "artist-management-c6bc7.firebasestorage.app",
  messagingSenderId: "408614548298",
  appId: "1:408614548298:web:c88eac10fd4d545c7707b3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

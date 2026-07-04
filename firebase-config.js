// js/firebase-config.js
// Replace the placeholder values below with your AMP Firebase project's
// web app config (Firebase Console → Project Settings → General → Your apps).
//
// This file is imported as an ES module by auth.js and every other page script.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_AMP_API_KEY",
  authDomain: "REPLACE_WITH_AMP_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_AMP_PROJECT_ID",
  storageBucket: "REPLACE_WITH_AMP_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

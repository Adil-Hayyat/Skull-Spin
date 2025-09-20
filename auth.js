// auth.js
// Signup/Login with Firebase Auth + Firestore (username stored & verified)

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* Helper to show messages */
function showStatus(msg, color = "red") {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.display = "block";
  clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(() => { el.style.display = "none"; }, 4000);
}

/* ------------------ SIGNUP ------------------ */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !email || !password) {
    showStatus("⚠️ Enter username, email & password.", "red");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    // Firestore document with username
    await setDoc(doc(db, "users", user.uid), {
      username: username,
      email: email,
      balance: 0
    });

    showStatus("✅ Signup successful!", "green");
    setTimeout(() => window.location.href = "index.html", 1000);

  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === "auth/email-already-in-use") {
      showStatus("❌ Email already in use.", "red");
    } else {
      showStatus("❌ " + err.message, "red");
    }
  }
});

/* ------------------ LOGIN ------------------ */
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!usernameInput || !email || !password) {
    showStatus("⚠️ Enter username, email & password.", "red");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      showStatus("❌ No user record found.", "red");
      return;
    }

    const data = snap.data();
    if (data.username !== usernameInput) {
      await signOut(auth);
      showStatus("❌ Invalid username.", "red");
      return;
    }

    showStatus("✅ Login successful!", "green");
    setTimeout(() => window.location.href = "index.html", 800);

  } catch (err) {
    console.error("Login error:", err);
    if (err.code === "auth/wrong-password") {
      showStatus("❌ Wrong password.", "red");
    } else if (err.code === "auth/user-not-found") {
      showStatus("❌ No account found.", "red");
    } else {
      showStatus("❌ " + err.message, "red");
    }
  }
});

/* ------------------ LOGOUT ------------------ */
export async function logout() {
  try {
    await signOut(auth);
    window.location.href = "auth.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
}

/* ------------------ AUTH GUARD ------------------ */
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "auth.html";
  }
});

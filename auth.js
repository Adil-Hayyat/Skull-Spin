// auth.js (final without username)
// Signup, Login, Logout, Auth check

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
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/** Show status messages */
function showStatus(msg, color = "red") {
  let statusBox = document.getElementById("authStatus");
  if (!statusBox) {
    statusBox = document.createElement("p");
    statusBox.id = "authStatus";
    document.body.appendChild(statusBox);
  }
  statusBox.textContent = msg;
  statusBox.style.color = color;
  statusBox.style.display = "block";
  clearTimeout(showStatus._hideTimer);
  showStatus._hideTimer = setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}

/** ---------------- SIGNUP ---------------- */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("password")?.value || "");

  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }
  if (password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", "red");
    return;
  }

  try {
    // ✅ create firebase auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // ✅ save user profile in Firestore
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      email: user.email,
      balance: 0,
      createdAt: serverTimestamp()
    });

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 1200);
  } catch (error) {
    const code = error.code || "";
    if (code === "auth/email-already-in-use") {
      showStatus("❌ Email already in use. Try logging in.", "red");
    } else if (code === "auth/invalid-email") {
      showStatus("❌ Invalid email address.", "red");
    } else {
      showStatus("❌ " + (error.message || "Signup failed"), "red");
    }
    console.error("Signup error:", error);
  }
});

/** ---------------- LOGIN ---------------- */
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("password")?.value || "");

  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }

  try {
    // ✅ sign in firebase auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // ✅ check firestore profile exists
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      showStatus("No Account Found, Please Sign-Up", "red");
      return;
    }

    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 800);
  } catch (error) {
    const code = error.code || "";
    console.error("Login error:", error);

    if (code === "auth/user-not-found") {
      showStatus("No Account Found, Please Sign-Up", "red");
      return;
    }
    if (code === "auth/wrong-password") {
      showStatus("Invalid Password", "red");
      return;
    }
    showStatus("❌ " + (error.message || "Login failed"), "red");
  }
});

/** ---------------- LOGOUT ---------------- */
export async function logout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Logout failed:", e);
  }
  window.location.href = "auth.html";
}

/** ---------------- AUTH CHECK ---------------- */
onAuthStateChanged(auth, (user) => {
  if (!user && !window.location.href.includes("auth.html")) {
    window.location.href = "auth.html";
  }
});

// auth.js (updated)
// Handles: signup (username saved), login (username validation), logout, auth check

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
  getDocs,
  collection,
  query,
  where,
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
  // Auto-hide after 5s
  clearTimeout(showStatus._hideTimer);
  showStatus._hideTimer = setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}

/** Signup handler */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const username = (document.getElementById("Username")?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("password")?.value || "");

  if (!username) {
    showStatus("⚠️ Please enter a username.", "red");
    return;
  }
  if (!email) {
    showStatus("⚠️ Please enter an email.", "red");
    return;
  }
  if (!password || password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", "red");
    return;
  }

  try {
    // Check username uniqueness (search users collection for same username)
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username));
    const existing = await getDocs(q);
    if (!existing.empty) {
      showStatus("⚠️ Username already taken. Choose another.", "red");
      return;
    }

    // Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save user profile in Firestore (users/{uid})
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      username,
      email: user.email,
      balance: 0,
      createdAt: serverTimestamp()
    });

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 1200);
  } catch (error) {
    // Map common errors to friendlier messages
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

/** Login handler */
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const username = (document.getElementById("Username")?.value || "").trim();
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("password")?.value || "");

  if (!username && !email && !password) {
    showStatus("⚠️ Please enter username, email and password.", "red");
    return;
  }
  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }

  try {
    // Try sign in
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // Fetch user's Firestore doc
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // No Firestore profile — treat as no account / require signup
      await signOut(auth);
      showStatus("No Account Found, Please Sign-Up", "red");
      return;
    }

    const data = snap.data() || {};
    const storedUsername = (data.username || "").trim();

    if (!storedUsername) {
      // Account exists but no username saved → require signup correction
      await signOut(auth);
      showStatus("No username set for this account. Please sign up correctly.", "red");
      return;
    }

    if (storedUsername !== username) {
      // Username mismatch → invalid user
      await signOut(auth);
      showStatus("Invalid User", "red");
      return;
    }

    // All good
    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 800);
  } catch (error) {
    // sign-in failed: map codes, and try to determine combined "Invalid User and Password" case
    const code = error.code || "";
    console.error("Login error:", error);

    if (code === "auth/user-not-found") {
      showStatus("No Account Found, Please Sign-Up", "red");
      return;
    }

    if (code === "auth/wrong-password") {
      // Check Firestore record for this email to see username mismatch as well
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          // there is an account with this email — check username in that doc
          const docData = qSnap.docs[0].data();
          const storedUsername = (docData.username || "").trim();
          if (storedUsername && storedUsername !== (document.getElementById("Username")?.value || "").trim()) {
            showStatus("Invalid User and Password", "red");
            return;
          }
        }
      } catch (e) {
        // ignore — fallback to generic message below
        console.error("Error checking user doc on wrong-password:", e);
      }
      showStatus("Invalid Password", "red");
      return;
    }

    // Fallback: show firebase message or generic
    if (error && error.message) {
      showStatus("❌ " + error.message, "red");
    } else {
      showStatus("❌ Login failed", "red");
    }
  }
});

/** Logout function for index.html use */
export async function logout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Logout failed:", e);
  }
  window.location.href = "auth.html";
}

/** Redirect if not on auth page and not logged in */
onAuthStateChanged(auth, (user) => {
  // If not on auth page and user not logged in, redirect handled in index and other pages.
  // No additional actions required here for now.
});

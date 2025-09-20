// auth.js
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
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Helper: Show status messages (success/error)
 * @param {string} msg
 * @param {"green"|"red"} color
 */
function showStatus(msg, color) {
  let statusBox = document.getElementById("authStatus");
  if (!statusBox) {
    statusBox = document.createElement("p");
    statusBox.id = "authStatus";
    document.body.appendChild(statusBox);
  }
  statusBox.textContent = msg;
  statusBox.style.color = color === "green" ? "#155724" : "#721c24";
  statusBox.style.background = color === "green" ? "#d4edda" : "#f8d7da";
  statusBox.style.border = color === "green" ? "1px solid #c3e6cb" : "1px solid #f5c6cb";
  statusBox.style.padding = "10px";
  statusBox.style.borderRadius = "8px";
  statusBox.style.display = "block";

  // auto-hide after 5s
  setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}

/** Utility: check if username already exists in users collection */
async function usernameExists(username) {
  if (!username) return false;
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ---------------- SIGNUP ----------------
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // Basic validation
  if (!username || !email || !password) {
    showStatus("⚠️ All fields are required (username, email, password).", "red");
    return;
  }
  if (password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", "red");
    return;
  }

  try {
    // check username uniqueness
    const exists = await usernameExists(username);
    if (exists) {
      showStatus("⚠️ Username already taken. Choose another.", "red");
      return;
    }

    // create auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // create user doc with username
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      username,
      email: user.email,
      balance: 0,
      createdAt: new Date()
    });

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => (window.location.href = "index.html"), 1500);
  } catch (err) {
    // Show friendly message for firebase auth codes
    if (err && err.code) {
      if (err.code === "auth/email-already-in-use") {
        showStatus("❌ Email already in use. Try logging in.", "red");
        return;
      }
    }
    showStatus("❌ " + (err.message || "Signup failed"), "red");
  }
});

// ---------------- LOGIN ----------------
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    showStatus("⚠️ All fields are required (username, email, password).", "red");
    return;
  }

  // Check whether username exists in users collection
  let usernameDoc = null;
  try {
    const q = query(collection(db, "users"), where("username", "==", username));
    const snap = await getDocs(q);
    if (!snap.empty) {
      // if more than one, pick first (shouldn't happen if unique)
      usernameDoc = snap.docs[0].data();
    }
  } catch (err) {
    console.error("Error checking username:", err);
  }

  // Try sign-in and capture possible errors
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get user's Firestore doc by uid
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      // Signed in but no firestore doc
      showStatus("❌ No Account Found, Please Sign-Up", "red");
      // optionally sign out immediately
      await signOut(auth);
      return;
    }

    const userData = docSnap.data();
    // If username stored in doc doesn't match entered username -> invalid user
    if (!userData.username || userData.username !== username) {
      // Sign out so session doesn't remain
      await signOut(auth);
      showStatus("❌ Invalid User", "red");
      return;
    }

    // All good
    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => (window.location.href = "index.html"), 1200);
  } catch (err) {
    // signIn failed -> map error
    const code = err?.code || "";
    // Decide message by combining username existence query and sign-in error
    const usernameFound = !!usernameDoc;

    if (code === "auth/user-not-found") {
      if (!usernameFound) {
        // both email user not found and username not found
        showStatus("❌ No Account Found, Please Sign-Up", "red");
      } else {
        // username exists but entered email not found (maybe user typed wrong email)
        showStatus("❌ Invalid User", "red");
      }
      return;
    }

    if (code === "auth/wrong-password") {
      if (!usernameFound) {
        // username doesn't exist AND password wrong
        showStatus("❌ Invalid User and Password", "red");
      } else {
        // username exists but wrong password for the given email
        showStatus("❌ Invalid Password", "red");
      }
      return;
    }

    // other firebase errors
    showStatus("❌ " + (err.message || "Login failed"), "red");
  }
});

// ✅ Logout (used inside index.html)
export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout error", err);
  }
  window.location.href = "auth.html";
}

// ✅ Auth check for pages that should redirect away if not logged in
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "auth.html";
  }
});

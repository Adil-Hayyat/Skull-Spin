// auth.js (updated)
// Handles signup/login with username stored in Firestore and improved error messages.

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

/* Utility to show status */
function showStatus(msg, color = "red") {
  const el = document.getElementById("authStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.display = "block";
  // auto-hide after 5s
  clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(() => { el.style.display = "none"; }, 5000);
}

/* Helper: check if username already exists */
async function usernameExists(username) {
  if (!username) return false;
  const q = query(collection(db, "users"), where("username", "==", username));
  const snap = await getDocs(q);
  return !snap.empty;
}

/* Signup */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !email || !password) {
    showStatus("⚠️ Please enter username, email and password.", "red");
    return;
  }
  if (password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", "red");
    return;
  }

  try {
    // check username unique
    const taken = await usernameExists(username);
    if (taken) {
      showStatus("⚠️ Username already taken. Choose another.", "red");
      return;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // create user document with username + email + balance
    await setDoc(doc(db, "users", user.uid), {
      username,
      email: user.email,
      balance: 0
    });

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 1400);
  } catch (err) {
    // firebase auth error
    console.error("Signup error:", err);
    if (err.code === "auth/email-already-in-use") {
      showStatus("❌ Email already in use. Try login or use another email.", "red");
    } else if (err.code === "auth/invalid-email") {
      showStatus("❌ Invalid email address.", "red");
    } else {
      showStatus("❌ " + (err.message || "Signup failed."), "red");
    }
  }
});

/* Login with enhanced checks */
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const usernameInput = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!usernameInput || !email || !password) {
    showStatus("⚠️ Please enter username, email and password.", "red");
    return;
  }

  try {
    // Attempt sign-in
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // fetch user document
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // account exists in auth but no users doc
      await signOut(auth);
      showStatus("❌ No Account Found in database. Please Sign-Up.", "red");
      return;
    }

    const data = snap.data();
    const storedUsername = data.username || "";

    if (storedUsername !== usernameInput) {
      // username mismatch: sign out and show error
      await signOut(auth);
      showStatus("❌ Invalid User (username does not match).", "red");
      return;
    }

    // successful login
    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 900);

  } catch (err) {
    console.error("Login error:", err);

    // After sign-in failure, run checks to produce helpful combined messages
    // Check whether username exists in any user doc
    const usernameQ = query(collection(db, "users"), where("username", "==", document.getElementById("username").value.trim()));
    const emailQ = query(collection(db, "users"), where("email", "==", document.getElementById("email").value.trim()));

    const [usernameSnap, emailSnap] = await Promise.all([getDocs(usernameQ), getDocs(emailQ)]).catch(() => [null, null]);

    const usernameExistsFlag = usernameSnap ? !usernameSnap.empty : false;
    const emailExistsFlag = emailSnap ? !emailSnap.empty : false;

    // Map firebase error codes to readable
    const code = err.code || "";

    if (!emailExistsFlag && !usernameExistsFlag) {
      showStatus("❌ No Account Found, Please Sign-Up", "red");
      return;
    }

    if (code === "auth/wrong-password") {
      // password incorrect
      if (!usernameExistsFlag) {
        showStatus("❌ Invalid User and Password", "red");
      } else if (!emailExistsFlag) {
        // user name exists but email doesn't match any account
        showStatus("❌ No Account Found for this email. Check email or sign-up.", "red");
      } else {
        showStatus("❌ Invalid Password", "red");
      }
      return;
    }

    if (code === "auth/user-not-found") {
      // email not found
      if (usernameExistsFlag) {
        showStatus("No Account Found, Please Sign-Up", "red");
      } else {
        showStatus("No Account Found, Please Sign-Up", "red");
      }
      return;
    }

    // fallback: if username mismatch & email exists
    if (emailExistsFlag && !usernameExistsFlag) {
      showStatus("Invalid User", "red");
      return;
    }

    // generic error
    showStatus("❌ " + (err.message || "Login failed."), "red");
  }
});

/* Logout helper used by index page */
export async function logout() {
  try {
    await signOut(auth);
    window.location.href = "auth.html";
  } catch (err) {
    console.error("Logout error:", err);
  }
}

/* Auth guard */
onAuthStateChanged(auth, (user) => {
  // If user navigates while on index, that file has its own guard. This keeps behavior consistent.
  if (!user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "auth.html";
  }
});

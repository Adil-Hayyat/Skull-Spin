// auth.js (final with referral + signup/login form split)
// Handles Signup, Login, Logout, Auth check

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
  serverTimestamp,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/** Show status messages */
function showStatus(msg, color = "red") {
  let statusBox = document.getElementById("authStatus");
  if (!statusBox) {
    statusBox = document.createElement("p");
    statusBox.id = "authStatus";
    statusBox.style.position = "fixed";
    statusBox.style.top = "12px";
    statusBox.style.right = "12px";
    statusBox.style.zIndex = "9999";
    statusBox.style.padding = "8px 12px";
    statusBox.style.borderRadius = "8px";
    statusBox.style.background = "rgba(0,0,0,0.6)";
    statusBox.style.color = "#fff";
    document.body.appendChild(statusBox);
  }
  statusBox.textContent = msg;
  statusBox.style.background =
    color === "green"
      ? "rgba(40,167,69,0.9)"
      : "rgba(220,53,69,0.95)";
  statusBox.style.display = "block";
  clearTimeout(showStatus._hideTimer);
  showStatus._hideTimer = setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}

/** ---------------- SIGNUP ---------------- */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const name = (document.getElementById("name")?.value || "").trim();
  const username = (document.getElementById("username")?.value || "").trim();
  const email = (document.getElementById("signupEmail")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("signupPassword")?.value || "");
  const confirmPassword = (document.getElementById("confirmPassword")?.value || "");
  const refCodeInput = (document.getElementById("refCode")?.value || "").trim(); // optional

  if (!name || !username || !email || !password || !confirmPassword) {
    showStatus("⚠️ Please fill all required fields.", "red");
    return;
  }
  if (password.length < 6) {
    showStatus("⚠️ Password must be at least 6 characters.", "red");
    return;
  }
  if (password !== confirmPassword) {
    showStatus("⚠️ Passwords do not match.", "red");
    return;
  }

  try {
    // Create firebase auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Prepare Firestore doc
    const userRef = doc(db, "users", user.uid);
    const baseData = {
      name,
      username,
      email: user.email,
      balance: 0,
      createdAt: serverTimestamp(),
      referCode: user.uid,      // shareable referral UID
      referralsCount: 0
    };

    await setDoc(userRef, baseData);

    // If referral code supplied, update referrer
    if (refCodeInput && refCodeInput !== user.uid) {
      try {
        const referrerRef = doc(db, "users", refCodeInput);
        const refSnap = await getDoc(referrerRef);
        if (refSnap.exists()) {
          await updateDoc(userRef, {
            referredBy: refCodeInput,
            referredAt: serverTimestamp()
          }).catch(() => {});

          try {
            await updateDoc(referrerRef, { referralsCount: increment(1) });
          } catch (e) {
            try {
              await updateDoc(referrerRef, { referralsCount: 1 });
            } catch (e2) {}
          }
        }
      } catch (e) {
        console.error("Referral handling error (signup):", e);
      }
    }

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
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
  const email = (document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("loginPassword")?.value || "");

  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await signOut(auth);
      showStatus("No Account Found, Please Sign-Up", "red");
      return;
    }

    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
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

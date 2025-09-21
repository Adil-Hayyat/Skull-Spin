// auth.js (final with referral code reward system)

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
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
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

/** Generate random referral code */
function generateReferralCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/** ---------------- SIGNUP ---------------- */
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = (document.getElementById("email")?.value || "").trim().toLowerCase();
  const password = (document.getElementById("password")?.value || "");
  const referralInput = (document.getElementById("referralCode")?.value || "").trim().toUpperCase();

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

    // ✅ generate unique referral code for this user
    const myReferralCode = generateReferralCode(6);

    // ✅ save user profile in Firestore
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      email: user.email,
      balance: 0,
      referralCode: myReferralCode,
      referredBy: referralInput || null,
      createdAt: serverTimestamp()
    });

    // ✅ If referral code exists, validate & reward
    if (referralInput) {
      const q = query(collection(db, "users"), where("referralCode", "==", referralInput));
      const snap = await getDocs(q);
      if (!snap.empty) {
        snap.forEach(async docSnap => {
          const refUser = docSnap.data();
          const refUserRef = doc(db, "users", docSnap.id);
          const bonus = 50; // PKR reward for referral
          const currentBalance = refUser.balance || 0;
          await updateDoc(refUserRef, { balance: currentBalance + bonus });
        });
        showStatus(`✅ Referral applied! Both you and referrer get 50 PKR.`, "green");
      } else {
        showStatus("⚠️ Invalid referral code.", "orange");
      }
    }

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
  try { await signOut(auth); } catch (e) { console.error("Logout failed:", e); }
  window.location.href = "auth.html";
}

/** ---------------- AUTH CHECK ---------------- */
onAuthStateChanged(auth, (user) => {
  if (!user && !window.location.href.includes("auth.html")) {
    window.location.href = "auth.html";
  }
});

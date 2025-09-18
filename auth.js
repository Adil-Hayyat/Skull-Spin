// auth.js
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Helper: Show status messages (success/error)
 * @param {string} msg - Message text
 * @param {string} color - "green" or "red"
 */
function showStatus(msg, color) {
  let statusBox = document.getElementById("authStatus");
  if (!statusBox) {
    statusBox = document.createElement("p");
    statusBox.id = "authStatus";
    statusBox.style.fontWeight = "bold";
    statusBox.style.marginTop = "10px";
    statusBox.style.textAlign = "center";
    document.body.appendChild(statusBox);
  }

  statusBox.textContent = msg;
  statusBox.style.color = color;
  statusBox.style.display = "block";

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}

// ✅ Signup
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Naya user document banega
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        balance: 0
      });
    }

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (error) {
    showStatus("❌ " + error.message, "red");
  }
});

// ✅ Login
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showStatus("⚠️ Please enter email and password.", "red");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (error) {
    showStatus("❌ " + error.message, "red");
  }
});

// ✅ Logout (used inside index.html)
export async function logout() {
  await signOut(auth);
  window.location.href = "auth.html";
}

// ✅ Auth check
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname.endsWith("index.html")) {
    window.location.href = "auth.html";
  }
});

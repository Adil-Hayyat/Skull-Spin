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
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    showStatus("⚠️ Please enter username, email and password.", "red");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Naya user document banega
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      username,
      email: user.email,
      balance: 0
    });

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
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    showStatus("⚠️ Please enter username, email and password.", "red");
    return;
  }

  try {
    // Firebase Auth se login
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Firestore se username validate
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      showStatus("❌ No Account Found, Please Sign-Up", "red");
      return;
    }

    const dbUsername = docSnap.data().username;
    if (dbUsername !== username) {
      showStatus("❌ Invalid User", "red");
      return;
    }

    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      showStatus("❌ No Account Found, Please Sign-Up", "red");
    } else if (error.code === "auth/wrong-password") {
      if (username) {
        showStatus("❌ Invalid Password", "red");
      } else {
        showStatus("❌ Invalid User and Password", "red");
      }
    } else {
      showStatus("❌ " + error.message, "red");
    }
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

// auth.js
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Helper: Show status messages (success/error)
 */
function showStatus(msg, color) {
  let statusBox = document.getElementById("authStatus");
  if (!statusBox) {
    statusBox = document.createElement("p");
    statusBox.id = "authStatus";
    document.body.appendChild(statusBox);
  }
  statusBox.textContent = msg;
  statusBox.style.color = color;
  statusBox.style.display = "block";
  setTimeout(() => { statusBox.style.display = "none"; }, 5000);
}

// ✅ Signup
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    showStatus("⚠️ Username, Email, and Password are required.", "red");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Firestore user doc
    await setDoc(doc(db, "users", user.uid), {
      username,
      email,
      balance: 0
    });

    showStatus("✅ Signup successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 2000);
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
    showStatus("⚠️ All fields are required.", "red");
    return;
  }

  try {
    // 🔍 Find user by username
    const q = query(collection(db, "users"), where("username", "==", username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      showStatus("❌ Invalid User", "red");
      return;
    }

    let matchedUser = null;
    snapshot.forEach(docSnap => { matchedUser = docSnap.data(); });

    // Username exists → now check email
    if (matchedUser.email !== email) {
      showStatus("❌ No Account Found, Please Sign-Up", "red");
      return;
    }

    // Try Firebase Auth login (this checks password)
    await signInWithEmailAndPassword(auth, email, password);

    showStatus("✅ Login successful! Redirecting...", "green");
    setTimeout(() => { window.location.href = "index.html"; }, 2000);

  } catch (error) {
    // Firebase password mismatch → catch here
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      showStatus("❌ Invalid Password", "red");
    } else if (error.code === "auth/user-not-found") {
      showStatus("❌ No Account Found, Please Sign-Up", "red");
    } else {
      showStatus("❌ " + error.message, "red");
    }
  }
});

// ✅ Logout
export async function logout() {
  await signOut(auth);
  window.location.href = "auth.html";
}

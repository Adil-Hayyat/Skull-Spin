// auth.js
import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ Signup
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // user ka balance Firestore me save
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      balance: 0
    });

    alert("Signup successful ✅");
    window.location.href = "index.html"; // redirect to game
  } catch (error) {
    alert(error.message);
  }
});

// ✅ Login
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful ✅");
    window.location.href = "index.html";
  } catch (error) {
    alert(error.message);
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
    // agar login nahi hai to game page pe jane ki ijazat nahi
    window.location.href = "auth.html";
  }
});

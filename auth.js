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

    // Naya account banate hi balance 0 set karo (sirf first time)
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      balance: 0
    }, { merge: true }); // 👈 merge: true → dobara overwrite nahi karega

    alert("Signup successful ✅");
    window.location.href = "index.html"; // redirect to game
  } catch (error) {
    alert("Signup failed ❌\n" + error.message);
  }
});

// ✅ Login
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Login ke baad user ka data check karo
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Agar user ka record missing hai to create karo
      await setDoc(docRef, { email: user.email, balance: 0 }, { merge: true });
    }

    alert("Login successful ✅");
    window.location.href = "index.html"; // redirect to game
  } catch (error) {
    alert("Login failed ❌\n" + error.message);
  }
});

// ✅ Logout
export async function logout() {
  await signOut(auth);
  window.location.href = "auth.html";
}

// ✅ Auth check
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname.endsWith("index.html")) {
    // agar login nahi hai aur index.html par hai to redirect
    window.location.href = "auth.html";
  }
});

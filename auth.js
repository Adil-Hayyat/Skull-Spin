import { auth } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Signup
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    alert("Signup successful! 🎉");
    console.log(userCredential.user);
  } catch (error) {
    alert("Error: " + error.message);
    console.error(error);
  }
});

// Login
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful! ✅");
    console.log(userCredential.user);
  } catch (error) {
    alert("Error: " + error.message);
    console.error(error);
  }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    alert("Logged out!");
  } catch (error) {
    console.error(error);
  }
});

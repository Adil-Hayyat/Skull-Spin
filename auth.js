// auth.js
import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

// Signup
export async function signup(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    alert("Signup successful: " + userCredential.user.email);
  } catch (error) {
    alert("Signup failed: " + error.message);
  }
}

// Login
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful: " + userCredential.user.email);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

// Logout
export async function logout() {
  try {
    await signOut(auth);
    alert("Logged out successfully");
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
}

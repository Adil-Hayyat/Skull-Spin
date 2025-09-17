import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// DOM elements
const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const addBalanceBtn = document.getElementById("addBalanceBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const userInfo = document.getElementById("userInfo");

const authPopup = document.getElementById("authPopup");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");

let isSignupMode = true;
let currentUser = null;
let currentBalance = 0;

// Open signup popup
signupBtn.addEventListener("click", () => {
  isSignupMode = true;
  authTitle.textContent = "Signup";
  authPopup.style.display = "flex";
});

// Open login popup
loginBtn.addEventListener("click", () => {
  isSignupMode = false;
  authTitle.textContent = "Login";
  authPopup.style.display = "flex";
});

// Submit auth form
authSubmitBtn.addEventListener("click", async () => {
  const email = authEmail.value;
  const password = authPassword.value;

  if (!email || !password) {
    alert("Please fill all fields");
    return;
  }
  if (password.length < 6) {
    alert("Password must be at least 6 characters long");
    return;
  }

  try {
    if (isSignupMode) {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCred.user.uid), { balance: 0, email: email });
      alert("Signup successful!");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Login successful!");
    }
    closeAuthPopup();
  } catch (err) {
    alert("Error: " + err.message);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Close auth popup
window.closeAuthPopup = () => {
  authPopup.style.display = "none";
  authEmail.value = "";
  authPassword.value = "";
};

// Firestore helpers
async function getBalance(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().balance : 0;
}
async function updateBalance(uid, newBalance) {
  await updateDoc(doc(db, "users", uid), { balance: newBalance });
}

// Auth state change
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    currentBalance = await getBalance(user.uid);
    userInfo.textContent = `Balance: ${currentBalance} PKR`;
    userInfo.style.display = "inline-block";

    signupBtn.style.display = "none";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    addBalanceBtn.style.display = "inline-block";
    withdrawBtn.style.display = "inline-block";
  } else {
    currentUser = null;
    currentBalance = 0;
    userInfo.style.display = "none";

    signupBtn.style.display = "inline-block";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    addBalanceBtn.style.display = "none";
    withdrawBtn.style.display = "none";
  }
});

// Expose balance funcs for game.js
export { currentUser, currentBalance, updateBalance };

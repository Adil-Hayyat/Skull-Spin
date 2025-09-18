// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ✅ Aapka Firebase config (jo aapne diya tha)
const firebaseConfig = {
  apiKey: "AIzaSyAE6IddcAPdAUe4J_UywUSBQ2d060yDmPU",
  authDomain: "one-wheely.firebaseapp.com",
  projectId: "one-wheely",
  storageBucket: "one-wheely.firebasestorage.app",
  messagingSenderId: "232397481240",
  appId: "1:232397481240:web:9737c7e1c1ff1c2721ea6d",
  measurementId: "G-626PW7BMSZ"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("✅ Firebase Connected");

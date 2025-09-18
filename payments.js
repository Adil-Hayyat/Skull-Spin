// payments.js
import { auth, db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Receiver static details
const RECEIVER = {
  method: "Easypaisa",
  accountName: "Adil Hayyat",
  accountNumber: "03127196480"
};

/**
 * Add a new transaction to Firestore
 * @param {string} accHolder - Account Holder Name (user input)
 * @param {string} accNumber - Account Number (user input)
 * @param {number} amount - Amount user entered (>=200 PKR)
 */
export async function createTransaction(accHolder, accNumber, amount) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found!");

    const reference = `REF-${user.uid.slice(0, 6)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    await addDoc(collection(db, "transactions"), {
      uid: user.uid,
      accHolder,
      accNumber,
      amount,
      method: RECEIVER.method,
      accountReceiver: RECEIVER.accountNumber,
      reference,
      status: "pending",
      createdAt: serverTimestamp()
    });

    return { success: true, reference };
  } catch (err) {
    console.error("❌ Error creating transaction:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all transactions of current user
 */
export async function getMyTransactions() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found!");

    const q = query(collection(db, "transactions"), where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    const data = [];
    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    return data;
  } catch (err) {
    console.error("❌ Error fetching transactions:", err);
    return [];
  }
}

// payments.js
// Frontend helper: create pending deposit transaction with unique reference

import { auth, db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Receiver account details (Easypaisa)
const RECEIVER = {
  method: "Easypaisa",
  accountName: "Adil Hayyat",
  accountNumber: "0312-7196480"
};

/**
 * createPendingDeposit(amount)
 * - Creates a pending transaction in Firestore
 * - Returns { id, reference }
 */
export async function createPendingDeposit(amount) {
  // ✅ Check if user logged in
  if (!auth.currentUser) {
    alert("⚠️ Please login first.");
    return null;
  }

  // ✅ Validate amount
  if (!amount || isNaN(amount) || amount < 200) {
    alert("⚠️ Minimum deposit amount is 200 PKR.");
    return null;
  }

  const uid = auth.currentUser.uid;

  // ✅ Generate unique reference
  const reference = `REF-${uid.slice(0, 6)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  // ✅ Transaction data
  const tx = {
    uid,
    amount: Number(amount),
    reference,
    method: RECEIVER.method,
    accountReceiver: RECEIVER.accountNumber,
    accountHolder: RECEIVER.accountName,
    status: "pending", // later updated to "confirmed"
    createdAt: serverTimestamp()
  };

  try {
    // ✅ Save in Firestore → "transactions" collection
    const docRef = await addDoc(collection(db, "transactions"), tx);

    // ✅ Message for user
    const msg =
      `💸 Send *${amount} PKR* to ${RECEIVER.method}:\n\n` +
      `📱 Account: ${RECEIVER.accountNumber}\n` +
      `👤 Name: ${RECEIVER.accountName}\n\n` +
      `📝 IMPORTANT: In payment note/reference write:\n\n` +
      `➡️ ${reference}\n\n` +
      `✅ After sending, your balance will be updated once verified.`;

    // ✅ Try to copy reference for user
    try {
      await navigator.clipboard.writeText(reference);
      alert(msg + "\n\n(Reference copied to clipboard ✅)");
    } catch (e) {
      alert(msg + "\n\n⚠️ Reference not copied automatically, please copy it manually.");
    }

    return { id: docRef.id, reference };
  } catch (err) {
    console.error("❌ createPendingDeposit error:", err);
    alert("Failed to create deposit request. Try again.");
    return null;
  }
}

// (Optional) Attach to window so you can call directly from browser console
window.createPendingDeposit = createPendingDeposit;

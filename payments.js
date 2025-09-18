// payments.js
// Frontend helper: create pending deposit transaction with unique reference

import { auth, db } from "./firebase-config.js";
import { 
  addDoc, 
  collection, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

    // 🔹 TEST MODE ONLY: Update balance immediately
    // ⚠️ REMOVE THIS in production (only admin/webhook should confirm payment)
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { balance: increment(Number(amount)) });

    // ✅ Message for user
    const msg =
      `💸 Send *${amount} PKR* to ${RECEIVER.method}:<br><br>` +
      `📱 <b>Account:</b> ${RECEIVER.accountNumber}<br>` +
      `👤 <b>Name:</b> ${RECEIVER.accountName}<br><br>` +
      `📝 <b>IMPORTANT:</b> In payment note/reference write:<br>` +
      `<span style="color:red; font-weight:bold;">${reference}</span><br><br>` +
      `✅ After sending, your balance will be updated once verified.`;

    // ✅ Show in HTML (if container exists)
    const container = document.getElementById("paymentInstructions");
    if (container) {
      container.style.display = "block";
      container.innerHTML = msg;
    } else {
      alert(msg.replace(/<br>/g, "\n"));
    }

    // ✅ Try to copy reference for user
    try {
      await navigator.clipboard.writeText(reference);
      console.log("Reference copied:", reference);
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
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

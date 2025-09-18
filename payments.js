// payments.js
// frontend helper: create pending deposit transaction with unique reference
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Your displayed receiving account (Easypaisa)
const RECEIVER = {
  method: "Easypaisa",
  accountName: "Adil Hayyat",
  accountNumber: "0312-7196480"
};

/**
 * createPendingDeposit(amount)
 * - creates a pending transaction doc in Firestore
 * - returns { id, reference }
 */
export async function createPendingDeposit(amount) {
  if (!auth.currentUser) {
    alert("Please login first.");
    return null;
  }
  if (!amount || isNaN(amount) || amount < 200) {
    alert("Minimum deposit amount is 200 PKR.");
    return null;
  }

  const uid = auth.currentUser.uid;
  const reference = `REF-${uid.slice(0,6)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

  const tx = {
    uid,
    amount: Number(amount),
    reference,
    method: RECEIVER.method,
    accountReceiver: RECEIVER.accountNumber,
    status: "pending",
    createdAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, "transactions"), tx);

    // show user instructions
    const msg = `Pay ${amount} PKR to ${RECEIVER.method} account:\n\n` +
                `Account: ${RECEIVER.accountNumber}\n` +
                `Account holder: ${RECEIVER.accountName}\n\n` +
                `IMPORTANT: In payment note/reference write EXACTLY:\n\n` +
                `${reference}\n\n` +
                `After sending payment, you will be credited automatically when we receive the notification.`;

    // copy reference to clipboard for convenience
    try {
      await navigator.clipboard.writeText(reference);
      alert(msg + "\n\nReference copied to clipboard ✅");
    } catch (e) {
      alert(msg + "\n\n(Reference not copied automatically; please copy it manually.)");
    }

    return { id: docRef.id, reference };
  } catch (err) {
    console.error("createPendingDeposit error:", err);
    alert("Failed to create pending transaction. Try again.");
    return null;
  }
}

// attach to global for quick use from index buttons if you prefer:
window.createPendingDeposit = createPendingDeposit;

// payments.js
import { auth, db } from "./firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const RECEIVER = {
  method: "Easypaisa",
  accountName: "Adil Hayyat",
  accountNumber: "0312-7196480"
};

export async function createPendingDeposit(amount) {
  if (!auth.currentUser) {
    alert("⚠️ Please login first.");
    return null;
  }

  if (!amount || isNaN(amount) || amount < 200) {
    alert("⚠️ Minimum deposit amount is 200 PKR.");
    return null;
  }

  const uid = auth.currentUser.uid;
  const reference = `REF-${uid.slice(0, 6)}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  const tx = {
    uid,
    amount: Number(amount),
    reference,
    method: RECEIVER.method,
    accountReceiver: RECEIVER.accountNumber,
    accountHolder: RECEIVER.accountName,
    status: "pending",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "transactions"), tx);

    // ✅ Balance Update (Temporary / Test Mode)
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const currentBalance = snap.data().balance || 0;
      await updateDoc(userRef, { balance: currentBalance + Number(amount) });
    } else {
      await setDoc(userRef, { balance: Number(amount) });
    }

    // ✅ Show instructions in styled popup
    const container = document.getElementById("paymentInstructions");
    if (container) {
      container.style.display = "block";
      container.innerHTML = `
        <h3>💳 Deposit Instructions</h3>
        <p>Follow these steps to add <b>${amount} PKR</b> to your account:</p>
        <hr>
        <p><b>Step 1:</b> Open your <b>${RECEIVER.method}</b> app.</p>
        <p><b>Step 2:</b> Send money to:</p>
        <p>📱 <b>${RECEIVER.accountNumber}</b><br>👤 ${RECEIVER.accountName}</p>
        <p><b>Step 3:</b> In the payment note/reference, write:</p>
        <p style="color:#143ad3; font-weight:bold;">${reference}</p>
        <p><b>Step 4:</b> Complete the transfer. Your balance will update automatically once verified.</p>
        <hr>
        <button id="closePaymentPopup">Close</button>
      `;

      // ✅ Close button event
      document.getElementById("closePaymentPopup").addEventListener("click", () => {
        container.style.display = "none";
      });
    }

    // ✅ Copy reference for user
    try {
      await navigator.clipboard.writeText(reference);
      alert("Reference copied ✅\n\nCheck instructions popup.");
    } catch (e) {
      alert("Check instructions popup 👇 (Reference not auto-copied)");
    }

    return { reference };
  } catch (err) {
    console.error("❌ createPendingDeposit error:", err);
    alert("Failed to create deposit request. Try again.");
    return null;
  }
}

window.createPendingDeposit = createPendingDeposit;

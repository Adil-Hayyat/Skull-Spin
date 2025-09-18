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
    // ✅ Transaction add karo
    await addDoc(collection(db, "transactions"), tx);

    // ✅ Balance update karo (test mode)
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const currentBalance = snap.data().balance || 0;
      await updateDoc(userRef, { balance: currentBalance + Number(amount) });
    } else {
      await setDoc(userRef, { balance: Number(amount) });
    }

    // ✅ Reference clipboard me copy
    try {
      await navigator.clipboard.writeText(reference);
      console.log("Reference copied:", reference);
    } catch (e) {
      console.warn("Reference not auto-copied:", reference);
    }

    // 🔹 return reference so index.html can show it in popup
    return { reference };
  } catch (err) {
    console.error("❌ createPendingDeposit error:", err);
    alert("Failed to create deposit request. Try again.");
    return null;
  }
}

window.createPendingDeposit = createPendingDeposit;

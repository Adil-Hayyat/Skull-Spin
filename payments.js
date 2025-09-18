// payments.js
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

    // ✅ Balance Update (Test Mode)
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const currentBalance = snap.data().balance || 0;
      await updateDoc(userRef, { balance: currentBalance + Number(amount) });
    } else {
      // agar user ka record nahi bana abhi tak
      await setDoc(userRef, { balance: Number(amount) });
    }

    // ✅ Show instructions in page
    const msg =
      `💸 Send *${amount} PKR* to ${RECEIVER.method}:\n\n` +
      `📱 Account: ${RECEIVER.accountNumber}\n` +
      `👤 Name: ${RECEIVER.accountName}\n\n` +
      `📝 IMPORTANT: In payment note/reference write:\n\n` +
      `➡️ ${reference}\n\n` +
      `✅ After sending, your balance will be updated once verified.`;

    const container = document.getElementById("paymentInstructions");
    if (container) {
      container.style.display = "block";
      container.innerHTML = `<pre>${msg}</pre>`;
    }

    try {
      await navigator.clipboard.writeText(reference);
      alert("Reference copied ✅\n\nCheck instructions below.");
    } catch (e) {
      alert("Check instructions below 👇 (Reference not auto-copied)");
    }

    return { reference };
  } catch (err) {
    console.error("❌ createPendingDeposit error:", err);
    alert("Failed to create deposit request. Try again.");
    return null;
  }
}

window.createPendingDeposit = createPendingDeposit;

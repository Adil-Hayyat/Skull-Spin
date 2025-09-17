import { auth, db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let balance = 0;
const userInfo = document.getElementById("userInfo");
const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");

async function loadBalance() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    balance = snap.data().balance;
  } else {
    balance = 0;
  }

  updateBalanceUI();
}

function updateBalanceUI() {
  userInfo.textContent = `Balance: ${balance} PKR`;
}

async function updateBalanceInDB(newBalance) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, { balance: newBalance });
}

spinBtn.addEventListener("click", async () => {
  if (balance < 10) {
    alert("Not enough balance!");
    return;
  }

  balance -= 10;
  updateBalanceUI();
  await updateBalanceInDB(balance);

  // yahan apka wheel spin ka logic chalega
  console.log("Spin ho gaya!");
});

multiSpinBtn.addEventListener("click", async () => {
  if (balance < 50) {
    alert("Not enough balance!");
    return;
  }

  balance -= 50;
  updateBalanceUI();
  await updateBalanceInDB(balance);

  // multi spin ka logic
  console.log("5 Spin ho gaya!");
});

// jab user login kare → balance load ho
auth.onAuthStateChanged((user) => {
  if (user) {
    loadBalance();
  } else {
    balance = 0;
    updateBalanceUI();
  }
});

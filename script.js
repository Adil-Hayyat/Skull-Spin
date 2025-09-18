import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { logout } from "./auth.js";
import { createPendingDeposit } from "./payments.js";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");
const userInfo = document.getElementById("userInfo");

const addBalanceBtn = document.getElementById("addBalanceBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

let balance = 0;
let currentUser = null;

// 🎡 Wheel setup
let wheelImg = new Image();
wheelImg.src = "wheel.png";
const prizes = ["00", "💀", "10", "💀", "100", "💀", "1000", "💀"];

function drawWheel(rotation) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -250, -250, 500, 500);
  ctx.restore();
}
wheelImg.onload = () => drawWheel(0);

// 🎁 Popup
function showPrize(prize) {
  document.getElementById("prizeText").textContent = prize;
  document.getElementById("popup").style.display = "flex";
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}
window.closePopup = closePopup;

// 👤 UI update
function updateUserInfo() {
  if (currentUser) {
    userInfo.textContent = `${currentUser.email}  ||  PKR | ${balance} |`;
  }
}

// 💾 Balance save with check for new user document
async function saveBalance() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { email: currentUser.email, balance });
  } else {
    await updateDoc(userRef, { balance });
  }
}

// 🎡 Spin button
spinBtn.addEventListener("click", () => {
  if (balance < 10) { alert("⚠️ Not enough balance!"); return; }
  balance -= 10;
  updateUserInfo(); saveBalance();

  let spinAngle = Math.random() * 360 + 360 * 5;
  let spinTime = 0;
  let spinTimeTotal = 3000;

  function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
      const degrees = spinAngle % 360;
      const sectorSize = 360 / prizes.length;
      const index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
      const prize = prizes[index];

      if (prize !== "💀" && prize !== "00") {
        balance += parseInt(prize);
        updateUserInfo(); saveBalance();
      }
      showPrize("🎁 You got: " + prize);
      return;
    }
    const easeOut = (t, b, c, d) => c * ((t = t/d - 1) * t * t + 1) + b;
    const angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
    drawWheel(angleCurrent * Math.PI / 180);
    requestAnimationFrame(rotateWheel);
  }
  rotateWheel();
});

// 🎡 Multi-spin
multiSpinBtn.addEventListener("click", async () => {
  if (balance < 50) { alert("⚠️ Not enough balance!"); return; }
  balance -= 50; updateUserInfo(); saveBalance();

  const rewards = [];
  for (let i = 0; i < 5; i++) {
    const prize = await spinWheelOnce();
    rewards.push(prize);
  }
  showPrize("🎁 You got:\n" + rewards.join(", "));
});

function spinWheelOnce() {
  return new Promise((resolve) => {
    let spinAngle = Math.random() * 360 + 360 * 5;
    let spinTime = 0;
    let spinTimeTotal = 1000;

    function rotateWheel() {
      spinTime += 30;
      if (spinTime >= spinTimeTotal) {
        const degrees = spinAngle % 360;
        const sectorSize = 360 / prizes.length;
        const index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
        const prize = prizes[index];
        if (prize !== "💀" && prize !== "00") {
          balance += parseInt(prize);
          updateUserInfo(); saveBalance();
        }
        resolve(prize);
        return;
      }
      const easeOut = (t, b, c, d) => c * ((t = t/d - 1) * t * t + 1) + b;
      const angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
      drawWheel(angleCurrent * Math.PI / 180);
      requestAnimationFrame(rotateWheel);
    }
    rotateWheel();
  });
}

// 💰 Deposit (frontend → payments.js)
addBalanceBtn.addEventListener("click", async () => {
  const amount = parseInt(prompt("Enter amount to deposit (min 200 PKR):"), 10);
  if (!amount) return;
  await createPendingDeposit(amount);
});

// 💸 Withdraw
withdrawBtn.addEventListener("click", async () => {
  const amount = parseInt(prompt("Enter amount to withdraw (min 1000 PKR):"), 10);
  if (!amount || amount < 1000) { alert("⚠️ Minimum withdraw is 1000 PKR."); return; }
  if (amount > balance) { alert("⚠️ Not enough balance!"); return; }

  try {
    await addDoc(collection(db, "withdrawals"), {
      uid: currentUser.uid,
      amount,
      status: "pending",
      createdAt: serverTimestamp()
    });
    balance -= amount;
    updateUserInfo(); saveBalance();
    alert("✅ Withdraw request submitted!");
  } catch (err) {
    console.error("Withdraw error:", err);
    alert("❌ Failed to submit withdraw request.");
  }
});

// 🚪 Logout
logoutBtn.addEventListener("click", logout);

// 🔥 Auth + Realtime balance sync
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);

    // Ensure document exists for new users
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, { email: user.email, balance: 0 });
      balance = 0;
    } else {
      balance = snap.data().balance || 0;
    }
    updateUserInfo();

    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        balance = docSnap.data().balance || 0;
        updateUserInfo();
      }
    });
  }
});

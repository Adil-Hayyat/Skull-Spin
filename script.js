import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { logout } from "./auth.js";

// 🎡 Canvas setup
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");
const userInfo = document.getElementById("userInfo");

const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

let balance = 0;
let currentUser = null;

// 🎡 Wheel image
let wheelImg = new Image();
wheelImg.src = "./wheel.png";
const prizes = ["00", "💀", "10", "💀", "100", "💀", "1000", "💀"];

function drawWheel(rotation = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
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
    userInfo.textContent = `${currentUser.email} | Balance: ${balance} PKR`;
  }
}

// 💾 Save balance
async function saveBalance() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  try {
    await updateDoc(userRef, { balance });
  } catch {
    await setDoc(userRef, { email: currentUser.email, balance });
  }
}

// 🎡 Single Spin
spinBtn.addEventListener("click", async () => {
  if (balance < 10) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }
  balance -= 10;
  updateUserInfo();
  await saveBalance();

  let spinAngle = Math.random() * 360 + 360 * 5;
  let spinTime = 0;
  let spinTimeTotal = 3000; // 🔥 shorter duration = faster result

  function rotateWheel() {
    spinTime += 16; // 🔥 16ms = ~60 FPS (smoother, no lag)
    if (spinTime >= spinTimeTotal) {
      const degrees = spinAngle % 360;
      const sectorSize = 360 / prizes.length;
      const index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
      const prize = prizes[index];

      if (prize !== "💀" && prize !== "00") {
        balance += parseInt(prize);
        updateUserInfo();
        saveBalance();
      }
      showPrize("🎁 You got: " + prize);
      return;
    }

    const easeOut = (t, b, c, d) =>
      c * ((t = t / d - 1) * t * t + 1) + b;

    const angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
    drawWheel((angleCurrent * Math.PI) / 180);

    requestAnimationFrame(rotateWheel);
  }
  rotateWheel();
});


// 🎡 Multi-spin
multiSpinBtn.addEventListener("click", async () => {
  if (balance < 50) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }
  balance -= 50;
  updateUserInfo();
  await saveBalance();

  // Run 5 spins in parallel
  const spinPromises = [];
  for (let i = 0; i < 5; i++) {
    spinPromises.push(spinWheelOnce());
  }
  const rewards = await Promise.all(spinPromises);

  showPrize("🎁 You got:\n" + rewards.join(", "));
});


function spinWheelOnce() {
  return new Promise((resolve) => {
    let spinAngle = Math.random() * 360 + 360 * 5;
    let spinTime = 0;
    let spinTimeTotal = 10000;

    function rotateWheel() {
      spinTime += 30;
      if (spinTime >= spinTimeTotal) {
        const degrees = spinAngle % 360;
        const sectorSize = 360 / prizes.length;
        const index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
        const prize = prizes[index];

        if (prize !== "💀" && prize !== "00") {
          balance += parseInt(prize);
          updateUserInfo();
          saveBalance();
        }
        resolve(prize);
        return;
      }
      const easeOut = (t, b, c, d) => c * ((t = t / d - 1) * t * t + 1) + b;
      const angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
      drawWheel((angleCurrent * Math.PI) / 180);
      requestAnimationFrame(rotateWheel);
    }
    rotateWheel();
  });
}

// 💸 Withdraw
withdrawBtn.addEventListener("click", async () => {
  const amount = parseInt(prompt("Enter amount to withdraw (min 1000 PKR):"), 10);
  if (!amount || amount < 1000) {
    showStatus("⚠️ Minimum withdraw is 1000 PKR.", "error");
    return;
  }
  if (amount > balance) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }

  try {
    await addDoc(collection(db, "withdrawals"), {
      uid: currentUser.uid,
      amount,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    balance -= amount;
    updateUserInfo();
    await saveBalance();
    showStatus("✅ Withdraw request submitted!", "success");
  } catch (err) {
    console.error("Withdraw error:", err);
    showStatus("❌ Failed to submit withdraw request.", "error");
  }
});

// 🚪 Logout
logoutBtn.addEventListener("click", logout);

// 🔥 Auth + Realtime balance sync
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);

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

// ✅ Status message
function showStatus(message, type) {
  let statusBox = document.getElementById("statusMessage");
  if (!statusBox) {
    statusBox = document.createElement("div");
    statusBox.id = "statusMessage";
    document.body.appendChild(statusBox);
  }

  statusBox.textContent = message;
  statusBox.style.display = "block";
  statusBox.style.position = "fixed";
  statusBox.style.bottom = "20px";
  statusBox.style.left = "50%";
  statusBox.style.transform = "translateX(-50%)";
  statusBox.style.padding = "12px 20px";
  statusBox.style.borderRadius = "8px";
  statusBox.style.fontWeight = "bold";
  statusBox.style.zIndex = "2000";
  statusBox.style.background = type === "success" ? "#28a745" : "#dc3545";
  statusBox.style.color = "#fff";

  setTimeout(() => {
    statusBox.style.display = "none";
  }, 5000);
}


// =========================
// 💰 Add Balance Popup Code
// =========================
const addBalanceBtn = document.getElementById("addBalanceBtn");
const doneBtn = document.getElementById("doneBtn");
const paymentPopup = document.getElementById("paymentInstructions");

if (addBalanceBtn && doneBtn && paymentPopup) {
  // Open popup
  addBalanceBtn.addEventListener("click", () => {
    paymentPopup.style.display = "block";
  });

  // Close + Save transaction
  doneBtn.addEventListener("click", async () => {
    paymentPopup.style.display = "none";

    const amount = parseInt(prompt("Enter deposit amount (min 100 PKR):"), 10);

    if (!amount || amount < 100) {
      showStatus("⚠️ Minimum deposit is 100 PKR.", "error");
      return;
    }

    if (!currentUser) {
      showStatus("⚠️ Please login first!", "error");
      return;
    }

    try {
      await addDoc(collection(db, "payments"), {
        uid: currentUser.uid,
        email: currentUser.email,
        method: "Easypaisa", // 🔥 popup details ke hisaab se
        accountNumber: "03123456789", // 🔥 yaha apna receiver account number likhna
        amount,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      showStatus("✅ Deposit request submitted! Admin will confirm soon.", "success");
    } catch (err) {
      console.error("Payment error:", err);
      showStatus("❌ Failed to submit payment request.", "error");
    }
  });
}

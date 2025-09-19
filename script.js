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

// 🎡 Wheel & pointer images
let wheelImg = new Image();
wheelImg.src = "./wheel.png";

let pointerImg = new Image();
pointerImg.src = "./pointer.png";

const prizes = ["00", "💀", "10", "💀", "100", "💀", "1000", "💀"];

function drawWheel(rotation = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw wheel
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();

  // Draw pointer at center top
  ctx.drawImage(pointerImg, canvas.width/2 - pointerImg.width/2, canvas.height/2 - pointerImg.height/2, pointerImg.width, pointerImg.height);
}

// Draw red dot at stop angle
function drawRedDot(angle) {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(0, -canvas.height / 2 + 20, 10, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

// Initial draw
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

// Spin function
async function spinWheel(cost = 10) {
  if (balance < cost) {
    showStatus("⚠️ Not enough balance!", "error");
    return null;
  }
  balance -= cost;
  updateUserInfo();
  await saveBalance();

  return new Promise((resolve) => {
    let spinAngle = Math.random() * 360 + 360 * 5;
    let spinTime = 0;
    let spinTimeTotal = 3000;

    function rotateWheel() {
      spinTime += 16;
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

        drawWheel((spinAngle * Math.PI) / 180);
        drawRedDot(degrees);
        resolve(prize);
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
}

// 🎡 Single Spin
spinBtn.addEventListener("click", async () => {
  const prize = await spinWheel(10);
  if (prize) showPrize("🎁 You got: " + prize);
});

// 🎡 Multi-spin (5 times with animation for each)
multiSpinBtn.addEventListener("click", async () => {
  if (balance < 50) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }
  balance -= 50;
  updateUserInfo();
  await saveBalance();

  const rewards = [];
  for (let i = 0; i < 5; i++) {
    const prize = await spinWheel(0); // already deducted 50
    if (prize) rewards.push(prize);
  }
  showPrize("🎁 You got:\n" + rewards.join(", "));
});

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
      email: currentUser.email,
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
const inputAmount = document.getElementById("inputAmount");
const inputAccHolder = document.getElementById("inputAccHolder");
const inputAccNumber = document.getElementById("inputAccNumber");

if (addBalanceBtn && doneBtn && paymentPopup) {
  addBalanceBtn.addEventListener("click", () => {
    paymentPopup.style.display = "block";
  });

  doneBtn.addEventListener("click", async () => {
    const amount = parseInt(inputAmount.value, 10);

    if (!amount || amount < 200) {
      showStatus("⚠️ Minimum deposit is 200 PKR.", "error");
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
        name: inputAccHolder.value || "",
        number: inputAccNumber.value || "",
        amount,
        method: "Easypaisa",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      paymentPopup.style.display = "none";
      inputAmount.value = "";
      inputAccHolder.value = "";
      inputAccNumber.value = "";

      showStatus("✅ Deposit request submitted! Admin will confirm soon.", "success");
    } catch (err) {
      console.error("Payment error:", err);
      showStatus("❌ Failed to submit payment request.", "error");
    }
  });
}

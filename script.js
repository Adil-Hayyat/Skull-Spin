// script.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { logout } from "./auth.js";

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

function showPrize(prize) {
  document.getElementById("prizeText").textContent = prize;
  document.getElementById("popup").style.display = "flex";
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}
window.closePopup = closePopup;

function updateUserInfo() {
  if (currentUser) {
    userInfo.textContent = `${currentUser.email} || PKR | ${balance} |`;
  }
}

async function saveBalance() {
  if (currentUser) {
    await updateDoc(doc(db, "users", currentUser.uid), { balance });
  }
}

// Spin logic
spinBtn.addEventListener("click", () => {
  if (balance < 10) { alert("Not enough balance!"); return; }
  balance -= 10;
  updateUserInfo(); saveBalance();

  let spinAngle = Math.random() * 360 + 360 * 5;
  let spinTime = 0;
  let spinTimeTotal = 3000;

  function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
      const degrees = spinAngle % 360;
      let sectorSize = 360 / prizes.length;
      let index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
      let prize = prizes[index];

      if (prize !== "💀" && prize !== "00") {
        balance += parseInt(prize);
        updateUserInfo(); saveBalance();
      }
      showPrize("🎁 You got: " + prize);
      return;
    }
    let easeOut = (t, b, c, d) => c * ((t = t/d - 1) * t * t + 1) + b;
    let angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
    drawWheel(angleCurrent * Math.PI / 180);
    requestAnimationFrame(rotateWheel);
  }
  rotateWheel();
});

// Multi-spin
multiSpinBtn.addEventListener("click", async () => {
  if (balance < 50) { alert("Not enough balance!"); return; }
  balance -= 50; updateUserInfo(); saveBalance();

  let rewards = [];
  for (let i = 0; i < 5; i++) {
    let prize = await spinWheelOnce();
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
        let sectorSize = 360 / prizes.length;
        let index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
        let prize = prizes[index];
        if (prize !== "💀" && prize !== "00") {
          balance += parseInt(prize);
          updateUserInfo(); saveBalance();
        }
        resolve(prize);
        return;
      }
      let easeOut = (t, b, c, d) => c * ((t = t/d - 1) * t * t + 1) + b;
      let angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);
      drawWheel(angleCurrent * Math.PI / 180);
      requestAnimationFrame(rotateWheel);
    }
    rotateWheel();
  });
}

// Balance management
addBalanceBtn.addEventListener("click", () => {
  let amount = parseInt(prompt("Enter amount:"));
  if (!isNaN(amount)) { balance += amount; updateUserInfo(); saveBalance(); }
});
withdrawBtn.addEventListener("click", () => {
  let amount = parseInt(prompt("Withdraw amount:"));
  if (amount > balance) { alert("Not enough balance!"); return; }
  balance -= amount; updateUserInfo(); saveBalance();
  alert("Withdraw request submitted!");
});

// Logout
logoutBtn.addEventListener("click", logout);

// Auth check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      balance = docSnap.data().balance;
      updateUserInfo();
    }
  }
});

// script.js (FULL UPDATED FILE)
// Requirements met:
// - pointer.png removed
// - red dot drawn exactly at the landed sector's CENTER
// - single spin and multi-spin animations work (multi runs sequentially, each with full animation)
// - balance save & realtime sync preserved

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

// -------- Canvas + DOM --------
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

// ensure canvas has explicit size (same as your index.html attributes)
canvas.width = canvas.width || 500;
canvas.height = canvas.height || 500;

const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");
const userInfo = document.getElementById("userInfo");
const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Status box helper exists in DOM? If not, we'll create on demand.
let balance = 0;
let currentUser = null;

// -------- Wheel image --------
const wheelImg = new Image();
wheelImg.src = "./wheel.png";

// Prize definitions: IMPORTANT — set order to match your wheel graphic clockwise from 0° (top).
// You earlier described these ranges; map them accordingly.
// We'll define `prizes` and derive sectors from index (each sector = 360 / n).
const prizes = ["100", "💀", "10", "💀", "00", "💀", "1000", "💀"];
const SECTOR_COUNT = prizes.length;
const SECTOR_SIZE = 360 / SECTOR_COUNT; // e.g. 45°

/**
 * Build sectors array: { prize, startDeg, endDeg, centerDeg }
 * startDeg measured clockwise from top (0).
 */
const sectors = [];
for (let i = 0; i < SECTOR_COUNT; i++) {
  const start = i * SECTOR_SIZE;
  const end = start + SECTOR_SIZE;
  const center = (start + end) / 2;
  sectors.push({ prize: prizes[i], startDeg: start, endDeg: end, centerDeg: center });
}

// -------- Drawing helpers --------
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draw wheel image with given rotation (radians).
 * rotation = angle the wheel is rotated clockwise in radians.
 */
function drawWheel(rotation = 0) {
  clearCanvas();

  // draw wheel centered
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();
}

/**
 * Draw red dot at the CENTER of the sector that corresponds to centerDeg.
 * We draw the dot attached to the wheel image (so it rotates with wheel).
 *
 * rotationRad = current wheel rotation in radians (same used when drawing wheel).
 * centerDeg = sector center angle (degrees, measured clockwise from top).
 */
function drawRedDot(rotationRad, centerDeg) {
  // convert center angle to radians
  const centerRad = (centerDeg * Math.PI) / 180;

  // We'll rotate to (rotationRad + centerRad) and draw dot at top offset.
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotationRad + centerRad);

  // dot position: slightly below the wheel outer edge
  const radius = Math.min(canvas.width, canvas.height) / 2;
  const dotDistance = radius - 18; // tweak offset from edge (18 px)
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(0, -dotDistance, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Given finalSpinDegrees (0-360, total spin %360), return sector index landed.
 * We use same mapping as earlier: sector i covers [i*SECTOR_SIZE, (i+1)*SECTOR_SIZE)
 * But your code used index = floor((360 - degrees)/sectorSize). We'll use a consistent mapping:
 *
 * We define "wheelDegrees" = (360 - finalDegrees) % 360 so that top/indicator aligns.
 * Then index = Math.floor(wheelDegrees / SECTOR_SIZE).
 */
function getSectorIndexFromStopDegrees(finalDegrees) {
  // normalize 0..360
  let deg = finalDegrees % 360;
  if (deg < 0) deg += 360;

  // convert to wheelDegrees (the value used to index into sectors)
  const wheelDegrees = (360 - deg) % 360; // matches earlier logic where 0 is top
  let index = Math.floor(wheelDegrees / SECTOR_SIZE);
  index = ((index % SECTOR_COUNT) + SECTOR_COUNT) % SECTOR_COUNT;
  return index;
}

// -------- Firebase balance helpers --------
async function saveBalance() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  try {
    await updateDoc(userRef, { balance });
  } catch {
    await setDoc(userRef, { email: currentUser.email, balance });
  }
}

function updateUserInfoDisplay() {
  if (userInfo && currentUser) {
    userInfo.textContent = `${currentUser.email} | Balance: ${balance} PKR`;
  }
}

// -------- Wheel animation & result handling --------
/**
 * spinWheel: performs rotation animation and returns the prize string when done.
 * - cost: amount to deduct (default 10)
 * Behavior:
 * - deduct cost immediately (and save)
 * - animate easing-out rotation
 * - on stop: compute landed sector index, add prize to balance (if numeric), draw final wheel and red dot, resolve prize
 */
async function spinWheel(cost = 10) {
  if (balance < cost) {
    showStatus("⚠️ Not enough balance!", "error");
    return null;
  }

  // Deduct cost immediately
  balance -= cost;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch (e) { /* non-fatal */ }

  return new Promise((resolve) => {
    // generate final spin angle in degrees (randomized)
    const rounds = 5 + Math.floor(Math.random() * 3); // 5..7 rounds for variety
    const randomExtra = Math.random() * 360; // final offset
    const spinAngle = rounds * 360 + randomExtra; // total degrees wheel will rotate clockwise
    let spinTime = 0;
    const spinTimeTotal = 2200; // ms (reduced for snappy feel)
    const startTime = performance.now();

    function step(now) {
      spinTime = now - startTime;
      const t = Math.min(spinTime, spinTimeTotal);
      // easeOut cubic
      const easeOut = (t, b, c, d) => c * ((t = t / d - 1) * t * t + 1) + b;
      const currentAngle = easeOut(t, 0, spinAngle, spinTimeTotal); // degrees
      const rotationRad = (currentAngle * Math.PI) / 180;
      drawWheel(rotationRad);

      if (spinTime < spinTimeTotal) {
        requestAnimationFrame(step);
        return;
      }

      // done — final degrees (mod 360)
      const finalDegrees = spinAngle % 360; // 0..360: total rotation degrees clockwise
      // determine which sector landed
      const idx = getSectorIndexFromStopDegrees(finalDegrees);
      const prize = prizes[idx];

      // add prize (if numeric)
      const prizeVal = parseInt(prize);
      if (!isNaN(prizeVal) && prizeVal > 0) {
        balance += prizeVal;
        updateUserInfoDisplay();
        // save balance (best-effort)
        saveBalance().catch(() => {});
      }

      // draw final wheel AND red dot at sector center
      const finalRotationRad = (spinAngle * Math.PI) / 180;
      drawWheel(finalRotationRad);
      // get sector center degrees
      const centerDeg = sectors[idx].centerDeg;
      drawRedDot(finalRotationRad, centerDeg);

      resolve(prize);
    }

    requestAnimationFrame(step);
  });
}

// -------- Button handlers --------
spinBtn?.addEventListener("click", async () => {
  // disable button until finished to prevent double clicks
  spinBtn.disabled = true;
  try {
    const prize = await spinWheel(10);
    if (prize) showPrize("🎁 You got: " + prize);
  } finally {
    spinBtn.disabled = false;
  }
});

// Multi-spin: run sequential spins (each full animation)
multiSpinBtn?.addEventListener("click", async () => {
  if (balance < 50) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }

  // disable to avoid overlapping runs
  multiSpinBtn.disabled = true;
  spinBtn.disabled = true;

  // deduct once
  balance -= 50;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch (e) {}

  const results = [];
  try {
    for (let i = 0; i < 5; i++) {
      // each spin has cost 0 because we've already deducted 50
      // but spinWheel will still attempt to deduct cost; pass 0 to avoid double deduct
      const prize = await spinWheel(0);
      if (prize) results.push(prize);
      // small pause between spins (optional)
      await new Promise(r => setTimeout(r, 200));
    }
    showPrize("🎁 You got:\n" + results.join(", "));
  } finally {
    multiSpinBtn.disabled = false;
    spinBtn.disabled = false;
  }
});

// -------- Withdraw, logout, firestore sync --------
withdrawBtn?.addEventListener("click", async () => {
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
    updateUserInfoDisplay();
    await saveBalance();
    showStatus("✅ Withdraw request submitted!", "success");
  } catch (err) {
    console.error("Withdraw error:", err);
    showStatus("❌ Failed to submit withdraw request.", "error");
  }
});

logoutBtn?.addEventListener("click", logout);

// Realtime user balance sync
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
    updateUserInfoDisplay();

    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        balance = docSnap.data().balance || 0;
        updateUserInfoDisplay();
      }
    });
  } else {
    currentUser = null;
    // optionally clear display
    if (userInfo) userInfo.textContent = "...";
  }
});

// -------- UI helpers (popup / status) --------
function showPrize(prize) {
  const p = document.getElementById("prizeText");
  const pop = document.getElementById("popup");
  if (p) p.textContent = prize;
  if (pop) pop.style.display = "flex";
}
function closePopup() {
  const pop = document.getElementById("popup");
  if (pop) pop.style.display = "none";
}
window.closePopup = closePopup;

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
  setTimeout(() => { statusBox.style.display = "none"; }, 5000);
}

// initial draw when image loaded
wheelImg.onload = () => {
  drawWheel(0);
};

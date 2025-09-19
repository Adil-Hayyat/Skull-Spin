// script.js (FULL UPDATED FILE - withdraw prompt removed and replaced with custom modal)
// Requirements kept from previous version:
// - pointer.png removed
// - red dot drawn at landed sector center
// - single spin and multi-spin animations work (multi runs sequentially, each with full animation)
// - balance save & realtime sync preserved
// - browser prompt() removed for withdraw; replaced with a custom in-page modal

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
// According to your mapping earlier.
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
 * Given finalSpinDegrees (0-360°) calculate sector index landed.
 * We normalize as used previously: wheelDegrees = (360 - finalDegrees) % 360, then index = floor(wheelDegrees / SECTOR_SIZE)
 */
function getSectorIndexFromStopDegrees(finalDegrees) {
  let deg = finalDegrees % 360;
  if (deg < 0) deg += 360;
  const wheelDegrees = (360 - deg) % 360;
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
    const rounds = 5 + Math.floor(Math.random() * 3); // 5..7 rounds
    const randomExtra = Math.random() * 360; // final offset
    const spinAngle = rounds * 360 + randomExtra; // total degrees wheel will rotate clockwise
    let spinTime = 0;
    const spinTimeTotal = 2200; // ms (snappy)
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
      const finalDegrees = spinAngle % 360;
      const idx = getSectorIndexFromStopDegrees(finalDegrees);
      const prize = prizes[idx];

      // add prize (if numeric)
      const prizeVal = parseInt(prize);
      if (!isNaN(prizeVal) && prizeVal > 0) {
        balance += prizeVal;
        updateUserInfoDisplay();
        saveBalance().catch(() => {});
      }

      // draw final wheel AND red dot at sector center
      const finalRotationRad = (spinAngle * Math.PI) / 180;
      drawWheel(finalRotationRad);
      const centerDeg = sectors[idx].centerDeg;
      drawRedDot(finalRotationRad, centerDeg);

      resolve(prize);
    }

    requestAnimationFrame(step);
  });
}

// -------- Button handlers --------
spinBtn?.addEventListener("click", async () => {
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

  multiSpinBtn.disabled = true;
  spinBtn.disabled = true;

  // deduct once
  balance -= 50;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch (e) {}

  const results = [];
  try {
    for (let i = 0; i < 5; i++) {
      // each spin cost 0 because we already deducted 50
      const prize = await spinWheel(0);
      if (prize) results.push(prize);
      // small pause between spins
      await new Promise(r => setTimeout(r, 200));
    }
    showPrize("🎁 You got:\n" + results.join(", "));
  } finally {
    multiSpinBtn.disabled = false;
    spinBtn.disabled = false;
  }
});

// -------- Withdraw: replace browser prompt() with custom modal --------
/**
 * Creates modal DOM for withdraw if it doesn't exist.
 * Modal contains amount input (min 1000), Submit and Cancel buttons.
 */
function ensureWithdrawModal() {
  if (document.getElementById("withdrawModal")) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "withdrawModal";
  modalOverlay.style.position = "fixed";
  modalOverlay.style.top = "0";
  modalOverlay.style.left = "0";
  modalOverlay.style.width = "100%";
  modalOverlay.style.height = "100%";
  modalOverlay.style.background = "rgba(0,0,0,0.5)";
  modalOverlay.style.display = "flex";
  modalOverlay.style.alignItems = "center";
  modalOverlay.style.justifyContent = "center";
  modalOverlay.style.zIndex = "3000";
  modalOverlay.style.visibility = "hidden"; // hidden by default

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.padding = "18px";
  box.style.borderRadius = "10px";
  box.style.minWidth = "300px";
  box.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  box.style.textAlign = "left";
  box.style.color = "#000";

  box.innerHTML = `
    <h3 style="margin:0 0 10px 0; color:#143ad3;">Withdraw</h3>
    <div style="margin-bottom:8px;">
      <label style="font-weight:600;">Amount (min 1000 PKR)</label>
      <input id="withdrawAmountInput" type="number" min="1000" placeholder="1000" style="width:100%; padding:8px; margin-top:6px; border-radius:8px; border:1px solid #ccc;">
    </div>
    <div id="withdrawError" style="color:#721c24; display:none; margin-bottom:8px;"></div>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button id="withdrawCancelBtn" style="padding:8px 12px; border-radius:8px; border:none; background:#ccc; cursor:pointer;">Cancel</button>
      <button id="withdrawSubmitBtn" style="padding:8px 12px; border-radius:8px; border:none; background:#e14a3c; color:#fff; cursor:pointer;">Submit</button>
    </div>
  `;

  modalOverlay.appendChild(box);
  document.body.appendChild(modalOverlay);

  // event listeners
  document.getElementById("withdrawCancelBtn").addEventListener("click", () => {
    hideWithdrawModal();
  });

  document.getElementById("withdrawSubmitBtn").addEventListener("click", async () => {
    const input = document.getElementById("withdrawAmountInput");
    const errDiv = document.getElementById("withdrawError");
    const value = parseInt(input.value, 10);

    // Validation
    if (!value || value < 1000) {
      errDiv.textContent = "⚠️ Amount must be at least 1000 PKR.";
      errDiv.style.display = "block";
      return;
    }
    if (!currentUser) {
      errDiv.textContent = "⚠️ Please login first.";
      errDiv.style.display = "block";
      return;
    }
    if (value > balance) {
      errDiv.textContent = "⚠️ Not enough balance.";
      errDiv.style.display = "block";
      return;
    }

    // proceed with withdraw (disable submit while processing)
    const submitBtn = document.getElementById("withdrawSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      await addDoc(collection(db, "withdrawals"), {
        uid: currentUser.uid,
        email: currentUser.email,
        amount: value,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      balance -= value;
      updateUserInfoDisplay();
      try { await saveBalance(); } catch (e) {}

      hideWithdrawModal();
      showStatus(`✅ Withdraw request for ${value} PKR submitted!`, "success");
    } catch (err) {
      console.error("Withdraw error:", err);
      errDiv.textContent = "❌ Failed to submit withdraw request.";
      errDiv.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  // hide on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWithdrawModal();
  });
}

function showWithdrawModal() {
  ensureWithdrawModal();
  const m = document.getElementById("withdrawModal");
  if (!m) return;
  m.style.visibility = "visible";
  const input = document.getElementById("withdrawAmountInput");
  const errDiv = document.getElementById("withdrawError");
  if (input) { input.value = ""; input.focus(); }
  if (errDiv) { errDiv.style.display = "none"; errDiv.textContent = ""; }
}

function hideWithdrawModal() {
  const m = document.getElementById("withdrawModal");
  if (!m) return;
  m.style.visibility = "hidden";
}

// Replace previous prompt-based withdraw with modal
withdrawBtn?.addEventListener("click", async () => {
  // open custom modal
  if (!currentUser) {
    showStatus("⚠️ Please login first!", "error");
    return;
  }
  showWithdrawModal();
});

// -------- Logout, firestore sync --------
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

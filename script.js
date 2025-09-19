// script.js (FULL UPDATED FILE)
// - Adds add-balance popup handling (Done button) integrated with Firestore
// - Withdraw modal updated (no prompt), wheel/spin/red-dot behavior preserved
// - Multi-spin sequential, single spin works, balance sync saved
// - Admin approval flow expected for payments/withdrawals

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
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { logout } from "./auth.js";

// -------- Canvas + DOM --------
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

// ensure canvas has explicit size (same as your index.html attributes)
canvas.width = canvas.width || 500;
canvas.height = canvas.height || 500;

// Buttons / DOM references
const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");
const userInfo = document.getElementById("userInfo");
const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Add-balance popup elements (from your index.html)
const addBalanceBtn = document.getElementById("addBalanceBtn");
const paymentPopup = document.getElementById("paymentInstructions");
const doneBtn = document.getElementById("doneBtn");
const userIDSpan = document.getElementById("userID");
const inputAccHolder = document.getElementById("inputAccHolder");
const inputAccNumber = document.getElementById("inputAccNumber");
const inputAmount = document.getElementById("inputAmount");

// Status box helper exists in DOM? If not, we'll create on demand.
let balance = 0;
let currentUser = null;

// -------- Wheel image --------
const wheelImg = new Image();
wheelImg.src = "./wheel.png";

// Prize config (must match graphic clockwise from top)
const prizes = ["100", "💀", "10", "💀", "00", "💀", "1000", "💀"];
const SECTOR_COUNT = prizes.length;
const SECTOR_SIZE = 360 / SECTOR_COUNT; // e.g. 45°

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
function drawWheel(rotation = 0) {
  clearCanvas();
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();
}
function drawRedDot(rotationRad, centerDeg) {
  const centerRad = (centerDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotationRad + centerRad);
  const radius = Math.min(canvas.width, canvas.height) / 2;
  const dotDistance = radius - 18; // tweak offset from edge
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(0, -dotDistance, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
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

  // Deduct cost immediately for spins (gameplay)
  balance -= cost;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch (e) { /* non-fatal */ }

  return new Promise((resolve) => {
    const rounds = 5 + Math.floor(Math.random() * 3); // 5..7 rounds
    const randomExtra = Math.random() * 360;
    const spinAngle = rounds * 360 + randomExtra;
    let spinTime = 0;
    const spinTimeTotal = 2200;
    const startTime = performance.now();

    function step(now) {
      spinTime = now - startTime;
      const t = Math.min(spinTime, spinTimeTotal);
      const easeOut = (t, b, c, d) => c * ((t = t / d - 1) * t * t + 1) + b;
      const currentAngle = easeOut(t, 0, spinAngle, spinTimeTotal);
      const rotationRad = (currentAngle * Math.PI) / 180;
      drawWheel(rotationRad);

      if (spinTime < spinTimeTotal) {
        requestAnimationFrame(step);
        return;
      }

      const finalDegrees = spinAngle % 360;
      const idx = getSectorIndexFromStopDegrees(finalDegrees);
      const prize = prizes[idx];

      const prizeVal = parseInt(prize);
      if (!isNaN(prizeVal) && prizeVal > 0) {
        balance += prizeVal;
        updateUserInfoDisplay();
        saveBalance().catch(() => {});
      }

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

multiSpinBtn?.addEventListener("click", async () => {
  if (balance < 50) {
    showStatus("⚠️ Not enough balance!", "error");
    return;
  }

  multiSpinBtn.disabled = true;
  spinBtn.disabled = true;

  // deduct once for 5 spins
  balance -= 50;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch (e) {}

  const results = [];
  try {
    for (let i = 0; i < 5; i++) {
      const prize = await spinWheel(0); // pass 0 so spinWheel doesn't deduct again
      if (prize) results.push(prize);
      await new Promise(r => setTimeout(r, 200));
    }
    showPrize("🎁 You got:\n" + results.join(", "));
  } finally {
    multiSpinBtn.disabled = false;
    spinBtn.disabled = false;
  }
});

// -------- Add-balance popup handling --------
function ensureAddBalancePopupListeners() {
  // If elements missing, skip
  if (!addBalanceBtn || !paymentPopup || !doneBtn || !userIDSpan) return;

  // Open popup directly
  addBalanceBtn.addEventListener("click", async () => {
    const user = currentUser;
    if (!user) {
      showStatus("⚠️ Please login first!", "error");
      return;
    }
    userIDSpan.textContent = user.uid;
    // show popup
    paymentPopup.style.display = "block";
  });

  // Done button
  doneBtn.addEventListener("click", async () => {
    const user = currentUser;
    if (!user) {
      showStatus("⚠️ Please login first!", "error");
      return;
    }

    const accHolder = inputAccHolder ? inputAccHolder.value.trim() : "";
    const accNumber = inputAccNumber ? inputAccNumber.value.trim() : "";
    const amount = inputAmount ? parseInt(inputAmount.value, 10) : NaN;

    if (!accHolder || !accNumber || isNaN(amount) || amount < 200) {
      showStatus("⚠️ Please fill all fields correctly. Minimum amount is 200 PKR.", "error");
      return;
    }

    // Disable button while sending
    doneBtn.disabled = true;
    doneBtn.textContent = "Submitting...";

    try {
      await addDoc(collection(db, "payments"), {
        uid: user.uid,
        email: user.email || "",
        accountHolder: accHolder,
        accountNumber: accNumber,
        amount,
        method: "Easypaisa",
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Close popup and clear inputs
      paymentPopup.style.display = "none";
      if (inputAccHolder) inputAccHolder.value = "";
      if (inputAccNumber) inputAccNumber.value = "";
      if (inputAmount) inputAmount.value = "";

      showStatus("✅ Payment request submitted! Payment will be added after admin verification.", "success");
    } catch (err) {
      console.error("Payment submission error:", err);
      showStatus("❌ Failed to submit payment request.", "error");
    } finally {
      doneBtn.disabled = false;
      doneBtn.textContent = "Done";
    }
  });

  // If user clicks outside popup to close (optional): you can add this if needed
  window.addEventListener("click", (e) => {
    if (!paymentPopup) return;
    if (e.target === paymentPopup) {
      paymentPopup.style.display = "none";
    }
  });
}

// -------- Withdraw modal (updated) --------
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
  modalOverlay.style.visibility = "hidden";

  const box = document.createElement("div");
  box.style.background = "#fff";
  box.style.padding = "18px";
  box.style.borderRadius = "10px";
  box.style.minWidth = "340px";
  box.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  box.style.textAlign = "left";
  box.style.color = "#000";

  box.innerHTML = `
    <h3 style="margin:0 0 10px 0; color:#143ad3;">Enter Account Details</h3>

    <div style="margin-bottom:10px;">
      <label style="font-weight:600;">Acc. Holder's Name</label>
      <input id="withdrawHolderInput" type="text" placeholder="Full name" style="width:100%; padding:8px; margin-top:6px; border-radius:8px; border:1px solid #ccc;">
    </div>

    <div style="margin-bottom:10px;">
      <label style="font-weight:600;">Acc. Number</label>
      <input id="withdrawNumberInput" type="text" placeholder="e.g. 03XXXXXXXXX" style="width:100%; padding:8px; margin-top:6px; border-radius:8px; border:1px solid #ccc;">
    </div>

    <div style="margin-bottom:10px;">
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

  document.getElementById("withdrawCancelBtn").addEventListener("click", () => {
    hideWithdrawModal();
  });

  document.getElementById("withdrawSubmitBtn").addEventListener("click", async () => {
    const holder = document.getElementById("withdrawHolderInput").value.trim();
    const number = document.getElementById("withdrawNumberInput").value.trim();
    const input = document.getElementById("withdrawAmountInput");
    const value = parseInt(input.value, 10);
    const errDiv = document.getElementById("withdrawError");

    if (!holder) {
      errDiv.textContent = "⚠️ Please enter account holder's name.";
      errDiv.style.display = "block";
      return;
    }
    if (!number) {
      errDiv.textContent = "⚠️ Please enter account number.";
      errDiv.style.display = "block";
      return;
    }
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
      errDiv.textContent = "⚠️ You do not have enough balance.";
      errDiv.style.display = "block";
      return;
    }

    // Check existing pending withdrawal(s)
    try {
      const q = query(collection(db, "withdrawals"), where("uid", "==", currentUser.uid), where("status", "==", "pending"));
      const snap = await getDocs(q);
      if (!snap.empty) {
        errDiv.textContent = "⚠️ You already have a pending withdrawal. Wait until it is processed.";
        errDiv.style.display = "block";
        return;
      }
    } catch (err) {
      console.error("Error checking pending withdrawals:", err);
      errDiv.textContent = "❌ Unable to check pending withdrawals. Try again.";
      errDiv.style.display = "block";
      return;
    }

    const submitBtn = document.getElementById("withdrawSubmitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      await addDoc(collection(db, "withdrawals"), {
        uid: currentUser.uid,
        email: currentUser.email,
        accountHolder: holder,
        accountNumber: number,
        amount: value,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Do not deduct balance here — admin approval should update user balance.
      hideWithdrawModal();
      showStatus(`✅ Withdraw request submitted for ${value} PKR. Wait for admin approval.`, "success");
    } catch (err) {
      console.error("Withdraw creation error:", err);
      errDiv.textContent = "❌ Failed to submit withdraw request.";
      errDiv.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideWithdrawModal();
  });
}
function showWithdrawModal() {
  ensureWithdrawModal();
  const m = document.getElementById("withdrawModal");
  if (!m) return;
  m.style.visibility = "visible";
  const errDiv = document.getElementById("withdrawError");
  const h = document.getElementById("withdrawHolderInput");
  const n = document.getElementById("withdrawNumberInput");
  const a = document.getElementById("withdrawAmountInput");
  if (h) h.value = "";
  if (n) n.value = "";
  if (a) a.value = "";
  if (errDiv) { errDiv.style.display = "none"; errDiv.textContent = ""; }
}
function hideWithdrawModal() {
  const m = document.getElementById("withdrawModal");
  if (!m) return;
  m.style.visibility = "hidden";
}
withdrawBtn?.addEventListener("click", async () => {
  if (!currentUser) {
    showStatus("⚠️ Please login first!", "error");
    return;
  }
  showWithdrawModal();
});

// -------- Logout, firestore sync --------
logoutBtn?.addEventListener("click", logout);

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

// initialize listeners that depend on DOM elements
ensureAddBalancePopupListeners();
ensureWithdrawModal();

// script.js (responsive + mobile menu + original game logic + referral reward handling)
// - When referred user's balance crosses thresholds, award referrer (20 or 50) once per referred user per threshold.
// - Uses 'referralRewards' collection with doc id "<referrer>_<referred>_<type>" to prevent duplicates.

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
  where,
  increment
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { logout } from "./auth.js";

// DOM refs
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const gameWrapper = document.getElementById("gameWrapper") || canvas.parentElement;

const spinBtn = document.getElementById("spinBtn");
const multiSpinBtn = document.getElementById("multiSpinBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const logoutBtn = document.getElementById("logoutBtn");

const addBalanceBtn = document.getElementById("addBalanceBtn");
const paymentPopup = document.getElementById("paymentInstructions");
const doneBtn = document.getElementById("doneBtn");
const paymentCancel = document.getElementById("paymentCancel");
const userIDSpan = document.getElementById("userID");
const inputAccHolder = document.getElementById("inputAccHolder");
const inputAccNumber = document.getElementById("inputAccNumber");
const inputAmount = document.getElementById("inputAmount");

const popup = document.getElementById("popup");
const popupOkBtn = document.getElementById("popupOkBtn");
const prizeText = document.getElementById("prizeText");

// Mobile header/menu elements
const hamburgerBtn = document.getElementById("hamburgerBtn");
const mobileMenu = document.getElementById("mobileMenu");
const mobileAddBalanceBtn = document.getElementById("mobileAddBalanceBtn");
const mobileWithdrawBtn = document.getElementById("mobileWithdrawBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
const headerBalance = document.getElementById("headerBalance");
const mobileBalance = document.getElementById("mobileBalance");
const mobileEmail = document.getElementById("mobileEmail");

// Footer admin email (constant)
const footerEmail = document.getElementById("footerEmail");
const ADMIN_EMAIL = "adilhayat113@gmail.com";

let balance = 0;
let prevBalance = 0; // to detect threshold crossing
let currentUser = null;
let currentRotationRad = 0;

// wheel image & prizes
const wheelImg = new Image();
wheelImg.src = "./wheel.png";
const prizes = ["100", "💀", "10", "💀", "00", "💀", "1000", "💀"];
const SECTOR_COUNT = prizes.length;
const SECTOR_SIZE = 360 / SECTOR_COUNT;
const sectors = [];
for (let i = 0; i < SECTOR_COUNT; i++) {
  const start = i * SECTOR_SIZE;
  const end = start + SECTOR_SIZE;
  const center = (start + end) / 2;
  sectors.push({ prize: prizes[i], startDeg: start, endDeg: end, centerDeg: center });
}

/* ==========================
   Spin sound setup (unchanged)
   ==========================
*/
if (!window.__spinSound) {
  try {
    const a = new Audio('./wheel.mp3');
    a.preload = 'auto';
    a.volume = 0.7;
    a.loop = false;
    window.__spinSound = a;
  } catch (e) {
    window.__spinSound = null;
  }
}
const spinSound = window.__spinSound || null;

// ===== responsive canvas helpers =====
function resizeCanvasToContainer() {
  const rect = gameWrapper ? gameWrapper.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  const cssSide = Math.max(80, Math.floor(Math.min(rect.width, rect.height)));
  const cssW = Math.min(rect.width, 700);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const finalCssWidth = window.innerWidth < 700 ? Math.min(window.innerWidth - 24, 600) : Math.min(500, cssW);

  canvas.style.width = finalCssWidth + "px";
  canvas.style.height = finalCssWidth + "px";

  canvas.width = Math.round(finalCssWidth * dpr);
  canvas.height = Math.round(finalCssWidth * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  drawWheel(currentRotationRad);
}
window.addEventListener("resize", debounce(resizeCanvasToContainer, 120));
window.addEventListener("orientationchange", () => setTimeout(resizeCanvasToContainer, 120));
window.addEventListener("load", () => setTimeout(resizeCanvasToContainer, 20));
wheelImg.onload = () => resizeCanvasToContainer();

function debounce(fn, wait = 80) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ===== drawing =====
function clearCanvas() {
  const cssW = parseFloat(canvas.style.width) || canvas.clientWidth || 500;
  const cssH = parseFloat(canvas.style.height) || canvas.clientHeight || 500;
  ctx.clearRect(0, 0, cssW, cssH);
}
function drawWheel(rotationRad = 0) {
  currentRotationRad = rotationRad;
  clearCanvas();
  const cssW = parseFloat(canvas.style.width) || canvas.clientWidth || 500;
  const cssH = parseFloat(canvas.style.height) || canvas.clientHeight || 500;

  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  ctx.rotate(rotationRad);
  if (wheelImg.complete && wheelImg.naturalWidth) {
    ctx.drawImage(wheelImg, -cssW / 2, -cssH / 2, cssW, cssH);
  } else {
    const radius = Math.min(cssW, cssH) / 2;
    for (let i = 0; i < SECTOR_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,radius,(i*SECTOR_SIZE)*Math.PI/180,((i+1)*SECTOR_SIZE)*Math.PI/180);
      ctx.closePath();
      ctx.fillStyle = i%2===0 ? "#fff" : "rgba(6,52,236,0.06)";
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawRedDot(rotationRad, centerDeg) {
  const cssW = parseFloat(canvas.style.width) || canvas.clientWidth || 500;
  const cssH = parseFloat(canvas.style.height) || canvas.clientHeight || 500;
  const radius = Math.min(cssW, cssH) / 2;
  const dotDistance = radius - 18;

  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  const centerRad = (centerDeg * Math.PI) / 180;
  ctx.rotate(rotationRad + centerRad);
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

/* ==========================
   Referral reward helpers
   ==========================
   - referralRewards collection used to store one-off rewards per pair+type
   - doc id format: "<referrerUid>_<referredUid>_<type>" where type "200" or "1000"
*/
async function awardReferralIfEligible(referredUid, oldBal, newBal, userDocData) {
  try {
    // ensure there is a referrer recorded
    const referredBy = (userDocData && userDocData.referredBy) ? userDocData.referredBy : null;
    if (!referredBy) return;

    // prevent self-referral (shouldn't happen) and ensure different UIDs
    if (referredBy === referredUid) return;

    const referrerUid = referredBy;
    // decide which reward (prefer 1000+ if crossed)
    const crossed1000 = (oldBal < 1000 && newBal >= 1000);
    const crossed200 = (oldBal < 200 && newBal >= 200 && newBal < 1000);

    if (!crossed1000 && !crossed200) return;

    // pick reward and doc id
    const type = crossed1000 ? "1000" : "200";
    const rewardAmount = crossed1000 ? 50 : 20;
    const rewardDocId = `${referrerUid}_${referredUid}_${type}`;
    const rewardRef = doc(db, "referralRewards", rewardDocId);

    const existing = await getDoc(rewardRef);
    if (existing.exists()) {
      // already rewarded for this threshold
      return;
    }

    // Atomic update to referrer's balance
    const refUserRef = doc(db, "users", referrerUid);
    try {
      await updateDoc(refUserRef, { balance: increment(rewardAmount) });
    } catch (e) {
      // If updateDoc fails because field missing, fallback: set doc (best-effort)
      try {
        const rSnap = await getDoc(refUserRef);
        const rBal = rSnap.exists() ? (rSnap.data().balance || 0) : 0;
        await updateDoc(refUserRef, { balance: rBal + rewardAmount });
      } catch (e2) {
        console.error("Failed to credit referrer balance:", e2);
      }
    }

    // record the reward operation so it's not repeated
    try {
      await setDoc(rewardRef, {
        referrerUid,
        referredUid,
        type,
        rewardAmount,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to write referralRewards record:", e);
    }

    // Optional: notify user in-app (if referrer is online, their snapshot will update and UI will reflect new balance)
    console.log(`Referral reward: ${rewardAmount} credited to ${referrerUid} for referred ${referredUid} (type ${type})`);
  } catch (err) {
    console.error("awardReferralIfEligible error:", err);
  }
}

// ===== Firebase balance helpers =====
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
  if (headerBalance) headerBalance.textContent = `Rs: ${balance}`;
  if (mobileBalance) mobileBalance.textContent = `Rs: ${balance}`;
  if (mobileEmail) mobileEmail.textContent = currentUser ? currentUser.email : '...';
  if (userIDSpan) userIDSpan.textContent = currentUser ? currentUser.uid : '...';
  if (footerEmail) footerEmail.textContent = ADMIN_EMAIL;
}

// ===== Wheel animation & result handling (with sound) =====
async function spinWheel(cost = 10) {
  if (cost > 0 && balance < cost) {
    showStatus("⚠️ Not enough balance!", "error"); return null;
  }
  if (cost > 0) {
    balance -= cost;
    updateUserInfoDisplay();
    try { await saveBalance(); } catch {}
  }

  return new Promise((resolve) => {
    const rounds = 5 + Math.floor(Math.random() * 3);
    const randomExtra = Math.random() * 360;
    const spinAngle = rounds * 360 + randomExtra;
    const spinTimeTotal = 5000; // ms
    const startTime = performance.now();

    // Start sound (loop while spinning)
    if (spinSound) {
      try {
        spinSound.loop = true;
        spinSound.currentTime = 0;
        const p = spinSound.play();
        if (p && typeof p.catch === 'function') p.catch(()=>{/* ignore */});
      } catch (e) {}
    }

    function step(now) {
      const spinTime = now - startTime;
      const t = Math.min(spinTime, spinTimeTotal);
      const easeOut = (t, b, c, d) => c * ((t = t / d - 1) * t * t + 1) + b;
      const currentAngle = easeOut(t, 0, spinAngle, spinTimeTotal);
      const rotationRad = (currentAngle * Math.PI) / 180;
      drawWheel(rotationRad);

      if (spinTime < spinTimeTotal) {
        requestAnimationFrame(step); return;
      }

      // stop sound when animation ends
      if (spinSound) {
        try {
          spinSound.pause();
          spinSound.currentTime = 0;
          spinSound.loop = false;
        } catch (e) { /* ignore */ }
      }

      const finalDegrees = spinAngle % 360;
      const idx = getSectorIndexFromStopDegrees(finalDegrees);
      const prize = prizes[idx];
      const prizeVal = parseInt(prize);
      if (!isNaN(prizeVal) && prizeVal > 0) {
        balance += prizeVal;
        updateUserInfoDisplay();
        saveBalance().catch(()=>{});
      }

      const finalRotationRad = (spinAngle * Math.PI)/180;
      drawWheel(finalRotationRad);
      const centerDeg = sectors[idx].centerDeg;
      drawRedDot(finalRotationRad, centerDeg);

      resolve(prize);
    }
    requestAnimationFrame(step);
  });
}

// ===== Button handlers =====
spinBtn?.addEventListener("click", async () => {
  spinBtn.disabled = true;
  try {
    const prize = await spinWheel(10);
    if (prize) showPrize("🎁 You got: " + prize);
  } finally { spinBtn.disabled = false; }
});

multiSpinBtn?.addEventListener("click", async () => {
  if (balance < 50) { showStatus("⚠️ Not enough balance!", "error"); return; }
  multiSpinBtn.disabled = true;
  spinBtn.disabled = true;
  balance -= 50;
  updateUserInfoDisplay();
  try { await saveBalance(); } catch {}
  const results = [];
  try {
    for (let i=0;i<5;i++){
      const prize = await spinWheel(0);
      if (prize) results.push(prize);
      await new Promise(r=>setTimeout(r,160));
    }
    showPrize("🎁 You got:\n" + results.join(", "));
  } finally {
    multiSpinBtn.disabled = false;
    spinBtn.disabled = false;
  }
});

// ===== Add-balance popup handling =====
function ensureAddBalancePopupListeners() {
  if (!addBalanceBtn || !paymentPopup || !doneBtn || !userIDSpan) return;

  const openPayment = () => {
    if (!currentUser) { showStatus("⚠️ Please login first!", "error"); return; }
    userIDSpan.textContent = currentUser.uid;
    paymentPopup.style.display = "flex";
    paymentPopup.setAttribute("aria-hidden", "false");
  };

  addBalanceBtn.addEventListener("click", openPayment);
  if (mobileAddBalanceBtn) mobileAddBalanceBtn.addEventListener("click", () => { openPayment(); toggleMobileMenu(); });

  doneBtn.addEventListener("click", async () => {
    const user = currentUser;
    if (!user) { showStatus("⚠️ Please login first!", "error"); return; }
    const accHolder = inputAccHolder ? inputAccHolder.value.trim() : "";
    const accNumber = inputAccNumber ? inputAccNumber.value.trim() : "";
    const amount = inputAmount ? parseInt(inputAmount.value, 10) : NaN;

    if (!accHolder || !accNumber || isNaN(amount) || amount < 200) {
      showStatus("⚠️ Fill all fields correctly. Min 200 PKR.", "error"); return;
    }

    doneBtn.disabled = true; doneBtn.textContent = "Submitting...";
    try {
      await addDoc(collection(db, "payments"), {
        uid: user.uid, email: user.email || "", accountHolder: accHolder, accountNumber: accNumber,
        amount, method: "Easypaisa", status: "pending", createdAt: serverTimestamp()
      });
      paymentPopup.style.display = "none";
      if (inputAccHolder) inputAccHolder.value = "";
      if (inputAccNumber) inputAccNumber.value = "";
      if (inputAmount) inputAmount.value = "";
      showStatus("✅ Payment request submitted! Await admin verification.", "success");
    } catch (err) {
      console.error(err); showStatus("❌ Failed to submit payment request.", "error");
    } finally { doneBtn.disabled = false; doneBtn.textContent = "Done"; }
  });

  paymentCancel?.addEventListener("click", () => {
    paymentPopup.style.display = "none";
    paymentPopup.setAttribute("aria-hidden", "true");
  });

  window.addEventListener("click", (e) => {
    if (paymentPopup && e.target === paymentPopup) {
      paymentPopup.style.display = "none";
      paymentPopup.setAttribute("aria-hidden", "true");
    }
  });
}

// ===== Withdraw modal (same) =====
function ensureWithdrawModal() {
  if (document.getElementById("withdrawModal")) return;
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "withdrawModal";
  modalOverlay.style.position = "fixed";
  modalOverlay.style.top = "0"; modalOverlay.style.left = "0";
  modalOverlay.style.width = "100%"; modalOverlay.style.height = "100%";
  modalOverlay.style.background = "rgba(0,0,0,0.5)";
  modalOverlay.style.display = "flex";
  modalOverlay.style.alignItems = "center";
  modalOverlay.style.justifyContent = "center";
  modalOverlay.style.zIndex = "3000";
  modalOverlay.style.visibility = "hidden";

  const box = document.createElement("div");
  box.style.background = "#fff"; box.style.padding = "18px"; box.style.borderRadius = "10px";
  box.style.minWidth = "300px"; box.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  box.style.textAlign = "left"; box.style.color = "#000";

  box.innerHTML = `
    <h3 style="margin:0 0 10px 0; color:#143ad3;">Enter Account Details</h3>
    <div style="margin-bottom:10px;">
      <label style="font-weight:600;">Acc. Holder's Name</label>
      <input id="withdrawHolderInput" type="text" placeholder="Full name" style="width:100%; padding:8px; margin-top:6px; border-radius:8px; border:1px solid #ccc;">
    </div>
    <div style="margin-bottom:10px;">
      <label style="font-weight:600;">Easypaisa Acc. Number</label>
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

  document.getElementById("withdrawCancelBtn").addEventListener("click", hideWithdrawModal);

  document.getElementById("withdrawSubmitBtn").addEventListener("click", async () => {
    const holder = document.getElementById("withdrawHolderInput").value.trim();
    const number = document.getElementById("withdrawNumberInput").value.trim();
    const input = document.getElementById("withdrawAmountInput");
    const value = parseInt(input.value, 10);
    const errDiv = document.getElementById("withdrawError");

    if (!holder) { errDiv.textContent = "⚠️ Please enter account holder's name."; errDiv.style.display = "block"; return; }
    if (!number) { errDiv.textContent = "⚠️ Please enter account number."; errDiv.style.display = "block"; return; }
    if (!value || value < 1000) { errDiv.textContent = "⚠️ Amount must be at least 1000 PKR."; errDiv.style.display = "block"; return; }
    if (!currentUser) { errDiv.textContent = "⚠️ Please login first."; errDiv.style.display = "block"; return; }
    if (value > balance) { errDiv.textContent = "⚠️ You do not have enough balance."; errDiv.style.display = "block"; return; }

    try {
      const q = query(collection(db, "withdrawals"), where("uid", "==", currentUser.uid), where("status", "==", "pending"));
      const snap = await getDocs(q);
      if (!snap.empty) { errDiv.textContent = "⚠️ You already have a pending withdrawal."; errDiv.style.display = "block"; return; }
    } catch (err) {
      console.error(err); errDiv.textContent = "❌ Unable to check pending withdrawals."; errDiv.style.display = "block"; return;
    }

    const submitBtn = document.getElementById("withdrawSubmitBtn");
    submitBtn.disabled = true; submitBtn.textContent = "Submitting...";

    try {
      await addDoc(collection(db, "withdrawals"), {
        uid: currentUser.uid, email: currentUser.email, accountHolder: holder, accountNumber: number,
        amount: value, status: "pending", createdAt: serverTimestamp()
      });
      hideWithdrawModal();
      showStatus(`✅ Withdraw request submitted for ${value} PKR.`, "success");
    } catch (err) {
      console.error(err); errDiv.textContent = "❌ Failed to submit withdraw request."; errDiv.style.display = "block";
    } finally { submitBtn.disabled = false; submitBtn.textContent = "Submit"; }
  });

  window.addEventListener("keydown", (e) => { if (e.key === "Escape") hideWithdrawModal(); });
}

function showWithdrawModal(){ ensureWithdrawModal(); const m = document.getElementById("withdrawModal"); if(!m) return; m.style.visibility = "visible"; const h=document.getElementById("withdrawHolderInput"); const n=document.getElementById("withdrawNumberInput"); const a=document.getElementById("withdrawAmountInput"); if(h)h.value=''; if(n) n.value=''; if(a) a.value=''; const err=document.getElementById("withdrawError"); if(err){ err.style.display='none'; err.textContent=''; } }
function hideWithdrawModal(){ const m=document.getElementById("withdrawModal"); if(!m) return; m.style.visibility='hidden'; }
withdrawBtn?.addEventListener("click", () => { if(!currentUser){ showStatus("⚠️ Please login first!","error"); return; } showWithdrawModal(); });
if (mobileWithdrawBtn) mobileWithdrawBtn.addEventListener("click", () => { if(!currentUser){ showStatus("⚠️ Please login first!","error"); return; } showWithdrawModal(); });

// ===== Logout =====
logoutBtn?.addEventListener("click", () => logout());
mobileLogoutBtn?.addEventListener("click", () => logout());

// ===== Auth state & Firestore sync =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);

    // get initial snapshot once to initialize prevBalance
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, { email: user.email, balance: 0, referCode: user.uid, referralsCount: 0 });
      balance = 0;
      prevBalance = 0;
    } else {
      balance = snap.data().balance || 0;
      prevBalance = balance;
    }
    updateUserInfoDisplay();

    // listen for changes and detect balance increases to award referrer
    onSnapshot(userRef, async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const newBal = data.balance || 0;
      const oldBal = typeof prevBalance === "number" ? prevBalance : 0;

      // if balance changed (increased), check referral awarding rules
      if (newBal !== oldBal) {
        // call award check (pass entire doc data so we can read referredBy)
        try {
          await awardReferralIfEligible(user.uid, oldBal, newBal, data);
        } catch (e) {
          console.error("awardReferralIfEligible error call:", e);
        }
      }

      // update local state
      prevBalance = newBal;
      balance = newBal;
      updateUserInfoDisplay();
    });
  } else {
    currentUser = null;
    if (headerBalance) headerBalance.textContent = `Rs: 0`;
    if (mobileBalance) mobileBalance.textContent = `Rs: 0`;
    if (mobileEmail) mobileEmail.textContent = '...';
    if (userIDSpan) userIDSpan.textContent = '...';
    if (footerEmail) footerEmail.textContent = ADMIN_EMAIL;
  }
});

// ===== UI helpers =====
function showPrize(text){ if(prizeText) prizeText.textContent = text; if(popup) { popup.style.display = 'flex'; popup.setAttribute('aria-hidden','false'); } }
function closePopup(){ if(popup) { popup.style.display = 'none'; popup.setAttribute('aria-hidden','true'); } }
window.closePopup = closePopup;
popupOkBtn?.addEventListener('click', closePopup);

function showStatus(message, type){
  let statusBox = document.getElementById("statusMessage");
  if(!statusBox){ statusBox = document.createElement("div"); statusBox.id = "statusMessage"; document.body.appendChild(statusBox); }
  statusBox.textContent = message;
  statusBox.style.display = "block";
  statusBox.style.background = type === "success" ? "#28a745" : "#dc3545";
  statusBox.style.color = "#fff";
  setTimeout(()=>{ statusBox.style.display='none'; }, 4000);
}

// ===== Mobile menu toggle =====
let mobileOpen = false;
function toggleMobileMenu(){
  mobileOpen = !mobileOpen;
  if(mobileOpen){
    if(mobileMenu) { mobileMenu.style.display = 'block'; mobileMenu.setAttribute('aria-hidden','false'); }
    hamburgerBtn?.classList.add('open');
  } else {
    if(mobileMenu) { mobileMenu.style.display = 'none'; mobileMenu.setAttribute('aria-hidden','true'); }
    hamburgerBtn?.classList.remove('open');
  }
}
hamburgerBtn?.addEventListener('click', toggleMobileMenu);

// Map mobile buttons to main handlers
if (mobileAddBalanceBtn) mobileAddBalanceBtn.addEventListener('click', () => { addBalanceBtn?.click(); toggleMobileMenu(); });
if (mobileWithdrawBtn) mobileWithdrawBtn.addEventListener('click', () => { withdrawBtn?.click(); toggleMobileMenu(); });

// ===== Prevent touch scroll while interacting with canvas =====
canvas.addEventListener('pointerdown', (e) => { if (e.isPrimary) e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ===== init =====
ensureAddBalancePopupListeners();
ensureWithdrawModal();
resizeCanvasToContainer();

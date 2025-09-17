const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const userInfo = document.getElementById("userInfo");

let currentUser = null;
let balance = 0;
let wheelImg = new Image();
wheelImg.src = "wheel.png";

const prizes = ["00", "💀", "10", "💀", "100", "💀", "1000", "💀"];

// Wheel draw with image
function drawWheel(rotation) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(wheelImg, -250, -250, 500, 500);
  ctx.restore();
}
wheelImg.onload = () => { drawWheel(0); };

// Spin
spinBtn.addEventListener("click", () => {
  if (balance < 10) {
    alert("Not enough balance! Please add money.");
    return;
  }
  balance -= 10;
  updateUserInfo();

  let spinAngle = Math.random() * 360 + 360 * 5;
  let spinTime = 0;
  let spinTimeTotal = 3000;

  function rotateWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
      const degrees = (spinAngle % 360);
      let sectorSize = 360 / prizes.length;
      let index = Math.floor((360 - degrees) / sectorSize) % prizes.length;
      let prize = prizes[index];

      showPrize(prize);

      if (prize !== "💀" && prize !== "00") {
        balance += parseInt(prize);
        updateUserInfo();
      }
      return;
    }

    const easeOut = (t, b, c, d) =>
      c * ((t = t / d - 1) * t * t + 1) + b;
    let angleCurrent = easeOut(spinTime, 0, spinAngle, spinTimeTotal);

    drawWheel(angleCurrent * Math.PI / 180);
    requestAnimationFrame(rotateWheel);
  }
  rotateWheel();
});

// Popup show
function showPrize(prize) {
  document.getElementById("prizeText").textContent = "🎁 You got: " + prize;
  document.getElementById("popup").style.display = "flex";
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

// Account System (demo with localStorage)
function signup() {
  const username = prompt("Enter username:");
  const accountType = prompt("JazzCash or EasyPaisa?");
  const accNumber = prompt("Enter account number:");
  const password = prompt("Enter password:");
  const confirm = prompt("Confirm password:");
  if (password !== confirm) { alert("Passwords don't match!"); return; }
  localStorage.setItem(username, JSON.stringify({password, accountType, accNumber, balance: 0}));
  alert("Signup successful!");
}

function login() {
  const username = prompt("Username:");
  const password = prompt("Password:");
  const user = JSON.parse(localStorage.getItem(username));
  if (user && user.password === password) {
    currentUser = username;
    balance = user.balance;
    updateUserInfo();
    alert("Login successful!");
  } else {
    alert("Invalid login!");
  }
}

function updateUserInfo() {
  if (currentUser) {
    userInfo.textContent = `${currentUser} | Balance: ${balance} PKR`;
    let user = JSON.parse(localStorage.getItem(currentUser));
    user.balance = balance;
    localStorage.setItem(currentUser, JSON.stringify(user));
  } else {
    userInfo.textContent = `Guest | Balance: ${balance} PKR`;
  }
}

function addBalance() {
  alert("Send money to:\nJazzCash: 0300-1234567\nEasyPaisa: 0301-7654321\n(Show QR codes here)");
  let amount = parseInt(prompt("Enter amount you sent:"));
  if (!isNaN(amount)) {
    balance += amount;
    updateUserInfo();
    alert("Balance added manually!");
  }
}

function withdraw() {
  if (balance <= 0) { alert("No balance to withdraw!"); return; }
  let amount = parseInt(prompt("Enter amount to withdraw:"));
  if (amount > balance) { alert("Not enough balance!"); return; }
  balance -= amount;
  updateUserInfo();
  alert("Withdraw request submitted!");
}

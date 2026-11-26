const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const actionBtn = document.getElementById("actionBtn");
const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");
const setupPanel = document.getElementById("setupPanel");
const gameArea = document.getElementById("gameArea");
const levelSelect = document.getElementById("levelSelect");
const difficultySelect = document.getElementById("difficultySelect");
const speedSelect = document.getElementById("speedSelect");
const ballSelect = document.getElementById("ballSelect");
const paddleSelect = document.getElementById("paddleSelect");

// 3 個關卡的地圖設計 (0=空, 1=普通磚, 2=裝甲磚需打2下)
const LEVELS = [
    // 第 1 關：標準排列
    [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1]
    ],
    // 第 2 關：中間夾雜裝甲磚
    [
        [2, 1, 2, 2, 1, 2],
        [1, 2, 1, 1, 2, 1],
        [1, 1, 2, 2, 1, 1],
        [1, 1, 1, 1, 1, 1]
    ],
    // 第 3 關：魔王城牆陣
    [
        [2, 2, 2, 2, 2, 2],
        [2, 1, 2, 2, 1, 2],
        [1, 2, 1, 1, 2, 1],
        [2, 1, 2, 2, 1, 2],
        [1, 1, 1, 1, 1, 1]
    ]
];

const rowColors = ["#f43f5e", "#fb923c", "#facc15", "#4ade80", "#a855f7"];
const brickColumnCount = 6;
const brickWidth = 64;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 35;
const brickOffsetLeft = 22;

let currentLevel = 0;
let score = 0;
let lives = 3;
let gameState = "PLAYING"; // PLAYING, LEVEL_CLEAR, GAME_OVER, ALL_CLEAR
let animationId;
let selectedDifficulty = "normal";
let selectedSpeed = "normal";
let selectedBallShape = "circle";
let selectedPaddleShape = "rounded";
let powerUpChance = 0.3;

// 球與擋板狀態
let ballRadius = 8;
let x, y, dx, dy;
let isFireball = false;
let fireballTimer = 0;

let paddleHeight = 12;
let defaultPaddleWidth = 85;
let paddleWidth = defaultPaddleWidth;
let paddleX;
let wideTimer = 0;

let rightPressed = false;
let leftPressed = false;
let bricks = [];
let powerUps = [];

function loadLevel(lvlIndex) {
    const map = LEVELS[lvlIndex];
    bricks = [];
    powerUps = [];
    for (let r = 0; r < map.length; r++) {
        bricks[r] = [];
        for (let c = 0; c < brickColumnCount; c++) {
            const hp = map[r][c];
            let adjustedHp = hp;
            if (selectedDifficulty === "easy" && hp === 2) adjustedHp = 1;
            if (selectedDifficulty === "hard" && hp === 2) adjustedHp = 3;
            bricks[r][c] = {
                x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                y: r * (brickHeight + brickPadding) + brickOffsetTop,
                hp: adjustedHp,
                maxHp: adjustedHp,
                color: rowColors[r % rowColors.length]
            };
        }
    }
    resetBallAndPaddle();
}

function resetBallAndPaddle() {
    const speedMultiplier = { slow: 0.75, normal: 1, fast: 1.35 }[selectedSpeed];
    const speed = (3.2 + currentLevel * 0.5) * speedMultiplier;
    x = canvas.width / 2;
    y = canvas.height - 35;
    dx = speed * (Math.random() > 0.5 ? 1 : -1);
    dy = -speed;
    paddleWidth = defaultPaddleWidth;
    paddleX = (canvas.width - paddleWidth) / 2;
    isFireball = false;
    fireballTimer = 0;
    wideTimer = 0;
}

function startNewGame() {
    currentLevel = Number(levelSelect.value);
    selectedDifficulty = difficultySelect.value;
    selectedSpeed = speedSelect.value;
    selectedBallShape = ballSelect.value;
    selectedPaddleShape = paddleSelect.value;

    const difficultySettings = {
        easy: { lives: 5, powerChance: 0.45 },
        normal: { lives: 3, powerChance: 0.3 },
        hard: { lives: 2, powerChance: 0.2 }
    };
    lives = difficultySettings[selectedDifficulty].lives;
    powerUpChance = difficultySettings[selectedDifficulty].powerChance;
    score = 0;
    updateHUD();
    actionBtn.style.display = "none";
    gameState = "PLAYING";
    setupPanel.hidden = true;
    gameArea.hidden = false;
    loadLevel(currentLevel);
    cancelAnimationFrame(animationId);
    draw();
}

function handleBtnClick() {
    if (gameState === "LEVEL_CLEAR") {
        currentLevel++;
        updateHUD();
        actionBtn.style.display = "none";
        gameState = "PLAYING";
        loadLevel(currentLevel);
        draw();
    } else {
        startNewGame();
    }
}

function updateHUD() {
    levelEl.textContent = currentLevel + 1;
    scoreEl.textContent = score;
    livesEl.textContent = lives;
}

// 操作監聽
document.addEventListener("keydown", (e) => {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = true;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = true;
});
document.addEventListener("keyup", (e) => {
    if (e.key === "Right" || e.key === "ArrowRight") rightPressed = false;
    else if (e.key === "Left" || e.key === "ArrowLeft") leftPressed = false;
});
canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddleX = relativeX - paddleWidth / 2;
    }
});

// 隨機生成掉落道具 (30% 機率)
function spawnPowerUp(bx, by) {
    if (Math.random() > powerUpChance) return;
    const types = [
        { type: "WIDE", label: "寬", color: "#38bdf8" },
        { type: "LIFE", label: "命", color: "#4ade80" },
        { type: "FIRE", label: "火", color: "#f97316" }
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];
    powerUps.push({ x: bx + brickWidth / 2, y: by, dy: 2.2, ...chosen });
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.y += p.dy;

        // 繪製道具膠囊
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.label, p.x, p.y);
        ctx.closePath();

        // 判斷是否被擋板接到
        if (p.y + 11 >= canvas.height - paddleHeight - 6 &&
            p.y - 11 <= canvas.height - 6 &&
            p.x >= paddleX && p.x <= paddleX + paddleWidth) {
            if (p.type === "WIDE") {
                paddleWidth = 135;
                wideTimer = 600; // 約10秒
            } else if (p.type === "LIFE") {
                lives++;
                updateHUD();
            } else if (p.type === "FIRE") {
                isFireball = true;
                fireballTimer = 420; // 約7秒
            }
            powerUps.splice(i, 1);
        } else if (p.y > canvas.height) {
            powerUps.splice(i, 1);
        }
    }
}

function collisionDetection() {
    let remainingBricks = 0;
    for (let r = 0; r < bricks.length; r++) {
        for (let c = 0; c < brickColumnCount; c++) {
            const b = bricks[r][c];
            if (b.hp > 0) {
                remainingBricks++;
                if (x + ballRadius > b.x && x - ballRadius < b.x + brickWidth &&
                    y + ballRadius > b.y && y - ballRadius < b.y + brickHeight) {
                    if (!isFireball) dy = -dy; // 火球模式直接穿透不反彈
                    b.hp--;
                    score += 10;
                    updateHUD();
                    if (b.hp === 0) {
                        remainingBricks--;
                        spawnPowerUp(b.x, b.y);
                    }
                }
            }
        }
    }

    // 檢查是否清空本關所有磚塊
    if (remainingBricks === 0) {
        if (currentLevel + 1 < LEVELS.length) {
            showOverlay(`✨ 第 ${currentLevel + 1} 關過關！`, "挑戰下一關", "LEVEL_CLEAR");
        } else {
            showOverlay(`🏆 恭喜全破！最終得分：${score}`, "重新挑戰", "ALL_CLEAR");
        }
    }
}

function showOverlay(title, btnText, state) {
    gameState = state;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, canvas.width / 2, canvas.height / 2);
    actionBtn.textContent = btnText;
    actionBtn.style.display = "inline-block";
}

function drawBricks() {
    for (let r = 0; r < bricks.length; r++) {
        for (let c = 0; c < brickColumnCount; c++) {
            const b = bricks[r][c];
            if (b.hp > 0) {
                ctx.beginPath();
                ctx.roundRect(b.x, b.y, brickWidth, brickHeight, 4);
                // 裝甲磚未受損時顯示金屬銀白色，被打一下後恢復原色
                ctx.fillStyle = (b.hp > 1) ? "#e2e8f0" : b.color;
                ctx.fill();
                if (b.hp > 1) {
                    ctx.strokeStyle = "#38bdf8";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                ctx.closePath();
            }
        }
    }
}

function draw() {
    if (gameState !== "PLAYING") return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 道具時效倒數
    if (wideTimer > 0 && --wideTimer === 0) paddleWidth = defaultPaddleWidth;
    if (fireballTimer > 0 && --fireballTimer === 0) isFireball = false;

    drawBricks();
    updatePowerUps();

    // 畫球 (火球模式變橘紅色)
    ctx.fillStyle = isFireball ? "#f97316" : "#ffffff";
    ctx.beginPath();
    if (selectedBallShape === "square") {
        ctx.rect(x - ballRadius, y - ballRadius, ballRadius * 2, ballRadius * 2);
    } else if (selectedBallShape === "diamond") {
        ctx.moveTo(x, y - ballRadius);
        ctx.lineTo(x + ballRadius, y);
        ctx.lineTo(x, y + ballRadius);
        ctx.lineTo(x - ballRadius, y);
        ctx.closePath();
    } else {
        ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.closePath();

    // 畫擋板
    ctx.fillStyle = wideTimer > 0 ? "#4ade80" : "#38bdf8";
    ctx.beginPath();
    if (selectedPaddleShape === "capsule") {
        ctx.roundRect(paddleX, canvas.height - paddleHeight - 6, paddleWidth, paddleHeight, paddleHeight / 2);
    } else if (selectedPaddleShape === "arrow") {
        const yPos = canvas.height - paddleHeight - 6;
        ctx.moveTo(paddleX, yPos);
        ctx.lineTo(paddleX + paddleWidth - 12, yPos);
        ctx.lineTo(paddleX + paddleWidth, yPos + paddleHeight / 2);
        ctx.lineTo(paddleX + paddleWidth - 12, yPos + paddleHeight);
        ctx.lineTo(paddleX, yPos + paddleHeight);
        ctx.closePath();
    } else {
        ctx.roundRect(paddleX, canvas.height - paddleHeight - 6, paddleWidth, paddleHeight, 6);
    }
    ctx.fill();

    collisionDetection();
    if (gameState !== "PLAYING") return;

    // 邊界與擋板反彈
    if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) dx = -dx;
    if (y + dy < ballRadius) {
        dy = -dy;
    } else if (y + dy > canvas.height - ballRadius - 6) {
        if (x > paddleX && x < paddleX + paddleWidth) {
            let hitPoint = (x - (paddleX + paddleWidth / 2)) / (paddleWidth / 2);
            const speed = Math.hypot(dx, dy);
            dx = hitPoint * (speed * 0.85);
            dy = -Math.sqrt(Math.max(4, speed * speed - dx * dx));
        } else if (y + dy > canvas.height - ballRadius) {
            lives--;
            updateHUD();
            if (lives <= 0) {
                showOverlay("💥 遊戲結束！再試一次吧", "重新開始", "GAME_OVER");
                return;
            } else {
                resetBallAndPaddle();
            }
        }
    }

    if (rightPressed && paddleX < canvas.width - paddleWidth) paddleX += 6.5;
    else if (leftPressed && paddleX > 0) paddleX -= 6.5;

    x += dx;
    y += dy;
    animationId = requestAnimationFrame(draw);
}

startBtn.addEventListener("click", startNewGame);
actionBtn.addEventListener("click", handleBtnClick);
backBtn.addEventListener("click", () => {
    cancelAnimationFrame(animationId);
    gameState = "PLAYING";
    gameArea.hidden = true;
    setupPanel.hidden = false;
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const startOverlay = document.getElementById("startOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const startTitle = document.getElementById("startTitle");
const startSubtitle = document.getElementById("startSubtitle");
const pauseSubtitle = document.getElementById("pauseSubtitle");
const hintText = document.getElementById("hintText");
const restartBtn = document.getElementById("restartBtn");
const soundToggle = document.getElementById("soundToggle");
const motionToggle = document.getElementById("motionToggle");

const mobileQuery = window.matchMedia("(max-width: 640px), (pointer: coarse)");

const state = {
  started: false,
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  highScore: 0,
  speed: 0,
  baseSpeed: 420,
  spawnTimer: 0,
  nextSpawn: 1.1,
  obstacles: [],
  day: true,
  dayTimer: 0,
  dayBlend: 1,
  groundOffset: 0,
  reducedMotion: false,
  soundEnabled: true,
  allowPause: true
};

const config = {
  gravity: 2000,
  jumpVelocity: -700,
  minJumpVelocity: -280,
  maxJumpHold: 0.18,
  jumpHoldGravity: 0.45,
  groundPadding: 26,
  minSpawn: 0.85,
  maxSpawn: 1.6,
  birdHeight: 54
};

const player = {
  x: 80,
  y: 0,
  w: 36,
  h: 48,
  vy: 0,
  ducking: false,
  onGround: true,
  jumpHeld: false,
  jumpHoldTime: 0
};

let view = {
  width: 0,
  height: 0,
  groundY: 0,
  dpr: 1
};

let audioCtx = null;
let lastTime = 0;
let pointerStart = null;

function init() {
  state.highScore = Number(localStorage.getItem("runnerHighScore") || 0);
  highscoreEl.textContent = `HI ${state.highScore}`;
  state.reducedMotion =
    localStorage.getItem("runnerReducedMotion") === "1" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  motionToggle.checked = state.reducedMotion;

  const soundPref = localStorage.getItem("runnerSoundEnabled");
  state.soundEnabled = soundPref === null ? true : soundPref === "1";
  soundToggle.checked = state.soundEnabled;

  resizeCanvas();
  applyLayoutMode();
  resetGame();
  requestAnimationFrame(loop);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  view = {
    width: rect.width,
    height: rect.height,
    groundY: rect.height - config.groundPadding,
    dpr
  };
  player.y = view.groundY - player.h;
}

function resetGame() {
  state.running = false;
  state.gameOver = false;
  state.paused = false;
  state.score = 0;
  state.speed = state.baseSpeed;
  state.spawnTimer = 0;
  state.nextSpawn = 1.1;
  state.obstacles = [];
  state.day = true;
  state.dayTimer = 0;
  state.dayBlend = 1;
  state.groundOffset = 0;
  player.vy = 0;
  player.ducking = false;
  player.onGround = true;
  player.jumpHeld = false;
  player.jumpHoldTime = 0;
  player.h = 48;
  player.y = view.groundY - player.h;
  updateHud();
  updateOverlays();
}

function startGame() {
  if (state.gameOver) {
    resetGame();
  }
  state.started = true;
  state.running = true;
  state.paused = false;
  updateOverlays();
}

function pauseGame() {
  if (!state.allowPause || !state.started || state.gameOver) {
    return;
  }
  state.paused = !state.paused;
  updateOverlays();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.paused = false;
  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem("runnerHighScore", state.highScore);
  }
  updateHud();
  updateOverlays();
  playSound("hit");
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  highscoreEl.textContent = `HI ${state.highScore}`;
}

function updateOverlays() {
  startOverlay.classList.toggle("hidden", state.started);
  pauseOverlay.classList.toggle("hidden", !state.paused || !state.allowPause);
  gameOverOverlay.classList.toggle("hidden", !state.gameOver);
}

function loop(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  if (state.running && !state.paused) {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.score += dt * 10;
  state.speed = state.baseSpeed + state.score * 2.2;

  state.spawnTimer += dt;
  const spawnWindow = Math.max(0.55, 1 - state.score / 1200);
  if (state.spawnTimer >= state.nextSpawn * spawnWindow) {
    spawnObstacle();
    state.spawnTimer = 0;
    state.nextSpawn = randRange(config.minSpawn, config.maxSpawn);
  }

  updatePlayer(dt);
  updateObstacles(dt);
  updateDayNight(dt);

  if (checkCollision()) {
    endGame();
  }

  updateHud();
}

function updatePlayer(dt) {
  let gravityScale = 1;
  if (player.jumpHeld && player.vy < 0 && player.jumpHoldTime < config.maxJumpHold) {
    gravityScale = config.jumpHoldGravity;
    player.jumpHoldTime += dt;
  }
  player.vy += config.gravity * gravityScale * dt;
  player.y += player.vy * dt;

  if (player.y >= view.groundY - player.h) {
    player.y = view.groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumpHeld = false;
    player.jumpHoldTime = 0;
  } else {
    player.onGround = false;
  }

  if (player.ducking && player.onGround) {
    player.h = 30;
    player.y = view.groundY - player.h;
  } else if (player.onGround) {
    player.h = 48;
    player.y = view.groundY - player.h;
  }
}

function updateObstacles(dt) {
  const speed = state.speed;
  for (const obstacle of state.obstacles) {
    obstacle.x -= speed * dt;
    if (obstacle.type === "bird" && !state.reducedMotion) {
      obstacle.wingTimer += dt;
      if (obstacle.wingTimer > 0.15) {
        obstacle.wingTimer = 0;
        obstacle.wingUp = !obstacle.wingUp;
      }
    }
  }
  state.obstacles = state.obstacles.filter((obs) => obs.x + obs.w > -20);

  if (!state.reducedMotion) {
    state.groundOffset += speed * dt * 0.6;
  }
}

function updateDayNight(dt) {
  state.dayTimer += dt;
  if (state.dayTimer > 18) {
    state.dayTimer = 0;
    state.day = !state.day;
  }
  if (state.reducedMotion) {
    state.dayBlend = state.day ? 1 : 0;
    return;
  }
  const target = state.day ? 1 : 0;
  const rate = 0.25;
  state.dayBlend += (target - state.dayBlend) * rate * dt * 10;
}

function spawnObstacle() {
  const allowBirds = state.score > 120;
  const spawnBird = allowBirds && Math.random() > 0.6;
  let obstacle;

  if (spawnBird) {
    obstacle = {
      type: "bird",
      x: view.width + 40,
      y: view.groundY - config.birdHeight,
      w: 34,
      h: 22,
      wingUp: true,
      wingTimer: 0
    };
  } else {
    const tall = Math.random() > 0.55;
    obstacle = {
      type: "cactus",
      x: view.width + 40,
      y: view.groundY - (tall ? 52 : 36),
      w: tall ? 26 : 20,
      h: tall ? 52 : 36
    };
  }

  const last = state.obstacles[state.obstacles.length - 1];
  if (last) {
    const minGap = 140 + state.speed * 0.18;
    obstacle.x = Math.max(obstacle.x, last.x + last.w + minGap);
  }

  state.obstacles.push(obstacle);
}

function checkCollision() {
  const playerBox = getHitbox({
    x: player.x,
    y: player.y,
    w: player.w,
    h: player.h
  });

  return state.obstacles.some((obs) => {
    const obsBox = getHitbox({
      x: obs.x,
      y: obs.y,
      w: obs.w,
      h: obs.h
    });
    return (
      playerBox.x < obsBox.x + obsBox.w &&
      playerBox.x + playerBox.w > obsBox.x &&
      playerBox.y < obsBox.y + obsBox.h &&
      playerBox.y + playerBox.h > obsBox.y
    );
  });
}

function render() {
  ctx.clearRect(0, 0, view.width, view.height);

  const sky = lerpColor("#f8f6f2", "#101012", 1 - state.dayBlend);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.width, view.height);

  drawSunMoon();
  drawGround();
  drawPlayer();
  drawObstacles();
}

function drawSunMoon() {
  const x = view.width - 80;
  const y = 60;
  ctx.save();
  ctx.globalAlpha = 0.4 + 0.3 * state.dayBlend;
  ctx.fillStyle = state.day ? "#f3e8b8" : "#b0b5c4";
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGround() {
  ctx.strokeStyle = state.day ? "#111" : "#e6e6e6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, view.groundY + 1);
  ctx.lineTo(view.width, view.groundY + 1);
  ctx.stroke();

  const tickSpacing = 26;
  const offset = state.reducedMotion ? 0 : state.groundOffset % tickSpacing;
  for (let x = -offset; x < view.width; x += tickSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, view.groundY + 1);
    ctx.lineTo(x + 10, view.groundY + 1);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.fillStyle = state.day ? "#111" : "#eaeaea";
  const headHeight = 14;
  ctx.fillRect(player.x, player.y + 6, player.w, player.h - 6);
  ctx.fillRect(player.x + 6, player.y, player.w - 12, headHeight);

  if (player.ducking && player.onGround) {
    ctx.clearRect(player.x + 8, player.y + 2, player.w - 16, 6);
  }
}

function drawObstacles() {
  ctx.fillStyle = state.day ? "#111" : "#e6e6e6";
  for (const obs of state.obstacles) {
    if (obs.type === "cactus") {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillRect(obs.x - 8, obs.y + 10, 8, obs.h - 20);
    } else {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      const wingOffset = obs.wingUp ? -6 : 6;
      ctx.fillRect(obs.x + 8, obs.y + wingOffset, obs.w - 16, 6);
    }
  }
}

function jump() {
  if (!state.running) {
    startGame();
  }
  if (player.onGround) {
    player.vy = config.jumpVelocity;
    player.jumpHeld = true;
    player.jumpHoldTime = 0;
    playSound("jump");
  }
}

function releaseJump() {
  player.jumpHeld = false;
  if (player.vy < 0) {
    player.vy = Math.max(player.vy, config.minJumpVelocity);
  }
}

function duck(isDown) {
  if (!state.running) {
    return;
  }
  player.ducking = isDown;
}

function handleKeyDown(event) {
  const { code, key } = event;
  if (["Space", "ArrowUp", "ArrowDown"].includes(code)) {
    event.preventDefault();
  }

  if (code === "Space" || code === "ArrowUp") {
    if (state.gameOver) {
      resetGame();
      startGame();
      return;
    }
    jump();
  } else if (code === "ArrowDown") {
    duck(true);
  } else if (key.toLowerCase() === "p" && state.allowPause) {
    pauseGame();
  } else if (key.toLowerCase() === "r" && state.gameOver) {
    resetGame();
    startGame();
  }
}

function handleKeyUp(event) {
  if (event.code === "ArrowDown") {
    duck(false);
  }
  if (event.code === "Space" || event.code === "ArrowUp") {
    releaseJump();
  }
}

function handlePointerDown(event) {
  pointerStart = { y: event.clientY, time: performance.now() };
  if (!state.started || state.running) {
    jump();
  }
}

function handlePointerMove(event) {
  if (!pointerStart || !state.running) {
    return;
  }
  const deltaY = event.clientY - pointerStart.y;
  if (deltaY > 40) {
    duck(true);
  }
}

function handlePointerUp(event) {
  if (!pointerStart) {
    return;
  }
  const deltaY = event.clientY - pointerStart.y;
  if (state.gameOver && deltaY <= 40) {
    resetGame();
    startGame();
  }
  releaseJump();
  duck(false);
  pointerStart = null;
}

function applyLayoutMode() {
  const isMobile = mobileQuery.matches;
  state.allowPause = !isMobile;
  if (isMobile) {
    startTitle.textContent = "Tap to start";
    startSubtitle.textContent = "Tap to jump, swipe down to duck";
    hintText.textContent = "Tap to jump. Swipe down to duck.";
  } else {
    startTitle.textContent = "Press Space or Tap to start";
    startSubtitle.textContent = "ArrowUp/Space = jump, ArrowDown = duck, P = pause";
    hintText.textContent = "Space/Up = jump. Down = duck. P = pause.";
  }
  if (!state.allowPause && state.paused) {
    state.paused = false;
  }
  pauseSubtitle.textContent = "Press P to resume";
  updateOverlays();
}

function playSound(type) {
  if (!state.soundEnabled) {
    return;
  }
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    audioCtx = new AudioContext();
  }
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  oscillator.type = "square";
  oscillator.frequency.value = type === "hit" ? 160 : 440;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.22);
}

function getHitbox(rect) {
  return {
    x: rect.x + 4,
    y: rect.y + 4,
    w: rect.w - 8,
    h: rect.h - 8
  };
}

function lerpColor(a, b, amount) {
  const ah = Number.parseInt(a.replace("#", ""), 16);
  const ar = (ah >> 16) & 255;
  const ag = (ah >> 8) & 255;
  const ab = ah & 255;
  const bh = Number.parseInt(b.replace("#", ""), 16);
  const br = (bh >> 16) & 255;
  const bg = (bh >> 8) & 255;
  const bb = bh & 255;
  const rr = Math.round(ar + amount * (br - ar));
  const rg = Math.round(ag + amount * (bg - ag));
  const rb = Math.round(ab + amount * (bb - ab));
  return `rgb(${rr}, ${rg}, ${rb})`;
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

restartBtn.addEventListener("click", () => {
  resetGame();
  startGame();
});

soundToggle.addEventListener("change", (event) => {
  state.soundEnabled = event.target.checked;
  localStorage.setItem("runnerSoundEnabled", state.soundEnabled ? "1" : "0");
});

motionToggle.addEventListener("change", (event) => {
  state.reducedMotion = event.target.checked;
  localStorage.setItem("runnerReducedMotion", state.reducedMotion ? "1" : "0");
});

window.addEventListener("resize", resizeCanvas);
mobileQuery.addEventListener("change", applyLayoutMode);
window.addEventListener("keydown", handleKeyDown, { passive: false });
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

init();

/* =========================================================
   Cloud Skateboarder — a grey cat, a skateboard, sunglasses,
   and a whole lot of cat treats.
   ========================================================= */

(() => {
"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const GROUND = 470;          // y of the sidewalk surface
const GRAV = 2200;
const JUMP_V = -800;
const ACC = 1500;
const AIR_ACC = 950;
const FRICTION = 1100;
const MAX_SPD = 330;
const BOOST_SPD = 580;       // max speed while ramp-boosted
const BOOST_TIME = 2.2;      // seconds of ramp boost
const HURT_TIME = 1.5;       // invulnerability after a hit
const BASE_HEARTS = 5;
const HEART_CAP = 10;
const HEART_COST = 30;
const LEVEL_REWARD = 10;

const SAVE_KEY = "cloudskateboarder_save_v1";

/* ---------------- Levels ----------------
   ramps:    [x, width, height]   (rise to the right -> launch!)
   dogs:     [x, patrolRange, speed]
   puddles:  [x, width]
   sprayers: [x, period, offset]  (water jet cycles on/off)
   cans:     [x, y]               (cat food cans, +1 treat each)
------------------------------------------ */
const LEVELS = [
  {
    name: "Sunny Sidewalk", length: 4200, reward: "Cat Treats",
    ramps: [[700, 170, 75], [1900, 180, 85], [3100, 170, 80]],
    dogs: [[2500, 150, 90]],
    puddles: [[1300, 110], [2850, 120]],
    sprayers: [],
    cans: [[930, 320], [990, 300], [1050, 320], [2140, 290], [2200, 270], [3330, 300]],
  },
  {
    name: "Park Path", length: 4800, reward: "Cat Food",
    ramps: [[600, 170, 80], [2100, 190, 90], [3600, 180, 85]],
    dogs: [[1500, 160, 100], [2900, 180, 110]],
    puddles: [[1050, 120], [2550, 130], [4050, 110]],
    sprayers: [[3250, 2.6, 0]],
    cans: [[830, 310], [890, 290], [2350, 280], [2410, 260], [2470, 280], [3840, 290]],
  },
  {
    name: "Backyard Blitz", length: 5200, reward: "Cat Treats",
    ramps: [[800, 180, 85], [2400, 190, 95], [4000, 180, 90]],
    dogs: [[1700, 170, 110], [3100, 160, 120], [4500, 150, 110]],
    puddles: [[1250, 120], [2850, 140]],
    sprayers: [[2050, 2.4, 0], [3550, 2.4, 1.2]],
    cans: [[1040, 300], [1100, 280], [2650, 270], [2710, 250], [2770, 270], [4240, 280], [4300, 300]],
  },
  {
    name: "Dog Park Dash", length: 5600, reward: "Cat Food",
    ramps: [[650, 180, 85], [2200, 190, 95], [3800, 200, 100]],
    dogs: [[1300, 170, 120], [1850, 150, 130], [2900, 180, 125], [3400, 150, 135], [4700, 180, 130]],
    puddles: [[2550, 130], [4300, 140]],
    sprayers: [[5000, 2.2, 0]],
    cans: [[890, 300], [950, 280], [2450, 270], [2510, 250], [4060, 260], [4120, 240], [4180, 260]],
  },
  {
    name: "Sprinkler Splash", length: 6000, reward: "Cat Treats",
    ramps: [[700, 180, 90], [2300, 190, 95], [3900, 190, 95], [5100, 180, 90]],
    dogs: [[1750, 160, 120], [4500, 170, 125]],
    puddles: [[1150, 140], [2050, 130], [2950, 150], [3500, 130], [4250, 140], [5500, 130]],
    sprayers: [[1450, 2.2, 0], [2700, 2.2, 1.1], [3250, 2.2, 0.5], [4750, 2.0, 0], [5700, 2.0, 1.0]],
    cans: [[940, 290], [1000, 270], [2550, 260], [2610, 240], [4150, 250], [4210, 230], [5340, 280]],
  },
  {
    name: "Rooftop Rush", length: 6800, reward: "Cat Treats",
    ramps: [[600, 190, 95], [1800, 200, 100], [3000, 200, 105], [4300, 210, 110], [5600, 200, 105]],
    dogs: [[1250, 160, 130], [2400, 170, 140], [3650, 160, 140], [4950, 180, 145], [6100, 160, 140]],
    puddles: [[1550, 130], [2750, 140], [4050, 130], [5300, 150]],
    sprayers: [[2150, 2.0, 0], [3400, 2.0, 1.0], [4650, 1.9, 0.4], [5950, 1.9, 1.2]],
    cans: [[850, 280], [910, 260], [970, 280], [2060, 250], [2120, 230], [3260, 240], [3320, 220], [4570, 230], [4630, 210], [5860, 250], [5920, 230]],
  },
];

/* ---------------- Save data ---------------- */
let save = { treats: 0, maxHearts: BASE_HEARTS, unlocked: 1 };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw);
    save.treats = Math.max(0, s.treats | 0);
    save.maxHearts = Math.min(HEART_CAP, Math.max(BASE_HEARTS, s.maxHearts | 0));
    save.unlocked = Math.min(LEVELS.length, Math.max(1, s.unlocked | 0));
  }
} catch (e) { /* fresh save */ }

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}

/* ---------------- Tiny sound effects ---------------- */
let audioCtx = null;
function beep(freq, dur, type = "square", vol = 0.05) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  jump:    () => beep(420, 0.12, "square"),
  boost:   () => { beep(500, 0.1); setTimeout(() => beep(750, 0.12), 60); },
  hurt:    () => beep(140, 0.3, "sawtooth", 0.07),
  can:     () => beep(880, 0.09, "triangle", 0.06),
  stomp:   () => beep(260, 0.12, "square", 0.06),
  win:     () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.06), i * 120)); },
  lose:    () => { [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, "sawtooth", 0.05), i * 180)); },
};

/* ---------------- Input ---------------- */
const keys = {};
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if ((e.key === "p" || e.key === "P") && state === "playing") togglePause();
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

const left  = () => keys["arrowleft"] || keys["a"];
const right = () => keys["arrowright"] || keys["d"];
const jumpK = () => keys[" "] || keys["arrowup"] || keys["w"];

/* ---------------- Game state ---------------- */
let state = "menu";        // menu | levels | playing | paused | complete | gameover
let levelIndex = 0;
let level = null;          // live copy of level data
let player = null;
let camX = 0;
let elapsed = 0;
let particles = [];

function startLevel(i) {
  levelIndex = i;
  const src = LEVELS[i];
  level = {
    name: src.name,
    length: src.length,
    reward: src.reward,
    goalX: src.length - 180,
    ramps: src.ramps.map(([x, w, h]) => ({ x, w, h })),
    dogs: src.dogs.map(([x, range, speed]) => ({ x, homeX: x, range, speed, dir: 1, alive: true, w: 56, h: 38 })),
    puddles: src.puddles.map(([x, w]) => ({ x, w })),
    sprayers: src.sprayers.map(([x, period, offset]) => ({ x, period, offset, active: false })),
    cans: src.cans.map(([x, y]) => ({ x, y, taken: false })),
  };
  player = {
    x: 120, y: GROUND, vx: 0, vy: 0,
    w: 44, h: 46,
    grounded: true, ramp: null,
    hearts: save.maxHearts,
    hurtT: 0, boostT: 0,
    facing: 1, cansGot: 0,
  };
  camX = 0;
  elapsed = 0;
  particles = [];
  setState("playing");
}

/* ---------------- UI overlays ---------------- */
const $ = (id) => document.getElementById(id);
const overlays = ["menu", "levels", "complete", "gameover", "pause"];

function setState(s) {
  state = s;
  overlays.forEach((id) => $(id).classList.add("hidden"));
  if (s === "menu") { refreshMenu(); $("menu").classList.remove("hidden"); }
  if (s === "levels") { buildLevelGrid(); $("levels").classList.remove("hidden"); }
  if (s === "complete") $("complete").classList.remove("hidden");
  if (s === "gameover") $("gameover").classList.remove("hidden");
  if (s === "paused") $("pause").classList.remove("hidden");
}

function refreshMenu() {
  $("menu-treats").textContent = save.treats;
  let hearts = "";
  for (let i = 0; i < HEART_CAP; i++) hearts += i < save.maxHearts ? "❤️" : "🖤";
  $("menu-hearts").innerHTML = hearts + `<div style="font-size:13px;color:#cdd6ea">Max HP: ${save.maxHearts} / ${HEART_CAP} hearts</div>`;
  const btn = $("btn-shop-buy");
  btn.disabled = save.maxHearts >= HEART_CAP || save.treats < HEART_COST;
  btn.textContent = save.maxHearts >= HEART_CAP
    ? "❤️ Max HP reached! (10 hearts)"
    : `❤️ Upgrade HP: +1 Heart (${HEART_COST} 🐟)`;
}

function buildLevelGrid() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  LEVELS.forEach((lv, i) => {
    const b = document.createElement("button");
    const locked = i + 1 > save.unlocked;
    b.textContent = locked ? `🔒 Level ${i + 1}` : `${i + 1}. ${lv.name}`;
    b.disabled = locked;
    b.addEventListener("click", () => startLevel(i));
    grid.appendChild(b);
  });
}

$("btn-play").addEventListener("click", () => setState("levels"));
$("btn-levels-back").addEventListener("click", () => setState("menu"));
$("btn-shop-buy").addEventListener("click", () => {
  if (save.treats >= HEART_COST && save.maxHearts < HEART_CAP) {
    save.treats -= HEART_COST;
    save.maxHearts++;
    persist();
    sfx.win();
    $("shop-msg").textContent = `Purrfect! Max HP is now ${save.maxHearts} hearts!`;
    refreshMenu();
  }
});
$("btn-next").addEventListener("click", () => {
  if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
  else setState("menu");
});
$("btn-complete-menu").addEventListener("click", () => setState("menu"));
$("btn-retry").addEventListener("click", () => startLevel(levelIndex));
$("btn-gameover-menu").addEventListener("click", () => setState("menu"));
$("btn-resume").addEventListener("click", () => togglePause());
$("btn-pause-menu").addEventListener("click", () => setState("menu"));

function togglePause() {
  if (state === "playing") setState("paused");
  else if (state === "paused") {
    overlays.forEach((id) => $(id).classList.add("hidden"));
    state = "playing";
  }
}

/* ---------------- Mechanics helpers ---------------- */
function rampSurfaceY(px) {
  // Returns {y, ramp} for the support surface under the player's feet.
  for (const r of level.ramps) {
    if (px >= r.x && px <= r.x + r.w) {
      return { y: GROUND - r.h * ((px - r.x) / r.w), ramp: r };
    }
  }
  return { y: GROUND, ramp: null };
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function hurtPlayer(fromX) {
  if (player.hurtT > 0) return;
  player.hearts--;
  player.hurtT = HURT_TIME;
  player.boostT = 0;
  player.vx = player.x < fromX ? -280 : 280;
  player.vy = -380;
  player.grounded = false;
  sfx.hurt();
  splash(player.x, player.y - 30, "#ff6b6b", 10);
  if (player.hearts <= 0) {
    sfx.lose();
    setState("gameover");
  }
}

function splash(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 320,
      vy: -Math.random() * 320,
      life: 0.5 + Math.random() * 0.3,
      color,
    });
  }
}

function completeLevel() {
  save.treats += LEVEL_REWARD;
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  persist();
  sfx.win();
  const bonus = player.cansGot;
  $("complete-msg").innerHTML =
    `You finished <b>${level.name}</b> and earned <b>${LEVEL_REWARD} ${level.reward}</b>! 🐟` +
    (bonus ? `<br>Plus <b>${bonus}</b> bonus treat${bonus > 1 ? "s" : ""} from cat food cans!` : "");
  $("complete-treats").textContent = save.treats;
  $("btn-next").style.display = levelIndex + 1 < LEVELS.length ? "" : "none";
  setState("complete");
}

/* ---------------- Update ---------------- */
function update(dt) {
  elapsed += dt;
  const p = player;

  // --- horizontal control ---
  const maxSpd = p.boostT > 0 ? BOOST_SPD : MAX_SPD;
  const acc = p.grounded ? ACC : AIR_ACC;
  if (right()) { p.vx += acc * dt; p.facing = 1; }
  else if (left()) { p.vx -= acc * dt; p.facing = -1; }
  else if (p.grounded) {
    // skateboard coasts: gentle friction
    const f = FRICTION * dt;
    if (Math.abs(p.vx) <= f) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * f;
  }
  p.vx = Math.max(-maxSpd, Math.min(maxSpd, p.vx));
  if (p.boostT > 0) p.boostT -= dt;

  // --- jump ---
  if (jumpK() && p.grounded) {
    p.vy = JUMP_V;
    p.grounded = false;
    p.ramp = null;
    sfx.jump();
  }

  // --- gravity & integrate ---
  p.vy += GRAV * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = Math.max(20, Math.min(level.length - 20, p.x));

  // --- ground / ramp support ---
  const prevRamp = p.ramp;
  const support = rampSurfaceY(p.x);
  if (p.y >= support.y && p.vy >= 0) {
    p.y = support.y;
    p.vy = 0;
    p.grounded = true;
    p.ramp = support.ramp;
  } else {
    p.grounded = false;
    p.ramp = null;
  }

  // Launch! Rode off the top edge of a ramp at speed.
  if (prevRamp && p.ramp !== prevRamp && p.x > prevRamp.x + prevRamp.w && p.vx > 140) {
    p.vy = Math.min(p.vy, -(280 + p.vx * 0.85));
    p.vx = Math.max(p.vx * 1.4, 460);
    p.boostT = BOOST_TIME;
    p.grounded = false;
    p.ramp = null;
    sfx.boost();
    splash(p.x, p.y, "#ffd166", 8);
  }

  if (p.hurtT > 0) p.hurtT -= dt;

  // --- dogs ---
  for (const d of level.dogs) {
    if (!d.alive) continue;
    d.x += d.dir * d.speed * dt;
    if (d.x > d.homeX + d.range) { d.x = d.homeX + d.range; d.dir = -1; }
    if (d.x < d.homeX - d.range) { d.x = d.homeX - d.range; d.dir = 1; }
    if (overlap(p.x - p.w / 2, p.y - p.h, p.w, p.h, d.x - d.w / 2, GROUND - d.h, d.w, d.h)) {
      const stomping = p.vy > 100 && (p.y - p.h / 2) < GROUND - d.h * 0.6;
      if (stomping) {
        d.alive = false;
        p.vy = -520;
        sfx.stomp();
        splash(d.x, GROUND - d.h, "#b08457", 12);
      } else {
        hurtPlayer(d.x);
      }
    }
  }

  // --- puddles (only hurt while rolling on the ground) ---
  if (p.grounded && p.hurtT <= 0) {
    for (const pd of level.puddles) {
      if (p.x > pd.x && p.x < pd.x + pd.w && p.y >= GROUND - 2) {
        splash(p.x, GROUND, "#7ec8ff", 12);
        hurtPlayer(p.x + (p.vx >= 0 ? 60 : -60));
        break;
      }
    }
  }

  // --- water sprayers ---
  for (const s of level.sprayers) {
    const t = (elapsed + s.offset) % s.period;
    s.active = t < s.period * 0.45;
    if (s.active && p.hurtT <= 0) {
      const jx = s.x - 12, jy = GROUND - 26 - 190, jw = 24, jh = 190;
      if (overlap(p.x - p.w / 2, p.y - p.h, p.w, p.h, jx, jy, jw, jh)) {
        splash(p.x, p.y - 20, "#7ec8ff", 12);
        hurtPlayer(s.x);
      }
    }
  }

  // --- cat food cans ---
  for (const c of level.cans) {
    if (c.taken) continue;
    const dx = p.x - c.x, dy = (p.y - p.h / 2) - c.y;
    if (dx * dx + dy * dy < 38 * 38) {
      c.taken = true;
      p.cansGot++;
      save.treats++;
      persist();
      sfx.can();
      splash(c.x, c.y, "#ffd166", 8);
    }
  }

  // --- particles ---
  for (const pt of particles) {
    pt.life -= dt;
    pt.vy += 1400 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
  }
  particles = particles.filter((pt) => pt.life > 0);

  // --- goal ---
  if (p.x >= level.goalX) completeLevel();

  // --- camera ---
  camX = Math.max(0, Math.min(level.length - W, p.x - W * 0.35));
}

/* ---------------- Drawing ---------------- */
function draw() {
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6ec6f0");
  sky.addColorStop(0.7, "#bfe8fb");
  sky.addColorStop(1, "#ffe9c9");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // sun
  ctx.fillStyle = "#ffdf6b";
  ctx.beginPath();
  ctx.arc(830, 80, 42, 0, Math.PI * 2);
  ctx.fill();

  // far clouds (parallax)
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 7; i++) {
    const cx = ((i * 520 - camX * 0.25) % (W + 400) + W + 400) % (W + 400) - 200;
    const cy = 60 + (i % 3) * 45;
    drawCloud(cx, cy, 1 + (i % 2) * 0.4);
  }

  // distant skyline
  ctx.fillStyle = "#9db8d2";
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 260 - camX * 0.45) % (W + 520) + W + 520) % (W + 520) - 260;
    const bh = 90 + ((i * 53) % 110);
    ctx.fillRect(bx, GROUND - 40 - bh, 130, bh + 40);
  }

  ctx.save();
  ctx.translate(-camX, 0);

  // sidewalk
  ctx.fillStyle = "#c9c2b8";
  ctx.fillRect(camX - 20, GROUND, W + 40, H - GROUND);
  ctx.fillStyle = "#a89f93";
  ctx.fillRect(camX - 20, GROUND, W + 40, 6);
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = 2;
  const startSeg = Math.floor(camX / 120) * 120;
  for (let x = startSeg; x < camX + W + 120; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 6);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  drawGoal(level.goalX);
  level.ramps.forEach(drawRamp);
  level.puddles.forEach(drawPuddle);
  level.sprayers.forEach(drawSprayer);
  level.cans.forEach(drawCan);
  level.dogs.forEach(drawDog);
  drawPlayer();

  // particles
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  drawHUD();
}

function drawCloud(x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 24 * s, 0, Math.PI * 2);
  ctx.arc(x + 26 * s, y - 8 * s, 20 * s, 0, Math.PI * 2);
  ctx.arc(x + 50 * s, y, 22 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawRamp(r) {
  ctx.fillStyle = "#b07c4f";
  ctx.beginPath();
  ctx.moveTo(r.x, GROUND);
  ctx.lineTo(r.x + r.w, GROUND);
  ctx.lineTo(r.x + r.w, GROUND - r.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a5c36";
  ctx.lineWidth = 3;
  ctx.stroke();
  // plank lines
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w * t, GROUND);
    ctx.lineTo(r.x + r.w, GROUND - r.h * t);
    ctx.stroke();
  }
}

function drawPuddle(pd) {
  ctx.fillStyle = "#5fb6e8";
  ctx.beginPath();
  ctx.ellipse(pd.x + pd.w / 2, GROUND + 5, pd.w / 2, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.ellipse(pd.x + pd.w / 2 - pd.w * 0.15, GROUND + 3, pd.w * 0.18, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSprayer(s) {
  // base
  ctx.fillStyle = "#5a6b7a";
  ctx.fillRect(s.x - 12, GROUND - 26, 24, 26);
  ctx.fillStyle = "#7d92a5";
  ctx.fillRect(s.x - 8, GROUND - 32, 16, 8);
  if (s.active) {
    // water jet
    const jh = 190, jy = GROUND - 26 - jh;
    const g = ctx.createLinearGradient(0, jy, 0, GROUND - 26);
    g.addColorStop(0, "rgba(126,200,255,.25)");
    g.addColorStop(1, "rgba(126,200,255,.85)");
    ctx.fillStyle = g;
    ctx.fillRect(s.x - 11, jy, 22, jh);
    // droplets
    ctx.fillStyle = "#cfeaff";
    for (let i = 0; i < 6; i++) {
      const dy = ((elapsed * 420 + i * 47) % jh);
      ctx.beginPath();
      ctx.arc(s.x - 8 + (i % 3) * 8, GROUND - 30 - dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // warning drips so the player can read the timing
    ctx.fillStyle = "#9fd4f5";
    ctx.beginPath();
    ctx.arc(s.x, GROUND - 36 - Math.sin(elapsed * 6) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCan(c) {
  if (c.taken) return;
  const bob = Math.sin(elapsed * 3 + c.x * 0.01) * 4;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  ctx.fillStyle = "#e8732c";
  ctx.fillRect(-12, -14, 24, 28);
  ctx.fillStyle = "#cfd6dd";
  ctx.fillRect(-12, -16, 24, 5);
  ctx.fillRect(-12, 11, 24, 5);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🐟", 0, 5);
  ctx.restore();
}

function drawDog(d) {
  if (!d.alive) return;
  const bx = d.x, by = GROUND;
  const step = Math.sin(elapsed * 12) * 3;
  ctx.save();
  ctx.translate(bx, by);
  if (d.dir < 0) ctx.scale(-1, 1);
  // legs
  ctx.fillStyle = "#7a4f2a";
  ctx.fillRect(-20, -12 + step * 0.5, 7, 12);
  ctx.fillRect(13, -12 - step * 0.5, 7, 12);
  // body
  ctx.fillStyle = "#96622f";
  ctx.beginPath();
  ctx.ellipse(0, -22, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.arc(24, -30, 12, 0, Math.PI * 2);
  ctx.fill();
  // snout
  ctx.fillStyle = "#7a4f2a";
  ctx.fillRect(30, -30, 12, 8);
  ctx.fillStyle = "#2c2c2c";
  ctx.fillRect(40, -30, 4, 4);
  // ear
  ctx.fillStyle = "#6b4423";
  ctx.beginPath();
  ctx.moveTo(18, -40); ctx.lineTo(26, -44); ctx.lineTo(26, -32);
  ctx.closePath(); ctx.fill();
  // eye
  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath(); ctx.arc(26, -33, 2.4, 0, Math.PI * 2); ctx.fill();
  // tail
  ctx.strokeStyle = "#96622f";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-24, -26);
  ctx.quadraticCurveTo(-34, -38 + Math.sin(elapsed * 10) * 4, -30, -44);
  ctx.stroke();
  ctx.restore();
}

function drawGoal(gx) {
  // finish pole + flag
  ctx.fillStyle = "#666";
  ctx.fillRect(gx, GROUND - 170, 8, 170);
  ctx.fillStyle = "#ff5a5a";
  ctx.beginPath();
  ctx.moveTo(gx + 8, GROUND - 170);
  ctx.lineTo(gx + 80, GROUND - 152);
  ctx.lineTo(gx + 8, GROUND - 134);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("GOAL", gx + 16, GROUND - 146);
  // food bowl
  ctx.fillStyle = "#d8553b";
  ctx.beginPath();
  ctx.ellipse(gx + 40, GROUND - 6, 30, 12, 0, 0, Math.PI, false);
  ctx.fill();
  ctx.fillRect(gx + 10, GROUND - 18, 60, 12);
  ctx.fillStyle = "#b8861f";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(gx + 18 + i * 8, GROUND - 20, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const p = player;
  // flash while invulnerable
  if (p.hurtT > 0 && Math.floor(p.hurtT * 12) % 2 === 0) return;

  let tilt = 0;
  if (p.grounded && p.ramp) tilt = -Math.atan2(p.ramp.h, p.ramp.w);
  else if (!p.grounded) tilt = Math.max(-0.35, Math.min(0.3, p.vy / 2200));

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.facing === 1 ? tilt : -tilt);
  if (p.facing < 0) ctx.scale(-1, 1);

  // boost flames behind the board
  if (p.boostT > 0) {
    ctx.fillStyle = "rgba(255,170,60,.8)";
    for (let i = 0; i < 3; i++) {
      const fl = 10 + Math.random() * 14;
      ctx.beginPath();
      ctx.moveTo(-30, -6 - i * 2);
      ctx.lineTo(-30 - fl, -8);
      ctx.lineTo(-30, -10 - i * 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  // skateboard
  ctx.fillStyle = "#3b2f2f";
  ctx.beginPath();
  ctx.roundRect(-28, -12, 56, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#222";
  const spin = elapsed * 14;
  for (const wx of [-17, 17]) {
    ctx.beginPath(); ctx.arc(wx, -2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx, -2);
    ctx.lineTo(wx + Math.cos(spin) * 5, -2 + Math.sin(spin) * 5);
    ctx.stroke();
  }

  // tail (animated)
  ctx.strokeStyle = "#8d939c";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, -32);
  ctx.quadraticCurveTo(-34, -44 + Math.sin(elapsed * 5) * 5, -28, -58 + Math.sin(elapsed * 5) * 4);
  ctx.stroke();

  // back leg + front leg on the board
  ctx.fillStyle = "#8d939c";
  ctx.fillRect(-14, -22, 8, 12);
  ctx.fillRect(8, -22, 8, 12);

  // body (grey cat!)
  ctx.fillStyle = "#9aa0a8";
  ctx.beginPath();
  ctx.ellipse(0, -32, 21, 15, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // chest patch
  ctx.fillStyle = "#c9cdd3";
  ctx.beginPath();
  ctx.ellipse(8, -28, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = "#9aa0a8";
  ctx.beginPath();
  ctx.arc(16, -50, 14, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(6, -58); ctx.lineTo(8, -70); ctx.lineTo(15, -62);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(19, -63); ctx.lineTo(25, -72); ctx.lineTo(28, -60);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e8a8b8";
  ctx.beginPath();
  ctx.moveTo(9, -61); ctx.lineTo(10, -66); ctx.lineTo(13, -62);
  ctx.closePath(); ctx.fill();

  // sunglasses 😎
  ctx.fillStyle = "#15161a";
  ctx.fillRect(6, -54, 26, 7);
  ctx.beginPath();
  ctx.roundRect(8, -55, 9, 9, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(20, -55, 9, 9, 3);
  ctx.fill();
  // lens shine
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.fillRect(10, -53, 3, 2);
  ctx.fillRect(22, -53, 3, 2);

  // nose + mouth + whiskers
  ctx.fillStyle = "#e8a8b8";
  ctx.beginPath();
  ctx.moveTo(28, -44); ctx.lineTo(32, -44); ctx.lineTo(30, -41);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(40,40,40,.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, -42); ctx.quadraticCurveTo(28, -38, 24, -39);
  ctx.stroke();
  for (const wy of [-45, -42]) {
    ctx.beginPath();
    ctx.moveTo(30, wy); ctx.lineTo(42, wy - 1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHUD() {
  // hearts
  ctx.font = "22px sans-serif";
  ctx.textAlign = "left";
  for (let i = 0; i < save.maxHearts; i++) {
    ctx.fillText(i < player.hearts ? "❤️" : "🖤", 14 + i * 27, 32);
  }
  // treats
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.roundRect(W - 170, 10, 158, 32, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`🐟 Treats: ${save.treats}`, W - 158, 32);
  // level name + progress
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 130, 10, 260, 32, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  const pct = Math.min(100, Math.round((player.x / level.goalX) * 100));
  ctx.fillText(`${levelIndex + 1}. ${level.name} — ${pct}%`, W / 2, 31);
}

/* ---------------- Main loop ---------------- */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  if (state === "playing") {
    update(dt);
    draw();
  } else if ((state === "paused" || state === "complete" || state === "gameover") && level) {
    draw(); // frozen backdrop behind the overlay
  }
  requestAnimationFrame(frame);
}

// roundRect fallback for older browsers
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

setState("menu");
requestAnimationFrame(frame);

})();

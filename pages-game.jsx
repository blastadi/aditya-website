/* ════════════════════════════════════════════════════════════════
   Game V4.6 — Five interdependent layers · vulnerable opening
   Foundation · Trust · Friction · Capital · Capacity
   Numeric values authoritative against v4_6_sim.py.
   Exports: GamePage
   ════════════════════════════════════════════════════════════════ */

const { useState: useStateGame, useEffect: useEffectGame, useRef: useRefGame, useCallback: useCallbackGame } = React;

/* ───────── V4.6 brick catalogue: 12 player bricks across 4 categories ─────────
   Effect values authoritative against v4_6_sim.py. Attack bricks ship in Phase 3. */
const PLAYER_BRICKS = {
  // ─ BUILD — ship capability, costs Capacity, earns Capital when Foundation healthy
  SHIP: {
    id: "SHIP", label: "SHIP", category: "build",
    effects: { foundationPush: +1, trust: +2, capital: +1, capacity: -3, capitalBonusIfHealthy: +2 },
  },
  SCALE: {
    id: "SCALE", label: "SCALE", category: "build",
    effects: { foundationPush: +1, capital: -3, capacity: -4, ballSpeedBoost: { mult: 0.05, durationMs: 8000 } },
  },
  AUTOMATE: {
    id: "AUTOMATE", label: "AUTOMATE", category: "build",
    effects: { friction: -6, capital: +4, capacity: +6, trust: +1 },
  },

  // ─ DEFEND — protect what exists, attention cost
  REVIEW: {
    id: "REVIEW", label: "REVIEW", category: "defend",
    effects: { friction: +3, trust: +2, foundationPush: -1, capacity: -3 },
  },
  MONITOR: {
    id: "MONITOR", label: "MONITOR", category: "defend",
    effects: { foundationPush: -1, capacity: -2, grantsIncidentShield: true },
  },
  GOVERN: {
    id: "GOVERN", label: "GOVERN", category: "defend",
    effects: { friction: +5, trust: +3, foundationPush: -1, capital: -2, capacity: -3 },
  },

  // ─ REPAIR — recover from problems, heavy Capacity cost
  PATCH: {
    id: "PATCH", label: "PATCH", category: "repair",
    effects: { foundationPush: -1, capacity: -4 },
  },
  APOLOGIZE: {
    id: "APOLOGIZE", label: "APOLOGIZE", category: "repair",
    effects: { trust: +4, capacity: -2 },
  },
  REBUILD: {
    id: "REBUILD", label: "REBUILD", category: "repair",
    effects: { foundationToHealthy: true, friction: -4, capital: -8, capacity: -6 },
  },

  // ─ INVEST — delayed payoffs, heavy on Capital up front
  TRAIN: {
    id: "TRAIN", label: "TRAIN", category: "invest",
    effects: { capital: -4, capacity: -2, trust: +1,
               delayedTrustBonus:    { amount: +4, delayMs: 10000 },
               delayedCapacityBonus: { amount: +8, delayMs: 15000 } },
  },
  HIRE: {
    id: "HIRE", label: "HIRE", category: "invest",
    effects: { capital: -10, capacity: -3, capacityPassiveBoost: +1 },
  },
  ALIGN: {
    id: "ALIGN", label: "ALIGN", category: "invest",
    effects: { friction: -2, trust: +2, capital: -1, capacity: -2, compoundCheck: true },
  },
};

const PLAYER_BRICK_IDS = Object.keys(PLAYER_BRICKS);

function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// V4.6: uniform draw across 12 player bricks. Attack bricks (Phase 3) spawn from
// cascade conditions, never from this pool.
function pickPlayerBrick() {
  return PLAYER_BRICKS[PLAYER_BRICK_IDS[Math.floor(Math.random() * PLAYER_BRICK_IDS.length)]];
}

/* ───────── Apply effects to the five layers ─────────
   Called from onBrickBreak (player bricks) and Phase 3 attack-brick handler. */
function applyBrickEffects(state, brickDef, isAttack = false) {
  const e = brickDef.effects || {};

  // Foundation
  if (e.foundationPush != null) pushFoundation(state, e.foundationPush);
  if (e.foundationToHealthy) {
    state.foundation = "healthy";
    state.foundationStressedSince = null;
  }
  if (e.foundationToDegraded) {
    state.foundation = "degraded";
    state.foundationStressedSince = state.timeMs;
  }

  // Trust
  if (e.trust != null) updateTrust(state, e.trust);
  if (e.trustBandDrop) updateTrust(state, -30);

  // Friction
  if (e.friction != null) updateFriction(state, e.friction);

  // Capital
  if (e.capital != null) updateCapital(state, e.capital);
  if (e.capitalBonusIfHealthy != null && state.foundation === "healthy") {
    updateCapital(state, e.capitalBonusIfHealthy);
  }

  // Capacity
  if (e.capacity != null) updateCapacity(state, e.capacity);

  // Transient effects
  if (e.ballSpeedBoost) {
    state.ballSpeedMultiplier = Math.max(state.ballSpeedMultiplier || 1, 1 + e.ballSpeedBoost.mult);
    state.ballSpeedUntil = state.timeMs + e.ballSpeedBoost.durationMs;
  }
  if (e.wallRefillBoost) {
    state.wallRefillMultiplier = Math.max(state.wallRefillMultiplier || 1, 1 + e.wallRefillBoost.mult);
    state.wallRefillUntil = state.timeMs + e.wallRefillBoost.durationMs;
  }
  if (e.capacityDrainBoost) {
    state.capacityDrainMultiplier = Math.max(state.capacityDrainMultiplier || 1, e.capacityDrainBoost.mult);
    state.capacityDrainUntil = state.timeMs + e.capacityDrainBoost.durationMs;
  }
  if (e.grantsIncidentShield) {
    state.incidentShields = (state.incidentShields || 0) + 1;
  }
  if (e.capacityPassiveBoost) {
    state.capacityPassiveBoost = (state.capacityPassiveBoost || 0) + e.capacityPassiveBoost;
  }

  // Delayed bonuses — drained by main update loop
  if (e.delayedTrustBonus) {
    state.delayedTrustBonuses.push({
      amount: e.delayedTrustBonus.amount,
      fireAt: state.timeMs + e.delayedTrustBonus.delayMs,
    });
  }
  if (e.delayedCapacityBonus) {
    state.delayedCapacityBonuses.push({
      amount: e.delayedCapacityBonus.amount,
      fireAt: state.timeMs + e.delayedCapacityBonus.delayMs,
    });
  }

  // ALIGN compound bonus — second tap within 30s fires all-layer kicker
  if (e.compoundCheck && state.lastAlignTime != null && state.timeMs - state.lastAlignTime < 30000) {
    pushFoundation(state, -1);
    updateTrust(state, +5);
    updateFriction(state, -5);
    updateCapital(state, +3);
    updateCapacity(state, +5);
  }
  if (e.compoundCheck) state.lastAlignTime = state.timeMs;

  // Build streak — used by Phase 3 OUTAGE cascade
  if (!isAttack) {
    if (brickDef.category === "build") {
      state.buildStreak = (state.buildStreak || 0) + 1;
    } else {
      state.buildStreak = 0;
    }
  }
}

const clamp01 = v => Math.max(0, Math.min(1, v));

/* ════════════════════════════════════════════════════════════════
   V4.6 Five-layer system — VULNERABLE OPENING
   You start with stressed Foundation, eroded Trust, low Friction
   (no governance), modest Capital and stretched Capacity.
   Cascade clocks tick from frame 1 because the starting state is
   already in BREACH/HALLUCINATION-eligible conditions.
   ════════════════════════════════════════════════════════════════ */

const FOUNDATION_STATES = ["healthy", "stressed", "degraded"];

// Brand new deployment: untested infra, no track record, small team.
const INITIAL_LAYERS = {
  foundation: "stressed",   // untested infrastructure on day 1
  trust: 0,                 // no users yet
  friction: 10,             // no governance process — creates BREACH risk
  capital: 40,              // medium funding
  capacity: 25,             // small team, already stretched
  maxCapital: 100,
  maxCapacity: 100,
};

const QUARTER_LENGTH_MS = 60000;
const TOTAL_GAME_LENGTH_MS = 240000;  // 4 minutes

function trustBand(t) {
  if (t < 26) return "eroded";
  if (t < 51) return "skeptical";
  if (t < 76) return "earned";
  return "endorsed";
}

function pushFoundation(state, direction) {
  const idx = FOUNDATION_STATES.indexOf(state.foundation);
  const newIdx = Math.max(0, Math.min(2, idx + direction));
  if (newIdx === idx) return;
  state.foundation = FOUNDATION_STATES[newIdx];
  if (state.foundation === "stressed" && state.foundationStressedSince == null) {
    state.foundationStressedSince = state.timeMs;
  } else if (state.foundation === "healthy") {
    state.foundationStressedSince = null;
  }
}

function updateTrust(state, delta) {
  // Diminishing returns above 80 — mandatory. Without this, defend/invest pegs Trust.
  if (delta > 0 && state.trust >= 80) {
    delta = delta >= 2 ? Math.max(1, Math.floor(delta / 2)) : 1;
  }
  state.trust = Math.max(0, Math.min(100, state.trust + delta));
  if (state.trust < 26 && state.trustErodedSince == null) {
    state.trustErodedSince = state.timeMs;
  } else if (state.trust >= 26) {
    state.trustErodedSince = null;
  }
}

function updateFriction(state, delta) {
  state.friction = Math.max(0, Math.min(100, state.friction + delta));
}

function updateCapital(state, delta) {
  state.capital = Math.max(0, Math.min(state.maxCapital, state.capital + delta));
  checkCrisis(state);
}

function updateCapacity(state, delta) {
  state.capacity = Math.max(0, Math.min(state.maxCapacity, state.capacity + delta));
  checkCrisis(state);
}

function checkCrisis(state) {
  const inCrisis = state.capital <= 5 && state.capacity <= 5;
  if (inCrisis && !state.crisisActive) {
    state.crisisActive = true;
    state.crisesEntered = (state.crisesEntered || 0) + 1;
  } else if (state.crisisActive && (state.capital > 20 || state.capacity > 20)) {
    state.crisisActive = false;
    state.crisesRecovered = (state.crisesRecovered || 0) + 1;
  }
}

function getPaddleSpeed(state) {
  // Friction throttles paddle linearly: 0 → full speed, 100 → 50% speed.
  return 9 * (1 - state.friction / 200);
}

// V4.6 §2.1: Foundation health modifies physics directly.
// Stressed → ball +10%. Degraded → ball +20%, wall +30%.
function getFoundationBallMult(state) {
  if (state.foundation === "degraded") return 1.20;
  if (state.foundation === "stressed") return 1.10;
  return 1.0;
}
function getFoundationWallMult(state) {
  return state.foundation === "degraded" ? 1.30 : 1.0;
}

function tickPassiveEffects(state) {
  // Friction entropy
  updateFriction(state, +1);

  // Trust drift, scaled by Friction
  let trustDrift = -1;
  if (state.friction > 70) trustDrift = -3;
  else if (state.friction > 50) trustDrift = -2;
  if (state.trust > 30) updateTrust(state, trustDrift);

  // Healthy foundation slowly earns Trust (capped at 70 — passive can't peg you at endorsed)
  if (state.foundation === "healthy" && state.trust < 70) updateTrust(state, +1);

  // Passive capacity recovery from HIRE bricks
  if (state.capacityPassiveBoost > 0) updateCapacity(state, state.capacityPassiveBoost);

  // Calm operation rewards
  state.timeSinceLastIncident += 30000;
  if (state.timeSinceLastIncident >= 30000 && state.foundation === "healthy") {
    updateCapacity(state, +2);
    if (!state.crisisActive) updateCapital(state, +2);
  }

  // Crisis pressure
  if (state.crisisActive) {
    updateCapital(state, -3);
    updateCapacity(state, -3 * (state.capacityDrainMultiplier || 1));
  }
}

/* ════════════════════════════════════════════════════════════════
   Canvas engine
   ════════════════════════════════════════════════════════════════ */
function createGame(canvas, onHudSync) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = () => canvas.width / dpr;
  const H = () => canvas.height / dpr;

  const state = {
    paddle: { x: 0, w: 120, h: 13 },
    balls: [],
    bricks: [],
    keys: {},
    score: 0,
    quarter: 1,                   // V4.6 caps at 4
    status: "ready",
    events: [],
    flash: null,

    // ── V4.6 Five layers (vulnerable opening) ──
    ...INITIAL_LAYERS,

    // Cascade clocks — V4.6: both tick from frame 1 since starting Foundation
    // is stressed and starting Trust is eroded. Set in startGame() to runStart.
    foundationStressedSince: 0,
    trustErodedSince: 0,
    crisisActive: false,
    crisesEntered: 0,
    crisesRecovered: 0,

    // Effect queues + flags (populated by Phase 2 bricks, Phase 3 attacks)
    capacityPassiveBoost: 0,
    capacityDrainMultiplier: 1,
    capacityDrainUntil: 0,
    ballSpeedMultiplier: 1,
    ballSpeedUntil: 0,
    wallRefillMultiplier: 1,
    wallRefillUntil: 0,
    delayedTrustBonuses: [],
    delayedCapacityBonuses: [],
    incidentShields: 0,
    lastAlignTime: null,
    buildStreak: 0,
    timeSinceLastIncident: 0,
    incidents: 0,
    incidentsThisQuarter: 0,

    // Parallel workstream stacking (Phase 4 wires SPACE handler, fields used now)
    ballsLive: 1,
    parallelTaps: 0,
    lastSpaceTap: -100000,
    timeAt2Balls: 0,
    timeAt3Balls: 0,

    // V4.6 record
    layerHistory: [],            // quarter-end snapshots filled in Phase 4
    notableMoments: [],
    brickCounts: {},
    attackBrickCounts: {},

    // Time
    timeMs: 0,
    runStart: 0,
    runEnd: 0,
    endResult: null,

    // Ball respawn after incident (Phase 4 retunes; current cadence works)
    respawnAt: 0,
    incidentMoments: [],

    // Timers
    nextBrickRefillAt: 0,
    nextPassiveTickAt: 0,
    nextQuarterAt: 0,
    nextHudSync: 0,
    pauseUntil: 0,
    flashUntil: 0,
  };

  state.paddle.x = (W() - state.paddle.w) / 2;

  /* ───────── Bricks ───────── */
  const initBricks = () => {
    state.bricks = [];
    const cols = 7, rows = 4, gap = 6;
    const bw = (W() - gap * (cols + 1)) / cols;
    const bh = 30;
    const topPad = 20;
    const now = performance.now();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        state.bricks.push({
          x: gap + c * (bw + gap),
          y: topPad + r * (bh + gap),
          w: bw,
          h: bh,
          alive: true,
          challenge: pickPlayerBrick(),
          fadeInAt: now,
        });
      }
    }
  };

  const refillBricks = () => {
    const empties = state.bricks.filter(b => !b.alive);
    if (empties.length === 0) return;
    const refillCount = 1 + Math.floor(Math.random() * 3); // 1..3 slots
    const used = new Set();
    const now = performance.now();
    for (let i = 0; i < Math.min(refillCount, empties.length); i++) {
      let pick = -1;
      for (let attempts = 0; attempts < 12; attempts++) {
        const idx = Math.floor(Math.random() * empties.length);
        if (!used.has(idx) && !empties[idx].alive) { pick = idx; break; }
      }
      if (pick === -1) break;
      used.add(pick);
      const b = empties[pick];
      b.alive = true;
      b.challenge = pickPlayerBrick();
      b.fadeInAt = now + i * (150 + Math.random() * 450);
    }
  };

  const addNewRow = () => {
    const cols = 7, gap = 6;
    const bw = (W() - gap * (cols + 1)) / cols;
    const bh = 30;
    const aliveYs = state.bricks.filter(b => b.alive).map(b => b.y);
    const topY = aliveYs.length ? Math.min(...aliveYs) : 20;
    const newY = Math.max(20, topY - (bh + gap));
    const now = performance.now();
    for (let c = 0; c < cols; c++) {
      state.bricks.push({
        x: gap + c * (bw + gap),
        y: newY,
        w: bw, h: bh,
        alive: true,
        challenge: pickPlayerBrick(),
        fadeInAt: now + c * (180 + Math.random() * 220),
      });
    }
  };

  /* ───────── Ball ───────── */
  const spawnBall = (opts = {}) => {
    const baseSpeed = 4.4 * (state.ballSpeedMultiplier || 1);
    const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2;
    state.balls.push({
      x: opts.x != null ? opts.x : (state.paddle.x + state.paddle.w / 2),
      y: opts.y != null ? opts.y : (H() - 38),
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      r: 7,
      isParallel: !!opts.parallel,
      bornAt: performance.now(),
    });
  };

  /* ───────── Run lifecycle ───────── */
  const startGame = () => {
    const now = performance.now();
    state.status = "playing";
    state.score = 0;
    state.quarter = 1;
    state.events = [];
    state.respawnAt = 0;
    state.brickCounts = {};
    state.attackBrickCounts = {};
    state.incidentMoments = [];
    state.endResult = null;

    // V4.6 layer reset — vulnerable opening
    Object.assign(state, INITIAL_LAYERS);
    // Cascade clocks tick from t=0 because Foundation begins stressed and Trust begins eroded.
    state.foundationStressedSince = now;
    state.trustErodedSince = now;
    state.crisisActive = false;
    state.crisesEntered = 0;
    state.crisesRecovered = 0;
    state.capacityPassiveBoost = 0;
    state.capacityDrainMultiplier = 1;
    state.capacityDrainUntil = 0;
    state.ballSpeedMultiplier = 1;
    state.ballSpeedUntil = 0;
    state.wallRefillMultiplier = 1;
    state.wallRefillUntil = 0;
    state.delayedTrustBonuses = [];
    state.delayedCapacityBonuses = [];
    state.incidentShields = 0;
    state.lastAlignTime = null;
    state.buildStreak = 0;
    state.timeSinceLastIncident = 0;
    state.incidents = 0;
    state.incidentsThisQuarter = 0;
    state.ballsLive = 1;
    state.parallelTaps = 0;
    state.lastSpaceTap = -100000;
    state.timeAt2Balls = 0;
    state.timeAt3Balls = 0;
    state.layerHistory = [];
    state.notableMoments = [];

    initBricks();
    state.balls = [];
    spawnBall();

    state.timeMs = 0;
    state.runStart = now;
    state.runEnd = 0;
    state.nextBrickRefillAt = now + 9000 + Math.random() * 4000;
    state.nextPassiveTickAt = now + 30000;
    state.nextQuarterAt = now + QUARTER_LENGTH_MS;      // Phase 4 wires the board-review
    state.flash = null;
    state.flashUntil = 0;
  };

  const togglePause = () => {
    if (state.status === "playing") state.status = "paused";
    else if (state.status === "paused") state.status = "playing";
  };

  const restart = () => {
    startGame();
  };

  const onSpace = () => {
    if (state.status === "ready")  startGame();
    else if (state.status === "ended") startGame();
    else if (state.status === "playing" && state.balls.length === 0 && state.respawnAt === 0) spawnBall();
  };

  const onKeyDown = (e) => {
    state.keys[e.key] = true;
    if (e.key === " " || e.code === "Space") { e.preventDefault(); onSpace(); }
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "r" || e.key === "R") restart();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
  };
  const onKeyUp = (e) => { state.keys[e.key] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* ───────── Helpers ───────── */
  const pushEvent = (text) => {
    state.events.unshift({ score: state.score, text });
    if (state.events.length > 10) state.events.pop();
  };

  const setFlash = (kind, title, note) => {
    state.flash = { kind, title, note };
    state.flashUntil = performance.now() + 1500;
  };

  const onBrickBreak = (brick) => {
    const brickDef = brick.challenge;
    const isAttack = !!brickDef.isAttack;

    // MONITOR shield absorbs the next attack brick entirely (Phase 3 makes attacks fire)
    if (isAttack && (state.incidentShields || 0) > 0) {
      state.incidentShields -= 1;
      state.score += 1;
      pushEvent(`MONITOR shield absorbed ${brickDef.label}`);
      state.brickCounts.MONITOR_SHIELDS = (state.brickCounts.MONITOR_SHIELDS || 0) + 1;
      return;
    }

    state.score += 1;
    pushEvent(brickDef.label);
    const id = brickDef.id || brickDef.label;
    if (isAttack) {
      state.attackBrickCounts[id] = (state.attackBrickCounts[id] || 0) + 1;
    } else {
      state.brickCounts[id] = (state.brickCounts[id] || 0) + 1;
    }

    applyBrickEffects(state, brickDef, isAttack);
  };

  // Phase 1 placeholder end-screen result. Phase 5 builds the verdict layout.
  const finishRun = () => {
    state.status = "ended";
    state.runEnd = performance.now();
    state.endResult = {
      durationMs: state.runEnd - state.runStart,
      quarter: state.quarter,
      score: state.score,
      foundation: state.foundation,
      trust: state.trust,
      friction: state.friction,
      capital: state.capital,
      capacity: state.capacity,
      crisesEntered: state.crisesEntered,
      incidents: state.incidents,
      brickCounts: { ...state.brickCounts },
    };
    state.balls = [];
    state.respawnAt = 0;
  };

  // Phase 1 placeholder ball-drop. Phase 4 implements V4.6 unlimited drops with
  // uniform penalty (Capital −3, Capacity −8, Foundation +1, Trust −2) and
  // RESUMING OPERATION banner. For now: end after 3 to keep games short during phase work.
  const onBallDrop = (now) => {
    state.incidents++;
    state.incidentsThisQuarter++;
    state.timeSinceLastIncident = 0;
    state.incidentMoments.push(now - state.runStart);
    pushEvent(`Incident #${state.incidents}`);
    if (state.incidents >= 3) {
      finishRun();
    } else {
      state.respawnAt = now + 1500;
    }
  };

  /* ───────── Update ───────── */
  const update = () => {
    const now = performance.now();
    if (now < state.pauseUntil) return;
    state.timeMs = now - state.runStart;

    // Expire timed transient effects
    if (state.timeMs >= state.ballSpeedUntil) state.ballSpeedMultiplier = 1;
    if (state.timeMs >= state.wallRefillUntil) state.wallRefillMultiplier = 1;
    if (state.timeMs >= state.capacityDrainUntil) state.capacityDrainMultiplier = 1;

    // Drain delayed bonus queues (Phase 2 bricks populate these)
    for (let i = state.delayedTrustBonuses.length - 1; i >= 0; i--) {
      const b = state.delayedTrustBonuses[i];
      if (state.timeMs >= b.fireAt) { updateTrust(state, b.amount); state.delayedTrustBonuses.splice(i, 1); }
    }
    for (let i = state.delayedCapacityBonuses.length - 1; i >= 0; i--) {
      const b = state.delayedCapacityBonuses[i];
      if (state.timeMs >= b.fireAt) { updateCapacity(state, b.amount); state.delayedCapacityBonuses.splice(i, 1); }
    }

    // Paddle — Friction throttles linearly
    const p = state.paddle;
    const pSpeed = getPaddleSpeed(state);
    if (state.keys["ArrowLeft"]) p.x -= pSpeed;
    if (state.keys["ArrowRight"]) p.x += pSpeed;
    p.x = Math.max(0, Math.min(W() - p.w, p.x));

    // Wall refill — Foundation degraded amplifies refill rate (V4.6 §2.1)
    if (now > state.nextBrickRefillAt) {
      refillBricks();
      const base = 8000 + Math.random() * 6000;
      const foundationMult = getFoundationWallMult(state);
      state.nextBrickRefillAt = now + base / (state.wallRefillMultiplier * foundationMult);
    }

    // Passive ticks every 30s of game time
    if (state.timeMs >= state.nextPassiveTickAt) {
      tickPassiveEffects(state);
      state.nextPassiveTickAt += 30000;
    }

    // Ball movement — Foundation health modifies ball speed (V4.6 §2.1)
    const ballMult = state.ballSpeedMultiplier * getFoundationBallMult(state);
    state.balls = state.balls.filter(b => {
      if (b.expireAt && now > b.expireAt) return false;

      const sp = Math.hypot(b.vx, b.vy);
      const maxSp = 5.0 + state.quarter * 1.05;
      const minSp = 3.0 + state.quarter * 0.35;
      if (sp > maxSp) { b.vx = (b.vx / sp) * maxSp; b.vy = (b.vy / sp) * maxSp; }
      if (sp < minSp) { b.vx = (b.vx / Math.max(sp, 0.01)) * minSp; b.vy = (b.vy / Math.max(sp, 0.01)) * minSp; }

      b.x += b.vx * ballMult;
      b.y += b.vy * ballMult;

      if (b.x < b.r) { b.x = b.r; b.vx = -b.vx; }
      if (b.x > W() - b.r) { b.x = W() - b.r; b.vx = -b.vx; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }

      const py = H() - 26;
      if (b.y + b.r > py && b.y + b.r < py + p.h + 4 && b.x > p.x - 2 && b.x < p.x + p.w + 2 && b.vy > 0) {
        b.vy = -Math.abs(b.vy);
        const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2);
        b.vx = hit * 5.5;
        if (b.y > py) b.y = py - b.r - 0.5;
      }

      if (b.y > H() + 30) {
        onBallDrop(now);
        return false;
      }

      for (let i = 0; i < state.bricks.length; i++) {
        const brick = state.bricks[i];
        if (!brick.alive) continue;
        if (b.x + b.r > brick.x && b.x - b.r < brick.x + brick.w &&
            b.y + b.r > brick.y && b.y - b.r < brick.y + brick.h) {
          brick.alive = false;
          brick.deathAt = now;
          onBrickBreak(brick);
          const dx = b.x - (brick.x + brick.w / 2);
          const dy = b.y - (brick.y + brick.h / 2);
          if (Math.abs(dx / brick.w) > Math.abs(dy / brick.h)) b.vx = -b.vx;
          else b.vy = -b.vy;
          break;
        }
      }

      return true;
    });

    // Ball respawn after incident
    if (state.status === "playing" && state.respawnAt > 0 && now >= state.respawnAt) {
      if (state.balls.length === 0) {
        spawnBall();
        state.respawnAt = 0;
      }
    }
  };

  /* ───────── Draw ───────── */
  const draw = () => {
    const styles = getComputedStyle(document.documentElement);
    const fg     = styles.getPropertyValue('--fg').trim()    || '#0b0b0b';
    const fg2    = styles.getPropertyValue('--fg-2').trim()  || '#2d2d2d';
    const fg3    = styles.getPropertyValue('--fg-3').trim()  || '#6b6b6b';
    const bg     = styles.getPropertyValue('--bg').trim()    || '#fff';
    const bg2    = styles.getPropertyValue('--bg-2').trim()  || '#f4f4f4';
    const bg3    = styles.getPropertyValue('--bg-3').trim()  || '#e8e8e8';
    const accent = styles.getPropertyValue('--accent').trim()|| '#2d4fe0';
    const line   = styles.getPropertyValue('--line').trim()  || '#d9d9d9';

    const now = performance.now();
    // V2 complication overlays removed in Phase 1; V4.6 attack animations land in Phase 3.
    const inBias = false, inGov = false, inRogue = false, inAudit = false, inMoat = false, inCapa = false;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W(), H());
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W(), H());

    // φ-grid reference lines
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 0.5;
    const gx = W() / 1.618;
    ctx.beginPath();
    ctx.moveTo(gx, 0); ctx.lineTo(gx, H());
    ctx.moveTo(W() - gx, 0); ctx.lineTo(W() - gx, H());
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Bricks
    state.bricks.forEach(brick => {
      if (!brick.alive) {
        if (brick.deathAt && now - brick.deathAt < 400) {
          const t = (now - brick.deathAt) / 400;
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(brick.x + 0.5 - t*3, brick.y + 0.5 - t*3, brick.w - 1 + t*6, brick.h - 1 + t*6);
          ctx.globalAlpha = 1;
        }
        return;
      }
      const fadeT = Math.min(1, Math.max(0, (now - (brick.fadeInAt || 0)) / 500));
      if (fadeT <= 0) return; // not yet faded in (staggered refill)
      ctx.globalAlpha = fadeT;

      const def = brick.challenge;
      const cat = def.category;
      const label = def.label || def.short || "";

      if (def.isAttack) {
        // Attack brick — solid accent fill, bold label (Phase 3 paints these in)
        ctx.fillStyle = accent;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = bg;
        ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "build") {
        // BUILD — solid accent fill, ink label
        ctx.fillStyle = accent;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = bg;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "defend") {
        // DEFEND — outlined, no fill, accent label
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(brick.x + 0.6, brick.y + 0.6, brick.w - 1.2, brick.h - 1.2);
        ctx.fillStyle = accent;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "repair") {
        // REPAIR — diagonal stripes at 50% opacity over light bg, fg label
        ctx.save();
        ctx.beginPath();
        ctx.rect(brick.x, brick.y, brick.w, brick.h);
        ctx.clip();
        ctx.fillStyle = bg2;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.globalAlpha = fadeT * 0.5;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        for (let s = -brick.h; s < brick.w + brick.h; s += 5) {
          ctx.beginPath();
          ctx.moveTo(brick.x + s, brick.y);
          ctx.lineTo(brick.x + s + brick.h, brick.y + brick.h);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = fadeT;
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        ctx.fillStyle = fg;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "invest") {
        // INVEST — dashed outline, accent italic label
        ctx.save();
        ctx.setLineDash([3, 2.5]);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        ctx.restore();
        ctx.fillStyle = accent;
        ctx.font = 'italic 500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else {
        // Fallback (shouldn't fire in V4.6)
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        ctx.fillStyle = fg2;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, brick.x + brick.w / 2, brick.y + brick.h / 2);
      ctx.globalAlpha = 1;
    });

    // Paddle
    const p = state.paddle;
    const py = H() - 26;
    ctx.fillStyle = fg;
    ctx.fillRect(p.x, py, p.w, p.h);
    ctx.fillStyle = accent;
    ctx.fillRect(p.x, py, p.w, 2);

    // Balls — Phase 3 will add attack-animation visual variants (ghost ball,
    // rogue jitter, parallel-trail). Phase 1 is plain solid balls.
    state.balls.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.fill();
    });

    // Footer text strip
    ctx.fillStyle = fg3;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Q${String(state.quarter).padStart(2,"0")}  ·  CLEARED ${String(state.score).padStart(3,"0")}  ·  BALLS ${state.balls.length}`, 10, H() - 8);

    // Resuming-operation held-breath banner
    if (state.status === "playing" && state.respawnAt > 0 && now < state.respawnAt) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.7;
      ctx.font = '500 16px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Letter-space approximation
      ctx.fillText('RESUMING OPERATION…', W() / 2, H() / 2);
      ctx.globalAlpha = 1;
    }
  };

  /* ───────── Loop + sync ───────── */
  let rafId;
  const loop = () => {
    if (state.status === "playing") update();
    draw();

    const now = performance.now();
    if (now > state.nextHudSync) {
      state.nextHudSync = now + 200;
      onHudSync({
        score: state.score,
        quarter: state.quarter,
        balls: state.balls.length,
        ballsLive: state.ballsLive,
        // V4.6 five layers
        foundation: state.foundation,
        trust: state.trust,
        friction: state.friction,
        capital: state.capital,
        capacity: state.capacity,
        maxCapital: state.maxCapital,
        maxCapacity: state.maxCapacity,
        crisisActive: state.crisisActive,
        events: [...state.events],
        status: state.status,
        flash: now < state.flashUntil ? state.flash : null,
        incidents: state.incidents,
        resuming: state.respawnAt > 0 && now < state.respawnAt,
        endResult: state.endResult,
      });
    }

    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  return {
    destroy: () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    resize: () => {
      state.paddle.x = Math.max(0, Math.min(W() - state.paddle.w, state.paddle.x));
    },
    startGame, togglePause, restart, onSpace,
  };
}

/* ════════════════════════════════════════════════════════════════
   V4.6 Layer status bar — five compact cells across top of canvas
   ════════════════════════════════════════════════════════════════ */
function LayerCell({ label, value, sub, danger, max }) {
  const numeric = typeof value === "number";
  const pct = numeric ? Math.max(0, Math.min(100, (value / (max || 100)) * 100)) : null;
  return (
    <div className={"layer-cell" + (danger ? " layer-bad" : "")}>
      <div className="layer-head">
        <span className="layer-label">{label}</span>
        <span className="layer-value">{numeric ? Math.round(value) : value.toString().toUpperCase()}</span>
      </div>
      {numeric && (
        <div className="layer-track"><div className="layer-fill" style={{ width: pct + "%" }} /></div>
      )}
      {sub && <div className="layer-sub">{sub}</div>}
    </div>
  );
}

function LayerStatus({ hud }) {
  const tBand = trustBand(hud.trust || 0);
  return (
    <div className="layer-status">
      <LayerCell label="FOUNDATION" value={hud.foundation || "stressed"} sub={hud.foundation || "stressed"} danger={hud.foundation !== "healthy"} />
      <LayerCell label="TRUST"      value={hud.trust || 0} sub={tBand} danger={tBand === "eroded"} />
      <LayerCell label="FRICTION"   value={hud.friction || 0} danger={(hud.friction || 0) > 70} />
      <LayerCell label="CAPITAL"    value={hud.capital || 0} max={hud.maxCapital || 100} danger={(hud.capital || 0) <= 15 || hud.crisisActive} />
      <LayerCell label="CAPACITY"   value={hud.capacity || 0} max={hud.maxCapacity || 100} danger={(hud.capacity || 0) <= 15 || hud.crisisActive} />
    </div>
  );
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/* Phase 1 placeholder end screen — Phase 5 ships the V4.6 verdict layout. */
function EndScreen({ result, onRestart }) {
  if (!result) return null;
  return (
    <div className="game-overlay game-overlay-end">
      <div className="end-grid v4-placeholder">
        <section className="end-archetype">
          <span className="overlay-eyebrow">— Handoff (Phase 1 placeholder)</span>
          <h2 className="end-arch-name">Layer snapshot</h2>
          <p className="end-arch-copy">
            Five layers wired. Bricks don't apply effects yet — Phase 2 hooks the 12 player bricks.
            Quarter clock, attacks, parallel workstreams, and the V4.6 verdict screen all land in later phases.
            Duration: {fmtDuration(result.durationMs)}.
          </p>
          <div className="end-record-summary">
            <div className="ers-cell"><span className="k">Foundation</span><span className="v">{(result.foundation || "").toUpperCase()}</span></div>
            <div className="ers-cell"><span className="k">Trust</span><span className="v">{Math.round(result.trust || 0)} {trustBand(result.trust || 0)}</span></div>
            <div className="ers-cell"><span className="k">Friction</span><span className="v">{Math.round(result.friction || 0)}</span></div>
            <div className="ers-cell"><span className="k">Capital</span><span className="v">{Math.round(result.capital || 0)}</span></div>
            <div className="ers-cell"><span className="k">Capacity</span><span className="v">{Math.round(result.capacity || 0)}</span></div>
            <div className="ers-cell"><span className="k">Incidents</span><span className="v">{result.incidents || 0}</span></div>
            <div className="ers-cell"><span className="k">Crises</span><span className="v">{result.crisesEntered || 0}</span></div>
            <div className="ers-cell"><span className="k">Bricks broken</span><span className="v">{Object.values(result.brickCounts || {}).reduce((s,n) => s+n, 0)}</span></div>
          </div>
        </section>
        <div className="end-footer">
          RUN ANOTHER DEPLOYMENT — PRESS <span className="kbd">SPACE</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════ */
function GamePage({ navigate }) {
  const canvasRef = useRefGame(null);
  const wrapRef = useRefGame(null);
  const gameRef = useRefGame(null);

  const [hud, setHud] = useStateGame({
    score: 0, quarter: 1, balls: 0, ballsLive: 1,
    ...INITIAL_LAYERS,
    crisisActive: false,
    incidents: 0,
    events: [],
    status: "ready",
    flash: null,
    resuming: false,
    endResult: null,
  });

  useEffectGame(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const cw = wrap.clientWidth;
      const ch = Math.max(320, wrap.clientHeight);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + "px";
      canvas.style.height = ch + "px";
      if (gameRef.current && gameRef.current.resize) gameRef.current.resize();
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrap);

    const game = createGame(canvas, setHud);
    gameRef.current = game;

    return () => {
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      game.destroy();
    };
  }, []);

  const status = hud.status;

  const statusLabel = {
    ready: "Ready", playing: "Live", paused: "Paused", ended: "Handoff",
  }[status] || "Ready";

  return (
    <main className="page-fade game-page">
      <div className="page">
        <header className="game-header">
          <div className="game-intro">
            <span className="eyebrow">An interactive metaphor — § Game</span>
            <h1 className="game-title">Deploy. <em>Continuously</em>.</h1>
            <p className="game-dek">
              You operate a brand new AI deployment for four quarters. Five interdependent layers move with each choice. What you hand off at the end of Q4 is what you're judged on.
            </p>
          </div>
          <div className="game-controls">
            <div className="ctrl-row"><span className="key">SPACE</span><span className="meaning">Deploy / parallel</span></div>
            <div className="ctrl-row"><span className="key">← →</span><span className="meaning">Move paddle</span></div>
            <div className="ctrl-row"><span className="key">P</span><span className="meaning">Pause</span></div>
            <div className="ctrl-row"><span className="key">R</span><span className="meaning">Restart</span></div>
          </div>
        </header>

        <div className="game-shell">
          <div className="game-board">
            <LayerStatus hud={hud} />
            <div className="game-stats">
              <div className="game-stat"><span className="k">Quarter</span><span className="v">{String(hud.quarter || 1).padStart(2,"0")}</span></div>
              <div className="game-stat"><span className="k">Cleared</span><span className="v">{String(hud.score).padStart(3,"0")}</span></div>
              <div className="game-stat"><span className="k">Balls</span><span className="v">{hud.balls}</span></div>
              <div className="game-stat"><span className="k">Incidents</span><span className="v">{hud.incidents || 0}</span></div>
              <div className="game-stat"><span className="k">Status</span><span className="v">{statusLabel}</span></div>
            </div>
            <div className="game-canvas-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} className="game-canvas" />
              {status === "ready" && (
                <div className="game-overlay game-overlay-start">
                  <span className="overlay-eyebrow">— Day 1 · Brand new deployment</span>
                  <h2>Press <em>spacebar</em> to deploy.</h2>
                  <p>← → paddle · P pause · R restart</p>
                  <p className="overlay-fine">Untested infrastructure, no track record, small team. Four quarters of sixty seconds each. The wall is the work — choose which brick to break, keep the ball alive, hand off whatever you built.</p>
                </div>
              )}
              {status === "paused" && (
                <div className="game-overlay">
                  <span className="overlay-eyebrow">— Paused</span>
                  <h2><em>Hold</em>.</h2>
                  <p>Press P to resume.</p>
                </div>
              )}
              {status === "ended" && (
                <EndScreen result={hud.endResult} onRestart={() => gameRef.current && gameRef.current.restart()} />
              )}
              {hud.flash && status !== "ended" && (
                <div className={"game-flash flash-" + hud.flash.kind}>
                  <span className="flash-title">{hud.flash.title}</span>
                  <span className="flash-note">{hud.flash.note}</span>
                </div>
              )}
            </div>
          </div>

          <aside className="game-log">
            <div className="meters-head">
              <span className="eyebrow">§ Events</span>
              <span className="meters-sub">Most recent first.</span>
            </div>
            <div className="log-list">
              {hud.events.length === 0 && (
                <div className="log-empty">Break a brick to see consequences here.</div>
              )}
              {hud.events.map((e, i) => (
                <div key={i} className="log-item">
                  <span className="log-num">#{String(e.score).padStart(3, "0")}</span>
                  <span className="log-text">{e.text}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <footer className="game-foot">
          <div className="game-foot-text">
            <p>The wall is not a level to be finished — it is a system to be operated. Every action ripples through Foundation, Trust, Friction, Capital, and Capacity. The four quarters are your tenure. The state you hand off is the diagnosis.</p>
          </div>
          <div className="game-foot-meta">
            <span className="label">Read the thesis →</span>
            <button className="btn btn-quiet" onClick={() => navigate("thesis")}>Open the manuscript</button>
          </div>
        </footer>
      </div>
    </main>
  );
}

Object.assign(window, { GamePage });

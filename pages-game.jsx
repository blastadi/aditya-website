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

/* ───────── V4.6 attack bricks (6) — cascade-spawned, not in random pool ─────────
   Each has a restored V1 animation tag. Effect values authoritative against v4_6_sim.py. */
const ATTACK_BRICKS = {
  DRIFT: {
    id: "DRIFT", label: "DRIFT", isAttack: true, animation: "curveRight",
    effects: { foundationPush: +1, trust: -4, capacity: -3 },
    flashTitle: "DRIFT", flashNote: "Balls curving right",
  },
  OUTAGE: {
    id: "OUTAGE", label: "OUTAGE", isAttack: true, animation: "flash",
    effects: { foundationToDegraded: true, capital: -5, capacity: -8,
               ballSpeedBoost: { mult: 0.20, durationMs: 10000 } },
    flashTitle: "OUTAGE", flashNote: "System down — ball accelerating",
  },
  BREACH: {
    id: "BREACH", label: "BREACH", isAttack: true, animation: "shake",
    effects: { trustBandDrop: true, friction: +20, capacity: -5 },
    flashTitle: "BREACH", flashNote: "Trust collapsed — friction spiked",
  },
  ROGUE: {
    id: "ROGUE", label: "ROGUE", isAttack: true, animation: "jitter",
    effects: { capacity: -10, trust: -5 },
    flashTitle: "ROGUE AGENT", flashNote: "Unpredictable trajectories",
  },
  HALLUCINATION: {
    id: "HALLUCINATION", label: "HALLUCINATION", isAttack: true, animation: "ghostBall",
    effects: { trust: -5, capacity: -3 },
    flashTitle: "HALLUCINATION", flashNote: "Phantom output — looks real",
  },
  REVOLT: {
    id: "REVOLT", label: "REVOLT", isAttack: true, animation: "driftRight",
    effects: { wallRefillBoost: { mult: 0.5, durationMs: 60000 },
               capacityDrainBoost: { mult: 2.0, durationMs: 60000 } },
    flashTitle: "REVOLT", flashNote: "The org rebels — wall accelerates",
  },
};

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

    // V4.6 attack animations (all relative to state.timeMs)
    driftAnimUntil: 0,
    outageFlashUntil: 0,
    breachShakeUntil: 0,
    rogueAnimUntil: 0,
    revoltAnimUntil: 0,
    ghostBalls: [],
    lastAttackSpawnAt: -100000,
    nextAttackCheckAt: 0,

    // V2 visual texture restored onto V4.6 brick triggers
    auditTintUntil: 0,         // ALIGN compound bonus  (warm accent tint)
    moatVignetteUntil: 0,      // REBUILD               (radial accent vignette)
    govScanUntil: 0,           // GOVERN                (horizontal scan-lines)
    capabilityRingUntil: 0,    // AUTOMATE              (accent ring on balls)

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

    // Input lock — set by LoadingScreen / HelpOverlay
    locked: false,

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
    // Cascade clocks in relative time (state.timeMs). Foundation begins stressed
    // and Trust begins eroded → both clocks tick from t=0.
    state.foundationStressedSince = 0;
    state.trustErodedSince = 0;
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

    // V4.6 attack animations
    state.driftAnimUntil = 0;
    state.outageFlashUntil = 0;
    state.breachShakeUntil = 0;
    state.rogueAnimUntil = 0;
    state.revoltAnimUntil = 0;
    state.ghostBalls = [];
    state.lastAttackSpawnAt = -100000;
    state.nextAttackCheckAt = 500;
    state.nextBallCountDrainAt = 1000;
    state._lastBallTrackTime = 0;
    // V2-restored brick-trigger visuals
    state.auditTintUntil = 0;
    state.moatVignetteUntil = 0;
    state.govScanUntil = 0;
    state.capabilityRingUntil = 0;

    state.layerHistory = [
      // V4.6 §8 trajectory chart starts from t=0 snapshot
      {
        quarter: 0, timeMs: 0,
        foundation: INITIAL_LAYERS.foundation,
        trust: INITIAL_LAYERS.trust,
        friction: INITIAL_LAYERS.friction,
        capital: INITIAL_LAYERS.capital,
        capacity: INITIAL_LAYERS.capacity,
        breaks: 0, incidents: 0, ballsLive: 1,
      },
    ];
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
    if (state.status === "ready")  { startGame(); return; }
    if (state.status === "ended")  { startGame(); return; }
    if (state.status !== "playing") return;

    // After incident, deploy waiting ball if respawn timer hasn't fired yet
    if (state.balls.length === 0 && state.respawnAt === 0) { spawnBall(); return; }

    // V4.6 §5 parallel workstream stacking — no eligibility gate, 5s cooldown only
    if (state.balls.length === 0) return;            // can't stack mid-respawn
    if (state.ballsLive >= 3) return;                // 3-ball cap
    if (state.timeMs - state.lastSpaceTap < 5000) return;  // cooldown

    state.ballsLive += 1;
    state.parallelTaps += 1;
    state.lastSpaceTap = state.timeMs;
    spawnBall({ parallel: true });

    if (state.ballsLive === 2) {
      setFlash("parallel-2", "+ 1 WORKSTREAM", "Wall refill 2.5×");
      state.notableMoments.push({
        quarter: state.quarter, timeMs: state.timeMs,
        description: "Tapped SPACE — 2 workstreams",
      });
    } else if (state.ballsLive === 3) {
      setFlash("parallel-3", "PARALLEL OVERLOAD", "Wall 4.5× · drain active");
      state.notableMoments.push({
        quarter: state.quarter, timeMs: state.timeMs,
        description: "Tapped SPACE — 3 workstreams",
      });
    }
  };

  const onKeyDown = (e) => {
    if (state.locked) return;            // LoadingScreen / HelpOverlay holds the keys
    state.keys[e.key] = true;
    if (e.key === " " || e.code === "Space") { e.preventDefault(); onSpace(); }
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === "r" || e.key === "R") restart();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
  };
  const onKeyUp = (e) => {
    if (state.locked) return;
    state.keys[e.key] = false;
  };
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

  /* ───────── Attack-brick cascade spawn (V4.6 §4) ─────────
     Conditions tuned in v4_6_sim.py. Ball-count attack-skew set in Phase 4
     when SPACE-stacking lands. */
  const checkAttackSpawns = () => {
    const spawns = [];
    const tNow = state.timeMs;

    // Ball-count attack-skew multipliers (Phase 4 stacks balls; placeholder uses 1×)
    let driftMult, outageMult, breachMult, rogueMult, hallMult, revoltMult;
    if (state.ballsLive >= 3) {
      driftMult = 2.0; outageMult = 1.5; breachMult = 1.0;
      rogueMult = 1.5; hallMult = 2.0; revoltMult = 1.0;
    } else {
      driftMult = outageMult = breachMult = rogueMult = hallMult = revoltMult = 1.0;
    }

    // DRIFT — Foundation stressed > 30s
    if (state.foundation === "stressed" && state.foundationStressedSince != null) {
      if (tNow - state.foundationStressedSince > 30000) {
        if (Math.random() < 0.6 * driftMult) {
          spawns.push("DRIFT");
          state.foundationStressedSince = tNow;
        }
      }
    }

    // OUTAGE — Foundation degraded (probabilistic), OR 4+ Build streak
    if (state.foundation === "degraded" && Math.random() < 0.025 * outageMult) {
      spawns.push("OUTAGE");
    }
    if (state.buildStreak >= 4) {
      spawns.push("OUTAGE");
      state.buildStreak = 0;
    }

    // BREACH — Low Friction + Stressed Foundation, OR 5+ incidents this quarter
    if (state.friction < 25 && state.foundation === "stressed" && Math.random() < 0.03 * breachMult) {
      spawns.push("BREACH");
    }
    if (state.incidentsThisQuarter >= 5 && Math.random() < 0.10 * breachMult) {
      spawns.push("BREACH");
      state.incidentsThisQuarter = 0;
    }

    // ROGUE — Foundation degraded + Trust eroded + Friction > 60
    if (state.foundation === "degraded" && state.trust < 26 && state.friction > 60
        && Math.random() < 0.04 * rogueMult) {
      spawns.push("ROGUE");
    }

    // HALLUCINATION — Foundation stressed + Trust eroded (probabilistic)
    if (state.foundation === "stressed" && state.trust < 26
        && Math.random() < 0.025 * hallMult) {
      spawns.push("HALLUCINATION");
    }

    // REVOLT — Friction > 70 + Trust eroded > 60s
    if (state.friction > 70 && state.trust < 26 && state.trustErodedSince != null) {
      if (tNow - state.trustErodedSince > 60000) {
        if (Math.random() < 0.6 * revoltMult) {
          spawns.push("REVOLT");
          state.trustErodedSince = tNow;
        }
      }
    }

    return spawns;
  };

  const spawnAttackBrick = (attackName) => {
    const aliveBricks = state.bricks.filter(b => b.alive);
    if (aliveBricks.length === 0) return;
    const target = aliveBricks[Math.floor(Math.random() * aliveBricks.length)];
    const def = ATTACK_BRICKS[attackName];
    if (!def) return;
    target.challenge = def;
    target.fadeInAt = performance.now();
    target.telegraphUntil = state.timeMs + 1000;          // 1s pulse before active
    state.lastAttackSpawnAt = state.timeMs;
    state.notableMoments.push({
      quarter: state.quarter,
      timeMs: state.timeMs,
      description: `${attackName} attack spawned`,
    });
    pushEvent(`⚠ ${attackName} — attack brick on the wall`);
  };

  const spawnGhostBall = () => {
    const baseSpeed = 3.2;
    state.ghostBalls.push({
      x: 40 + Math.random() * Math.max(40, W() - 80),
      y: H() / 3,
      vx: (Math.random() > 0.5 ? 1 : -1) * baseSpeed,
      vy: baseSpeed,
      r: 7,
      expireAt: state.timeMs + 6000,
    });
  };

  const onBrickBreak = (brick) => {
    const brickDef = brick.challenge;
    const isAttack = !!brickDef.isAttack;

    // MONITOR shield absorbs the next attack brick entirely (effects and animation skipped)
    if (isAttack && (state.incidentShields || 0) > 0) {
      state.incidentShields -= 1;
      state.score += 1;
      setFlash("shield", "MONITOR SHIELDED", `${brickDef.label} absorbed`);
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

    // Detect ALIGN compound BEFORE applyBrickEffects mutates lastAlignTime.
    const willAlignCompound = brickDef.id === "ALIGN"
      && state.lastAlignTime != null
      && (state.timeMs - state.lastAlignTime) < 30000;

    applyBrickEffects(state, brickDef, isAttack);

    // V4.6 §4 — attack-brick restored V1 animations
    if (isAttack) {
      setFlash(brickDef.id.toLowerCase(), brickDef.flashTitle, brickDef.flashNote);
      const anim = brickDef.animation;
      if (anim === "curveRight")   state.driftAnimUntil   = state.timeMs + 6000;
      else if (anim === "flash")   state.outageFlashUntil = state.timeMs + 200;
      else if (anim === "shake")   state.breachShakeUntil = state.timeMs + 600;
      else if (anim === "jitter")  state.rogueAnimUntil   = state.timeMs + 5000;
      else if (anim === "ghostBall") spawnGhostBall();
      else if (anim === "driftRight") state.revoltAnimUntil = state.timeMs + 60000;
    } else {
      // V2-restored visual texture on player-brick triggers
      if (willAlignCompound) {
        state.auditTintUntil = state.timeMs + 3000;
        setFlash("align-compound", "ALIGN × ALIGN", "All layers boost");
      }
      if (brickDef.id === "REBUILD") {
        state.moatVignetteUntil = state.timeMs + 3500;
        setFlash("rebuild", "FOUNDATION RESET", "Vignette deepens");
      }
      if (brickDef.id === "GOVERN") {
        state.govScanUntil = state.timeMs + 2500;
      }
      if (brickDef.id === "AUTOMATE") {
        state.capabilityRingUntil = state.timeMs + 5000;
      }
    }
  };

  // Phase 5 builds the V4.6 verdict layout on top of this payload.
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
      crisesEntered: state.crisesEntered || 0,
      crisesRecovered: state.crisesRecovered || 0,
      incidents: state.incidents,
      brickCounts: { ...state.brickCounts },
      attackBrickCounts: { ...state.attackBrickCounts },
      layerHistory: [...state.layerHistory],
      notableMoments: [...state.notableMoments],
      parallelTaps: state.parallelTaps,
      timeAt2Balls: state.timeAt2Balls,
      timeAt3Balls: state.timeAt3Balls,
    };
    state.balls = [];
    state.respawnAt = 0;
  };

  // V4.6 §7: unlimited drops. Parallel drops cost Capacity only; primary drops
  // (last ball off the bottom) fire the uniform incident penalty and respawn after 1.5s.
  const onBallDrop = (now, ball) => {
    const ballsRemaining = state.balls.length - 1;  // excluding the one that just fell

    if (ballsRemaining >= 1) {
      // Parallel workstream concluded messily — not an incident
      state.ballsLive = ballsRemaining;
      updateCapacity(state, -3);
      setFlash("workstream-end", "WORKSTREAM ENDED", `${state.ballsLive} active`);
      pushEvent(`Workstream ended — ${state.ballsLive} active`);
      return;
    }

    // Last ball dropped → incident
    state.ballsLive = 1;
    state.incidents++;
    state.incidentsThisQuarter++;
    state.timeSinceLastIncident = 0;
    state.incidentMoments.push(state.timeMs);

    // V4.6 §7 uniform penalty
    updateCapital(state, -3);
    updateCapacity(state, -8);
    pushFoundation(state, +1);
    updateTrust(state, -2);

    setFlash("incident", `INCIDENT #${state.incidents}`, "Resuming operation");
    pushEvent(`Incident #${state.incidents}`);
    state.notableMoments.push({
      quarter: state.quarter, timeMs: state.timeMs,
      description: `Incident — ball dropped`,
    });

    state.respawnAt = now + 1500;
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

    // V4.6 §6 quarter transition — board review event at each 60s boundary
    if (state.timeMs >= state.nextQuarterAt) {
      const closingQuarter = state.quarter;
      const snap = {
        quarter: closingQuarter,
        timeMs: state.timeMs,
        foundation: state.foundation,
        trust: state.trust,
        friction: state.friction,
        capital: state.capital,
        capacity: state.capacity,
        breaks: Object.values(state.brickCounts).reduce((s,n) => s+n, 0),
        incidents: state.incidents,
        ballsLive: state.ballsLive,
      };
      state.layerHistory.push(snap);
      state.notableMoments.push({
        quarter: closingQuarter, timeMs: state.timeMs,
        description: `Q${closingQuarter} closed`,
      });
      if (closingQuarter >= 4) {
        // V4.6 §7: game ends at end of Q4.
        finishRun();
        return;
      }
      setFlash("board-review", `Q${closingQuarter} CLOSED — BOARD REVIEW`,
        `Foundation ${state.foundation} · Trust ${Math.round(state.trust)} ${trustBand(state.trust)}`);
      state.pauseUntil = now + 1500;            // 1.5s mandatory pause
      state.incidentsThisQuarter = 0;
      state.quarter = closingQuarter + 1;
      state.nextQuarterAt = state.timeMs + QUARTER_LENGTH_MS;

      // Fresh quarter — full wall refresh. Every slot becomes a new brick,
      // staggered fade-in so the wall builds visibly during the board-review pause.
      state.bricks.forEach((b, i) => {
        b.alive = true;
        b.challenge = pickPlayerBrick();
        b.fadeInAt = now + i * 35;
        b.telegraphUntil = 0;
      });
      // Postpone the next regular refill so the fresh wall has room to breathe.
      state.nextBrickRefillAt = now + 8000 + Math.random() * 4000;
    }

    // Wall refill — Foundation degraded amplifies + ball-count escalates (V4.6 §5)
    if (now > state.nextBrickRefillAt) {
      refillBricks();
      const base = 8000 + Math.random() * 6000;
      const foundationMult = getFoundationWallMult(state);
      const ballCountMult = state.ballsLive === 3 ? 4.5 : state.ballsLive === 2 ? 2.5 : 1.0;
      state.nextBrickRefillAt = now + base / (state.wallRefillMultiplier * foundationMult * ballCountMult);
    }

    // V4.6 §5 continuous drain at 3 balls — 1Hz tick, -2 Capital, -3 Capacity per second
    if (state.timeMs >= (state.nextBallCountDrainAt || 0)) {
      state.nextBallCountDrainAt = state.timeMs + 1000;
      if (state.ballsLive === 3) {
        updateCapital(state, -2);
        updateCapacity(state, -3);
      }
    }

    // Per-frame ballsLive-duration tracking (for end-screen parallel usage line)
    {
      const last = state._lastBallTrackTime != null ? state._lastBallTrackTime : state.timeMs;
      const dtMs = Math.max(0, state.timeMs - last);
      state._lastBallTrackTime = state.timeMs;
      if (state.ballsLive === 2) state.timeAt2Balls += dtMs;
      else if (state.ballsLive === 3) state.timeAt3Balls += dtMs;
    }

    // Passive ticks every 30s of game time
    if (state.timeMs >= state.nextPassiveTickAt) {
      tickPassiveEffects(state);
      state.nextPassiveTickAt += 30000;
    }

    // V4.6 attack-spawn check (every 500ms; 5s cooldown between actual spawns)
    if (state.timeMs >= state.nextAttackCheckAt) {
      state.nextAttackCheckAt = state.timeMs + 500;
      if (state.timeMs - state.lastAttackSpawnAt >= 5000) {
        const spawns = checkAttackSpawns();
        if (spawns.length > 0) {
          // Pick one (sim semantics: first match each tick)
          spawnAttackBrick(spawns[0]);
        }
      }
    }

    // Active V4.6 animation flags (drive ball physics + paddle distractions below)
    const inDrift  = state.timeMs < state.driftAnimUntil;
    const inRogue  = state.timeMs < state.rogueAnimUntil;
    const inRevolt = state.timeMs < state.revoltAnimUntil;

    // Ball movement — Foundation health modifies ball speed (V4.6 §2.1)
    const ballMult = state.ballSpeedMultiplier * getFoundationBallMult(state);
    state.balls = state.balls.filter(b => {
      if (b.expireAt && now > b.expireAt) return false;

      // V4.6 attack animations applied to ball velocity
      if (inDrift)  b.vx += 0.013;                          // gradual rightward curve
      if (inRogue) { b.vx += (Math.random() - 0.5) * 0.4;
                     b.vy += (Math.random() - 0.5) * 0.4; }
      if (inRevolt) b.vx += 0.005;                          // gentler drift right
      // HALLUCINATION distraction handled in ghost-ball block (slows on paddle contact)

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
        onBallDrop(now, b);
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

    // HALLUCINATION ghost balls — visual distraction; if paddle touches one,
    // the real balls slow briefly (the operator was disambiguating phantom output).
    state.ghostBalls = state.ghostBalls.filter(g => {
      if (state.timeMs >= g.expireAt) return false;
      g.x += g.vx;
      g.y += g.vy;
      if (g.x < g.r) { g.x = g.r; g.vx = -g.vx; }
      if (g.x > W() - g.r) { g.x = W() - g.r; g.vx = -g.vx; }
      if (g.y < g.r) { g.y = g.r; g.vy = Math.abs(g.vy); }
      if (g.y > H() + 30) return false;

      const py = H() - 26;
      if (g.y + g.r > py && g.y + g.r < py + p.h + 4 && g.x > p.x - 2 && g.x < p.x + p.w + 2 && g.vy > 0) {
        g.vy = -Math.abs(g.vy);
        state.balls.forEach(b => { b.vx *= 0.75; b.vy *= 0.75; });
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

    // BREACH shake — translate the entire scene each frame during the shake window
    let shakeX = 0, shakeY = 0;
    if (state.timeMs < state.breachShakeUntil) {
      const intensity = ((state.breachShakeUntil - state.timeMs) / 600) * 8;
      shakeX = (Math.random() - 0.5) * intensity;
      shakeY = (Math.random() - 0.5) * intensity;
    }
    ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
    ctx.clearRect(-20, -20, W() + 40, H() + 40);
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W() + 40, H() + 40);

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

      // Attack-brick 1-second telegraph pulse (V4.6 §3.3)
      if (def.isAttack && brick.telegraphUntil && state.timeMs < brick.telegraphUntil) {
        const pulse = 0.55 + 0.45 * Math.sin(state.timeMs * 0.018);
        ctx.globalAlpha = fadeT * pulse;
      }

      if (def.isAttack) {
        // Attack brick — solid accent fill, bold label
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

    // Balls — ROGUE jitter, AUTOMATE capability ring, parallel trail
    const inCapaRing = state.timeMs < state.capabilityRingUntil;
    state.balls.forEach(b => {
      // V2-restored CAPABILITY shimmer — accent ring around the ball
      if (inCapaRing) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.45 * ((state.capabilityRingUntil - state.timeMs) / 5000);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      // ROGUE renders balls in accent during the jitter window
      ctx.fillStyle = (state.timeMs < state.rogueAnimUntil) ? accent : fg;
      ctx.fill();
    });

    // HALLUCINATION ghost balls — dashed circles, accent stroke
    if (state.ghostBalls.length > 0) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      state.ghostBalls.forEach(g => {
        const expireFade = Math.min(1, Math.max(0, (g.expireAt - state.timeMs) / 800));
        ctx.globalAlpha = expireFade;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    // REVOLT — canvas tint + diagonal lines for the 60s duration
    if (state.timeMs < state.revoltAnimUntil) {
      const tRemain = (state.revoltAnimUntil - state.timeMs) / 60000;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.07 * tRemain;
      ctx.fillRect(0, 0, W(), H());
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.14 * tRemain;
      ctx.lineWidth = 0.6;
      for (let s = -H(); s < W() + H(); s += 22) {
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(s + H(), H());
        ctx.stroke();
      }
      ctx.restore();
    }

    // OUTAGE — 200ms full-canvas white flash
    if (state.timeMs < state.outageFlashUntil) {
      const t = (state.outageFlashUntil - state.timeMs) / 200;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.65 * t;
      ctx.fillRect(0, 0, W(), H());
      ctx.restore();
    }

    // V2-restored AUDIT warm tint — ALIGN compound bonus reward
    if (state.timeMs < state.auditTintUntil) {
      const t = (state.auditTintUntil - state.timeMs) / 3000;
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.09 * t;
      ctx.fillRect(0, 0, W(), H());
      ctx.restore();
    }

    // V2-restored MOAT vignette — REBUILD foundation reset
    if (state.timeMs < state.moatVignetteUntil) {
      const t = (state.moatVignetteUntil - state.timeMs) / 3500;
      const cx = W() / 2, cy = H() / 2;
      const inner = Math.min(W(), H()) * 0.25;
      const outer = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, accent);
      ctx.save();
      ctx.globalAlpha = 0.12 * t;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W(), H());
      ctx.restore();
    }

    // V2-restored GOVERNANCE scan-lines — GOVERN brick break
    if (state.timeMs < state.govScanUntil) {
      const t = (state.govScanUntil - state.timeMs) / 2500;
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.14 * t;
      ctx.lineWidth = 0.5;
      for (let y = 0; y < H(); y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W(), y);
        ctx.stroke();
      }
      ctx.restore();
    }

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
    setLocked: (v) => {
      state.locked = !!v;
      if (v) {
        // Pause physics while locked (LoadingScreen / HelpOverlay)
        state.pauseUntil = Number.MAX_SAFE_INTEGER;
        // Clear any held arrow keys so the paddle doesn't drift on unlock
        state.keys = {};
      } else {
        state.pauseUntil = 0;
      }
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

/* ════════════════════════════════════════════════════════════════
   V4.6 verdict — 13 rule-based patterns, simulator-ordered.
   Do NOT reorder without re-running v4_6_sim.py.
   ════════════════════════════════════════════════════════════════ */
function computeVerdict(result) {
  const f   = result.foundation;
  const t   = trustBand(result.trust);
  const fr  = result.friction;
  const cap = result.capital;
  const cpc = result.capacity;
  const brickCounts = result.brickCounts || {};

  // Category ratios over player-brick breaks only
  const totalBreaks = Object.values(brickCounts).reduce((a, b) => a + b, 0);
  const cats = { build: 0, defend: 0, repair: 0, invest: 0 };
  for (const [name, count] of Object.entries(brickCounts)) {
    const c = PLAYER_BRICKS[name]?.category;
    if (c) cats[c] += count;
  }
  const denom = Math.max(1, totalBreaks);
  const buildRatio  = cats.build  / denom;
  const defendRatio = cats.defend / denom;
  const repairRatio = cats.repair / denom;
  const investRatio = cats.invest / denom;

  // 1 — CRISIS pattern (both resources depleted), with cause sub-patterns
  if (cap <= 10 && cpc <= 10) {
    if (defendRatio > 0.5)
      return "You hand off a deployment that reviewed itself into the ground. Your successor inherits a culture that mistook caution for safety.";
    if (buildRatio > 0.5)
      return "You hand off a deployment that shipped itself into exhaustion. Your successor inherits the cleanup.";
    return "You hand off a deployment with empty coffers and burned-out staff. Your successor inherits a recovery project.";
  }

  // 2 — REACTIVE (multiple crises survived; sim moves this above Investor)
  if ((result.crisesEntered || 0) >= 4)
    return "You hand off a deployment that survived through reflexes more than choices. Your successor inherits the same firefighting habit unless they break it.";

  // 3 — INVESTOR — heavy investment, capacity built, capital not yet returning
  if (investRatio > 0.5 && cpc > 70 && cap <= 15) {
    if (f === "stressed")
      return "You hand off a well-staffed deployment that hasn't shipped enough to pay for itself. Your successor inherits potential, and an empty bank account.";
    return "You hand off a deployment built for tomorrow at the cost of today. Your successor inherits capacity to act — and pressure to start using it.";
  }

  // 4 — VELOCITY — build-heavy AND foundation hurt
  if (buildRatio > 0.5 && f !== "healthy")
    return "You hand off a deployment that shipped fast and never paused to look. Your successor inherits the consequences.";

  // 5 — BUREAUCRACY — defend-heavy AND friction high
  if (defendRatio > 0.5 && fr > 65)
    return "You hand off a deployment that everyone trusts but nothing moves. Your successor inherits a culture problem.";

  // 6 — IDEAL — healthy + trusted + sustainable
  if (f === "healthy" && (t === "earned" || t === "endorsed") && fr < 60 && (cap + cpc) > 60)
    return "You hand off a healthy, trusted, well-resourced deployment. Your successor inherits something durable.";

  // 7 — PERCEPTION — sound system but trust eroded
  if (f === "healthy" && t === "eroded")
    return "You hand off a technically sound deployment that no one trusts. Your successor inherits a perception problem.";

  // 8 — GOODWILL AND DEADLINE — degraded but still believed in
  if (f === "degraded" && (t === "earned" || t === "endorsed"))
    return "You hand off a system the org still believes in, even as it's quietly cracking. Your successor inherits goodwill — and a deadline.";

  // 9 — DEBT — degraded and untrusted
  if (f === "degraded" && t === "eroded")
    return "You hand off a deployment that almost survived. Your successor inherits debt.";

  // 10 — CAPITAL-ONLY DEPLETION
  if (cap <= 10 && cpc > 50)
    return "You hand off a deployment with motivated people and no budget. Your successor inherits a fundraising problem.";

  // 11 — CAPACITY-ONLY DEPLETION
  if (cpc <= 10 && cap > 50)
    return "You hand off a well-funded deployment with no one left to run it. Your successor inherits a hiring problem.";

  // 12 — WOBBLE — foundation stressed but everything else holding
  if (f === "stressed")
    return "You hand off a deployment that's holding, but only just. Your successor inherits the wobble.";

  // 13 — Fallback
  return "You hand off a deployment that operated. Whether that's enough is for your successor to decide.";
}

/* Five-layer trajectory chart — 5 sparklines, 5 data points (Start + Q1-Q4 ends) */
function LayerTrajectoryChart({ history }) {
  const layers = [
    { key: "foundation", label: "FOUNDATION", numeric: false },
    { key: "trust",      label: "TRUST",      numeric: true },
    { key: "friction",   label: "FRICTION",   numeric: true },
    { key: "capital",    label: "CAPITAL",    numeric: true },
    { key: "capacity",   label: "CAPACITY",   numeric: true },
  ];
  const toY = (snap, k) => {
    if (k === "foundation") return ({ healthy: 100, stressed: 50, degraded: 0 })[snap.foundation] || 50;
    return snap[k];
  };

  // Pad history to 5 entries (start + Q1..Q4) so layout stays consistent if the
  // game ended early. If only `start` is present, render flat lines.
  const padded = history && history.length > 0 ? history : [];

  const W = 140, H = 56, PAD = 6;
  return (
    <div className="trajectory-grid">
      {layers.map(({ key, label, numeric }) => {
        const pts = padded.map((snap, i) => {
          const v = toY(snap, key);
          const x = padded.length > 1 ? PAD + (i / (padded.length - 1)) * (W - PAD * 2) : W / 2;
          const y = H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
        const lastSnap = padded[padded.length - 1];
        const finalRaw = lastSnap ? toY(lastSnap, key) : 0;
        const finalDisplay = numeric ? Math.round(lastSnap ? lastSnap[key] : 0)
                                     : (lastSnap ? lastSnap.foundation : "?").toString().toUpperCase();
        return (
          <div key={key} className="traj-cell">
            <svg viewBox={`0 0 ${W} ${H}`} className="traj-svg" preserveAspectRatio="none">
              {/* 50-line gridline */}
              <line x1={0} y1={H/2} x2={W} y2={H/2} className="traj-grid" />
              {/* Quarter ticks */}
              {padded.map((_, i) => {
                if (padded.length < 2) return null;
                const x = PAD + (i / (padded.length - 1)) * (W - PAD * 2);
                return <line key={i} x1={x} y1={H - PAD - 1} x2={x} y2={H - PAD + 2} className="traj-tick" />;
              })}
              {/* Trajectory */}
              {padded.length > 1 && pts && <polyline points={pts} className="traj-line" />}
              {/* Final point */}
              {padded.length > 0 && (
                <circle
                  cx={padded.length > 1 ? PAD + ((padded.length - 1) / (padded.length - 1)) * (W - PAD * 2) : W / 2}
                  cy={H - PAD - (Math.max(0, Math.min(100, finalRaw)) / 100) * (H - PAD * 2)}
                  r="2.4" className="traj-point"
                />
              )}
            </svg>
            <div className="traj-foot">
              <span className="traj-label">{label}</span>
              <span className="traj-value">{finalDisplay}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Three characteristic moments — distinct event types, spread across quarters */
function pickThreeMoments(moments) {
  if (!moments || moments.length === 0) return [];
  const distinctive = moments.filter(m => !m.description.includes("closed"));
  const seenByQuarter = new Map();
  const selected = [];

  for (const m of distinctive) {
    if (selected.length >= 3) break;
    const evType = m.description.split(" ")[0];
    const seenTypes = seenByQuarter.get(m.quarter) || new Set();
    if (!seenTypes.has(evType)) {
      const quartersUsed = new Set(selected.map(s => s.quarter));
      if (!quartersUsed.has(m.quarter) || selected.length >= 2) {
        selected.push(m);
        seenTypes.add(evType);
        seenByQuarter.set(m.quarter, seenTypes);
      }
    }
  }
  // Fallback: fill remaining slots with any leftover moments
  for (const m of moments) {
    if (selected.length >= 3) break;
    if (!selected.includes(m)) selected.push(m);
  }
  return selected;
}

function CharacteristicMoments({ moments }) {
  if (!moments || moments.length === 0) {
    return <div className="moments-empty">No defining moments — a quiet tenure.</div>;
  }
  return (
    <div className="moments-list">
      {moments.map((m, i) => (
        <div key={i} className="moment-row">
          <span className="moment-q">Q{m.quarter}</span>
          <span className="moment-t">{Math.round(m.timeMs / 1000)}s</span>
          <span className="moment-desc">{m.description}</span>
        </div>
      ))}
    </div>
  );
}

/* V4.6 End screen — The Handoff */
function EndScreen({ result, onRestart }) {
  if (!result) return null;
  const verdict = computeVerdict(result);
  const breaks = Object.values(result.brickCounts || {}).reduce((s, n) => s + n, 0);
  const crisisStr = (result.crisesEntered || 0) > 0
    ? `${result.crisesEntered} CRISES SURVIVED`
    : "NO CRISES";
  const pct2 = Math.round(100 * (result.timeAt2Balls || 0) / TOTAL_GAME_LENGTH_MS);
  const pct3 = Math.round(100 * (result.timeAt3Balls || 0) / TOTAL_GAME_LENGTH_MS);
  const moments = pickThreeMoments(result.notableMoments || []);

  return (
    <div className="game-overlay game-overlay-end">
      <div className="end-grid">
        <header className="handoff-header">
          <span className="overlay-eyebrow">— The Handoff · {fmtDuration(result.durationMs)}</span>
          <h2 className="handoff-title">The <em>Handoff</em></h2>
        </header>

        <LayerTrajectoryChart history={result.layerHistory || []} />

        <p className="verdict">{verdict}</p>

        <div className="handoff-stats">
          <span className="stats-line">4 QUARTERS · {breaks} BREAKS · {result.incidents || 0} INCIDENTS · {crisisStr}</span>
          {(result.parallelTaps > 0 || pct2 > 0 || pct3 > 0) && (
            <span className="stats-line stats-parallel">
              SPACE TAPS {result.parallelTaps || 0} · 2-BALL {pct2}% · 3-BALL {pct3}%
            </span>
          )}
        </div>

        <CharacteristicMoments moments={moments} />

        <div className="end-footer">
          RUN ANOTHER DEPLOYMENT — PRESS <span className="kbd">SPACE</span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   V4.6 Phase 7 — game primer (full-page loading screen on first visit,
   modal help overlay during play). localStorage-gated by `deploy_v4_seen`.
   ════════════════════════════════════════════════════════════════ */
const PRIMER_STORAGE_KEY = "deploy_v4_seen";

const PRIMER_BRICKS = {
  build: [
    { id: "SHIP",      blurb: "ship features.",          effects: "trust+ but foundation--" },
    { id: "SCALE",     blurb: "take on more load.",      effects: "capital-- capacity-- foundation--" },
    { id: "AUTOMATE",  blurb: "reduce manual work.",     effects: "capital+ capacity++ friction--" },
  ],
  defend: [
    { id: "REVIEW",    blurb: "institutional review.",   effects: "trust+ but friction+" },
    { id: "MONITOR",   blurb: "proactive monitoring.",   effects: "shields next attack." },
    { id: "GOVERN",    blurb: "formal governance.",      effects: "trust++ but friction+++" },
  ],
  repair: [
    { id: "PATCH",     blurb: "fix what broke.",         effects: "foundation- capacity--" },
    { id: "APOLOGIZE", blurb: "mend trust with users.",  effects: "trust+ capacity--" },
    { id: "REBUILD",   blurb: "reset foundation healthy.", effects: "capital-- capacity--" },
  ],
  invest: [
    { id: "TRAIN",     blurb: "team learning.",          effects: "delayed trust + capacity++" },
    { id: "HIRE",      blurb: "expand team.",            effects: "capital--- capacity passive+" },
    { id: "ALIGN",     blurb: "stakeholder alignment.",  effects: "chain two in 30s for bonus" },
  ],
};

const PRIMER_ATTACKS = [
  { id: "DRIFT",        trigger: "Foundation stressed too long.",                      animation: "Balls curve right for 6 seconds." },
  { id: "OUTAGE",       trigger: "Foundation degraded, or 4 BUILD in a row.",          animation: "Screen flashes. Ball speeds up." },
  { id: "HALLUCINATION",trigger: "Foundation stressed + trust eroded.",                animation: "A ghost ball spawns. It looks real. It isn't." },
  { id: "ROGUE",        trigger: "Foundation degraded + trust eroded + friction high.",animation: "All balls jitter unpredictably for 5 seconds." },
  { id: "BREACH",       trigger: "Low friction + stressed foundation.",                animation: "Trust collapses by 30. Friction spikes." },
  { id: "REVOLT",       trigger: "High friction + sustained trust collapse.",          animation: "Canvas tints. Balls drift right. The org rebels." },
];

function PrimerContent() {
  return (
    <>
      {/* Section 1 — Premise */}
      <section className="primer-section primer-premise">
        <h1 className="primer-title">DEPLOY</h1>
        <p className="primer-lede">You are operating a brand new AI deployment.</p>
        <p className="primer-lede">You have four quarters before your tenure ends.</p>
        <p className="primer-lede primer-lede-emphasis">What you hand off is what you're judged on.</p>
      </section>

      {/* Section 2 — How the game works */}
      <section className="primer-section">
        <h3 className="primer-h">THE WALL IS THE WORK.</h3>
        <p>Bricks represent operational choices. Break a brick — apply that choice — affect your deployment.</p>
        <ul className="primer-list">
          <li>Some bricks <em className="cat-build">BUILD</em> capability.</li>
          <li>Some <em className="cat-defend">DEFEND</em> what exists.</li>
          <li>Some <em className="cat-repair">REPAIR</em> damage.</li>
          <li>Some <em className="cat-invest">INVEST</em> for later.</li>
        </ul>
        <p>Your job: keep the ball in play and choose which bricks to break.</p>
      </section>

      {/* Section 3 — Five layers */}
      <section className="primer-section">
        <h3 className="primer-h">WHAT YOU MANAGE</h3>
        <div className="primer-layers">
          <div className="primer-layer">
            <div className="primer-layer-name">FOUNDATION</div>
            <div className="primer-layer-visual primer-foundation-pill">
              <span>healthy</span>
              <span className="active">STRESSED</span>
              <span>degraded</span>
            </div>
            <div className="primer-layer-desc">The system's structural health. You start STRESSED. Untested infrastructure.</div>
          </div>
          <div className="primer-layer">
            <div className="primer-layer-name">TRUST</div>
            <div className="primer-layer-visual primer-bar"><div className="primer-bar-dot" style={{ left: "0%" }} /></div>
            <div className="primer-layer-desc">What stakeholders and users feel. You start at 0. No track record. Hard to earn.</div>
          </div>
          <div className="primer-layer">
            <div className="primer-layer-name">FRICTION</div>
            <div className="primer-layer-visual primer-bar"><div className="primer-bar-dot" style={{ left: "10%" }} /></div>
            <div className="primer-layer-desc">Organizational drag. Higher = slower paddle. You start at 10 — but that creates BREACH risk.</div>
          </div>
          <div className="primer-layer">
            <div className="primer-layer-name">CAPITAL</div>
            <div className="primer-layer-visual primer-bar"><div className="primer-bar-dot" style={{ left: "40%" }} /></div>
            <div className="primer-layer-desc">Money, headcount, compute. You start at 40. Medium funding.</div>
          </div>
          <div className="primer-layer">
            <div className="primer-layer-name">CAPACITY</div>
            <div className="primer-layer-visual primer-bar"><div className="primer-bar-dot" style={{ left: "25%" }} /></div>
            <div className="primer-layer-desc">Attention. The team's bandwidth. You start at 25. Small team, already stretched.</div>
          </div>
        </div>
      </section>

      {/* Section 4 — Twelve bricks */}
      <section className="primer-section">
        <h3 className="primer-h">TWELVE CHOICES, FOUR CATEGORIES</h3>
        <div className="primer-bricks-grid">
          {["build", "defend", "repair", "invest"].map(cat => (
            <div key={cat} className={"primer-brick-col primer-brick-" + cat}>
              <div className="primer-brick-cat">{cat.toUpperCase()}</div>
              {PRIMER_BRICKS[cat].map(b => (
                <div key={b.id} className={"primer-brick primer-brick-vis-" + cat}>
                  <div className="primer-brick-id">{b.id}</div>
                  <div className="primer-brick-blurb">{b.blurb}</div>
                  <div className="primer-brick-effects">{b.effects}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Section 5 — Six attacks */}
      <section className="primer-section">
        <h3 className="primer-h">SIX FAILURE MODES</h3>
        <p className="primer-lede-attack">
          <em>These don't appear in the brick pool. They spawn when the conditions you create allow them.</em>
        </p>
        <div className="primer-attacks">
          {PRIMER_ATTACKS.map(a => (
            <div key={a.id} className="primer-attack">
              <div className="primer-attack-name">{a.id}</div>
              <div className="primer-attack-trigger"><em>{a.trigger}</em></div>
              <div className="primer-attack-anim">{a.animation}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 6 — Parallel workstreams */}
      <section className="primer-section">
        <h3 className="primer-h">PARALLEL WORKSTREAMS — SPACE</h3>
        <p>Tap SPACE to deploy a second ball. The wall refills 2.5× faster. More work, more output.</p>
        <p>Tap SPACE again for a third ball. The wall refills 4.5× faster — and starts producing more failures. Capital and capacity drain continuously.</p>
        <p>Drop a ball and the pressure drops with it.</p>
        <p className="primer-tagline"><em>You'll know when you're overloaded.</em></p>
      </section>

      {/* Section 7 — End of Q4 */}
      <section className="primer-section">
        <h3 className="primer-h">END OF Q4 — THE HANDOFF</h3>
        <p>Four quarters pass. Sixty seconds each.</p>
        <p>At the end, you see:</p>
        <ul className="primer-list primer-list-clean">
          <li>Your trajectory across all five layers</li>
          <li>What you built, broke, and survived</li>
          <li>A single sentence about what you hand off</li>
        </ul>
        <p className="primer-tagline"><em>No score. No archetype.<br />The state of your deployment is your diagnosis.</em></p>
      </section>
    </>
  );
}

function LoadingScreen({ onBegin }) {
  return (
    <div className="primer-screen primer-loading">
      <div className="primer-scroll">
        <PrimerContent />
      </div>
      <div className="primer-footer" onClick={onBegin}>
        <span className="primer-footer-text">SPACE — BEGIN</span>
      </div>
    </div>
  );
}

function HelpOverlay({ onClose }) {
  return (
    <div className="primer-screen primer-help">
      <button className="primer-close" onClick={onClose} aria-label="Close help">×</button>
      <div className="primer-scroll">
        <PrimerContent />
      </div>
      <div className="primer-footer" onClick={onClose}>
        <span className="primer-footer-text">ESC — RETURN TO GAME</span>
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

  // V4.6 §9 primer: shown once on first visit (localStorage-gated)
  const [showLoading, setShowLoading] = useStateGame(() => {
    try { return !window.localStorage.getItem(PRIMER_STORAGE_KEY); } catch (e) { return true; }
  });
  const [helpOpen, setHelpOpen] = useStateGame(false);

  const dismissLoading = useCallbackGame(() => {
    try { window.localStorage.setItem(PRIMER_STORAGE_KEY, "1"); } catch (e) {}
    setShowLoading(false);
  }, []);

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

  // Lock the game while LoadingScreen or HelpOverlay is open
  useEffectGame(() => {
    const locked = showLoading || helpOpen;
    if (gameRef.current && gameRef.current.setLocked) gameRef.current.setLocked(locked);
  }, [showLoading, helpOpen]);

  // SPACE on LoadingScreen → dismiss. ESC on HelpOverlay → close.
  useEffectGame(() => {
    if (!showLoading && !helpOpen) return;
    const onKey = (e) => {
      if (showLoading && (e.key === " " || e.code === "Space")) {
        e.preventDefault(); e.stopPropagation();
        dismissLoading();
      } else if (helpOpen && (e.key === "Escape" || e.key === "Esc")) {
        e.preventDefault(); e.stopPropagation();
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);  // capture phase, beats game's keydown
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showLoading, helpOpen, dismissLoading]);

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

              {/* V4.6 §9 help icon — opens primer as modal during play */}
              <button
                className="help-icon"
                onClick={() => setHelpOpen(true)}
                aria-label="Open primer"
                title="Primer"
              >?</button>

              {/* V4.6 §6 quarter indicator — Q1·Q2·Q3·Q4 dots, top-right */}
              <div className="quarter-indicator">
                {[1, 2, 3, 4].map(q => {
                  const cur = hud.quarter || 1;
                  const cls = q === cur ? "quarter-active" : (q < cur ? "quarter-past" : "quarter-future");
                  return <span key={q} className={"quarter-dot " + cls}>Q{q}</span>;
                })}
              </div>

              {/* V4.6 §5 parallel-workstream visual indicators */}
              {hud.ballsLive === 2 && status === "playing" && (
                <div className="parallel-indicator parallel-2">+1 WORKSTREAM · WALL ×2.5</div>
              )}
              {hud.ballsLive === 3 && status === "playing" && (
                <div className="parallel-indicator parallel-3">PARALLEL OVERLOAD · WALL ×4.5 · DRAIN</div>
              )}

              {/* V4.6 §4.10 stakeholder pressure indicators, bottom */}
              {status === "playing" && (
                <div className="stakeholder-pressure">
                  <span className={"stakeholder" + (hud.foundation !== "healthy" ? " stakeholder-pressing" : "")}>
                    ENG{hud.foundation !== "healthy" ? " ⚠" : ""}
                  </span>
                  <span className={"stakeholder" + ((hud.capital <= 30 || hud.capacity <= 30) ? " stakeholder-pressing" : "")}>
                    PRD{(hud.capital <= 30 || hud.capacity <= 30) ? " ⚠" : ""}
                  </span>
                  <span className={"stakeholder" + ((hud.friction || 0) < 30 ? " stakeholder-pressing" : "")}>
                    LEG{(hud.friction || 0) < 30 ? " ⚠" : ""}
                  </span>
                  <span className={"stakeholder" + ((hud.trust || 0) < 50 ? " stakeholder-pressing" : "")}>
                    USR{(hud.trust || 0) < 50 ? " ⚠" : ""}
                  </span>
                </div>
              )}

              {status === "ready" && (
                <div className="game-overlay game-overlay-start">
                  <span className="overlay-eyebrow">— Day 1 · Brand new deployment</span>
                  <h2>Press <em>spacebar</em> to deploy.</h2>
                  <p>← → paddle · P pause · R restart · SPACE again to stack workstreams</p>
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

      {/* V4.6 Phase 7 — primer overlays */}
      {showLoading && <LoadingScreen onBegin={dismissLoading} />}
      {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

Object.assign(window, { GamePage });

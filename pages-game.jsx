/* ════════════════════════════════════════════════════════════════
   Game V4.7 — Five interdependent layers · vulnerable opening
   Capital · Capacity · Trust · Friction · Safety
   Conditional brick effects · banded diminishing returns
   Crisis is terminal at 30s · all numbers tuned in v4_7_stress.py
   Exports: GamePage
   ════════════════════════════════════════════════════════════════ */

const { useState: useStateGame, useEffect: useEffectGame, useRef: useRefGame, useCallback: useCallbackGame } = React;

const clamp01 = v => Math.max(0, Math.min(1, v));
function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const QUARTER_LENGTH_MS = 60000;
const TOTAL_GAME_LENGTH_MS = 240000;            // 4 minutes
const CRISIS_TERMINAL_MS = 30000;               // game ends if Crisis persists 30s
const PRIMER_STORAGE_KEY = "deploy_v4_7_seen";

/* ════════════════════════════════════════════════════════════════
   V4.7 Initial state — brand-new deployment
   ════════════════════════════════════════════════════════════════ */
const INITIAL_LAYERS = {
  capital: 40,    // money, headcount, compute — approved but not lavish
  capacity: 25,   // attention, hours, focus — small team already stretched
  trust: 0,       // no track record, no users
  friction: 10,   // no governance process yet — creates BREACH risk
  safety: 15,     // AI-specific risk controls — unmitigated at day 1
  maxCapital: 100,
  maxCapacity: 100,
};

/* ────────────────────── Layer bands ────────────────────── */
function trustBand(t) {
  if (t < 26) return "eroded";
  if (t < 51) return "skeptical";
  if (t < 76) return "earned";
  return "endorsed";
}
function safetyBand(s) {
  if (s < 26) return "unmitigated";
  if (s < 51) return "reactive";
  if (s < 76) return "proactive";
  return "robust";
}

/* ────────────────────── Banded diminishing returns ──────────────────────
   trustGainMult also used for safety gains; loss mult amplifies at the top. */
function trustGainMult(v) {
  if (v < 26) return 1.00;
  if (v < 51) return 0.90;
  if (v < 76) return 0.70;
  if (v < 91) return 0.40;
  return 0.10;                       // strong ceiling
}
function trustLossMult(v) {
  if (v < 26) return 0.70;
  if (v < 51) return 0.90;
  if (v < 76) return 1.00;
  return 1.30;                       // sharper falls at the top
}
const safetyGainMult = trustGainMult;
const safetyLossMult = trustLossMult;

function capacityGainMult(v) {
  if (v < 51) return 1.00;
  if (v < 76) return 0.80;
  if (v < 91) return 0.60;
  return 0.30;
}
function frictionIncreaseMult(v) {
  if (v < 51) return 1.00;
  if (v < 71) return 0.80;
  if (v < 91) return 0.50;
  return 0.20;
}

/* ────────────────────── Layer mutators ────────────────────── */
function updateTrust(state, delta) {
  if (delta > 0) {
    delta *= trustGainMult(state.trust);
    delta = delta >= 0.5 ? Math.max(1, Math.floor(delta)) : 0;
  } else if (delta < 0) {
    delta *= trustLossMult(state.trust);
  }
  state.trust = Math.max(0, Math.min(100, state.trust + delta));
  if (state.trust < 26 && state.trustErodedSince == null) {
    state.trustErodedSince = state.timeMs;
  } else if (state.trust >= 26) {
    state.trustErodedSince = null;
  }
}

function updateSafety(state, delta) {
  if (delta > 0) {
    // Above 90: each point of gain costs Capital 3 (gold-plating tax)
    if (state.safety >= 90) {
      const capCost = Math.min(3, Math.floor(delta * 3));
      state.capital = Math.max(0, state.capital - capCost);
    }
    delta *= safetyGainMult(state.safety);
    delta = delta >= 0.5 ? Math.max(1, Math.floor(delta)) : 0;
  } else if (delta < 0) {
    delta *= safetyLossMult(state.safety);
  }
  state.safety = Math.max(0, Math.min(100, state.safety + delta));
  if (state.safety < 30 && state.safetyDegradedSince == null) {
    state.safetyDegradedSince = state.timeMs;
  } else if (state.safety >= 30) {
    state.safetyDegradedSince = null;
  }
}

function updateCapacity(state, delta) {
  if (delta > 0) delta *= capacityGainMult(state.capacity);
  state.capacity = Math.max(0, Math.min(state.maxCapacity, state.capacity + delta));
  checkCrisis(state);
}

function updateCapital(state, delta) {
  state.capital = Math.max(0, Math.min(state.maxCapital, state.capital + delta));
  // Above 90, Capital gains cost Capacity 1 (saturation tax)
  if (delta > 0 && state.capital >= 90) {
    state.capacity = Math.max(0, state.capacity - 1);
  }
  checkCrisis(state);
}

function updateFriction(state, delta) {
  if (delta > 0) delta *= frictionIncreaseMult(state.friction);
  state.friction = Math.max(0, Math.min(100, state.friction + delta));
}

function checkCrisis(state) {
  const inCrisisNow = state.capital <= 5 && state.capacity <= 5;
  if (inCrisisNow && !state.crisisActive) {
    state.crisisActive = true;
    state.crisesEntered = (state.crisesEntered || 0) + 1;
    // Multi-ball collapse — Crisis can't run multiple workstreams
    if (state.ballsLive > 1) {
      state.ballsLive = 1;
      // Drop all parallel balls; primary stays alive
      state.balls = state.balls.filter(b => !b.isParallel);
    }
  } else if (state.crisisActive && (state.capital > 20 || state.capacity > 20)) {
    state.crisisActive = false;
    state.crisisDurationMs = 0;
  }
}

function getPaddleSpeed(state) {
  return 9 * (1 - state.friction / 200);
}

/* ════════════════════════════════════════════════════════════════
   V4.7 brick catalogue — 12 player bricks, conditional effects
   ════════════════════════════════════════════════════════════════ */
const PLAYER_BRICKS = {
  SHIP:      { category: "build",  label: "SHIP" },
  SCALE:     { category: "build",  label: "SCALE" },
  AUTOMATE:  { category: "build",  label: "AUTOMATE" },
  REVIEW:    { category: "defend", label: "REVIEW" },
  REDTEAM:   { category: "defend", label: "REDTEAM" },
  GOVERN:    { category: "defend", label: "GOVERN" },
  PATCH:     { category: "repair", label: "PATCH" },
  APOLOGIZE: { category: "repair", label: "APOLOGIZE" },
  REBUILD:   { category: "repair", label: "REBUILD" },
  TRAIN:     { category: "invest", label: "TRAIN" },
  HIRE:      { category: "invest", label: "HIRE" },
  ALIGN:     { category: "invest", label: "ALIGN" },
};
const PLAYER_BRICK_IDS = Object.keys(PLAYER_BRICKS);
function pickPlayerBrickName() {
  return PLAYER_BRICK_IDS[Math.floor(Math.random() * PLAYER_BRICK_IDS.length)];
}

/* ════════════════════════════════════════════════════════════════
   V4.7 attack bricks — Safety-driven cascade conditions
   ════════════════════════════════════════════════════════════════ */
const ATTACK_BRICKS = {
  DRIFT:         { isAttack: true, label: "DRIFT",         animation: "curveRight",
                   flashTitle: "DRIFT",         flashNote: "Balls curving right" },
  OUTAGE:        { isAttack: true, label: "OUTAGE",        animation: "flash",
                   flashTitle: "OUTAGE",        flashNote: "Service down · ball accelerating" },
  BREACH:        { isAttack: true, label: "BREACH",        animation: "shake",
                   flashTitle: "BREACH",        flashNote: "Trust collapsed · friction spiked" },
  ROGUE:         { isAttack: true, label: "ROGUE",         animation: "jitter",
                   flashTitle: "ROGUE AGENT",   flashNote: "Unpredictable trajectories" },
  HALLUCINATION: { isAttack: true, label: "HALLUCINATION", animation: "ghostBall",
                   flashTitle: "HALLUCINATION", flashNote: "Phantom output — looks real" },
  REVOLT:        { isAttack: true, label: "REVOLT",        animation: "driftRight",
                   flashTitle: "REVOLT",        flashNote: "Org rebels · wall accelerates" },
};

/* Inline conditional logic — effects depend on Safety state at break time. */
function applyPlayerBrickEffect(state, name) {
  state.breaks += 1;
  state.score = state.breaks;
  state.brickCounts[name] = (state.brickCounts[name] || 0) + 1;
  const s = state.safety;

  switch (name) {
    case "SHIP":
      updateCapacity(state, -4);
      updateSafety(state, -5);
      if (s > 50) updateTrust(state, +3);
      else if (s < 26) updateTrust(state, -3);
      break;

    case "SCALE":
      updateCapital(state, -4);
      updateCapacity(state, -3);
      updateSafety(state, -8);
      if (s > 50) updateTrust(state, +2);
      else if (s < 26) updateTrust(state, -4);
      state.ballSpeedMultiplier = Math.max(state.ballSpeedMultiplier, 1.05);
      state.ballSpeedUntil = state.timeMs + 8000;
      break;

    case "AUTOMATE":
      updateCapital(state, -6);
      updateCapacity(state, -5);
      updateTrust(state, +1);
      state.delayedEffects.push({ fireAt: state.timeMs + 15000, layer: "capital",  amount: +10 });
      state.delayedEffects.push({ fireAt: state.timeMs + 15000, layer: "capacity", amount: +12 });
      state.delayedEffects.push({ fireAt: state.timeMs + 15000, layer: "friction", amount: -4  });
      break;

    case "REVIEW":
      updateFriction(state, +4);
      updateCapacity(state, -2);
      updateSafety(state, +2);
      if (s > 50) updateTrust(state, +3);
      else if (s < 26) updateTrust(state, -2);
      break;

    case "REDTEAM":
      updateCapacity(state, -4);
      updateCapital(state, -2);
      updateSafety(state, +6);
      updateFriction(state, +1);
      state.incidentShields += 1;
      break;

    case "GOVERN":
      updateFriction(state, +8);
      updateCapacity(state, -3);
      updateCapital(state, -2);
      updateSafety(state, +3);
      updateTrust(state, +2);
      state.delayedEffects.push({ fireAt: state.timeMs + 20000, layer: "trust", amount: +3 });
      break;

    case "PATCH": {
      const priorSafety = state.safety;
      updateCapacity(state, -5);
      updateSafety(state, +3);
      if (priorSafety < 30) updateTrust(state, +1);
      else if (priorSafety > 50) updateTrust(state, -2);
      break;
    }

    case "APOLOGIZE": {
      updateCapacity(state, -3);
      const within30s = (state.timeMs - state.lastApologizeTime) < 30000;
      const mult = within30s ? 0.5 : 1.0;
      state.lastApologizeTime = state.timeMs;
      if (s > 50) updateTrust(state, Math.round(5 * mult));
      else if (s < 26) updateTrust(state, Math.round(-4 * mult));
      else updateTrust(state, Math.max(1, Math.round(1 * mult)));
      break;
    }

    case "REBUILD":
      updateCapital(state, -12);
      updateCapacity(state, -10);
      state.safety = 60;
      state.safetyDegradedSince = null;
      updateTrust(state, -6);
      updateFriction(state, +6);
      break;

    case "TRAIN":
      updateCapital(state, -5);
      updateCapacity(state, -3);
      state.delayedEffects.push({ fireAt: state.timeMs + 12000, layer: "capacity", amount: +10 });
      state.delayedEffects.push({ fireAt: state.timeMs + 20000, layer: "trust",    amount: +3  });
      state.delayedEffects.push({ fireAt: state.timeMs + 25000, layer: "safety",   amount: +5  });
      break;

    case "HIRE": {
      state.hireCount += 1;
      updateCapital(state, -12);
      updateCapacity(state, -5);
      let payoffMult = 1.0;
      if (state.hireCount > 5) payoffMult = 0.25;
      else if (state.hireCount > 3) payoffMult = 0.50;
      // 15% chance the hire doesn't work out
      if (Math.random() < 0.85) {
        const capAmt = Math.floor(15 * payoffMult);
        const safAmt = Math.floor(3  * payoffMult);
        if (capAmt > 0) state.delayedEffects.push({ fireAt: state.timeMs + 25000, layer: "capacity", amount: capAmt });
        if (safAmt > 0) state.delayedEffects.push({ fireAt: state.timeMs + 30000, layer: "safety",   amount: safAmt });
      }
      break;
    }

    case "ALIGN":
      updateCapacity(state, -4);
      updateCapital(state, -1);
      updateFriction(state, -3);
      if (s > 50) updateTrust(state, +3);
      else if (s < 26) updateTrust(state, -1);
      else updateTrust(state, +1);
      if (state.lastAlignTime != null && state.timeMs - state.lastAlignTime < 30000) {
        updateTrust(state, +5);
        updateCapital(state, +5);
        updateCapacity(state, +5);
        updateFriction(state, -5);
      }
      state.lastAlignTime = state.timeMs;
      break;
  }

  // Build streak for OUTAGE cascade (Phase 3)
  if (PLAYER_BRICKS[name] && PLAYER_BRICKS[name].category === "build") {
    state.buildStreak += 1;
  } else {
    state.buildStreak = 0;
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
    quarter: 1,
    status: "ready",                  // ready | playing | paused | ended
    events: [],
    flash: null,
    locked: false,                    // LoadingScreen / HelpOverlay holds the keys

    // ── V4.7 Five layers ──
    ...INITIAL_LAYERS,

    // Cascade clocks — Safety begins unmitigated (15 < 26) and Trust begins eroded (0),
    // so both clocks tick from t=0.
    safetyDegradedSince: 0,
    trustErodedSince: 0,
    buildStreak: 0,
    lastAlignTime: null,
    lastApologizeTime: -100000,
    incidentShields: 0,
    hireCount: 0,
    incidentsThisQuarter: 0,
    timeSinceLastIncident: 0,

    // Delayed effect queue — drained in update loop
    delayedEffects: [],

    // Crisis
    crisisActive: false,
    crisesEntered: 0,
    crisisDurationMs: 0,
    gameEndedEarly: false,
    earlyEndReason: null,

    // Parallel workstream
    ballsLive: 1,
    parallelTaps: 0,
    lastSpaceTap: -100000,
    timeAt2Balls: 0,
    timeAt3Balls: 0,

    // Transient multipliers
    ballSpeedMultiplier: 1,
    ballSpeedUntil: 0,
    wallRefillExtraMultiplier: 1,   // attack/REVOLT-driven; separate from ball-count refill
    wallRefillExtraUntil: 0,
    capacityDrainMultiplier: 1,
    capacityDrainUntil: 0,

    // Attack animations (relative timeMs)
    driftAnimUntil: 0,
    outageFlashUntil: 0,
    breachShakeUntil: 0,
    rogueAnimUntil: 0,
    revoltAnimUntil: 0,
    ghostBalls: [],
    lastAttackSpawnAt: -100000,
    nextAttackCheckAt: 0,

    // Stats
    score: 0,                         // V4.7 has no score; kept as alias for breaks
    breaks: 0,
    incidents: 0,
    timeMs: 0,
    runStart: 0,
    runEnd: 0,
    endResult: null,

    // History
    layerHistory: [],
    notableMoments: [],
    brickCounts: {},
    attackBrickCounts: {},

    // Timers
    nextBrickRefillAt: 0,
    nextQuarterAt: 0,
    nextPassiveTickAt: 0,
    nextBallCountDrainAt: 0,
    nextHudSync: 0,
    respawnAt: 0,
    pauseUntil: 0,
    flashUntil: 0,
    incidentMoments: [],
    _lastBallTrackTime: 0,
  };

  state.paddle.x = (W() - state.paddle.w) / 2;

  /* ───────── Bricks ───────── */
  // V4.7 §5 — Crisis narrows the pool to recovery-oriented bricks only.
  const CRISIS_POOL = ["AUTOMATE", "APOLOGIZE", "TRAIN"];
  const pickBrickForWall = () => {
    const pool = state.crisisActive ? CRISIS_POOL : PLAYER_BRICK_IDS;
    const name = pool[Math.floor(Math.random() * pool.length)];
    return { id: name, label: PLAYER_BRICKS[name].label, category: PLAYER_BRICKS[name].category };
  };

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
          w: bw, h: bh,
          alive: true,
          challenge: pickBrickForWall(),
          fadeInAt: now,
        });
      }
    }
  };

  const refillBricks = () => {
    const empties = state.bricks.filter(b => !b.alive);
    if (empties.length === 0) return;
    const refillCount = 1 + Math.floor(Math.random() * 3);
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
      b.challenge = pickBrickForWall();
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
    state.breaks = 0;
    state.quarter = 1;
    state.events = [];
    state.respawnAt = 0;
    state.brickCounts = {};
    state.attackBrickCounts = {};
    state.incidentMoments = [];
    state.endResult = null;

    // V4.7 layer reset
    Object.assign(state, INITIAL_LAYERS);
    state.safetyDegradedSince = 0;
    state.trustErodedSince = 0;
    state.buildStreak = 0;
    state.lastAlignTime = null;
    state.lastApologizeTime = -100000;
    state.incidentShields = 0;
    state.hireCount = 0;
    state.incidentsThisQuarter = 0;
    state.timeSinceLastIncident = 0;
    state.delayedEffects = [];
    state.crisisActive = false;
    state.crisesEntered = 0;
    state.crisisDurationMs = 0;
    state.gameEndedEarly = false;
    state.earlyEndReason = null;
    state.ballsLive = 1;
    state.parallelTaps = 0;
    state.lastSpaceTap = -100000;
    state.timeAt2Balls = 0;
    state.timeAt3Balls = 0;
    state.ballSpeedMultiplier = 1;
    state.ballSpeedUntil = 0;
    state.wallRefillExtraMultiplier = 1;
    state.wallRefillExtraUntil = 0;
    state.capacityDrainMultiplier = 1;
    state.capacityDrainUntil = 0;
    state.driftAnimUntil = 0;
    state.outageFlashUntil = 0;
    state.breachShakeUntil = 0;
    state.rogueAnimUntil = 0;
    state.revoltAnimUntil = 0;
    state.ghostBalls = [];
    state.lastAttackSpawnAt = -100000;
    state.nextAttackCheckAt = 500;
    state.incidents = 0;
    state._lastBallTrackTime = 0;

    state.layerHistory = [{
      quarter: 0, timeMs: 0,
      capital: INITIAL_LAYERS.capital,
      capacity: INITIAL_LAYERS.capacity,
      trust: INITIAL_LAYERS.trust,
      friction: INITIAL_LAYERS.friction,
      safety: INITIAL_LAYERS.safety,
      breaks: 0, incidents: 0, ballsLive: 1,
    }];
    state.notableMoments = [];

    initBricks();
    state.balls = [];
    spawnBall();

    state.timeMs = 0;
    state.runStart = now;
    state.runEnd = 0;
    state.nextBrickRefillAt = now + 9000 + Math.random() * 4000;
    state.nextPassiveTickAt = now + 30000;
    state.nextQuarterAt = QUARTER_LENGTH_MS;            // relative timeMs
    state.nextBallCountDrainAt = 1000;
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

    if (state.balls.length === 0 && state.respawnAt === 0) { spawnBall(); return; }

    // V4.7 §5 — parallel workstream stacking, blocked during Crisis
    if (state.crisisActive) return;
    if (state.balls.length === 0) return;
    if (state.ballsLive >= 3) return;
    if (state.timeMs - state.lastSpaceTap < 5000) return;

    state.ballsLive += 1;
    state.parallelTaps += 1;
    state.lastSpaceTap = state.timeMs;
    spawnBall({ parallel: true });

    if (state.ballsLive === 2) {
      setFlash("parallel-2", "+ 1 WORKSTREAM", "Wall refill 1.25× · soft drain");
      state.notableMoments.push({ quarter: state.quarter, timeMs: state.timeMs,
                                  description: "Tapped SPACE — 2 workstreams" });
    } else if (state.ballsLive === 3) {
      setFlash("parallel-3", "PARALLEL OVERLOAD", "Wall 1.45× · heavy drain · attacks ×");
      state.notableMoments.push({ quarter: state.quarter, timeMs: state.timeMs,
                                  description: "Tapped SPACE — 3 workstreams" });
    }
  };

  const onKeyDown = (e) => {
    if (state.locked) return;
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
    state.events.unshift({ score: state.breaks, text });
    if (state.events.length > 10) state.events.pop();
  };

  const setFlash = (kind, title, note) => {
    state.flash = { kind, title, note };
    state.flashUntil = performance.now() + 1500;
  };

  const applyPlayerBrick = applyPlayerBrickEffect;

  /* V4.7 §4 attack cascade spawn check — Safety-driven conditions. */
  const checkAttackSpawns = () => {
    const spawns = [];
    const tNow = state.timeMs;

    // Ball-count attack-skew multipliers
    let driftM, outageM, breachM, rogueM, hallM, revoltM;
    if (state.ballsLive === 1) {
      driftM = outageM = breachM = rogueM = hallM = revoltM = 1.0;
    } else if (state.ballsLive === 2) {
      driftM = 1.5;  outageM = 1.25; breachM = 1.0;
      rogueM = 1.25; hallM   = 1.5;  revoltM = 1.0;
    } else {
      driftM = 2.5;  outageM = 1.75; breachM = 1.0;
      rogueM = 1.75; hallM   = 2.5;  revoltM = 1.0;
    }

    // DRIFT: Safety < 30 for > 30s
    if (state.safety < 30 && state.safetyDegradedSince != null) {
      if (tNow - state.safetyDegradedSince > 30000) {
        if (Math.random() < 0.5 * driftM) {
          spawns.push("DRIFT");
          state.safetyDegradedSince = tNow;
        }
      }
    }

    // OUTAGE: 4+ Build streak OR (Safety < 20 probabilistic)
    if (state.buildStreak >= 4) {
      spawns.push("OUTAGE");
      state.buildStreak = 0;
    } else if (state.safety < 20 && Math.random() < 0.025 * outageM) {
      spawns.push("OUTAGE");
    }

    // BREACH: Friction < 25 + Safety < 30, OR 5+ incidents this quarter
    if (state.friction < 25 && state.safety < 30 && Math.random() < 0.04 * breachM) {
      spawns.push("BREACH");
    }
    if (state.incidentsThisQuarter >= 5 && Math.random() < 0.10 * breachM) {
      spawns.push("BREACH");
      state.incidentsThisQuarter = 0;
    }

    // ROGUE: Safety < 20 + Trust < 26 + Friction > 60
    if (state.safety < 20 && state.trust < 26 && state.friction > 60) {
      if (Math.random() < 0.04 * rogueM) spawns.push("ROGUE");
    }

    // HALLUCINATION: Safety < 40 + Trust < 26
    if (state.safety < 40 && state.trust < 26) {
      if (Math.random() < 0.025 * hallM) spawns.push("HALLUCINATION");
    }

    // REVOLT: Friction > 70 + Trust eroded > 60s
    if (state.friction > 70 && state.trust < 26 && state.trustErodedSince != null) {
      if (tNow - state.trustErodedSince > 60000) {
        if (Math.random() < 0.6 * revoltM) {
          spawns.push("REVOLT");
          state.trustErodedSince = tNow;
        }
      }
    }
    return spawns;
  };

  const spawnAttackBrick = (attackName) => {
    const alive = state.bricks.filter(b => b.alive);
    if (alive.length === 0) return;
    const target = alive[Math.floor(Math.random() * alive.length)];
    const def = ATTACK_BRICKS[attackName];
    if (!def) return;
    target.challenge = { id: attackName, label: def.label, isAttack: true };
    target.fadeInAt = performance.now();
    target.telegraphUntil = state.timeMs + 1000;
    state.lastAttackSpawnAt = state.timeMs;
    state.notableMoments.push({
      quarter: state.quarter, timeMs: state.timeMs,
      description: `${attackName} attack spawned`,
    });
    pushEvent(`⚠ ${attackName} on the wall`);
  };

  const spawnGhostBall = () => {
    state.ghostBalls.push({
      x: 40 + Math.random() * Math.max(40, W() - 80),
      y: H() / 3,
      vx: (Math.random() > 0.5 ? 1 : -1) * 3.2,
      vy: 3.2,
      r: 7,
      expireAt: state.timeMs + 6000,
    });
  };

  const applyAttack = (name) => {
    state.breaks += 1;
    state.attackBrickCounts[name] = (state.attackBrickCounts[name] || 0) + 1;
    const def = ATTACK_BRICKS[name];
    if (!def) return;

    if (state.incidentShields > 0) {
      state.incidentShields -= 1;
      setFlash("shield", "REDTEAM SHIELD", `${name} absorbed`);
      pushEvent(`REDTEAM shield absorbed ${name}`);
      return;
    }

    setFlash(name.toLowerCase(), def.flashTitle, def.flashNote);

    switch (name) {
      case "DRIFT":
        updateSafety(state, -5);
        updateTrust(state, -4);
        updateCapacity(state, -3);
        state.driftAnimUntil = state.timeMs + 6000;
        break;
      case "OUTAGE":
        updateSafety(state, -10);
        updateCapital(state, -5);
        updateCapacity(state, -8);
        state.ballSpeedMultiplier = Math.max(state.ballSpeedMultiplier, 1.20);
        state.ballSpeedUntil = state.timeMs + 10000;
        state.outageFlashUntil = state.timeMs + 200;
        break;
      case "BREACH":
        updateTrust(state, -30);
        updateFriction(state, +20);
        updateCapacity(state, -5);
        state.breachShakeUntil = state.timeMs + 600;
        break;
      case "ROGUE":
        updateSafety(state, -10);
        updateCapacity(state, -10);
        updateTrust(state, -5);
        state.rogueAnimUntil = state.timeMs + 5000;
        break;
      case "HALLUCINATION":
        updateSafety(state, -3);
        updateTrust(state, -5);
        updateCapacity(state, -3);
        spawnGhostBall();
        break;
      case "REVOLT":
        state.wallRefillExtraMultiplier = 1.5;
        state.wallRefillExtraUntil = state.timeMs + 60000;
        state.capacityDrainMultiplier = 2.0;
        state.capacityDrainUntil = state.timeMs + 60000;
        state.revoltAnimUntil = state.timeMs + 60000;
        break;
    }
  };

  // Phase 5 may extend this with crisis-narrowed pool.
  const getBrickPool = () => ["SHIP","SCALE","AUTOMATE","REVIEW","REDTEAM","GOVERN",
                              "PATCH","APOLOGIZE","REBUILD","TRAIN","HIRE","ALIGN"];

  const onBrickBreak = (brick) => {
    const def = brick.challenge || {};
    if (def.isAttack) {
      applyAttack(def.id || def.label);
      pushEvent(`⚠ ${def.label || def.id}`);
      return;
    }
    const name = def.id || def.label || "SHIP";
    applyPlayerBrick(state, name);
    pushEvent(name);
  };

  const finishRun = () => {
    state.status = "ended";
    state.runEnd = performance.now();
    state.endResult = {
      durationMs: state.runEnd - state.runStart,
      quarter: state.quarter,
      capital: state.capital,
      capacity: state.capacity,
      trust: state.trust,
      friction: state.friction,
      safety: state.safety,
      breaks: state.breaks,
      incidents: state.incidents,
      crisesEntered: state.crisesEntered,
      brickCounts: { ...state.brickCounts },
      attackBrickCounts: { ...state.attackBrickCounts },
      layerHistory: [...state.layerHistory],
      notableMoments: [...state.notableMoments],
      parallelTaps: state.parallelTaps,
      timeAt2Balls: state.timeAt2Balls,
      timeAt3Balls: state.timeAt3Balls,
      gameEndedEarly: state.gameEndedEarly,
      earlyEndReason: state.earlyEndReason,
    };
    state.balls = [];
    state.respawnAt = 0;
  };

  // Phase 4 replaces this with V4.7 uniform drop penalty + RESUMING banner.
  const onBallDrop = (now, ball) => {
    const remaining = state.balls.length - 1;
    if (remaining >= 1) {
      state.ballsLive = remaining;
      updateCapacity(state, -3);
      pushEvent(`Workstream ended — ${state.ballsLive} active`);
      return;
    }
    state.ballsLive = 1;
    state.incidents += 1;
    state.incidentsThisQuarter += 1;
    state.timeSinceLastIncident = 0;
    state.incidentMoments.push(state.timeMs);
    updateCapital(state, -3);
    updateCapacity(state, -8);
    updateTrust(state, -2);
    updateSafety(state, -2);
    pushEvent(`Incident #${state.incidents}`);
    state.respawnAt = now + 1500;
  };

  const tickDelayedEffects = () => {
    for (let i = state.delayedEffects.length - 1; i >= 0; i--) {
      const e = state.delayedEffects[i];
      if (state.timeMs >= e.fireAt) {
        if (e.layer === "trust") updateTrust(state, e.amount);
        else if (e.layer === "safety") updateSafety(state, e.amount);
        else if (e.layer === "capacity") updateCapacity(state, e.amount);
        else if (e.layer === "capital") updateCapital(state, e.amount);
        else if (e.layer === "friction") updateFriction(state, e.amount);
        state.delayedEffects.splice(i, 1);
      }
    }
  };

  /* ───────── Update ───────── */
  const update = () => {
    const now = performance.now();
    if (now < state.pauseUntil) return;
    state.timeMs = now - state.runStart;

    // Expire transient multipliers
    if (state.timeMs >= state.ballSpeedUntil) state.ballSpeedMultiplier = 1;
    if (state.timeMs >= state.wallRefillExtraUntil) state.wallRefillExtraMultiplier = 1;
    if (state.timeMs >= state.capacityDrainUntil) state.capacityDrainMultiplier = 1;

    tickDelayedEffects();

    // Paddle — Friction-throttled
    const p = state.paddle;
    const pSpeed = getPaddleSpeed(state);
    if (state.keys["ArrowLeft"]) p.x -= pSpeed;
    if (state.keys["ArrowRight"]) p.x += pSpeed;
    p.x = Math.max(0, Math.min(W() - p.w, p.x));

    // V4.7 §4 quarter transition — board review every 60s of game time
    if (state.timeMs >= state.nextQuarterAt) {
      const closingQ = state.quarter;
      state.layerHistory.push({
        quarter: closingQ, timeMs: state.timeMs,
        capital: state.capital, capacity: state.capacity,
        trust: state.trust, friction: state.friction, safety: state.safety,
        breaks: state.breaks, incidents: state.incidents, ballsLive: state.ballsLive,
      });
      state.notableMoments.push({ quarter: closingQ, timeMs: state.timeMs,
                                  description: `Q${closingQ} closed` });
      if (closingQ >= 4) {
        finishRun();
        return;
      }
      setFlash("board-review", `Q${closingQ} CLOSED — BOARD REVIEW`,
        `T ${Math.round(state.trust)} ${trustBand(state.trust)} · S ${Math.round(state.safety)} ${safetyBand(state.safety)}`);
      state.pauseUntil = now + 1500;
      state.incidentsThisQuarter = 0;
      state.quarter = closingQ + 1;
      state.nextQuarterAt = state.timeMs + QUARTER_LENGTH_MS;
      // Fresh wall on board review
      state.bricks.forEach((b, i) => {
        b.alive = true;
        b.challenge = pickBrickForWall();
        b.fadeInAt = now + i * 35;
        b.telegraphUntil = 0;
      });
      state.nextBrickRefillAt = now + 8000 + Math.random() * 4000;
    }

    // Crisis duration + terminal end at 30s
    if (state.crisisActive) {
      const last = state._lastCrisisTickTime != null ? state._lastCrisisTickTime : state.timeMs;
      state.crisisDurationMs += Math.max(0, state.timeMs - last);
      state._lastCrisisTickTime = state.timeMs;
      if (state.crisisDurationMs > CRISIS_TERMINAL_MS) {
        state.gameEndedEarly = true;
        state.earlyEndReason = "CRISIS_TERMINAL";
        finishRun();
        return;
      }
    } else {
      state.crisisDurationMs = 0;
      state._lastCrisisTickTime = state.timeMs;
    }

    // Wall refill — base + REVOLT + ball-count + Crisis slow
    if (now > state.nextBrickRefillAt) {
      refillBricks();
      const base = 8000 + Math.random() * 6000;
      const ballMult = state.ballsLive === 3 ? 1.45 : state.ballsLive === 2 ? 1.25 : 1.0;
      const crisisMult = state.crisisActive ? 0.5 : 1.0;   // Crisis SLOWS the wall
      state.nextBrickRefillAt = now + base / (state.wallRefillExtraMultiplier * ballMult * crisisMult);
    }

    // V4.7 §5 ball-count continuous drain + 2/3-ball time tracking
    if (state.timeMs >= state.nextBallCountDrainAt) {
      state.nextBallCountDrainAt = state.timeMs + 1000;
      if (state.ballsLive === 2) {
        updateCapital(state, -0.2 * 1);    // -0.2/s (rounded by clamp)
        updateCapacity(state, -0.4 * 1);
      } else if (state.ballsLive === 3) {
        updateCapital(state, -2);
        updateCapacity(state, -3);
      }
    }
    {
      const last = state._lastBallTrackTime != null ? state._lastBallTrackTime : state.timeMs;
      const dtMs = Math.max(0, state.timeMs - last);
      state._lastBallTrackTime = state.timeMs;
      if (state.ballsLive === 2) state.timeAt2Balls += dtMs;
      else if (state.ballsLive === 3) state.timeAt3Balls += dtMs;
    }

    // Passive ticks every 30s of game time (Phase 4 fully wires this; safe stub here)
    if (state.timeMs >= state.nextPassiveTickAt) {
      updateFriction(state, +1);
      if (state.friction > 70) updateTrust(state, -3);
      else if (state.friction > 50) updateTrust(state, -2);
      else if (state.trust > 30) updateTrust(state, -1);
      state.timeSinceLastIncident += 30000;
      if (state.timeSinceLastIncident >= 30000 && state.safety > 50) {
        updateCapacity(state, +2);
        if (!state.crisisActive) updateCapital(state, +2);
      }
      if (state.crisisActive) {
        updateCapital(state, -3);
        updateCapacity(state, -3 * (state.capacityDrainMultiplier || 1));
      }
      state.nextPassiveTickAt += 30000;
    }

    // V4.7 attack-spawn check (no-op until Phase 3 lights it up)
    if (state.timeMs >= state.nextAttackCheckAt) {
      state.nextAttackCheckAt = state.timeMs + 500;
      if (state.timeMs - state.lastAttackSpawnAt >= 5000) {
        const spawns = checkAttackSpawns();
        if (spawns.length > 0) spawnAttackBrick(spawns[0]);
      }
    }

    // Active animation flags (Phase 3 fills the corresponding *Until fields)
    const inDrift  = state.timeMs < state.driftAnimUntil;
    const inRogue  = state.timeMs < state.rogueAnimUntil;
    const inRevolt = state.timeMs < state.revoltAnimUntil;

    // Ball movement
    const ballMult = state.ballSpeedMultiplier;
    state.balls = state.balls.filter(b => {
      if (b.expireAt && now > b.expireAt) return false;

      if (inDrift)  b.vx += 0.013;
      if (inRogue) { b.vx += (Math.random() - 0.5) * 0.4; b.vy += (Math.random() - 0.5) * 0.4; }
      if (inRevolt) b.vx += 0.005;

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

    // HALLUCINATION ghost-balls (Phase 3 spawns them; harmless here)
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

    // BREACH shake (Phase 3 fills breachShakeUntil)
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

    // Bricks — V4.7 four-category visuals, attack bricks solid accent
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
      if (fadeT <= 0) return;
      ctx.globalAlpha = fadeT;

      const def = brick.challenge || {};
      const cat = def.category;
      const label = def.label || def.id || "";

      // 1s telegraph pulse for newly spawned attack bricks
      if (def.isAttack && brick.telegraphUntil && state.timeMs < brick.telegraphUntil) {
        const pulse = 0.55 + 0.45 * Math.sin(state.timeMs * 0.018);
        ctx.globalAlpha = fadeT * pulse;
      }

      if (def.isAttack) {
        ctx.fillStyle = accent;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = bg;
        ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "build") {
        ctx.fillStyle = accent;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = bg;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "defend") {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(brick.x + 0.6, brick.y + 0.6, brick.w - 1.2, brick.h - 1.2);
        ctx.fillStyle = accent;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else if (cat === "repair") {
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
        ctx.save();
        ctx.setLineDash([3, 2.5]);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        ctx.restore();
        ctx.fillStyle = accent;
        ctx.font = 'italic 500 9.5px "JetBrains Mono", ui-monospace, monospace';
      } else {
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

    // Balls — ROGUE jitter renders in accent
    const inRogueDraw = state.timeMs < state.rogueAnimUntil;
    state.balls.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = inRogueDraw ? accent : fg;
      ctx.fill();
    });

    // HALLUCINATION ghost balls — dashed accent stroke
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

    // REVOLT tint + diagonal lines
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

    // OUTAGE white flash
    if (state.timeMs < state.outageFlashUntil) {
      const t = (state.outageFlashUntil - state.timeMs) / 200;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.65 * t;
      ctx.fillRect(0, 0, W(), H());
      ctx.restore();
    }

    // V4.7 NO TEXT ON CANVAS — banners and HUD render in surrounding chrome.
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
        breaks: state.breaks,
        quarter: state.quarter,
        balls: state.balls.length,
        ballsLive: state.ballsLive,
        // V4.7 five layers
        capital: state.capital,
        capacity: state.capacity,
        trust: state.trust,
        friction: state.friction,
        safety: state.safety,
        maxCapital: state.maxCapital,
        maxCapacity: state.maxCapacity,
        crisisActive: state.crisisActive,
        crisisDurationMs: state.crisisDurationMs,
        incidents: state.incidents,
        events: [...state.events],
        status: state.status,
        flash: now < state.flashUntil ? state.flash : null,
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
        state.pauseUntil = Number.MAX_SAFE_INTEGER;
        state.keys = {};
      } else {
        state.pauseUntil = 0;
      }
    },
    getState: () => state,
    startGame, togglePause, restart, onSpace,
  };
}

/* ════════════════════════════════════════════════════════════════
   V4.7 Layer status bar — five cells in top strip (outside canvas)
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
  const sBand = safetyBand(hud.safety || 0);
  return (
    <div className="layer-status">
      <LayerCell label="CAPITAL"  value={hud.capital || 0}  max={hud.maxCapital || 100}
                 danger={(hud.capital || 0) <= 15 || hud.crisisActive} />
      <LayerCell label="CAPACITY" value={hud.capacity || 0} max={hud.maxCapacity || 100}
                 danger={(hud.capacity || 0) <= 15 || hud.crisisActive} />
      <LayerCell label="TRUST"    value={hud.trust || 0}    sub={tBand}
                 danger={tBand === "eroded"} />
      <LayerCell label="FRICTION" value={hud.friction || 0}
                 danger={(hud.friction || 0) > 70} />
      <LayerCell label="SAFETY"   value={hud.safety || 0}   sub={sBand}
                 danger={sBand === "unmitigated"} />
    </div>
  );
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/* Phase 1 placeholder end screen — Phase 7 ships the V4.7 verdict + trajectory + tradeoff. */
function EndScreen({ result, onRestart }) {
  if (!result) return null;
  return (
    <div className="game-overlay game-overlay-end">
      <div className="end-grid">
        <header className="handoff-header">
          <span className="overlay-eyebrow">— Handoff (Phase 1 placeholder) · {fmtDuration(result.durationMs)}</span>
          <h2 className="handoff-title">The <em>Handoff</em></h2>
        </header>
        <p className="verdict">
          Five layers wired. Bricks don't apply effects yet — Phase 2 hooks the 12 conditional bricks.
          Phase 5 wires Crisis consequences. Phase 7 ships the full verdict.
        </p>
        <div className="handoff-stats">
          <span className="stats-line">
            CAPITAL {Math.round(result.capital || 0)} · CAPACITY {Math.round(result.capacity || 0)} ·
            TRUST {Math.round(result.trust || 0)} {trustBand(result.trust || 0)} ·
            FRICTION {Math.round(result.friction || 0)} ·
            SAFETY {Math.round(result.safety || 0)} {safetyBand(result.safety || 0)}
          </span>
          <span className="stats-line">
            {result.breaks || 0} BREAKS · {result.incidents || 0} INCIDENTS · {result.crisesEntered || 0} CRISES
          </span>
        </div>
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
    breaks: 0, quarter: 1, balls: 0, ballsLive: 1,
    ...INITIAL_LAYERS,
    crisisActive: false,
    crisisDurationMs: 0,
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

  return (
    <main className="page-fade game-page">
      <div className="page">
        <header className="game-header">
          <div className="game-intro">
            <span className="eyebrow">An interactive metaphor — § Game</span>
            <h1 className="game-title">Deploy. <em>Continuously</em>.</h1>
            <p className="game-dek">
              You're operating a brand new AI deployment for four quarters. Five interdependent layers
              shift with each choice. What you hand off at Q4 is what you're judged on.
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
            {/* TOP STRIP — V4.7 NO TEXT ON CANVAS. All UI lives here. */}
            <div className="top-strip">
              <LayerStatus hud={hud} />
              <div className="top-strip-meta">
                <span className="meta-quarter">Q{hud.quarter || 1}/4</span>
                <span className="meta-stats">{hud.breaks || 0} breaks · {hud.incidents || 0} incidents</span>
              </div>
            </div>

            <div className="game-canvas-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} className="game-canvas" />
              {status === "ready" && (
                <div className="game-overlay game-overlay-start">
                  <span className="overlay-eyebrow">— Day 1 · Brand new deployment</span>
                  <h2>Press <em>spacebar</em> to deploy.</h2>
                  <p>← → paddle · P pause · R restart · SPACE again to stack workstreams</p>
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
            </div>

            {/* BOTTOM STRIP — flashes + crisis banner + resume status (outside canvas) */}
            <div className="bottom-strip">
              {hud.crisisActive && (
                <div className="strip-banner crisis-banner">DEPLOYMENT IN CRISIS — OPERATIONS SLOWED</div>
              )}
              {hud.resuming && (
                <div className="strip-banner resume-banner">RESUMING OPERATION…</div>
              )}
              {hud.flash && status !== "ended" && (
                <div className={"strip-flash flash-" + hud.flash.kind}>
                  <span className="flash-title">{hud.flash.title}</span>
                  {hud.flash.note && <span className="flash-note">{hud.flash.note}</span>}
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
            <p>The wall is not a level to be finished — it is a system to be operated. Every action ripples through Capital, Capacity, Trust, Friction, and Safety. The four quarters are your tenure. The state you hand off is the diagnosis.</p>
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

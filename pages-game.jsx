/* ════════════════════════════════════════════════════════════════
   Game V2.1 — Breakout, with the full AI value taxonomy
   12 win bricks across 5 value categories · 3 positive complications
   Point-budget balanced: ¯L ≈ 11, ¯W ≈ 15 at 60/40 wall composition.
   Exports: GamePage
   ════════════════════════════════════════════════════════════════ */

const { useState: useStateGame, useEffect: useEffectGame, useRef: useRefGame, useCallback: useCallbackGame } = React;

/* ───────── Challenge catalogue ───────── */
const CHALLENGES = [
  { id: "data-val",     kind: "problem", label: "Data validation failures", short: "DATA VAL",   effect: { reliability: -8 } },
  { id: "bias",         kind: "problem", label: "Bias outcomes",            short: "BIAS",       effect: { trust: -10, safety: -2 },                trigger: "bias" },
  { id: "outage",       kind: "problem", label: "Software outages",         short: "OUTAGE",     effect: { reliability: -12, trust: -4 },           trigger: "outage" },
  { id: "rogue",        kind: "problem", label: "Rogue AI agents",          short: "ROGUE",      effect: { safety: -10, trust: -6 },                trigger: "rogue" },
  { id: "org-resist",   kind: "problem", label: "Organizational resistance",short: "ORG",        effect: { speed: -6, trust: +2 } },
  { id: "governance",   kind: "problem", label: "Governance friction",      short: "GOV",        effect: { governance: +8, speed: -5, safety: +2 }, trigger: "governance" },
  { id: "security",     kind: "problem", label: "Security vulnerabilities", short: "SEC",        effect: { safety: -8, trust: -4 } },
  { id: "compliance",   kind: "problem", label: "Compliance reviews",       short: "COMPLY",     effect: { governance: +6, speed: -3 },             trigger: "compliance" },
  { id: "drift",        kind: "problem", label: "Model drift",              short: "DRIFT",      effect: { reliability: -6, trust: -3 },            trigger: "drift" },
  { id: "scaling",      kind: "problem", label: "Scaling bottlenecks",      short: "SCALE",      effect: { speed: -4, cost: +6 } },
  { id: "user-trust",   kind: "problem", label: "User trust issues",        short: "TRUST",      effect: { trust: -8 } },
  { id: "integration",  kind: "problem", label: "Integration failures",     short: "INTEG",      effect: { reliability: -6, cost: +4 } },
  { id: "cost",         kind: "problem", label: "Cost overruns",            short: "COST",       effect: { cost: +10, governance: -2 } },
  { id: "halluc",       kind: "problem", label: "Hallucinated outputs",     short: "HALL",       effect: { trust: -6, reliability: -3 },            trigger: "halluc" },
];

const WINS = [
  // Efficiency (3) — filled circle category mark
  { id: "auto",    kind: "win", category: "efficiency",  label: "Automation breakthrough",  short: "AUTO",    effect: { speed: +8, cost: -6 } },
  { id: "save",    kind: "win", category: "efficiency",  label: "Cost reduction",           short: "SAVE",    effect: { cost: -12, speed: +2 } },
  { id: "thru",    kind: "win", category: "efficiency",  label: "Throughput scaling",       short: "THRU",    effect: { speed: +10, reliability: +4 } },

  // Revenue & strategic (3) — filled square
  { id: "rev",     kind: "win", category: "revenue",     label: "New revenue stream",       short: "REV+",    effect: { trust: +6, speed: +4, cost: -4 } },
  { id: "market",  kind: "win", category: "revenue",     label: "Market expansion",         short: "MARKET",  effect: { trust: +8, speed: +5, cost: -3 } },
  { id: "moat",    kind: "win", category: "revenue",     label: "Competitive moat deepens", short: "MOAT",    effect: { trust: +6, reliability: +5, governance: +4 }, trigger: "moat" },

  // Decision quality (2) — filled triangle up
  { id: "fcst",    kind: "win", category: "decision",    label: "Forecasting improvement",  short: "FCST",    effect: { reliability: +8, trust: +5, cost: -2 } },
  { id: "insight", kind: "win", category: "decision",    label: "Insight surfaced",         short: "INSIGHT", effect: { reliability: +6, trust: +4, speed: +3 } },

  // Human & organizational (2) — filled triangle down
  { id: "uplift",  kind: "win", category: "human",       label: "Employee uplift",          short: "UPLIFT",  effect: { trust: +8, speed: +4, cost: -3 } },
  { id: "talent",  kind: "win", category: "human",       label: "Talent retained",          short: "TALENT",  effect: { trust: +7, reliability: +5, governance: +3 } },

  // Capability & innovation (2) — filled diamond
  { id: "capa",    kind: "win", category: "capability",  label: "Capability unlock",        short: "CAPA",    effect: { speed: +8, reliability: +4, cost: +5 }, trigger: "capability" },
  { id: "audit",   kind: "win", category: "capability",  label: "Successful audit",         short: "AUDIT",   effect: { governance: +8, trust: +6, safety: +4 }, trigger: "audit" },
];

const METER_KEYS = ["speed", "reliability", "governance", "safety", "cost", "trust"];
const NON_COST   = METER_KEYS.filter(k => k !== "cost");
const INITIAL_METERS = { speed: 0, reliability: 0, governance: 0, safety: 0, cost: 0, trust: 0 };

function pickRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickBrickChallenge() {
  // 60% problem / 40% win
  return Math.random() < 0.6
    ? CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
    : WINS[Math.floor(Math.random() * WINS.length)];
}

/* ───────── Archetypes (V2.2 — weighted scoring matrix) ───────── */

const WIN_CATEGORIES = {
  efficiency: ["auto", "save", "thru"],
  revenue:    ["rev", "market", "moat"],
  decision:   ["fcst", "insight"],
  human:      ["uplift", "talent"],
  capability: ["capa", "audit"],
};
const ALL_WIN_IDS = Object.values(WIN_CATEGORIES).flat();
const LOSS_IDS    = CHALLENGES.map(c => c.id);
const NEGATIVE_KINDS = ["outage", "bias", "rogue", "governance", "compliance", "drift", "halluc"];
const POSITIVE_KINDS = ["audit", "moat", "capability"];

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function buildVector(stats, brickCounts, complicationCounts, runDurationMs) {
  const { avg, peak, final, volatility } = stats;

  const speed_score       = clamp01(avg.speed       / 60);
  const governance_score  = clamp01(avg.governance  / 50);
  const safety_score      = clamp01(avg.safety      / 50);
  const trust_score       = clamp01(avg.trust       / 50);
  const reliability_score = clamp01(avg.reliability / 55);
  const cost_score        = clamp01(1 - (avg.cost   / 70));

  const meanVol = METER_KEYS.reduce((s, k) => s + (volatility[k] || 0), 0) / METER_KEYS.length;
  const volatility_score = clamp01(meanVol / 15);

  const peakMax  = Math.max(...NON_COST.map(k => peak[k]  || 0));
  const finalMin = Math.min(...NON_COST.map(k => final[k] || 0));
  const peakTroughGap = peakMax - finalMin;
  const gambler_score = clamp01(peakTroughGap / 60);

  const categoryCounts = {};
  Object.entries(WIN_CATEGORIES).forEach(([cat, ids]) => {
    categoryCounts[cat] = ids.reduce((s, id) => s + (brickCounts[id] || 0), 0);
  });
  const efficiency_bricks = clamp01(categoryCounts.efficiency / 4);
  const revenue_bricks    = clamp01(categoryCounts.revenue    / 4);
  const decision_bricks   = clamp01(categoryCounts.decision   / 4);
  const human_bricks      = clamp01(categoryCounts.human      / 4);
  const capability_bricks = clamp01(categoryCounts.capability / 4);

  const total_wins   = ALL_WIN_IDS.reduce((s, id) => s + (brickCounts[id] || 0), 0);
  const total_losses = LOSS_IDS.reduce((s, id) => s + (brickCounts[id] || 0), 0);
  const totalBroken = total_wins + total_losses;
  const win_focus = totalBroken > 0 ? clamp01(total_wins / totalBroken) : 0;

  const negative_complications = NEGATIVE_KINDS.reduce((s, k) => s + (complicationCounts[k] || 0), 0);
  const positive_complications = POSITIVE_KINDS.reduce((s, k) => s + (complicationCounts[k] || 0), 0);
  const chaos_score       = clamp01(negative_complications / 10);
  const compounding_score = clamp01(positive_complications / 4);

  const runSeconds = Math.max(0, runDurationMs / 1000);
  const tenure_score = clamp01(runSeconds / 360);

  return {
    speed_score, governance_score, safety_score, trust_score, reliability_score, cost_score,
    volatility_score, gambler_score,
    efficiency_bricks, revenue_bricks, decision_bricks, human_bricks, capability_bricks,
    win_focus, chaos_score, compounding_score, tenure_score,
    raw: {
      avg, peak, final, volatility,
      counts: categoryCounts,
      brickCounts,
      negative_complications, positive_complications,
      total_wins, total_losses,
      runSeconds,
      gambler_peak: peakMax,
      gambler_trough: finalMin,
      win_focus,
    },
  };
}

const ARCHETYPES = [
  {
    name: "The Cowboy",
    copy: "You shipped fast and let the rest fray. Tempo was your priority and governance was an afterthought. The wall caught up because oversight never did.",
    weights: [
      { sig: "speed_score",       w: 35 },
      { sig: "governance_score",  w: 25, inv: true },
      { sig: "safety_score",      w: 20, inv: true },
      { sig: "chaos_score",       w: 15 },
      { sig: "efficiency_bricks", w: 10 },
      { sig: "human_bricks",      w: -15 },
    ],
  },
  {
    name: "The Bureaucrat",
    copy: "Every decision went through review. The system was safe, slow, and expensive. Nothing exploded — but nothing moved either.",
    weights: [
      { sig: "governance_score",  w: 35 },
      { sig: "speed_score",       w: 25, inv: true },
      { sig: "cost_score",        w: 20, inv: true },
      { sig: "capability_bricks", w: 15 },
      { sig: "volatility_score",  w: 10, inv: true },
      { sig: "revenue_bricks",    w: -10 },
    ],
  },
  {
    name: "The Visionary",
    copy: "You chased the upside. Revenue, capability, market reach — every brick you broke was about what the deployment could do next, not what it had to clean up. Speed stayed high. The deployment was kinetic, ambitious, and a little exposed.",
    weights: [
      { sig: "revenue_bricks",    w: 30 },
      { sig: "capability_bricks", w: 25 },
      { sig: "speed_score",       w: 15 },
      { sig: "win_focus",         w: 15 },
      { sig: "compounding_score", w: 10 },
      { sig: "safety_score",      w: -5 },
    ],
  },
  {
    name: "The Steward",
    copy: "You ran the deployment for the people inside it and around it. Employee uplift, talent retention, earned audits — your meters tell the story of a system that treated its humans like the point, not the cost. Slower than some, more durable than most.",
    weights: [
      { sig: "human_bricks",      w: 35 },
      { sig: "trust_score",       w: 20 },
      { sig: "capability_bricks", w: 5  }, // capability_bricks × 0.5 × 10 = ×5
      { sig: "governance_score",  w: 10 },
      { sig: "chaos_score",       w: 10, inv: true },
      { sig: "cost_score",        w: 5,  inv: true },
    ],
  },
  {
    name: "The Trust Builder",
    copy: "You optimized for the humans on the other end of the system. Slower wall rebuilds, calmer incidents, durable goodwill. You paid for it in operational burn.",
    weights: [
      { sig: "trust_score",       w: 35 },
      { sig: "reliability_score", w: 20 },
      { sig: "human_bricks",      w: 20 },
      { sig: "compounding_score", w: 15 },
      { sig: "chaos_score",       w: 10, inv: true },
      { sig: "speed_score",       w: -10 },
    ],
  },
  {
    name: "The Engineer",
    copy: "You built a robust system. Reliability held. Drift and outages were handled cleanly. The deployment wasn't beloved, but it worked.",
    weights: [
      { sig: "reliability_score", w: 35 },
      { sig: "volatility_score",  w: 20, inv: true },
      { sig: "efficiency_bricks", w: 15 },
      { sig: "decision_bricks",   w: 15 },
      { sig: "safety_score",      w: 10 },
      { sig: "trust_score",       w: 5,  inv: true },
    ],
  },
  {
    name: "The Idealist",
    copy: "You ran the most responsible deployment in the building. Also the slowest and most expensive. The question of whether it was worth it is left to the reader.",
    weights: [
      { sig: "safety_score",      w: 25 },
      { sig: "governance_score",  w: 25 },
      { sig: "cost_score",        w: 20, inv: true },
      { sig: "speed_score",       w: 15, inv: true },
      { sig: "human_bricks",      w: 10 },
      { sig: "capability_bricks", w: 5  },
    ],
  },
  {
    name: "The Gambler",
    copy: "You bet the deployment on one dimension and let another collapse. Strategies like this either define a career or end one.",
    weights: [
      { sig: "gambler_score",     w: 50 },
      { sig: "volatility_score",  w: 20 },
      { sig: "chaos_score",       w: 15 },
      { sig: "tenure_score",      w: 15, inv: true },
    ],
  },
  {
    name: "The Firefighter",
    copy: "You operated reactively. Every brick was an emergency, every meter swung wildly. The deployment stayed alive but it never settled into shape.",
    weights: [
      { sig: "volatility_score",  w: 35 },
      { sig: "chaos_score",       w: 25 },
      { sig: "tenure_score",      w: 15 },
      { sig: "compounding_score", w: 15, inv: true },
      { sig: "human_bricks",      w: -10 },
    ],
  },
  {
    name: "The Pragmatist",
    copy: "You did not optimize anything. You did not break anything. You held the line. That is a real strategy too.",
    floor: 10,
    weights: [
      { sig: "volatility_score",  w: 25, inv: true },
      { sig: "gambler_score",     w: 20, inv: true },
      { sig: "chaos_score",       w: 15, inv: true },
      { sig: "tenure_score",      w: 15 },
      { sig: "win_focus",         w: 10, inv: true },
    ],
  },
];

function scoreArchetypes(vector) {
  return ARCHETYPES.map(a => {
    let score = a.floor || 0;
    const contributions = [];
    (a.weights || []).forEach(({ sig, w, inv }) => {
      const sv = vector[sig] || 0;
      const value = inv ? (1 - sv) : sv;
      const contrib = value * w;
      score += contrib;
      contributions.push({ sig, w, inv, value, contrib });
    });
    return {
      name: a.name,
      copy: a.copy,
      score: Math.max(0, Math.min(100, score)),
      contributions,
    };
  });
}

function signalDescription(sig, inv, vector) {
  const raw = vector.raw;
  const fmt = Math.round;
  switch (sig) {
    case "speed_score": return inv
      ? `you kept tempo low — speed averaged ${fmt(raw.avg.speed)}`
      : `you ran the deployment fast — speed averaged ${fmt(raw.avg.speed)}`;
    case "governance_score": return inv
      ? `you avoided heavy review — governance averaged ${fmt(raw.avg.governance)}`
      : `you leaned into oversight — governance averaged ${fmt(raw.avg.governance)}`;
    case "safety_score": return inv
      ? `you ran lean on safety — average ${fmt(raw.avg.safety)}`
      : `you kept safety high — average ${fmt(raw.avg.safety)}`;
    case "trust_score": return inv
      ? `trust never built — average ${fmt(raw.avg.trust)}`
      : `you built trust — average ${fmt(raw.avg.trust)}`;
    case "reliability_score": return inv
      ? `reliability stayed low — average ${fmt(raw.avg.reliability)}`
      : `you kept the system reliable — average ${fmt(raw.avg.reliability)}`;
    case "cost_score": return inv
      ? `cost ran high — average ${fmt(raw.avg.cost)}`
      : `you ran the deployment cheap — cost averaged ${fmt(raw.avg.cost)}`;
    case "volatility_score": return inv
      ? `your meters stayed steady`
      : `your meters swung wildly`;
    case "gambler_score":
      return `you pushed one meter to ${fmt(raw.gambler_peak)} while another sat at ${fmt(raw.gambler_trough)}`;
    case "efficiency_bricks": return `you broke ${raw.counts.efficiency || 0} efficiency bricks`;
    case "revenue_bricks":    return `you broke ${raw.counts.revenue    || 0} revenue & strategic bricks`;
    case "decision_bricks":   return `you broke ${raw.counts.decision   || 0} decision-quality bricks`;
    case "human_bricks": return inv
      ? `you broke only ${raw.counts.human || 0} human-side bricks`
      : `you broke ${raw.counts.human || 0} human & organizational bricks`;
    case "capability_bricks": return `you broke ${raw.counts.capability || 0} capability bricks`;
    case "win_focus": return inv
      ? `you accepted losses — ${fmt(raw.win_focus * 100)}% of breaks were wins`
      : `you chased wins — ${fmt(raw.win_focus * 100)}% of breaks were positive`;
    case "chaos_score": return inv
      ? `you contained complications — ${raw.negative_complications} negative event${raw.negative_complications === 1 ? "" : "s"} fired`
      : `complications kept firing — ${raw.negative_complications} negative event${raw.negative_complications === 1 ? "" : "s"}`;
    case "compounding_score": return inv
      ? `positive complications never stacked`
      : `positive complications compounded — ${raw.positive_complications} fired`;
    case "tenure_score": return inv
      ? `you washed out early — ${Math.floor(raw.runSeconds / 60)}m ${fmt(raw.runSeconds % 60).toString().padStart(2, "0")}s`
      : `you ran a long deployment — ${Math.floor(raw.runSeconds / 60)}m ${fmt(raw.runSeconds % 60).toString().padStart(2, "0")}s`;
    default: return null;
  }
}

function diagnose(stats, brickCounts, complicationCounts, runDurationMs) {
  const vector = buildVector(stats, brickCounts, complicationCounts, runDurationMs);
  const scored = scoreArchetypes(vector);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const runnerUp = sorted.slice(1, 3);
  const winnerPos = [...winner.contributions]
    .filter(c => c.contrib > 0)
    .sort((a, b) => b.contrib - a.contrib);
  const dominant = winnerPos[0];
  const dominantText = dominant ? signalDescription(dominant.sig, dominant.inv, vector) : null;
  return { winner, runnerUp, dominantText, vector, allScored: sorted };
}

function statsFromHistory(history, incidentMoments) {
  const out = { avg: {}, peak: {}, final: {}, volatility: {} };
  METER_KEYS.forEach(k => {
    const arr = history[k] || [];
    const values = arr.map(p => p.v);
    if (values.length === 0) {
      out.avg[k] = 0; out.peak[k] = 0; out.final[k] = 0; out.volatility[k] = 0;
      return;
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    out.avg[k] = mean;
    out.peak[k] = Math.max(...values);
    out.final[k] = values[values.length - 1];
    out.volatility[k] = Math.sqrt(variance);
  });
  return out;
}

/* ───────── Drop penalties (1st / 2nd ; 3rd ends run) ───────── */
const DROP_PENALTIES = [
  { effect: { trust: -5, cost: +3 },                   log: "Incident logged — operator dropped a problem" },
  { effect: { trust: -10, reliability: -5, cost: +5 }, log: "Pattern emerging — second incident this cycle" },
  { effect: {},                                        log: "Operational confidence lost" },
];

/* ════════════════════════════════════════════════════════════════
   Canvas engine
   ════════════════════════════════════════════════════════════════ */
function createGame(canvas, onHudSync) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = () => canvas.width / dpr;
  const H = () => canvas.height / dpr;

  const emptyHistory = () => {
    const h = {};
    METER_KEYS.forEach(k => h[k] = []);
    return h;
  };

  const state = {
    paddle: { x: 0, w: 120, h: 13, speed: 9 },
    balls: [],
    bricks: [],
    keys: {},
    score: 0,
    day: 1,
    status: "ready",          // ready | playing | paused | ended
    meters: { ...INITIAL_METERS },
    peaks:   { ...INITIAL_METERS },
    valleys: { ...INITIAL_METERS },
    events: [],
    flash: null,

    // Lives system
    livesUsed: 0,
    livesMax: 3,
    respawnAt: 0,            // when the next ball auto-deploys after a drop

    // Run tracking
    runStart: 0,
    runEnd: 0,
    history: emptyHistory(),
    brickCounts: {},
    complicationCounts: {},
    incidentMoments: [],
    endResult: null,

    // V3 behavioral signals (Phase 1)
    openingBricks: {},          // { brickId: count } for first 60s only
    openingComplications: {},   // { compKind: count } for first 60s only
    openingDrops: 0,            // ball drops in first 60s
    windowBricks: {},           // accumulator for current 30s window
    windowStartTime: 0,         // start ts of current window (absolute)
    dominantByWindow: [],       // category per finalized 30s window (may include null)
    incidentMeterStates: [],    // meter snapshot at each drop
    postDropBricks: [{}, {}, {}],
    postDropTotal: [0, 0, 0],
    complicationResponses: [],  // [{type,time,categoryBefore,droppedWithin10s,sameCategoryAfter,resolved}]
    lastBrickCategoryBeforeComp: null,

    // Time-based timers
    nextBrickRefillAt: 0,
    nextDayUpAt: 0,
    nextComplicationAt: 0,
    nextHudSync: 0,
    nextHistoryAt: 0,
    pauseUntil: 0,
    flashUntil: 0,
    biasUntil: 0,
    rogueUntil: 0,
    driftUntil: 0,
    govUntil: 0,
    auditUntil: 0,
    nextAuditTickAt: 0,
    moatUntil: 0,
    nextMoatTickAt: 0,
    capabilityUntil: 0,
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
          challenge: pickBrickChallenge(),
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
      b.challenge = pickBrickChallenge();
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
        challenge: pickBrickChallenge(),
        fadeInAt: now + c * (180 + Math.random() * 220),
      });
    }
  };

  /* ───────── Ball ───────── */
  const spawnBall = () => {
    const baseSpeed = 4.4 + state.day * 0.85 + (state.meters.speed - 50) * 0.04;
    const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2;
    state.balls.push({
      x: state.paddle.x + state.paddle.w / 2,
      y: H() - 38,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      r: 7,
      rogue: false,
      ghost: false,
      bornAt: performance.now(),
    });
  };

  /* ───────── Run lifecycle ───────── */
  const startGame = () => {
    state.status = "playing";
    state.score = 0;
    state.day = 1;
    state.meters = { ...INITIAL_METERS };
    state.peaks   = { ...INITIAL_METERS };
    state.valleys = { ...INITIAL_METERS };
    state.events = [];
    state.livesUsed = 0;
    state.respawnAt = 0;
    state.history = emptyHistory();
    state.brickCounts = {};
    state.complicationCounts = {};
    state.incidentMoments = [];
    state.endResult = null;
    // V3 behavioral resets
    state.openingBricks = {};
    state.openingComplications = {};
    state.openingDrops = 0;
    state.windowBricks = {};
    state.windowStartTime = 0;          // will be set to runStart below
    state.dominantByWindow = [];
    state.incidentMeterStates = [];
    state.postDropBricks = [{}, {}, {}];
    state.postDropTotal = [0, 0, 0];
    state.complicationResponses = [];
    state.lastBrickCategoryBeforeComp = null;
    state.paddle.speed = 9;
    initBricks();
    state.balls = [];
    spawnBall();
    const now = performance.now();
    state.runStart = now;
    state.runEnd = 0;
    state.windowStartTime = now;
    state.nextBrickRefillAt = now + 9000 + Math.random() * 4000;
    state.nextDayUpAt = now + 22000;
    state.nextComplicationAt = now + 12000;
    state.nextHistoryAt = now;
    state.flash = null;
    state.flashUntil = 0;
    state.biasUntil = 0; state.rogueUntil = 0; state.driftUntil = 0;
    state.govUntil = 0; state.auditUntil = 0;
    state.moatUntil = 0; state.nextMoatTickAt = 0;
    state.capabilityUntil = 0;
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
  const applyEffect = (effect) => {
    Object.entries(effect).forEach(([k, v]) => {
      const next = Math.max(0, Math.min(100, (state.meters[k] || 0) + v));
      state.meters[k] = next;
      state.peaks[k]   = Math.max(state.peaks[k] || 0, next);
      state.valleys[k] = Math.min(state.valleys[k] || 0, next);
    });
  };

  const pushEvent = (text) => {
    state.events.unshift({ score: state.score, text });
    if (state.events.length > 10) state.events.pop();
  };

  const setFlash = (kind, title, note) => {
    state.flash = { kind, title, note };
    state.flashUntil = performance.now() + 1500;
  };

  const countComplication = (kind) => {
    state.complicationCounts[kind] = (state.complicationCounts[kind] || 0) + 1;
  };

  const triggerEffect = (kind) => {
    const now = performance.now();
    if (kind === "outage") {
      state.pauseUntil = now + 700;
      setFlash("outage", "OUTAGE", "Reliability hit — service down");
      applyEffect({ cost: +3 });
    } else if (kind === "bias") {
      state.biasUntil = now + 5000;
      setFlash("bias", "BIAS DETECTED", "Trajectories skewing");
    } else if (kind === "rogue") {
      state.balls.forEach(b => { b.rogue = true; });
      state.rogueUntil = now + 5000;
      setFlash("rogue", "ROGUE AGENT", "Unpredictable behaviour");
    } else if (kind === "governance") {
      state.govUntil = now + 4000;
      setFlash("governance", "GOV REVIEW", "Slowing — safety boosted");
      applyEffect({ safety: +5 });
    } else if (kind === "compliance") {
      state.pauseUntil = now + 900;
      setFlash("compliance", "COMPLIANCE REVIEW", "Mandatory pause");
    } else if (kind === "drift") {
      state.driftUntil = now + 6000;
      setFlash("drift", "MODEL DRIFT", "Trajectories curving");
    } else if (kind === "halluc") {
      const baseSpeed = 4 + state.day * 0.5;
      state.balls.push({
        x: 40 + Math.random() * (W() - 80),
        y: H() / 3,
        vx: (Math.random() > 0.5 ? 1 : -1) * baseSpeed * 0.6,
        vy: baseSpeed * 0.6,
        r: 6,
        rogue: true,
        ghost: true,
        bornAt: now,
        expireAt: now + 6000,
      });
      setFlash("halluc", "HALLUCINATION", "Phantom output spawned");
    } else if (kind === "audit") {
      state.auditUntil = now + 3000;
      state.nextAuditTickAt = now + 1000;
      setFlash("audit", "AUDIT PASSED", "Confidence rebuilding");
    } else if (kind === "moat") {
      state.moatUntil = now + 4000;
      state.nextMoatTickAt = now + 1000;
      setFlash("moat", "MOAT DEEPENS", "Competitive cushion holding");
    } else if (kind === "capability") {
      state.capabilityUntil = now + 5000;
      setFlash("capability", "CAPABILITY ONLINE", "Throughput ×1.15 · score ×2");
    }
    countComplication(kind);

    // ── V3 behavioral tracking ──
    const elapsedMs = now - state.runStart;
    if (elapsedMs <= 60000) {
      state.openingComplications[kind] = (state.openingComplications[kind] || 0) + 1;
    }
    state.complicationResponses.push({
      type: kind,
      time: now,
      categoryBefore: state.lastBrickCategoryBeforeComp,
      droppedWithin10s: false,
      sameCategoryAfter: null,
      resolved: false,
    });
    // ── end V3 tracking ──
  };

  const onBrickBreak = (brick) => {
    const now = performance.now();
    const mult = now < state.capabilityUntil ? 2 : 1;
    state.score += 3 * mult;
    applyEffect(brick.challenge.effect);
    pushEvent(brick.challenge.label);
    state.brickCounts[brick.challenge.id] = (state.brickCounts[brick.challenge.id] || 0) + 1;

    // ── V3 behavioral tracking ──
    const elapsedMs = now - state.runStart;
    const brickId = brick.challenge.id;
    const category = brick.challenge.category || 'loss';

    // Opening signature
    if (elapsedMs <= 60000) {
      state.openingBricks[brickId] = (state.openingBricks[brickId] || 0) + 1;
    }

    // 30s sliding window: finalize when window age >= 30s, then start new
    if (now - state.windowStartTime >= 30000) {
      let max = 0, dom = null;
      for (const cat in state.windowBricks) {
        if (state.windowBricks[cat] > max) { max = state.windowBricks[cat]; dom = cat; }
      }
      state.dominantByWindow.push(dom);
      state.windowBricks = {};
      state.windowStartTime = now;
    }
    state.windowBricks[category] = (state.windowBricks[category] || 0) + 1;

    // Post-drop tracking (within 30s of each incident, by absolute time)
    for (let i = 0; i < state.incidentMoments.length && i < 3; i++) {
      const incidentTimeAbs = state.runStart + state.incidentMoments[i];
      if (now > incidentTimeAbs && now - incidentTimeAbs <= 30000) {
        state.postDropBricks[i][category] = (state.postDropBricks[i][category] || 0) + 1;
        state.postDropTotal[i]++;
      }
    }

    // Resolve any complication-response entries within 10s
    for (const resp of state.complicationResponses) {
      if (!resp.resolved && now - resp.time <= 10000) {
        resp.sameCategoryAfter = (category === resp.categoryBefore);
        resp.resolved = true;
      }
    }

    // Set composure context for a complication that may fire from this brick's trigger
    state.lastBrickCategoryBeforeComp = category;
    // ── end V3 tracking ──

    if (brick.challenge.trigger) triggerEffect(brick.challenge.trigger);
  };

  const finishRun = () => {
    state.status = "ended";
    state.runEnd = performance.now();
    const stats = statsFromHistory(state.history, state.incidentMoments);
    const durationMs = state.runEnd - state.runStart;
    const diagnosis = diagnose(stats, state.brickCounts, state.complicationCounts, durationMs);
    state.endResult = {
      stats,
      archetype: diagnosis.winner,
      alsoLeaning: diagnosis.runnerUp,
      dominantText: diagnosis.dominantText,
      durationMs,
      day: state.day,
      score: state.score,
      brickCounts: { ...state.brickCounts },
      complicationCounts: { ...state.complicationCounts },
      history: { ...state.history },
      incidentMoments: [...state.incidentMoments],
    };
    state.balls = [];
    state.respawnAt = 0;

    // ── V3 Phase 1 verification — dev log of behavioral telemetry ──
    if (typeof console !== "undefined") {
      console.log("[V3 telemetry]", {
        openingBricks: state.openingBricks,
        openingComplications: state.openingComplications,
        openingDrops: state.openingDrops,
        dominantByWindow: state.dominantByWindow,
        postDropBricks: state.postDropBricks,
        postDropTotal: state.postDropTotal,
        complicationResponses: state.complicationResponses,
        incidentMeterStates: state.incidentMeterStates,
        lastBrickCategoryBeforeComp: state.lastBrickCategoryBeforeComp,
      });
    }
  };

  const onBallDrop = (now) => {
    const penalty = DROP_PENALTIES[state.livesUsed];
    if (penalty && penalty.effect) applyEffect(penalty.effect);
    pushEvent(penalty.log);
    state.incidentMoments.push(now - state.runStart);

    // ── V3 behavioral tracking ──
    const elapsedMs = now - state.runStart;
    if (elapsedMs <= 60000) state.openingDrops++;
    state.incidentMeterStates.push({ ...state.meters });
    for (const resp of state.complicationResponses) {
      if (!resp.resolved && now - resp.time <= 10000) {
        resp.droppedWithin10s = true;
      }
    }
    // ── end V3 tracking ──

    state.livesUsed++;
    if (state.livesUsed >= state.livesMax) {
      finishRun();
    } else {
      state.respawnAt = now + 1500;
    }
  };

  /* ───────── Update ───────── */
  const update = () => {
    const now = performance.now();
    if (now < state.pauseUntil) return;

    // Paddle input
    const p = state.paddle;
    let pSpeed = p.speed;
    if (now < state.govUntil) pSpeed *= 0.6;
    if (now < state.capabilityUntil) pSpeed *= 1.15;
    if (state.keys["ArrowLeft"]) p.x -= pSpeed;
    if (state.keys["ArrowRight"]) p.x += pSpeed;
    p.x = Math.max(0, Math.min(W() - p.w, p.x));

    // Day-up
    if (now > state.nextDayUpAt) {
      state.day++;
      state.nextDayUpAt = now + 22000;
      if (state.day % 2 === 0) spawnBall();
      if (state.day >= 3 && state.day % 2 === 1) addNewRow();
      state.balls.forEach(b => {
        if (b.ghost) return;
        b.vx *= 1.10;
        b.vy *= 1.10;
      });
      state.paddle.speed = 9 + state.day * 0.18;
      pushEvent(`Day ${state.day} begins — pace increases`);
    }

    // Wall refill (Moat event slows refills ×1.5 while active)
    if (now > state.nextBrickRefillAt) {
      refillBricks();
      const trustFactor = 0.7 + (state.meters.trust / 100) * 0.6;
      const moatFactor  = now < state.moatUntil ? 1.5 : 1.0;
      const base = 8000 + Math.random() * 6000;
      state.nextBrickRefillAt = now + base * trustFactor * moatFactor;
    }

    // Complications (random negative triggers; audit only from brick break)
    if (now > state.nextComplicationAt) {
      const triggers = ["outage","bias","rogue","governance","compliance","drift","halluc"];
      if (Math.random() < Math.min(0.85, 0.35 + state.day * 0.08)) {
        triggerEffect(pickRand(triggers));
      }
      state.nextComplicationAt = now + 8000 + Math.random() * 8000;
    }

    // Audit tick — +1 trust each second during audit window
    if (now < state.auditUntil && now > state.nextAuditTickAt) {
      applyEffect({ trust: +1 });
      state.nextAuditTickAt = now + 1000;
    }

    // Moat tick — +0.5 trust per second during moat window (rounded to +1 each 2s for clean ints)
    if (now < state.moatUntil && now > state.nextMoatTickAt) {
      applyEffect({ trust: +1 });
      state.nextMoatTickAt = now + 2000;
    }

    // Cost drift
    if (state.score > 0 && Math.random() < 0.005) {
      applyEffect({ cost: +1 });
    }

    // Update balls
    let speedMult = 1;
    if (now < state.govUntil) speedMult *= 0.65;
    if (now < state.capabilityUntil) speedMult *= 1.15;
    state.balls = state.balls.filter(b => {
      if (b.expireAt && now > b.expireAt) return false;

      if (b.rogue && now < state.rogueUntil) {
        b.vx += (Math.random() - 0.5) * 0.7;
        b.vy += (Math.random() - 0.5) * 0.5;
      }
      if (now < state.biasUntil)  b.vx += 0.04;
      if (now < state.driftUntil) b.vx += 0.025;

      const sp = Math.hypot(b.vx, b.vy);
      const maxSp = 5.0 + state.day * 1.05 + state.meters.speed * 0.05;
      const minSp = 3.0 + state.day * 0.35;
      if (sp > maxSp) { b.vx = (b.vx / sp) * maxSp; b.vy = (b.vy / sp) * maxSp; }
      if (sp < minSp) { b.vx = (b.vx / Math.max(sp, 0.01)) * minSp; b.vy = (b.vy / Math.max(sp, 0.01)) * minSp; }

      b.x += b.vx * speedMult;
      b.y += b.vy * speedMult;

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
        if (!b.ghost) {
          onBallDrop(now);
        }
        return false;
      }

      if (!b.ghost) {
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
      }

      return true;
    });

    // Ball respawn after held-breath
    if (state.status === "playing" && state.respawnAt > 0 && now >= state.respawnAt) {
      const real = state.balls.filter(b => !b.ghost).length;
      if (real === 0) {
        spawnBall();
        state.respawnAt = 0;
      }
    }

    // Sample meter history every 500ms
    if (now > state.nextHistoryAt) {
      state.nextHistoryAt = now + 500;
      const t = now - state.runStart;
      METER_KEYS.forEach(k => {
        state.history[k].push({ t, v: state.meters[k] });
        if (state.history[k].length > 1200) state.history[k].shift();
      });
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
    const inBias  = now < state.biasUntil;
    const inGov   = now < state.govUntil;
    const inRogue = now < state.rogueUntil;
    const inAudit = now < state.auditUntil;
    const inMoat  = now < state.moatUntil;
    const inCapa  = now < state.capabilityUntil;

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

      const isWin = brick.challenge.kind === "win";
      const isTrigger = !!brick.challenge.trigger;

      if (isWin) {
        // Inverted: ink fill, light label, accent hairline border
        ctx.fillStyle = fg;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.globalAlpha = fadeT * 0.5;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        ctx.globalAlpha = fadeT;
        // Trigger dot (top-right) for win bricks that fire complications
        if (isTrigger) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(brick.x + brick.w - 6, brick.y + 6, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        // Category mark (top-left) — 3px shape in accent at 50% opacity
        ctx.save();
        ctx.globalAlpha = fadeT * 0.5;
        ctx.fillStyle = accent;
        const mx = brick.x + 6, my = brick.y + 6;
        const cat = brick.challenge.category;
        if (cat === "efficiency") {
          ctx.beginPath();
          ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (cat === "revenue") {
          ctx.fillRect(mx - 2, my - 2, 4, 4);
        } else if (cat === "decision") {
          ctx.beginPath();
          ctx.moveTo(mx, my - 2.4);
          ctx.lineTo(mx + 2.4, my + 2);
          ctx.lineTo(mx - 2.4, my + 2);
          ctx.closePath();
          ctx.fill();
        } else if (cat === "human") {
          ctx.beginPath();
          ctx.moveTo(mx, my + 2.4);
          ctx.lineTo(mx + 2.4, my - 2);
          ctx.lineTo(mx - 2.4, my - 2);
          ctx.closePath();
          ctx.fill();
        } else if (cat === "capability") {
          ctx.beginPath();
          ctx.moveTo(mx, my - 2.6);
          ctx.lineTo(mx + 2.6, my);
          ctx.lineTo(mx, my + 2.6);
          ctx.lineTo(mx - 2.6, my);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = fadeT;
        ctx.fillStyle = bg;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brick.challenge.short, brick.x + brick.w / 2, brick.y + brick.h / 2);
      } else {
        ctx.fillStyle = isTrigger ? bg3 : bg2;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.strokeStyle = isTrigger ? fg3 : line;
        ctx.lineWidth = 1;
        ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);
        if (isTrigger) {
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(brick.x + brick.w - 6, brick.y + 6, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = fg2;
        ctx.font = '500 9.5px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(brick.challenge.short, brick.x + brick.w / 2, brick.y + brick.h / 2);
      }
      ctx.globalAlpha = 1;
    });

    // Paddle
    const p = state.paddle;
    const py = H() - 26;
    ctx.fillStyle = fg;
    ctx.fillRect(p.x, py, p.w, p.h);
    ctx.fillStyle = accent;
    ctx.fillRect(p.x, py, p.w, 2);

    // Balls
    state.balls.forEach(b => {
      // Capability shimmer — accent ring at slightly larger radius behind the ball
      if (inCapa && !b.ghost) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      if (b.ghost) {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (b.rogue && inRogue) {
        ctx.fillStyle = accent;
        ctx.fill();
      } else {
        ctx.fillStyle = fg;
        ctx.fill();
      }
    });

    // Bias overlay
    if (inBias) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.06;
      ctx.fillRect(0, 0, W(), H());
      ctx.globalAlpha = 1;
    }
    // Governance scan-lines
    if (inGov) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 0.5;
      for (let y = 0; y < H(); y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W(), y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Audit warm tint
    if (inAudit) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.07;
      ctx.fillRect(0, 0, W(), H());
      ctx.globalAlpha = 1;
    }
    // Moat vignette — soft accent frame around the canvas edges
    if (inMoat) {
      const cx = W() / 2, cy = H() / 2;
      const inner = Math.min(W(), H()) * 0.25;
      const outer = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, accent);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W(), H());
      ctx.globalAlpha = 1;
    }

    // Footer text strip
    ctx.fillStyle = fg3;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`DAY ${String(state.day).padStart(2,"0")}  ·  CLEARED ${String(state.score).padStart(3,"0")}  ·  BALLS ${state.balls.filter(b=>!b.ghost).length}`, 10, H() - 8);

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
        day: state.day,
        balls: state.balls.filter(b => !b.ghost).length,
        meters: { ...state.meters },
        peaks:   { ...state.peaks },
        valleys: { ...state.valleys },
        events: [...state.events],
        status: state.status,
        flash: now < state.flashUntil ? state.flash : null,
        livesUsed: state.livesUsed,
        livesMax: state.livesMax,
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
   Meter (session-relative tone)
   ════════════════════════════════════════════════════════════════ */
function Meter({ label, value, peak, valley, inverted = false, sub }) {
  const v = Math.max(0, Math.min(100, value));
  let tone = "good";
  if (inverted) {
    // Cost: danger if current > valley + 40
    if (v > (valley + 40)) tone = "bad";
  } else {
    // Danger if current < peak * 0.4 AND peak > 25
    if (peak > 25 && v < peak * 0.4) tone = "bad";
  }
  return (
    <div className={"meter meter-" + tone}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{Math.round(v)}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: v + "%" }}></div>
      </div>
      {sub && <div className="meter-sub">{sub}</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   End screen — archetype diagnosis
   ════════════════════════════════════════════════════════════════ */
function Sparkline({ data, runDuration, incidents, label, final, inverted }) {
  const W = 220, H = 64, PAD = 6;
  const xs = t => PAD + (Math.max(0, Math.min(runDuration, t)) / Math.max(runDuration, 1)) * (W - PAD * 2);
  const ys = v => H - PAD - (Math.max(0, Math.min(100, v)) / 100) * (H - PAD * 2);
  const pts = (data || []).map(d => `${xs(d.t).toFixed(1)},${ys(d.v).toFixed(1)}`).join(' ');
  return (
    <div className="end-spark">
      <svg viewBox={`0 0 ${W} ${H}`} className="end-spark-svg" preserveAspectRatio="none">
        {/* 50-line gridline */}
        <line x1={0} y1={H/2} x2={W} y2={H/2} className="spark-grid" />
        {/* incident markers */}
        {(incidents || []).map((t, i) => (
          <line key={i} x1={xs(t)} y1={PAD-2} x2={xs(t)} y2={H-PAD+2} className="spark-incident" />
        ))}
        {/* line */}
        {pts && <polyline points={pts} className="spark-line" />}
      </svg>
      <div className="end-spark-foot">
        <span className="end-spark-label">{label}</span>
        <span className="end-spark-final">{Math.round(final || 0)}</span>
      </div>
    </div>
  );
}

function lookupChallenge(id) {
  return [...CHALLENGES, ...WINS].find(c => c.id === id);
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function EndScreen({ result, onRestart }) {
  if (!result) return null;
  const { archetype, stats, durationMs, day, score, brickCounts, complicationCounts, history, incidentMoments } = result;
  const runDuration = Math.max(durationMs, 1);

  const sortedBricks = Object.entries(brickCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ challenge: lookupChallenge(id), count }))
    .filter(x => x.challenge);

  const sortedComps = Object.entries(complicationCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count }));

  const totalBricks = Object.values(brickCounts).reduce((s, n) => s + n, 0);

  const meterLabels = {
    speed: "Speed", reliability: "Reliability", governance: "Governance",
    safety: "Safety", cost: "Cost", trust: "Trust",
  };

  return (
    <div className="game-overlay game-overlay-end">
      <div className="end-grid">
        {/* Section 1: Archetype */}
        <section className="end-archetype">
          <span className="overlay-eyebrow">— Diagnosis</span>
          <h2 className="end-arch-name">{archetype.name}</h2>
          <p className="end-arch-copy">{archetype.copy}</p>
          {result.alsoLeaning && result.alsoLeaning.length > 0 && (
            <div className="end-leaning">
              Also leaning — {result.alsoLeaning.map(a => a.name.replace(/^The /, "")).join(", ")}
            </div>
          )}
          {result.dominantText && (
            <div className="end-dominant">
              The clearest signal — <em>{result.dominantText}</em>.
            </div>
          )}
        </section>

        {/* Section 2: Sparklines */}
        <section className="end-sparklines">
          {METER_KEYS.map(k => (
            <Sparkline
              key={k}
              data={history[k]}
              runDuration={runDuration}
              incidents={incidentMoments}
              label={meterLabels[k]}
              final={stats.final[k]}
              inverted={k === "cost"}
            />
          ))}
        </section>

        {/* Section 3: Operational record */}
        <section className="end-record">
          <div className="end-record-col">
            <div className="end-record-head">Top problems broken</div>
            <div className="end-record-list">
              {sortedBricks.length === 0 && <div className="end-record-empty">—</div>}
              {sortedBricks.map((x, i) => (
                <div key={i} className="end-record-row">
                  <span className="rr-label">{x.challenge.short}</span>
                  <span className="rr-count">{x.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="end-record-col">
            <div className="end-record-head">Complications fired</div>
            <div className="end-record-list">
              {sortedComps.length === 0 && <div className="end-record-empty">—</div>}
              {sortedComps.map((x, i) => (
                <div key={i} className="end-record-row">
                  <span className="rr-label">{x.id.toUpperCase()}</span>
                  <span className="rr-count">{x.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="end-record-summary">
            <div className="ers-cell"><span className="k">Bricks broken</span><span className="v">{totalBricks}</span></div>
            <div className="ers-cell"><span className="k">Run duration</span><span className="v">{fmtDuration(durationMs)}</span></div>
            <div className="ers-cell"><span className="k">Final day</span><span className="v">Day {String(day).padStart(2, "0")}</span></div>
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
    score: 0, day: 1, balls: 0,
    meters:  { ...INITIAL_METERS },
    peaks:   { ...INITIAL_METERS },
    valleys: { ...INITIAL_METERS },
    events: [],
    status: "ready",
    flash: null,
    livesUsed: 0,
    livesMax: 3,
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

  const m = hud.meters, peaks = hud.peaks, valleys = hud.valleys;
  const status = hud.status;

  const statusLabel = {
    ready: "Ready", playing: "Live", paused: "Paused", ended: "Diagnosis",
  }[status] || "Ready";

  return (
    <main className="page-fade game-page">
      <div className="page">
        <header className="game-header">
          <div className="game-intro">
            <span className="eyebrow">An interactive metaphor — § Game</span>
            <h1 className="game-title">Deploy. <em>Continuously</em>.</h1>
            <p className="game-dek">
              Breakout, with AI-deployment problems and wins. Each brick shifts the system around it. The wall keeps coming back — because deployment isn't a moment, it's a state. You get three incidents.
            </p>
          </div>
          <div className="game-controls">
            <div className="ctrl-row"><span className="key">SPACE</span><span className="meaning">Deploy</span></div>
            <div className="ctrl-row"><span className="key">← →</span><span className="meaning">Move paddle</span></div>
            <div className="ctrl-row"><span className="key">P</span><span className="meaning">Pause</span></div>
            <div className="ctrl-row"><span className="key">R</span><span className="meaning">Restart</span></div>
          </div>
        </header>

        <div className="game-shell">
          <aside className="game-meters">
            <div className="meters-head">
              <span className="eyebrow">§ Trade-offs</span>
              <span className="meters-sub">Each break shifts the system.</span>
            </div>
            <Meter label="Speed"        value={m.speed}        peak={peaks.speed}        valley={valleys.speed}        sub="Higher = faster pace" />
            <Meter label="Reliability"  value={m.reliability}  peak={peaks.reliability}  valley={valleys.reliability}  sub="Outages, drift, integration" />
            <Meter label="Governance"   value={m.governance}   peak={peaks.governance}   valley={valleys.governance}   sub="Slows tempo, lifts safety" />
            <Meter label="Safety"       value={m.safety}       peak={peaks.safety}       valley={valleys.safety}       sub="Operational headroom" />
            <Meter label="Cost"         value={m.cost}         peak={peaks.cost}         valley={valleys.cost}         inverted sub="Lower is better" />
            <Meter label="User Trust"   value={m.trust}        peak={peaks.trust}        valley={valleys.trust}        sub="Low trust = faster wall rebuild" />
          </aside>

          <div className="game-board">
            <div className="game-stats">
              <div className="game-stat"><span className="k">Day</span><span className="v">{String(hud.day).padStart(2,"0")}</span></div>
              <div className="game-stat"><span className="k">Cleared</span><span className="v">{String(hud.score).padStart(3,"0")}</span></div>
              <div className="game-stat"><span className="k">Balls</span><span className="v">{hud.balls}</span></div>
              <div className="game-stat"><span className="k">Incidents</span><span className="v">{hud.livesUsed} / {hud.livesMax}</span></div>
              <div className="game-stat"><span className="k">Status</span><span className="v">{statusLabel}</span></div>
            </div>
            <div className="game-canvas-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} className="game-canvas" />
              {status === "ready" && (
                <div className="game-overlay game-overlay-start">
                  <span className="overlay-eyebrow">— Day 1</span>
                  <h2>Press <em>spacebar</em> to deploy.</h2>
                  <p>← → paddle · P pause · R restart</p>
                  <p className="overlay-fine">Three incidents per run. Wins and problems mix in the wall. Bricks marked with a blue dot trigger events when broken.</p>
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
            <p>The wall is not a level to be finished — it is a system to be operated. Every brick you break adds another somewhere else. The trade-offs ratchet. After three incidents, the game describes the operator you turned out to be.</p>
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

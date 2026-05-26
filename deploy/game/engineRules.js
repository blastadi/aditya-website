/* ════════════════════════════════════════════════════════════════
   DEPLOY · game/engineRules.js
   Theme-driven engine. Owns game state, applies brick effects,
   evaluates events, manages the quarter clock, runs the archetype
   resolver. Phaser scene drives time via tick(); React UI listens.

   Canonical reference: DEPLOY_sim_full.py — when behaviour diverges
   from the Python sim, the Python is correct.

   Event-bus contract: see §5.1 of DEPLOY_BUILD_BRIEF.md.
   ════════════════════════════════════════════════════════════════ */

(function () {
  if (window.engineRules && window.engineRules.__deploy3) return; // hot-reload guard

  // ────────────────── constants ──────────────────
  const QUARTER_MS         = 60_000;
  const EVENT_FORESHADOW_S = 5;
  const EVENT_FIRE_S       = 50; // brief §5.5 rule 4: events fire ~50s into quarter
  const Q4_FORCED_CHOICE_S = 30; // brief §5.2 — triggered 30s into Q4

  // Crisis Events (Crisis Catalog §1)
  const CRISIS_COOLDOWN_MS         = 10_000; // 10s minimum between crises
  const CRISIS_QUARTER_START_MIN_S = 5;      // crisis cannot start in first 5s of quarter
  const CRISIS_QUARTER_END_BUFFER_S = 5;     // crisis must finish ≥5s before quarter event (50s) → ends by 45s
  const CRISIS_Q4_END_BY_S         = 25;     // Q4: crisis must finish before forced choice opens (30s)

  // ────────────────── tiny utils ──────────────────
  const clamp   = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
  const sumVals = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

  function sample(arr, n) {
    // Fisher-Yates partial — matches Python random.sample()
    const a = arr.slice();
    const out = [];
    const take = Math.min(n, a.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i));
      [a[i], a[j]] = [a[j], a[i]];
      out.push(a[i]);
    }
    return out;
  }

  // ────────────────── trigger DSL ──────────────────
  // Grammar: expr  = orExpr
  //          orExpr  = andExpr (' OR ' andExpr)*
  //          andExpr = atom    (' AND ' atom)*
  //          atom    = identifier_bool | ident op value
  //          op      = >= | <= | == | != | > | <
  //          value   = number | identifier
  // Whitespace between tokens; no parens (we never need them in spec).
  function evalTrigger(expr, ctx) {
    if (!expr) return false;
    const s = String(expr).trim();
    if (s === "always") return true;
    if (s === "never")  return false;

    return s.split(/\s+OR\s+/).some((orPart) =>
      orPart.split(/\s+AND\s+/).every((atom) => evalAtom(atom.trim(), ctx))
    );
  }

  function evalAtom(atom, ctx) {
    if (!atom) return false;
    if (atom === "always") return true;
    if (atom === "never")  return false;

    // boolean identifier (computed flag or event:NAME)
    if (atom.startsWith("event:")) {
      return ctx.eventsHistory.includes(atom.slice(6));
    }
    if (atom in ctx.bools) return !!ctx.bools[atom];

    // comparison
    const m = atom.match(/^(\S+)\s*(>=|<=|==|!=|>|<)\s*(\S+)$/);
    if (!m) {
      console.warn("[engineRules] unparseable atom:", atom);
      return false;
    }
    const [, lhs, op, rhs] = m;
    const l = resolveValue(lhs, ctx);
    const r = resolveValue(rhs, ctx);
    switch (op) {
      case ">":  return l >  r;
      case "<":  return l <  r;
      case ">=": return l >= r;
      case "<=": return l <= r;
      case "==": return l === r;
      case "!=": return l !== r;
    }
    return false;
  }

  function resolveValue(tok, ctx) {
    const n = parseFloat(tok);
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(tok)) return n;
    if (tok in ctx.derived) return ctx.derived[tok];
    if (tok in ctx.state)   return ctx.state[tok];
    if (tok in ctx.bools)   return ctx.bools[tok] ? 1 : 0;
    console.warn("[engineRules] unknown identifier:", tok);
    return 0;
  }

  // ────────────────── crisis library + proxy resolver ──────────────────
  let _crisisLibrary = null;

  function resolveProxy(g, key) {
    if (key === "lives" || key === "contested_regulator") return key;
    const map = (g.theme && g.theme.crisis_meter_map) || {};
    return map[key] || key;
  }
  function resolveEffectsProxy(g, effects) {
    if (!effects) return {};
    const out = {};
    for (const [k, v] of Object.entries(effects)) {
      const real = resolveProxy(g, k);
      out[real] = (out[real] || 0) + v;
    }
    return out;
  }

  // ────────────────── crisis + opportunity schedule (pre-game) ──────────────────
  function scheduleCrisesForGame(g) {
    if (!_crisisLibrary || !g.theme.crisis_pool || g.theme.crisis_pool.length === 0) return [];
    const cpq = g.theme.crises_per_quarter || { 1: 1, 2: 1, 3: 2, 4: 1 };
    const crisisPool       = g.theme.crisis_pool.slice();
    const opportunityPool  = (g.theme.opportunity_pool || []).slice();
    const opportunitiesPer = Number(g.theme.opportunities_per_game || 0);
    const cooldownS        = CRISIS_COOLDOWN_MS / 1000;
    const schedule         = [];

    // Crisis draw (with repeats if pool < total picks)
    let crisisRemaining = shuffle(crisisPool.slice());
    const drawCrisis = () => {
      if (crisisRemaining.length === 0) crisisRemaining = shuffle(crisisPool.slice());
      return crisisRemaining.pop();
    };

    // Pre-pick opportunity (placed after crises so we can honor cooldown)
    let oppPick = null;
    let oppQuarter = null;
    if (opportunitiesPer > 0 && opportunityPool.length > 0) {
      const oppId = shuffle(opportunityPool.slice())[0];
      const oppDef = _crisisLibrary.opportunities && _crisisLibrary.opportunities[oppId];
      if (oppDef) {
        oppQuarter = Math.random() < 0.5 ? 2 : 3;
        oppPick = { id: oppId, def: oppDef, duration: oppDef.duration_seconds || 4 };
      }
    }

    // For each quarter, pre-pick crises + optionally the opportunity, then lay them
    // out in time, respecting cooldowns and quarter end-by limits.
    for (const q of [1, 2, 3, 4]) {
      const count = Number(cpq[q] || cpq[String(q)] || 0);
      const endBy = (q === 4 ? CRISIS_Q4_END_BY_S : EVENT_FIRE_S - CRISIS_QUARTER_END_BUFFER_S);

      // Build the picks list — crises plus opportunity if in this quarter.
      const picks = [];
      for (let i = 0; i < count; i++) {
        const id = drawCrisis();
        const def = id && _crisisLibrary.crises[id];
        if (!def) continue;
        picks.push({ id, def, duration: def.duration_seconds || 4, kind: "crisis" });
      }
      if (oppPick && oppQuarter === q) {
        // Insert opportunity at a random position among picks for variety
        const insertAt = Math.floor(Math.random() * (picks.length + 1));
        picks.splice(insertAt, 0, { id: oppPick.id, def: oppPick.def, duration: oppPick.duration, kind: "opportunity" });
      }
      if (picks.length === 0) continue;

      // Lay them out: each one's `latest = endBy − duration_i − tail`.
      let earliest = CRISIS_QUARTER_START_MIN_S;
      for (let i = 0; i < picks.length; i++) {
        const p = picks[i];
        const tailNeeded = picks.slice(i + 1)
          .reduce((acc, q) => acc + q.duration + cooldownS, 0);
        const latest = endBy - p.duration - tailNeeded;
        if (latest < earliest) continue;
        const startS = earliest + Math.random() * (latest - earliest);
        schedule.push({
          id: p.id, quarter: q,
          kind: p.kind,                    // "crisis" | "opportunity"
          startMs: Math.round(startS * 1000),
          durationMs: p.duration * 1000,
          _fired: false, _resolved: null,
        });
        earliest = startS + p.duration + cooldownS;
      }
    }

    return schedule;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ────────────────── crisis lifecycle (per-tick) ──────────────────
  function tickCrisisScheduler(g, dtMs) {
    if (!_crisisLibrary) return;

    // 1. If a crisis is active, advance it.
    if (g.currentCrisis) {
      const c = g.currentCrisis;
      c.elapsedMs += dtMs;

      // Drain the target meter in real time
      if (c.drainConcreteMeter && c.drainConcreteMeter in g.meters) {
        const drainAmt = (c.def.drain_rate_per_sec || 0) * (dtMs / 1000);
        const before = g.meters[c.drainConcreteMeter];
        g.meters[c.drainConcreteMeter] = clamp(before - drainAmt);
        c.proxyDrainTotal += drainAmt;
        // Emit only on integer changes so HUD doesn't thrash
        if (Math.floor(before) !== Math.floor(g.meters[c.drainConcreteMeter])) {
          window.eventBus.emit("meter:update", {
            meter: c.drainConcreteMeter,
            delta: -drainAmt,
            newValue: g.meters[c.drainConcreteMeter],
            source: "crisis:" + c.id + ":drain",
          });
        }
      }

      const allBroken = c.responseBricks.every((b) => b.broken);
      if (allBroken) {
        _resolveCrisis(g, true);
      } else if (c.elapsedMs >= c.durationMs) {
        _resolveCrisis(g, false);
      }
      return;
    }

    // 2. No active crisis. Check the schedule for one whose start time has passed.
    if (g.totalElapsedMs < g.crisisCooldownUntil) return;
    const sched = g.crisisLog.scheduled;
    for (const item of sched) {
      if (item._fired || item.quarter !== g.quarter) continue;
      if (g.elapsedMs < item.startMs) continue;
      // Don't start one if we're already past the safe-end-by line.
      const endByS = (g.quarter === 4 ? CRISIS_Q4_END_BY_S : EVENT_FIRE_S - CRISIS_QUARTER_END_BUFFER_S);
      if ((g.elapsedMs + item.durationMs) / 1000 > endByS) {
        item._fired = true;
        item._resolved = "skipped";
        continue;
      }
      _fireEvent(g, item);
      break;
    }
  }

  function _fireEvent(g, item) {
    const isOpportunity = item.kind === "opportunity";
    const lib = isOpportunity ? _crisisLibrary.opportunities : _crisisLibrary.crises;
    const def = lib && lib[item.id];
    if (!def) return;
    item._fired = true;

    const drainConcrete = def.drain_meter ? resolveProxy(g, def.drain_meter) : null;
    const responseBricks = (def.response_bricks || []).map((b, i) => ({
      idx: i, id: b.id, label: b.label, color_hint: b.color_hint, broken: false,
    }));

    g.currentCrisis = {
      id: item.id, def,
      kind: isOpportunity ? "opportunity" : "crisis",
      elapsedMs: 0,
      durationMs: item.durationMs,
      startedAtTotalMs: g.totalElapsedMs,
      drainConcreteMeter: drainConcrete,
      responseBricks,
      proxyDrainTotal: 0,
    };
    if (!isOpportunity) g.crisisLog.fired.push(item.id);

    window.eventBus.emit("crisis:start", {
      id: item.id,
      kind: isOpportunity ? "opportunity" : "crisis",
      label: def.label,
      severity: isOpportunity ? "opportunity" : (def.severity || "moderate"),
      durationMs: item.durationMs,
      drainMeter: drainConcrete,
      drainRatePerSec: def.drain_rate_per_sec || 0,
      physicsSignatures: def.physics_signatures || [],
      responseBricks,
      warningText: def.warning_text || def.label,
    });
    window.eventBus.emit("feed:add", {
      text: (isOpportunity ? "✨ " : "⚠ ") + (def.warning_text || def.label),
      severity: isOpportunity ? "positive" : "warning",
    });
  }

  function _resolveCrisis(g, success) {
    const c = g.currentCrisis;
    if (!c) return;
    const def = c.def;
    const isOpportunity = c.kind === "opportunity";

    // Opportunities use success_effect vs missed_effect (no failure_effect concept).
    const effects = success
      ? def.success_effect
      : (isOpportunity ? def.missed_effect : def.failure_effect);
    const livesBefore = g.lives;
    applyEffects(
      g,
      resolveEffectsProxy(g, effects),
      (isOpportunity ? "opportunity:" : "crisis:") + c.id + ":" + (success ? "success" : (isOpportunity ? "missed" : "failure"))
    );
    if (g.lives < livesBefore) {
      g.crisisLog.livesLostToCrises += (livesBefore - g.lives);
    }
    if (!isOpportunity) {
      if (success) g.crisisLog.resolved.push(c.id);
      else         g.crisisLog.failed.push(c.id);
    }

    const responseTimeMs = c.elapsedMs;
    const bricksBroken = c.responseBricks.filter((b) => b.broken).length;
    g.crisisLog.responseBricksBroken += bricksBroken;
    // Mark the schedule entry
    const sched = g.crisisLog.scheduled.find((s) => s.id === c.id && s._resolved == null);
    if (sched) sched._resolved = success ? "success" : (isOpportunity ? "missed" : "failure");

    window.eventBus.emit("crisis:resolve", {
      id: c.id, kind: c.kind, label: def.label, success,
      responseTimeMs, bricksBroken,
      bricksTotal: c.responseBricks.length,
      meterDrained: Math.round(c.proxyDrainTotal),
    });
    const feedSeverity = success ? "positive" : (isOpportunity ? "neutral" : "critical");
    const verbSym = success ? "✓ " : (isOpportunity ? "○ " : "✗ ");
    const tailTxt = success
      ? (def.success_feed_text || "resolved")
      : (isOpportunity ? (def.missed_feed_text || "window closed") : (def.failure_feed_text || "not contained"));
    window.eventBus.emit("feed:add", {
      text: verbSym + def.label + " — " + tailTxt,
      severity: feedSeverity,
    });

    g.currentCrisis = null;
    g.crisisCooldownUntil = g.totalElapsedMs + CRISIS_COOLDOWN_MS;
  }

  // ────────────────── derived context for trigger eval ──────────────────
  // Generic per-category derivations so themes 2-5 work without engine forks.
  function buildEvalCtx(g) {
    const total = sumVals(g.brickCounts);
    const pct  = (k) => (total > 0 ? (g.brickCounts[k] || 0) / total : 0);
    const cnt  = (k) => g.brickCounts[k] || 0;
    const qCnt = (q, k) => (g.brickCountsPerQuarter[q] || {})[k] || 0;
    const qSum = (q)    => sumVals(g.brickCountsPerQuarter[q] || {});

    // Discover all categories present in the theme (data-driven).
    const cats = Object.keys((g.theme && g.theme.categories) || g.brickCounts);

    const derived = {};
    // Generic per-category derivations
    for (const c of cats) {
      derived[c + "_pct"]   = pct(c);
      derived[c + "_count"] = cnt(c);
      derived["q_" + c]     = qCnt(g.quarter, c);
      // Per-quarter pct and count for q1..q4 (historic shifts)
      for (const q of [1, 2, 3, 4]) {
        const qt = qSum(q);
        derived["q" + q + "_" + c + "_pct"]   = qt > 0 ? qCnt(q, c) / qt : 0;
        derived["q" + q + "_" + c + "_count"] = qCnt(q, c);
      }
    }
    // Cross-category derived signals used by Compliance Officer (Env) and
    // any theme that wants to detect a defensive shift mid-year.
    const defShift23 =
      (derived["q2_def_pct"] > derived["q1_def_pct"] + 0.15) ||
      (derived["q3_def_pct"] > derived["q1_def_pct"] + 0.15);

    // Trust & Framing derived gap (user_perception - actual_performance).
    if ("user_perception" in g.meters && "actual_performance" in g.meters) {
      const gap = g.meters.user_perception - g.meters.actual_performance;
      derived.gap     = gap;
      derived.abs_gap = Math.abs(gap);
    }
    // Paradox derived gap (auto - aug)
    if ("auto" in g.meters && "aug" in g.meters) {
      const gap = g.meters.auto - g.meters.aug;
      derived.auto_aug_gap = gap;
      derived.auto_aug_abs_gap = Math.abs(gap);
    }

    // Crisis-derived fields (catalog §7 — crisis archetype triggers reference these)
    const fired    = g.crisisLog ? g.crisisLog.fired.length    : 0;
    const resolved = g.crisisLog ? g.crisisLog.resolved.length : 0;
    derived.crisis_response_rate = fired > 0 ? resolved / fired : 0;
    derived.crises_fired         = fired;
    // strategic_pct: share of bricks broken in categories the theme calls "strategic"
    const stratCats = (g.theme && g.theme.strategic_categories) || [];
    const stratCount = stratCats.reduce((acc, c) => acc + (g.brickCounts[c] || 0), 0);
    derived.strategic_pct = total > 0 ? stratCount / total : 0;

    // Per-theme event family for "had_incident_or_drift" / similar flags.
    // Themes list their incident-class event IDs in theme.incident_event_ids.
    const incidentIds = (g.theme && g.theme.incident_event_ids) || [
      "Q1_INCIDENT", "Q2_DRIFT_AGG", "Q2_DRIFT_DEF", "Q2_DRIFT_MIX",
      "Q3_INCIDENT", "Q3_REG_BAD", "Q3_REG_OK"
    ];
    const hadIncident = g.eventsHistory.some((e) => incidentIds.includes(e));

    // Revealed flags (Inheritance discovery bricks etc.) become booleans
    // accessible as `revealed_<flag>` in triggers.
    const bools = {
      contested_regulator:   g.contestedRegulator,
      def_shift_2_or_3:      defShift23,
      had_incident_or_drift: hadIncident,
    };
    for (const f of g.revealedFlags || []) {
      bools["revealed_" + f] = true;
    }

    return {
      state: {
        ...g.meters,
        lives: g.lives,
        lives_lost: g.livesLost,
        lives_lost_to_crises: g.crisisLog ? g.crisisLog.livesLostToCrises : 0,
        quarter: g.quarter,
        total_bricks: total,
      },
      derived,
      bools,
      eventsHistory: g.eventsHistory,
    };
  }

  // ────────────────── effects application ──────────────────
  function applyEffects(g, effects, source) {
    if (!effects) return;
    const updates = [];
    for (const [k, v] of Object.entries(effects)) {
      if (k === "lives") {
        const before = g.lives;
        g.lives = Math.max(0, g.lives + v);
        g.livesLost = Math.max(g.livesLost, 3 - g.lives);
        if (g.lives < before) {
          window.eventBus.emit("life:lost", { remaining: g.lives, source });
        }
      } else if (k === "contested_regulator") {
        g.contestedRegulator = !!v;
      } else if (k in g.meters) {
        const before = g.meters[k];
        g.meters[k] = clamp(g.meters[k] + v);
        updates.push({ meter: k, delta: g.meters[k] - before, newValue: g.meters[k] });
      } else {
        console.warn("[engineRules] unknown effect key:", k);
      }
    }
    for (const u of updates) {
      window.eventBus.emit("meter:update", { ...u, source });
    }
  }

  // ────────────────── wall generation ──────────────────
  // Generic: honours quarter_walls.exclude_categories (always exclude),
  // recovery_unlock_trigger (Q3 reveal of recovery brick), and
  // opmod_unlock_trigger / per-category unlocks (e.g. SP operating-model).
  function buildWallForQuarter(g, q) {
    const theme = g.theme;
    const wallSpec = theme.quarter_walls[String(q)] || theme.quarter_walls[q];
    if (!wallSpec) return [];
    const ctx = buildEvalCtx(g);

    // Start from full pool; always exclude recovery by default.
    let candidates = theme.bricks.filter((b) => b.category !== "rec");

    // Theme-level / quarter-level category exclusions
    const exclude = new Set(wallSpec.exclude_categories || []);
    if (exclude.size > 0) {
      candidates = candidates.filter((b) => !exclude.has(b.category));
    }

    // Per-category unlock triggers (e.g. SP opmod requires coherence + capability)
    // Categories NOT in unlocks pass through; categories in unlocks pass only if their trigger evaluates true.
    const unlocks = wallSpec.category_unlock_triggers || {};
    // Strategic Posture single-key form: "opmod_unlock_trigger"
    if (wallSpec.opmod_unlock_trigger) unlocks.opmod = wallSpec.opmod_unlock_trigger;
    for (const [cat, trig] of Object.entries(unlocks)) {
      if (!evalTrigger(trig, ctx)) {
        candidates = candidates.filter((b) => b.category !== cat);
      }
    }

    // Recovery brick — only included if its unlock trigger fires (typically Q3 only).
    const recovery = theme.bricks.filter((b) => b.category === "rec");
    if (recovery.length > 0 && wallSpec.include_recovery && wallSpec.recovery_unlock_trigger) {
      if (evalTrigger(wallSpec.recovery_unlock_trigger, ctx)) {
        candidates.push(...recovery);
      }
    }

    return sample(candidates, wallSpec.size).map((b) => ({
      ...b,
      hitsTaken: 0,
    }));
  }

  // ────────────────── event firing ──────────────────
  function pickEventForQuarter(g, q) {
    const list = (g.theme.events && (g.theme.events[String(q)] || g.theme.events[q])) || [];
    const ctx = buildEvalCtx(g);
    for (const ev of list) {
      if (evalTrigger(ev.trigger, ctx)) return ev;
    }
    return null;
  }

  function scheduleQuarterEvent(g, q) {
    g.scheduledEvent = { quarter: q, foreshadowed: false, fired: false, event: null };
  }

  function tickQuarterEvent(g, secondsIntoQuarter) {
    const sched = g.scheduledEvent;
    if (!sched || sched.quarter !== g.quarter) return;

    // Foreshadow at T - foreshadow_seconds (default 5s)
    if (!sched.foreshadowed && secondsIntoQuarter >= EVENT_FIRE_S - EVENT_FORESHADOW_S) {
      const ev = pickEventForQuarter(g, g.quarter);
      sched.event = ev;
      sched.foreshadowed = true;
      if (ev) {
        window.eventBus.emit("event:foreshadow", {
          event: ev.id,
          quarter: g.quarter,
          secondsUntil: EVENT_FORESHADOW_S,
          severity: ev.severity,
          label: ev.label,
        });
        window.eventBus.emit("feed:add", {
          text: "▲ Foreshadow: " + (ev.label || ev.id),
          severity: "warning",
        });
      }
    }
    // Fire at T = 50s
    if (!sched.fired && secondsIntoQuarter >= EVENT_FIRE_S) {
      // re-evaluate at fire-time (state may have changed in last 5s)
      const ev = pickEventForQuarter(g, g.quarter) || sched.event;
      sched.fired = true;
      if (ev) {
        g.eventsHistory.push(ev.id);
        applyEffects(g, ev.effects, ev.id);
        window.eventBus.emit("event:fire", {
          event: ev.id,
          quarter: g.quarter,
          severity: ev.severity,
          label: ev.label,
          text: ev.text,
          effects: ev.effects,
        });
        window.eventBus.emit("feed:add", {
          text: ev.label + " — " + (ev.text || ""),
          severity: ev.severity || "neutral",
        });
      }
    }
  }

  // ────────────────── quarter wrap (BIZ_CRED, BC_COLLAPSE) ──────────────────
  function applyQuarterWrapRules(g) {
    // BIZ_CRED — perf < 25 for 2 consecutive quarters
    if (g.meters.perf < 25) g.lowPerfStreak += 1;
    else g.lowPerfStreak = 0;

    if (g.lowPerfStreak >= 2) {
      const rule = (g.theme.quarter_wrap_rules || []).find((r) => r.id === "BIZ_CRED");
      if (rule) {
        applyEffects(g, rule.effects, rule.id);
        g.eventsHistory.push(rule.id);
        window.eventBus.emit("event:fire", { event: rule.id, severity: rule.severity, label: rule.label, text: rule.text, effects: rule.effects });
        window.eventBus.emit("feed:add", { text: (rule.label || rule.id) + " — " + (rule.text || ""), severity: rule.severity || "critical" });
      }
      g.lowPerfStreak = 0;
    }

    // BC_COLLAPSE — board_conf < 15
    if (g.meters.board_conf < 15) {
      const rule = (g.theme.quarter_wrap_rules || []).find((r) => r.id === "BC_COLLAPSE");
      if (rule) {
        applyEffects(g, rule.effects, rule.id);
        g.eventsHistory.push(rule.id);
        window.eventBus.emit("event:fire", { event: rule.id, severity: rule.severity, label: rule.label, text: rule.text, effects: rule.effects });
        window.eventBus.emit("feed:add", { text: (rule.label || rule.id) + " — " + (rule.text || ""), severity: rule.severity || "critical" });
      }
    }
  }

  // ────────────────── archetype resolution ──────────────────
  // Crisis archetypes from crisis_library.shared_archetypes are merged in
  // and sorted with theme archetypes by trigger_priority ascending. Negative
  // priorities (catalog §7: −3 / −2 / −1) check before all theme archetypes.
  function determineArchetype(g) {
    const sharedCrisis = (_crisisLibrary && _crisisLibrary.shared_archetypes) || [];
    const archs = (g.theme.archetypes || []).concat(sharedCrisis).slice().sort(
      (a, b) => (a.trigger_priority || 0) - (b.trigger_priority || 0)
    );
    const ctx = buildEvalCtx(g);
    for (const a of archs) {
      if (evalTrigger(a.trigger, ctx)) return a;
    }
    // Fallback should never happen if the theme has a `trigger: always`
    return archs[archs.length - 1] || null;
  }

  // ────────────────── public API ──────────────────
  window.engineRules = {
    __deploy3: true,

    /** Game state — readonly externally; engine mutates internally. */
    g: null,

    /** Compile theme JSON into a game-ready state object. */
    loadTheme(themeJson) {
      const theme = themeJson;
      const meters = {};
      for (const m of theme.meters) meters[m.id] = m.start;

      // Brick counts initialised dynamically from theme categories
      // (themes 2-5 use auto/aug/hyb, disc/tech/pol/op, comm/perf/calib/etc).
      const brickCounts = {};
      for (const c of Object.keys(theme.categories || {})) brickCounts[c] = 0;

      this.g = {
        themeId: theme.id,
        theme,
        phase: "READY",         // 'READY' | 'PLAYING' | 'QUARTER_TRANSITION' | 'Q4_CHOICE_OPEN' | 'GAME_END'
        quarter: 0,             // bumped to 1 on startGame
        elapsedMs: 0,           // ms into current quarter
        totalElapsedMs: 0,      // monotonic across quarters (for grace period + cooldowns)
        speed: 1.0,             // ball-speed multiplier for current quarter
        meters,
        lives: theme.lives_start || 3,
        livesLost: 0,
        brickCounts,
        brickCountsPerQuarter: { 1:{}, 2:{}, 3:{}, 4:{} },
        eventsHistory: [],
        contestedRegulator: false,
        lowPerfStreak: 0,
        scheduledEvent: null,
        q4ChoiceOpened: false,
        q4Choice: null,
        q4Backfired: false,
        archetype: null,
        wallForQuarter: { 1: null, 2: null, 3: null, 4: null },
        revealedFlags: new Set(),   // Inheritance discovery flags + similar
        // Crisis Events state (catalog §10)
        crisisLog: {
          scheduled: [],            // [{ id, quarter, startMs, _fired, _resolved }]
          fired: [],                // crisis IDs that triggered
          resolved: [],             // crisis IDs successfully resolved
          failed: [],               // crisis IDs that timer-expired
          livesLostToCrises: 0,
          responseBricksBroken: 0,  // informational across all crises
        },
        currentCrisis: null,        // active crisis or null
        crisisCooldownUntil: 0,     // totalElapsedMs floor before next crisis can spawn
      };

      window.eventBus.emit("theme:loaded", { themeId: theme.id, theme });
      // Prime HUD with initial meter values
      for (const m of theme.meters) {
        window.eventBus.emit("meter:update", { meter: m.id, delta: 0, newValue: m.start, source: "theme:loaded" });
      }
      return this.g;
    },

    /** Inject the shared crisis library (loaded once at app startup). */
    setCrisisLibrary(lib) {
      _crisisLibrary = lib || null;
    },

    /** Begin the game: enter Q1. Builds the crisis schedule first. */
    startGame() {
      if (!this.g) { console.warn("[engineRules] startGame before loadTheme"); return; }
      this.g.phase = "PLAYING";
      this.g.crisisLog.scheduled = scheduleCrisesForGame(this.g);
      window.eventBus.emit("crisis:schedule", { schedule: this.g.crisisLog.scheduled.slice() });
      this._enterQuarter(1);
    },

    /** Called by PlayScene when the player breaks a response brick (idx ∈ 0..n-1). */
    onResponseBrickBroken(brickIdx) {
      const g = this.g;
      if (!g || !g.currentCrisis) return false;
      const rb = g.currentCrisis.responseBricks[brickIdx];
      if (!rb || rb.broken) return false;
      rb.broken = true;
      window.eventBus.emit("crisis:response-broken", {
        crisisId: g.currentCrisis.id,
        brickIdx, label: rb.label,
        bricksBroken: g.currentCrisis.responseBricks.filter((b) => b.broken).length,
        bricksTotal:  g.currentCrisis.responseBricks.length,
      });
      // Resolution check happens in tick(); don't double-fire here.
      return true;
    },

    _enterQuarter(q) {
      const g = this.g;
      g.quarter = q;
      g.elapsedMs = 0;
      const ramp = g.theme.ball_speed_ramp || [1, 1, 1, 1];
      g.speed = ramp[q - 1] || 1;
      g.wallForQuarter[q] = buildWallForQuarter(g, q);
      scheduleQuarterEvent(g, q);
      window.eventBus.emit("quarter:start", {
        q,
        wall: g.wallForQuarter[q],
        speed: g.speed,
      });
      window.eventBus.emit("feed:add", {
        text: "Q" + q + " — quarter open · " + g.wallForQuarter[q].length + " bricks · speed " + g.speed.toFixed(2) + "×",
        severity: "neutral",
      });
    },

    /** Called by Phaser scene every frame with elapsed ms since last tick. */
    tick(dtMs) {
      const g = this.g;
      if (!g || g.phase !== "PLAYING") return;

      g.elapsedMs += dtMs;
      g.totalElapsedMs += dtMs;
      const sec = g.elapsedMs / 1000;

      tickQuarterEvent(g, sec);
      tickCrisisScheduler(g, dtMs);

      // Q4 forced choice trigger
      if (g.quarter === 4 && !g.q4ChoiceOpened && sec >= Q4_FORCED_CHOICE_S) {
        g.q4ChoiceOpened = true;
        g.phase = "Q4_CHOICE_OPEN";
        window.eventBus.emit("q4:forced-choice", {
          options: g.theme.q4_forced_choice.options,
          default: g.theme.q4_forced_choice.default_choice,
          state: { meters: { ...g.meters }, lives: g.lives, livesLost: g.livesLost },
        });
        return;
      }

      // End-of-quarter
      if (g.elapsedMs >= QUARTER_MS) {
        this._endQuarter();
      }
    },

    /** Called by Phaser scene on brick destruction. */
    onBrickBroken(brickId) {
      const g = this.g;
      if (!g) return null;
      const brick = g.theme.bricks.find((b) => b.id === brickId);
      if (!brick) return null;

      g.brickCounts[brick.category] = (g.brickCounts[brick.category] || 0) + 1;
      const qb = g.brickCountsPerQuarter[g.quarter] || (g.brickCountsPerQuarter[g.quarter] = {});
      qb[brick.category] = (qb[brick.category] || 0) + 1;

      applyEffects(g, brick.effects, brick.id);

      // Discovery bricks reveal hidden state (Inheritance theme).
      if (brick.reveals) {
        const flag = String(brick.reveals);
        if (!g.revealedFlags.has(flag)) {
          g.revealedFlags.add(flag);
          window.eventBus.emit("state:reveal", { flag, source: brick.id });
        }
      }

      window.eventBus.emit("brick:broken", {
        brick,
        category: brick.category,
        q: g.quarter,
      });
      window.eventBus.emit("feed:add", {
        text: brick.label,
        severity: feedSeverityForBrick(brick),
      });
      return brick;
    },

    _endQuarter() {
      const g = this.g;
      // If event hasn't fired yet (rare — short quarter), force-fire it now
      tickQuarterEvent(g, EVENT_FIRE_S);
      applyQuarterWrapRules(g);

      window.eventBus.emit("quarter:end", {
        q: g.quarter,
        snapshot: { meters: { ...g.meters }, lives: g.lives, livesLost: g.livesLost,
                    brickCountsPerQuarter: g.brickCountsPerQuarter[g.quarter] || {},
                    brickCounts: { ...g.brickCounts },
                    eventsHistory: g.eventsHistory.slice() },
      });

      if (g.lives <= 0) {
        this._endGame("early");
        return;
      }

      if (g.quarter >= 4) {
        // Q4 ended without forced choice (timer ran out) → apply default
        if (!g.q4Choice) this.makeQ4Choice(g.theme.q4_forced_choice.default_choice, /*timedOut=*/true);
        this._endGame("completed");
        return;
      }

      g.phase = "QUARTER_TRANSITION";
      // React will re-enter via resumeFromQuarterTransition() after the modal closes.
    },

    /** Called by UI after the quarter-transition modal closes. */
    resumeFromQuarterTransition() {
      const g = this.g;
      if (!g || g.phase !== "QUARTER_TRANSITION") return;
      g.phase = "PLAYING";
      this._enterQuarter(g.quarter + 1);
    },

    /** Called by UI when the player picks a Q4 option (or timer expires). */
    makeQ4Choice(choiceId, timedOut = false) {
      const g = this.g;
      if (!g) return;
      const fc = g.theme.q4_forced_choice;
      const choice = fc.options.find((o) => o.id === choiceId) || fc.options.find((o) => o.id === fc.default_choice);
      g.q4Choice = choice.id;

      const succeeds = evalTrigger(choice.succeeds_if, buildEvalCtx(g));
      if (succeeds) {
        applyEffects(g, choice.success_effects, "q4:" + choice.id);
      } else {
        g.q4Backfired = true;
        applyEffects(g, choice.backfire_effects || choice.success_effects, "q4:" + choice.id + ":backfire");
        g.eventsHistory.push("Q4_BF");
        window.eventBus.emit("feed:add", { text: "Q4 BACKFIRE — " + choice.label, severity: "critical" });
      }

      // Regulator-escalation tax
      const reg = fc.regulator_escalation;
      if (reg && evalTrigger(reg.condition, buildEvalCtx(g))) {
        applyEffects(g, reg.effects, "q4:regulator");
        g.eventsHistory.push("Q4_REG_ESC");
        window.eventBus.emit("feed:add", { text: reg.label + " — " + reg.text, severity: reg.severity || "critical" });
      }

      window.eventBus.emit("q4:choice-applied", {
        choice: choice.id,
        backfired: g.q4Backfired,
        timedOut,
        meters: { ...g.meters }, lives: g.lives, livesLost: g.livesLost,
      });

      g.phase = "PLAYING";
      // Let the remaining seconds drain naturally; _endQuarter handles wrap.
    },

    _endGame(ended) {
      const g = this.g;
      g.phase = "GAME_END";
      const arch = determineArchetype(g);
      g.archetype = arch;
      window.eventBus.emit("game:end", {
        archetype: arch,
        ended,
        state: {
          meters: { ...g.meters }, lives: g.lives, livesLost: g.livesLost,
          brickCounts: { ...g.brickCounts },
          brickCountsPerQuarter: g.brickCountsPerQuarter,
          eventsHistory: g.eventsHistory.slice(),
          q4Choice: g.q4Choice,
          q4Backfired: g.q4Backfired,
          contestedRegulator: g.contestedRegulator,
          crisisLog: {
            scheduled:           g.crisisLog.scheduled.slice(),
            fired:               g.crisisLog.fired.slice(),
            resolved:            g.crisisLog.resolved.slice(),
            failed:              g.crisisLog.failed.slice(),
            livesLostToCrises:   g.crisisLog.livesLostToCrises,
            responseBricksBroken: g.crisisLog.responseBricksBroken,
          },
        },
      });
    },

    /** Reset game state but keep theme loaded. */
    restart() {
      if (!this.g) return;
      this.loadTheme(this.g.theme);
      this.startGame();
    },

    /** Helpers exposed for testing / UI introspection. */
    _debug: { evalTrigger, buildEvalCtx, determineArchetype, sample },
  };

  // Map brick category → feed severity flavour
  function feedSeverityForBrick(brick) {
    const e = brick.effects || {};
    if ((e.risk || 0) > 0)   return "warning";
    if ((e.trust || 0) >= 3) return "positive";
    if ((e.bnd   || 0) >= 5) return "positive";
    return "neutral";
  }

  console.info("[engineRules] v3 loaded — Phase 3 interpreter ready.");
})();

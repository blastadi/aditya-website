/* ════════════════════════════════════════════════════════════════
   DEPLOY · game/scenes/PlayScene.js
   Phase 4.5 — theme-driven brick wall with on-canvas labels and
   V4.7-style continuous wall refill (1-3 bricks every 8-14 s,
   staggered fade-in). Phase 3 paddle/ball/shatter unchanged.

   Bricks now show their qualitative LABEL on-canvas so players can
   choose intentionally instead of randomly. NO numeric effects on
   canvas (the briefing room is the place for the why).
   ════════════════════════════════════════════════════════════════ */

(function () {
  if (typeof window.Phaser === "undefined") return;

  // ────────────────── layout constants ──────────────────
  const BRICK_GAP        = 6;
  const BRICK_TOP_PAD    = 32;
  const BRICK_ROW_GAP    = 6;
  const COLS             = 6;       // was 8 — wider bricks so labels fit
  const ROW_HEIGHT       = 28;      // was 22 — taller so text reads
  const PADDLE_W         = 110;
  const PADDLE_H         = 12;
  const PADDLE_Y_OFFSET  = 30;
  const BALL_R           = 7;
  const BALL_BASE_SPEED  = 320;
  const PADDLE_SPEED     = 460;
  const BALL_TRAIL_LEN   = 8;

  // Refill cadence — ported from V4.7 pages-game.jsx
  const REFILL_BASE_MS   = 8000;
  const REFILL_JITTER_MS = 6000;    // → 8-14 s between refills
  const REFILL_MIN       = 1;       // bricks per refill
  const REFILL_MAX       = 3;
  const REFILL_STAGGER_BASE = 150;  // ms between stagger
  const REFILL_STAGGER_JIT  = 450;  // jitter per slot

  // ────────────────── text contrast helper ──────────────────
  // Returns "#fafaf7" for dark bricks, "#1a1a1a" for light bricks.
  function textColorFor(hex) {
    const c = String(hex).replace("#", "");
    const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    return luma > 150 ? "#1a1a1a" : "#fafaf7";
  }
  function parseHex(s) {
    if (typeof s === "number") return s;
    if (!s) return 0x888888;
    const c = String(s).replace("#", "");
    return parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  }

  // Maps catalog color_hint tokens to concrete colours for response bricks.
  function colorHint(hint) {
    switch (hint) {
      case "blue":   return 0x2d4fe0;
      case "green":  return 0x1d8a5f;
      case "yellow": return 0xd4a01b;
      case "cyan":   return 0x21a8a8;
      case "purple": return 0x6d4cae;
      case "red":    return 0xc0392b;
      default:       return 0x4a4a4a;
    }
  }

  // Reduced motion check — honours system preference + a window override.
  function isReducedMotion() {
    if (typeof window.deployReducedMotion === "boolean") return window.deployReducedMotion;
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch { return false; }
  }

  // Read a CSS custom property as a Phaser-friendly hex int. Falls back to
  // theme-neutral defaults if the var hasn't loaded yet.
  function cssVarHex(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!v) return fallback;
      return parseHex(v);
    } catch (_) { return fallback; }
  }
  function cssVarCss(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (_) { return fallback; }
  }

  window.PlayScene = class PlayScene extends window.Phaser.Scene {
    constructor() { super("play"); }

    create() {
      const W = this.scale.width, H = this.scale.height;
      // Theme-aware canvas + paddle + ball — read from CSS vars so dark mode flips properly.
      const bgCss   = cssVarCss("--bg", "#FFFFFF");
      const fgHex   = cssVarHex("--fg", 0x0B0B0B);
      this.cameras.main.setBackgroundColor(bgCss);
      this.W = W; this.H = H;

      // ────────────────── paddle ──────────────────
      this.paddle = this.add.rectangle(W / 2, H - PADDLE_Y_OFFSET, PADDLE_W, PADDLE_H, fgHex);
      this.physics.add.existing(this.paddle, true);

      // ────────────────── ball + trail ──────────────────
      this.ball = this.add.circle(W / 2, H - PADDLE_Y_OFFSET - 30, BALL_R, fgHex);
      this.physics.add.existing(this.ball);
      this.ball.body.setBounce(1, 1);
      this.ball.body.setCollideWorldBounds(true, 1, 1);
      this.ball.body.onWorldBounds = true;

      this.ballTrail = [];
      for (let i = 0; i < BALL_TRAIL_LEN; i++) {
        const ghost = this.add.circle(W / 2, H, BALL_R, fgHex, 0);
        ghost.setDepth(-1);
        this.ballTrail.push(ghost);
      }

      // Brick slots: { x, y, w, h, brick: GameObject|null, label: Text|null, stroke|null, meta }
      this.slots = [];
      this.bricks = this.physics.add.staticGroup();
      this.recoveryRingByBrick = new Map();
      this.brickCollider = null;

      // Collisions
      this.physics.add.collider(this.ball, this.paddle, this.onPaddleHit, null, this);

      // World-bounds detection (ball drop = respawn, no life)
      this.physics.world.on("worldbounds", (body, _u, down) => {
        if (down && body === this.ball.body) this.onBallDrop();
      });
      this.lastDropCheckMs = 0;

      // ────────────────── input ──────────────────
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.on("pointermove", (p) => {
        this.paddle.x = window.Phaser.Math.Clamp(p.x, PADDLE_W / 2, W - PADDLE_W / 2);
        this.paddle.body.updateFromGameObject();
      });

      // Crisis state (catalog §10/§11)
      this.responseBricks = [];           // [{ idx, brick, label, ring }]
      this.lockedBricks = new Set();      // main-wall bricks frozen by brick_lock_red
      this.ballErraticUntil = 0;
      this.paddleSpeedScale = 1;          // 1 = full, 0.8 = paddle_slow
      this.ballSpeedScale = 1;            // 1 = full, 0.85 = ball_slow

      // ────────────────── engine bridge ──────────────────
      this.busOffs = [];
      this.busOffs.push(window.eventBus.on("quarter:start", (p) => this.onQuarterStart(p)));
      this.busOffs.push(window.eventBus.on("quarter:end",   ()  => this.onQuarterEnd()));
      this.busOffs.push(window.eventBus.on("q4:forced-choice", () => this.freezeBall()));
      this.busOffs.push(window.eventBus.on("q4:choice-applied", () => this.unfreezeBall()));
      this.busOffs.push(window.eventBus.on("game:end",      ()  => this.haltGame()));
      this.busOffs.push(window.eventBus.on("game:restart",  ()  => this.onRestart()));
      this.busOffs.push(window.eventBus.on("crisis:start",   (p) => this.onCrisisStart(p)));
      this.busOffs.push(window.eventBus.on("crisis:resolve", (p) => this.onCrisisResolve(p)));
      this.busOffs.push(window.eventBus.on("theme:change",   ()  => this.applyTheme()));

      window.eventBus.emit("phaser:ready", { scene: "play" });

      // Self-rescue cold-start race (same as Phase 3)
      const g = window.engineRules && window.engineRules.g;
      if (g && g.phase === "PLAYING" && g.wallForQuarter[g.quarter]) {
        this.onQuarterStart({
          q: g.quarter,
          wall: g.wallForQuarter[g.quarter],
          speed: g.speed || 1,
        });
      }
    }

    // ────────────────── quarter lifecycle ──────────────────
    onQuarterStart({ wall, speed }) {
      this.currentSpeed = speed || 1;
      this.frozen = false;
      this.scheduleNextRefill();
      this.layoutSlots(wall.length);
      this.populateInitialWall(wall);
      this.serveBall();
    }

    onQuarterEnd() { this.freezeBall(); }
    onRestart() { this.frozen = false; this.clearWall(); this.serveBall(); }
    haltGame() { this.freezeBall(); }
    freezeBall() {
      this.frozen = true;
      if (this.ball && this.ball.body) this.ball.body.setVelocity(0, 0);
    }
    unfreezeBall() { this.frozen = false; this.serveBall(); }

    serveBall() {
      this.ball.x = this.paddle.x;
      this.ball.y = this.paddle.y - 30;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const speed = BALL_BASE_SPEED * (this.currentSpeed || 1);
      this.ball.body.setVelocity(speed * 0.4 * dir, -speed * 0.9);
    }

    onBallDrop() {
      const now = performance.now();
      if (now - this.lastDropCheckMs < 300) return;
      this.lastDropCheckMs = now;
      if (this.frozen) return;
      window.eventBus.emit("feed:add", { text: "Ball missed — paddle reset", severity: "neutral" });
      this.serveBall();
    }

    // ────────────────── wall: slot geometry ──────────────────
    layoutSlots(totalSlots) {
      this.clearWall();
      const W = this.W;
      const cols = COLS;
      const rows = Math.ceil(totalSlots / cols);
      const brickW = (W - BRICK_GAP * (cols + 1)) / cols;
      const brickH = ROW_HEIGHT;

      for (let i = 0; i < totalSlots; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = BRICK_GAP + c * (brickW + BRICK_GAP) + brickW / 2;
        const y = BRICK_TOP_PAD + r * (brickH + BRICK_ROW_GAP) + brickH / 2;
        this.slots.push({ x, y, w: brickW - 1, h: brickH - 1, brick: null, label: null, stroke: null, ring: null, meta: null });
      }
    }

    clearWall() {
      for (const s of this.slots) {
        if (s.brick)  s.brick.destroy();
        if (s.label)  s.label.destroy();
        if (s.stroke) s.stroke.destroy();
        if (s.ring)   s.ring.destroy();
      }
      this.slots = [];
      if (this.brickCollider) { this.brickCollider.destroy(); this.brickCollider = null; }
      this.recoveryRingByBrick.clear();
    }

    populateInitialWall(wall) {
      for (let i = 0; i < wall.length && i < this.slots.length; i++) {
        this.placeBrickInSlot(this.slots[i], wall[i], 0); // no fade delay for initial
      }
      this.brickCollider = this.physics.add.collider(this.ball, this.bricks, this.onBrickHit, null, this);
    }

    placeBrickInSlot(slot, meta, fadeDelayMs) {
      const theme = window.engineRules.g && window.engineRules.g.theme;
      const catPalette = (theme && theme.categories) || {};
      const cat = catPalette[meta.category] || { color: "#888" };
      const fill = parseHex(cat.color || "#888");
      const dim  = parseHex(cat.color_dim || cat.color || "#666");
      const textCol = textColorFor(cat.color || "#888");

      // Reset hitsTaken on a fresh placement
      const placed = { ...meta, hitsTaken: 0 };

      const brick = this.add.rectangle(slot.x, slot.y, slot.w, slot.h, fill);
      this.physics.add.existing(brick, true);
      brick.setData("meta", placed);
      brick.setData("slot", slot);
      brick.setData("fill", fill);
      brick.setData("dim", dim);

      // Label text — qualitative brick name, mono, contrasting
      const label = this.add.text(slot.x, slot.y, placed.label || "", {
        fontFamily: '"JetBrains Mono", "SF Mono", "Menlo", monospace',
        fontSize: "9px",
        color: textCol,
        align: "center",
        wordWrap: { width: slot.w - 6 },
      }).setOrigin(0.5, 0.5);
      // If label still overflows, scale down
      if (label.width > slot.w - 4) {
        label.setScale((slot.w - 4) / label.width);
      }

      // 2-hit bricks: outer stroke ring
      let stroke = null;
      if ((placed.hits || 1) > 1) {
        stroke = this.add.rectangle(slot.x, slot.y, slot.w + 2, slot.h + 2);
        stroke.setStrokeStyle(1.5, 0x1a1a1a, 0.55);
      }

      // Recovery brick — pulsing gold ring
      let ring = null;
      if (placed.category === "rec") {
        ring = this.add.rectangle(slot.x, slot.y, slot.w + 6, slot.h + 6);
        ring.setStrokeStyle(2, 0xe8b830, 1);
        this.tweens.add({
          targets: ring,
          scaleX: { from: 1.0, to: 1.04 },
          scaleY: { from: 1.0, to: 1.14 },
          alpha:  { from: 1.0, to: 0.55 },
          yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut",
        });
        this.recoveryRingByBrick.set(brick, ring);
      }

      // Fade-in (V4.7 stagger)
      if (fadeDelayMs > 0) {
        brick.alpha = 0; label.alpha = 0;
        if (stroke) stroke.alpha = 0;
        if (ring)   ring.alpha = 0;
        this.tweens.add({ targets: brick,  alpha: 1, duration: 320, delay: fadeDelayMs, ease: "Quad.easeOut" });
        this.tweens.add({ targets: label,  alpha: 1, duration: 320, delay: fadeDelayMs, ease: "Quad.easeOut" });
        if (stroke) this.tweens.add({ targets: stroke, alpha: 0.55, duration: 320, delay: fadeDelayMs, ease: "Quad.easeOut" });
        if (ring)   this.tweens.add({ targets: ring,   alpha: 1,    duration: 320, delay: fadeDelayMs, ease: "Quad.easeOut" });
      }

      this.bricks.add(brick);
      slot.brick = brick;
      slot.label = label;
      slot.stroke = stroke;
      slot.ring = ring;
      slot.meta = placed;
    }

    // ────────────────── wall refill ──────────────────
    scheduleNextRefill() {
      this.nextRefillAt = performance.now() + REFILL_BASE_MS + Math.random() * REFILL_JITTER_MS;
    }

    refillBricks() {
      const empties = this.slots.filter((s) => !s.brick);
      if (empties.length === 0) return;

      // Pull from the live brick pool (engine-defined)
      const theme = window.engineRules.g && window.engineRules.g.theme;
      if (!theme) return;
      // Refill pool: all bricks EXCEPT the recovery brick (recovery only appears
      // in the initial Q3 wall when its unlock trigger fires).
      const pool = theme.bricks.filter((b) => b.category !== "rec");
      if (pool.length === 0) return;

      const count = Math.min(
        REFILL_MIN + Math.floor(Math.random() * (REFILL_MAX - REFILL_MIN + 1)),
        empties.length
      );
      const picked = new Set();
      for (let i = 0; i < count; i++) {
        let slot = null;
        for (let attempt = 0; attempt < 12; attempt++) {
          const idx = Math.floor(Math.random() * empties.length);
          if (!picked.has(idx) && !empties[idx].brick) { slot = empties[idx]; picked.add(idx); break; }
        }
        if (!slot) break;
        const meta = pool[Math.floor(Math.random() * pool.length)];
        const fadeDelay = i * (REFILL_STAGGER_BASE + Math.random() * REFILL_STAGGER_JIT);
        this.placeBrickInSlot(slot, meta, fadeDelay);
      }
    }

    // ────────────────── theme re-tint (light ↔ dark) ──────────────────
    applyTheme() {
      const bgCss = cssVarCss("--bg", "#FFFFFF");
      const fgHex = cssVarHex("--fg", 0x0B0B0B);
      if (this.cameras && this.cameras.main) this.cameras.main.setBackgroundColor(bgCss);
      if (this.paddle) this.paddle.fillColor = fgHex;
      if (this.ball)   this.ball.fillColor   = fgHex;
      for (const ghost of this.ballTrail || []) ghost.fillColor = fgHex;
    }

    // ────────────────── crisis hooks (catalog §11) ──────────────────
    onCrisisStart({ id, label, severity, durationMs, physicsSignatures, responseBricks }) {
      // 1. Apply physics signatures (canvas-side only; React handles screen tints)
      const sigs = new Set(physicsSignatures || []);
      const rm = isReducedMotion();
      if (sigs.has("brick_lock_red"))        this.applyBrickLockRed();
      if (sigs.has("brick_hostile_purple"))  this.applyHostilePurple();
      if (sigs.has("brick_heavy"))           this.applyBrickHeavy();
      if (sigs.has("brick_rain"))            this.spawnBrickRain();
      if (sigs.has("brick_glow_cyan"))       this.applyBrickGlowCyan();
      if (sigs.has("brick_spawn_green"))     this.spawnBrickGreen();
      if (sigs.has("paddle_slow"))    this.paddleSpeedScale = 0.8;
      if (sigs.has("paddle_narrow"))  this.applyPaddleNarrow();
      if (sigs.has("ball_slow"))      { this.ballSpeedScale = 0.85; this.adjustBallSpeed(); }
      if (sigs.has("ball_erratic"))   this.ballErraticUntil = performance.now() + durationMs;
      // Camera shake — disabled by reduced motion
      if (!rm && sigs.has("camera_shake_low"))   this.cameras.main.shake(Math.min(durationMs, 1000), 0.003);
      if (!rm && sigs.has("camera_shake_high"))  this.cameras.main.shake(Math.min(durationMs, 1200), 0.008);

      // 2. Spawn response bricks in mid-canvas zone (catalog §11 mock)
      this.spawnResponseBricks(responseBricks);
    }

    onCrisisResolve({ id, success }) {
      // Tear down physics signatures
      this.clearLockedBricks();
      this.clearHostilePurple();
      this.clearBrickHeavy();
      this.clearBrickRain();
      this.clearBrickGlowCyan();
      this.clearBrickGreen();
      this.paddleSpeedScale = 1;
      this.clearPaddleNarrow();
      if (this.ballSpeedScale !== 1) { this.ballSpeedScale = 1; this.adjustBallSpeed(); }
      this.ballErraticUntil = 0;

      // Camera resolution flash + clear remaining response bricks
      if (this.cameras && this.cameras.main) {
        if (success) this.cameras.main.flash(280, 29, 138, 95, true);   // green
        else         this.cameras.main.flash(280, 192, 57, 43, true);   // red
      }
      this.clearResponseBricks();
    }

    spawnResponseBricks(defs) {
      this.clearResponseBricks();
      if (!defs || defs.length === 0) return;
      const W = this.W;
      const RB_W = 132, RB_H = 36, GAP = 16;
      const totalW = defs.length * RB_W + (defs.length - 1) * GAP;
      const startX = (W - totalW) / 2 + RB_W / 2;
      const y = this.H * 0.62; // mid-low canvas, well above paddle

      for (let i = 0; i < defs.length; i++) {
        const d = defs[i];
        const x = startX + i * (RB_W + GAP);
        const fill = colorHint(d.color_hint);
        const brick = this.add.rectangle(x, y, RB_W, RB_H, fill);
        this.physics.add.existing(brick, true);
        brick.setData("rbIdx", d.idx);
        brick.setData("rb", true);

        const label = this.add.text(x, y, d.label, {
          fontFamily: '"JetBrains Mono", "SF Mono", "Menlo", monospace',
          fontSize: "10px", color: "#fafaf7", align: "center",
          wordWrap: { width: RB_W - 8 },
        }).setOrigin(0.5, 0.5);
        if (label.width > RB_W - 8) label.setScale((RB_W - 8) / label.width);

        // Gold pulsing ring (catalog §11 — response brick visual signature)
        const ring = this.add.rectangle(x, y, RB_W + 8, RB_H + 8);
        ring.setStrokeStyle(2.5, 0xe8b830, 1);
        this.tweens.add({
          targets: ring,
          scaleX: { from: 1.0, to: 1.06 },
          scaleY: { from: 1.0, to: 1.20 },
          alpha:  { from: 1.0, to: 0.55 },
          yoyo: true, repeat: -1, duration: 600, ease: "Sine.easeInOut",
        });

        this.responseBricks.push({ idx: d.idx, brick, label, ring });
      }
      // Collider — let the ball hit response bricks just like the wall.
      if (this.responseBrickGroup) this.responseBrickGroup.destroy();
      this.responseBrickGroup = this.physics.add.staticGroup(this.responseBricks.map((rb) => rb.brick));
      this.responseBrickCollider = this.physics.add.collider(
        this.ball, this.responseBrickGroup, this.onResponseBrickHit, null, this
      );
    }

    onResponseBrickHit(ball, brick) {
      const idx = brick.getData("rbIdx");
      const rb  = this.responseBricks.find((r) => r.idx === idx);
      if (!rb) return;
      // Shatter
      this.shatterBrick(rb.brick);
      rb.brick.destroy();
      if (rb.label) rb.label.destroy();
      if (rb.ring)  rb.ring.destroy();
      this.responseBricks = this.responseBricks.filter((r) => r.idx !== idx);
      // Notify engine — engine's tick() will detect all-broken and resolve.
      window.engineRules.onResponseBrickBroken(idx);
    }

    clearResponseBricks() {
      for (const rb of this.responseBricks) {
        if (rb.brick && rb.brick.scene) rb.brick.destroy();
        if (rb.label && rb.label.scene) rb.label.destroy();
        if (rb.ring  && rb.ring.scene)  rb.ring.destroy();
      }
      this.responseBricks = [];
      if (this.responseBrickCollider) { this.responseBrickCollider.destroy(); this.responseBrickCollider = null; }
      if (this.responseBrickGroup)    { this.responseBrickGroup.destroy();    this.responseBrickGroup    = null; }
    }

    applyBrickLockRed() {
      // Lock ~50% of currently-occupied wall slots: tint red, mark unbreakable.
      const occupied = this.slots.filter((s) => s.brick);
      const lockCount = Math.floor(occupied.length / 2);
      const shuffled = occupied.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < lockCount; i++) {
        const s = shuffled[i];
        const orig = s.brick.fillColor;
        s.brick.setData("_lockOriginalFill", orig);
        s.brick.fillColor = 0xc0392b; // red
        this.lockedBricks.add(s.brick);
      }
    }
    clearLockedBricks() {
      for (const brick of this.lockedBricks) {
        if (brick && brick.scene) {
          const orig = brick.getData("_lockOriginalFill");
          if (orig != null) brick.fillColor = orig;
        }
      }
      this.lockedBricks.clear();
    }

    // brick_hostile_purple — tint subset; hitting them costs the player a wall break stat but
    // we keep it visual for v1 (no extra penalty) so the engine state stays clean.
    applyHostilePurple() {
      this.hostileBricks = this.hostileBricks || new Set();
      const occupied = this.slots.filter((s) => s.brick && !this.lockedBricks.has(s.brick));
      const count = Math.floor(occupied.length / 3);
      const shuffled = occupied.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        const s = shuffled[i];
        s.brick.setData("_hostileOriginalFill", s.brick.fillColor);
        s.brick.fillColor = 0x6d4cae;
        this.hostileBricks.add(s.brick);
      }
    }
    clearHostilePurple() {
      if (!this.hostileBricks) return;
      for (const brick of this.hostileBricks) {
        if (brick && brick.scene) {
          const orig = brick.getData("_hostileOriginalFill");
          if (orig != null) brick.fillColor = orig;
        }
      }
      this.hostileBricks.clear();
    }

    // brick_heavy — subset needs +1 hits while the crisis is active.
    applyBrickHeavy() {
      this.heavyBricks = this.heavyBricks || new Map();
      const occupied = this.slots.filter((s) => s.brick && !this.lockedBricks.has(s.brick));
      const count = Math.floor(occupied.length / 3);
      const shuffled = occupied.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        const s = shuffled[i];
        const meta = s.brick.getData("meta");
        if (!meta) continue;
        this.heavyBricks.set(s.brick, meta.hits || 1);
        meta.hits = (meta.hits || 1) + 1;
        // Outline ring (visual marker)
        const ring = this.add.rectangle(s.x, s.y, s.w + 4, s.h + 4);
        ring.setStrokeStyle(2, 0x1a1a1a, 0.7);
        s.brick.setData("_heavyRing", ring);
      }
    }
    clearBrickHeavy() {
      if (!this.heavyBricks) return;
      for (const [brick, origHits] of this.heavyBricks.entries()) {
        if (brick && brick.scene) {
          const meta = brick.getData("meta");
          if (meta) meta.hits = origHits;
          const ring = brick.getData("_heavyRing");
          if (ring && ring.scene) ring.destroy();
        }
      }
      this.heavyBricks.clear();
    }

    // brick_rain — detach one occupied brick and drop it toward the paddle.
    spawnBrickRain() {
      const occupied = this.slots.filter((s) => s.brick);
      if (occupied.length === 0) return;
      const s = occupied[Math.floor(Math.random() * occupied.length)];
      const brick = s.brick;
      // Re-create as a dynamic body that falls
      const x = brick.x, y = brick.y, color = brick.fillColor;
      const w = brick.width, h = brick.height;
      brick.destroy();
      if (s.label) s.label.destroy();
      s.brick = null; s.label = null; s.meta = null;
      const falling = this.add.rectangle(x, y, w, h, color);
      this.physics.add.existing(falling);
      falling.body.setVelocity(0, 110);
      falling.body.setAllowGravity(false);
      falling.setData("_rain", true);
      this.rainingBricks = this.rainingBricks || [];
      this.rainingBricks.push(falling);
    }
    clearBrickRain() {
      if (!this.rainingBricks) return;
      for (const b of this.rainingBricks) if (b && b.scene) b.destroy();
      this.rainingBricks = [];
    }

    // brick_glow_cyan — tint subset cyan as a positive marker (opportunity signature).
    applyBrickGlowCyan() {
      this.cyanBricks = this.cyanBricks || new Set();
      const occupied = this.slots.filter((s) => s.brick);
      const count = Math.max(1, Math.floor(occupied.length / 4));
      const shuffled = occupied.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        const s = shuffled[i];
        s.brick.setData("_cyanOriginalFill", s.brick.fillColor);
        s.brick.fillColor = 0x21a8a8;
        this.cyanBricks.add(s.brick);
      }
    }
    clearBrickGlowCyan() {
      if (!this.cyanBricks) return;
      for (const brick of this.cyanBricks) {
        if (brick && brick.scene) {
          const orig = brick.getData("_cyanOriginalFill");
          if (orig != null) brick.fillColor = orig;
        }
      }
      this.cyanBricks.clear();
    }

    // brick_spawn_green — drop in fresh green bricks at the top of the wall for OSS_REL.
    spawnBrickGreen() {
      this.greenBricks = this.greenBricks || [];
      const empties = this.slots.filter((s) => !s.brick).slice(0, 3);
      for (const s of empties) {
        const brick = this.add.rectangle(s.x, s.y - 80, s.w, s.h, 0x1d8a5f);
        this.physics.add.existing(brick, true);
        brick.setData("_oppGreen", true);
        this.tweens.add({
          targets: brick, y: s.y, duration: 320, ease: "Quad.easeOut",
        });
        this.greenBricks.push(brick);
      }
    }
    clearBrickGreen() {
      if (!this.greenBricks) return;
      for (const b of this.greenBricks) if (b && b.scene) b.destroy();
      this.greenBricks = [];
    }

    // paddle_narrow — temporarily shrink paddle by 30%
    applyPaddleNarrow() {
      if (this._narrowApplied) return;
      this._narrowApplied = true;
      this.tweens.add({ targets: this.paddle, scaleX: 0.7, duration: 200, ease: "Quad.easeOut" });
    }
    clearPaddleNarrow() {
      if (!this._narrowApplied) return;
      this._narrowApplied = false;
      this.tweens.add({ targets: this.paddle, scaleX: 1.0, duration: 200, ease: "Quad.easeOut" });
    }

    adjustBallSpeed() {
      if (!this.ball || !this.ball.body) return;
      const v = this.ball.body.velocity;
      const mag = Math.hypot(v.x, v.y) || 1;
      const target = BALL_BASE_SPEED * (this.currentSpeed || 1) * (this.ballSpeedScale || 1);
      const k = target / mag;
      this.ball.body.setVelocity(v.x * k, v.y * k);
    }

    // ────────────────── collision handlers ──────────────────
    onPaddleHit(ball, paddle) {
      const offset = (ball.x - paddle.x) / (PADDLE_W / 2);
      const speed = BALL_BASE_SPEED * (this.currentSpeed || 1);
      ball.body.setVelocityX(speed * 0.9 * offset);
      this.tweens.add({
        targets: paddle,
        scaleY: 0.6,
        duration: 60, yoyo: true, ease: "Sine.easeOut",
      });
    }

    onBrickHit(ball, brick) {
      // Crisis-locked bricks bounce but don't break (brick_lock_red signature)
      if (this.lockedBricks.has(brick)) return;

      const meta = brick.getData("meta");
      const slot = brick.getData("slot");
      if (!meta || !slot) return;
      meta.hitsTaken = (meta.hitsTaken || 0) + 1;

      // Multi-hit brick — partial: dim tint + small squish
      if (meta.hitsTaken < (meta.hits || 1)) {
        brick.fillColor = brick.getData("dim");
        this.tweens.add({
          targets: brick, scaleX: 0.94, scaleY: 0.94,
          duration: 70, yoyo: true, ease: "Quad.easeOut",
        });
        return;
      }

      // Final hit — destroy + shatter + free slot
      if (slot.stroke) { slot.stroke.destroy(); slot.stroke = null; }
      if (slot.ring)   { slot.ring.destroy();   slot.ring = null; }
      if (slot.label)  { slot.label.destroy();  slot.label = null; }
      this.recoveryRingByBrick.delete(brick);
      this.shatterBrick(brick);
      brick.destroy();
      slot.brick = null;
      slot.meta = null;

      window.engineRules.onBrickBroken(meta.id);
    }

    shatterBrick(brick) {
      const x = brick.x, y = brick.y;
      const color = brick.fillColor;
      for (let i = 0; i < 8; i++) {
        const shard = this.add.rectangle(x, y, 4, 4, color);
        const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
        const dist = 22 + Math.random() * 18;
        this.tweens.add({
          targets: shard,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist - 6,
          alpha: 0,
          duration: 420,
          ease: "Quad.easeOut",
          onComplete: () => shard.destroy(),
        });
      }
    }

    // ────────────────── update ──────────────────
    update(_t, dtMs) {
      // Drive engine clock
      if (window.engineRules && !this.frozen) {
        window.engineRules.tick(dtMs);
      }

      // Keyboard paddle (paddleSpeedScale = 0.8 during paddle_slow crises)
      const paddleSpeed = PADDLE_SPEED * (this.paddleSpeedScale || 1);
      if (this.cursors.left.isDown) {
        this.paddle.x -= (paddleSpeed * dtMs) / 1000;
      } else if (this.cursors.right.isDown) {
        this.paddle.x += (paddleSpeed * dtMs) / 1000;
      }
      this.paddle.x = window.Phaser.Math.Clamp(
        this.paddle.x, PADDLE_W / 2, this.W - PADDLE_W / 2
      );
      this.paddle.body.updateFromGameObject();

      // Belt-and-braces ball-drop detection
      if (!this.frozen && this.ball.y > this.H - PADDLE_Y_OFFSET + 30) {
        this.onBallDrop();
      }

      // Ball trail
      if (!this.frozen && this.ballTrail && this.ballTrail.length) {
        for (let i = this.ballTrail.length - 1; i > 0; i--) {
          const g = this.ballTrail[i], prev = this.ballTrail[i - 1];
          g.x = prev.x; g.y = prev.y;
          g.alpha = (1 - i / this.ballTrail.length) * 0.25;
        }
        this.ballTrail[0].x = this.ball.x;
        this.ballTrail[0].y = this.ball.y;
        this.ballTrail[0].alpha = 0.35;
      }

      // Wall refill (V4.7 cadence)
      if (!this.frozen && this.nextRefillAt && performance.now() > this.nextRefillAt) {
        this.refillBricks();
        this.scheduleNextRefill();
      }

      // ball_erratic crisis signature — nudge ball velocity randomly
      const tNow = performance.now();
      if (!this.frozen && this.ballErraticUntil && tNow < this.ballErraticUntil) {
        const v = this.ball.body.velocity;
        this.ball.body.setVelocity(
          v.x + (Math.random() - 0.5) * 32,
          v.y + (Math.random() - 0.5) * 32
        );
      }

      // brick_rain — cull any falling bricks that left the canvas; HALLUC_CUST
      // resolution catches them by hitting the response brick instead.
      if (this.rainingBricks && this.rainingBricks.length) {
        this.rainingBricks = this.rainingBricks.filter((b) => {
          if (!b || !b.scene) return false;
          if (b.y > this.H + 20) { b.destroy(); return false; }
          return true;
        });
      }
    }

    shutdown() {
      for (const off of this.busOffs || []) off();
      this.busOffs = [];
    }
  };
})();

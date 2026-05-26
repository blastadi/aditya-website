/* ════════════════════════════════════════════════════════════════
   Public pages
   Exports: HomePage, AboutPage, ThesisPage, BlogPage, BlogPostPage,
            WorkPage, AchievementsPage, ContactPage
   ════════════════════════════════════════════════════════════════ */

const { useState: useStatePublic, useEffect: useEffectPublic, useRef: useRefPublic } = React;

/* ───────── Reveal-on-scroll hook (with resilience fallback) ───────── */
function useReveal(threshold = 0.25) {
  const ref = useRefPublic(null);
  const [shown, setShown] = useStatePublic(false);
  useEffectPublic(() => {
    if (!ref.current) return;
    const el = ref.current;
    // Immediate check: already in viewport at mount?
    const inViewportNow = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    };
    if (inViewportNow()) { setShown(true); return; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    // Safety fallback for iframe quirks where IntersectionObserver doesn't fire
    const fallback = setTimeout(() => setShown(true), 2200);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);
  return [ref, shown];
}

/* ───────── Scroll-progress hook ───────── */
function useScrollProgress() {
  const [p, setP] = useStatePublic(0);
  useEffectPublic(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return p;
}

/* ───────── Teleprompter — scroll-locked text reveal ─────────
   Sets a `--reveal` CSS variable on each prompter element based
   on its vertical position in the viewport. CSS uses --reveal
   to drive opacity + transform. Throttled with rAF.
*/
const PROMPTER_SELECTOR = [
  '.home-quote-word', '.home-quote-mark',
  '.home-link-letter', '.home-link-arrow',
  '.home-attribution', '.home-link-meta',
  '.home-hero-tag', '.home-hero-prompt',
  '.home-signoff-line', '.home-signoff-meta',
].join(',');

function usePrompter() {
  useEffectPublic(() => {
    let rafQueued = false;
    let cache = [];
    const refreshCache = () => { cache = Array.from(document.querySelectorAll(PROMPTER_SELECTOR)); };
    refreshCache();

    const tick = () => {
      rafQueued = false;
      const vh = window.innerHeight;
      const start = vh * 0.95;
      const end   = vh * 0.45;
      const span  = start - end;
      for (let i = 0; i < cache.length; i++) {
        const el = cache[i];
        if (!el.isConnected) continue;
        const rect = el.getBoundingClientRect();
        const y = rect.top + rect.height * 0.5;
        let t = (start - y) / span;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        el.style.setProperty('--reveal', t.toFixed(3));
      }
    };
    const onScroll = () => {
      if (rafQueued) return;
      rafQueued = true;
      requestAnimationFrame(tick);
    };

    // Re-cache when DOM mutates (sections added dynamically etc.)
    const mo = new MutationObserver(() => { refreshCache(); onScroll(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // Initial passes (after layout + after fonts settle)
    tick();
    setTimeout(tick, 60);
    setTimeout(tick, 200);
    setTimeout(tick, 600);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      mo.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
}

/* ───────── Ambient petals + flowers — drifting particles in the background ───────── */
const SCRAMBLE_CHARS = "01<>{}[]/\\|+*-.,:;'~!@#$%^&*()=ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function useScramble(target, trigger, duration = 700) {
  const [text, setText] = useStatePublic(target);
  useEffectPublic(() => {
    if (!trigger) { setText(target); return; }
    const safe = String(target);
    const start = performance.now();
    let rafId;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const revealCount = Math.floor(t * (safe.length + 2));
      let s = "";
      for (let i = 0; i < safe.length; i++) {
        const c = safe[i];
        if (i < revealCount) s += c;
        else if (c === " " || c === "·" || c === "—" || c === "/") s += c;
        else s += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      setText(s);
      if (t < 1) rafId = requestAnimationFrame(step);
      else setText(safe);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, trigger, duration]);
  return text;
}

function ScrambleText({ children, trigger = true, duration = 700, className }) {
  const target = typeof children === "string" ? children : "";
  const text = useScramble(target, trigger, duration);
  return <span className={className}>{text}</span>;
}

function useElapsed() {
  const [s, setS] = useStatePublic(0);
  const startRef = useRefPublic(performance.now());
  useEffectPublic(() => {
    const id = setInterval(() => setS(Math.floor((performance.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
}
const fmtClock = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
};

/* ───────── SectionStamp — precision-instrument HUD on each section ───────── */
function SectionStamp({ index = 0, kind = "scan", placement = "left", shown = true }) {
  const phaseStr = ["I", "II", "III", "IV", "V", "VI", "VII"][index % 7];
  const pulseVal = 14 + ((index * 13) % 60);
  const sigVal = ((Math.sin(index * 0.71) * 0.5 + 0.5)).toFixed(3);
  const target = (kind || "").toUpperCase().slice(0, 9);
  return (
    <div className={`section-stamp section-stamp-${placement}`} data-shown={shown}>
      <span className="stamp-corner stamp-tl"></span>
      <span className="stamp-corner stamp-tr"></span>
      <span className="stamp-corner stamp-bl"></span>
      <span className="stamp-corner stamp-br"></span>
      <div className="stamp-content">
        <div className="stamp-row stamp-row-head">
          <span className="stamp-k">SIG</span>
          <span className="stamp-v"><ScrambleText trigger={shown} duration={1200}>{target}</ScrambleText></span>
        </div>
        <div className="stamp-row">
          <span className="stamp-k">PHS</span>
          <span className="stamp-v">{phaseStr}</span>
        </div>
        <div className="stamp-row">
          <span className="stamp-k">PUL</span>
          <span className="stamp-v stamp-pulse-num">{String(pulseVal).padStart(2, "0")}</span>
        </div>
        <div className="stamp-wave">
          <svg viewBox="0 0 60 12" preserveAspectRatio="none">
            <path className="wave-path" d="M 0 6 Q 5 1, 10 6 T 20 6 T 30 6 T 40 6 T 50 6 T 60 6" />
          </svg>
        </div>
        <div className="stamp-row stamp-row-foot">
          <span className="stamp-k">·{sigVal}</span>
          <span className="stamp-pulse"></span>
        </div>
      </div>
    </div>
  );
}
const FlowerVariants = {
  rose: (
    <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
      {[0, 72, 144, 216, 288].map((deg, i) => (
        <ellipse key={i} cx="30" cy="14" rx="6.5" ry="13" transform={`rotate(${deg} 30 30)`} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.5" />
      ))}
      <circle cx="30" cy="30" r="2.6" fill="currentColor" fillOpacity="0.7" />
    </svg>
  ),
  daisy: (
    <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <ellipse key={i} cx="30" cy="14" rx="3.5" ry="11" transform={`rotate(${deg} 30 30)`} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" />
      ))}
      <circle cx="30" cy="30" r="3.4" fill="currentColor" fillOpacity="0.8" />
    </svg>
  ),
  bloom: (
    <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <circle key={i} cx="30" cy="18" r="6" transform={`rotate(${deg} 30 30)`} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.5" />
      ))}
      <circle cx="30" cy="30" r="3" fill="currentColor" fillOpacity="0.7" />
    </svg>
  ),
  sprig: (
    <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
      <path d="M 30 6 Q 24 22, 30 30 Q 36 38, 30 54" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="20" rx="4" ry="8" transform="rotate(-30 22 20)" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.4" />
      <ellipse cx="38" cy="32" rx="4" ry="8" transform="rotate(40 38 32)" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.4" />
      <ellipse cx="24" cy="44" rx="4" ry="8" transform="rotate(-50 24 44)" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.4" />
    </svg>
  ),
  fern: (
    <svg viewBox="0 0 60 60" fill="none" aria-hidden="true">
      <path d="M 30 4 Q 32 30, 30 56" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.5" fill="none" />
      {[10, 18, 26, 34, 42, 50].map((y, i) => {
        const side = i % 2 === 0 ? 1 : -1;
        const len  = 11 - Math.abs(i - 2.5) * 1.4;
        return (
          <ellipse key={i} cx={30 + side * (len / 2 + 2)} cy={y} rx={len / 2} ry="2.6" transform={`rotate(${side > 0 ? -20 : 20} ${30 + side * (len / 2 + 2)} ${y})`} fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeOpacity="0.36" strokeWidth="0.4" />
        );
      })}
    </svg>
  ),
};

function SectionFlower({ variant = "rose", placement = "right" }) {
  return (
    <div className={`section-flower section-flower-${placement} section-flower-variant-${variant}`} aria-hidden="true">
      <div className="section-flower-spin">
        {FlowerVariants[variant] || FlowerVariants.rose}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   AmbientPetals — ambient canvas overlay (sakura ↔ snowflake)
   Light mode: sakura blossoms (5 petals + golden stamen, pink palette)
   Dark mode:  snowflakes (6-arm crystals, cool palette)
   Shared physics: 3-layer parallax, tumble (scaleX compression),
   sine sway, slow rotation, periodic gusts, scroll-driven kick,
   pre-rendered sprite cache (rebuilt on theme change), DPR cap 1.5,
   pause on document.hidden.
   ──────────────────────────────────────────────────────────────── */
function AmbientPetals({ enabled = true }) {
  const canvasRef = useRefPublic(null);

  useEffectPublic(() => {
    if (!enabled) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // ────────── palettes ──────────
    const SAKURA_COLORS = [
      'rgba(244, 154, 184, 1)',
      'rgba(238, 130, 168, 1)',
      'rgba(248, 178, 200, 1)',
      'rgba(252, 198, 214, 1)',
      'rgba(245, 168, 192, 1)',
    ];
    const SAKURA_STAMEN = 'rgba(255, 215, 130, 0.55)';
    const SNOW_COLORS = [
      'rgba(245, 248, 255, 1)',
      'rgba(220, 232, 248, 1)',
      'rgba(255, 255, 255, 1)',
      'rgba(195, 215, 240, 1)',
    ];

    // ────────── shape drawing ──────────
    function drawSakuraPetal(c, size) {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(size * 0.42, -size * 0.20, size * 0.40, -size * 0.78, 0, -size);
      c.bezierCurveTo(-size * 0.40, -size * 0.78, -size * 0.42, -size * 0.20, 0, 0);
      c.closePath();
      c.fill();
    }
    function paintSakura(c, cx, cy, size, color) {
      c.save();
      c.translate(cx, cy);
      c.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        c.save();
        c.rotate((i / 5) * Math.PI * 2);
        drawSakuraPetal(c, size);
        c.restore();
      }
      c.fillStyle = SAKURA_STAMEN;
      c.beginPath();
      c.arc(0, 0, size * 0.20, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    function paintSnowflake(c, cx, cy, size, color) {
      c.save();
      c.translate(cx, cy);
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = Math.max(1, size * 0.07);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        c.save();
        c.rotate((i / 6) * Math.PI * 2);
        // main arm
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -size);
        c.stroke();
        // two pairs of branches at 30° (Math.PI / 6) angles
        const branches = [
          { y: -size * 0.45, len: size * 0.26 },
          { y: -size * 0.72, len: size * 0.34 },
        ];
        for (const b of branches) {
          const dx = Math.sin(Math.PI / 6) * b.len;
          const dy = Math.cos(Math.PI / 6) * b.len;
          c.beginPath();
          c.moveTo(0, b.y); c.lineTo( dx, b.y - dy);
          c.moveTo(0, b.y); c.lineTo(-dx, b.y - dy);
          c.stroke();
        }
        c.restore();
      }
      c.beginPath();
      c.arc(0, 0, size * 0.10, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // ────────── sprite cache ──────────
    // Pre-render each (shape × color × size-bucket) tile to an offscreen
    // canvas once. drawImage in the rAF loop. Rebuild on theme change.
    const SIZE_BUCKETS = [11, 17, 24]; // small, medium, large radii
    let spriteCache = null; // { shape, sprites: [...by colorIdx then by bucketIdx] }
    function buildSprites(shape) {
      const colors = shape === 'sakura' ? SAKURA_COLORS : SNOW_COLORS;
      const sprites = [];
      for (let ci = 0; ci < colors.length; ci++) {
        const perColor = [];
        for (let bi = 0; bi < SIZE_BUCKETS.length; bi++) {
          const size = SIZE_BUCKETS[bi];
          const pad = Math.ceil(size * 0.3);
          const dim = size * 2 + pad * 2;
          const off = document.createElement('canvas');
          off.width  = Math.ceil(dim * dpr);
          off.height = Math.ceil(dim * dpr);
          off.style.width = dim + 'px';
          off.style.height = dim + 'px';
          const c = off.getContext('2d');
          c.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (shape === 'sakura') paintSakura(c, dim / 2, dim / 2, size, colors[ci]);
          else                    paintSnowflake(c, dim / 2, dim / 2, size, colors[ci]);
          perColor.push({ canvas: off, dim });
        }
        sprites.push(perColor);
      }
      return { shape, sprites };
    }

    // ────────── particle seed ──────────
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 12 : 22;
    const LAYERS = [
      { name: 'back',  sizeMul: 0.55, speedMul: 0.45, opaBase: 0.45, opaJitter: 0.10 },
      { name: 'mid',   sizeMul: 1.00, speedMul: 1.00, opaBase: 0.72, opaJitter: 0.12 },
      { name: 'front', sizeMul: 1.45, speedMul: 1.55, opaBase: 0.90, opaJitter: 0.08 },
    ];
    const pickLayer = () => {
      const r = Math.random();
      if (r < 0.35) return 0;            // back: 35%
      if (r < 0.75) return 1;            // mid:  40%
      return 2;                          // front: 25%
    };

    const particles = [];
    const W0 = window.innerWidth, H0 = window.innerHeight;
    for (let i = 0; i < COUNT; i++) {
      const layerIdx = pickLayer();
      const layer = LAYERS[layerIdx];
      const bucketIdx = Math.floor(Math.random() * SIZE_BUCKETS.length);
      const baseSize = SIZE_BUCKETS[bucketIdx] * layer.sizeMul;
      particles.push({
        layerIdx,
        bucketIdx,
        colorIdx: 0,                                  // assigned per-shape on rebuild
        x: Math.random() * W0,
        y: Math.random() * H0 * 1.4 - H0 * 0.2,
        vx: 0,
        vy: (0.40 + Math.random() * 0.55) * layer.speedMul,
        size: baseSize,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.010,
        tumblePhase: Math.random() * Math.PI * 2,
        tumbleFreq: 0.012 + Math.random() * 0.018,
        swayPhase: Math.random() * Math.PI * 2,
        swayFreq: 0.008 + Math.random() * 0.014,
        swayAmp: 0.6 + Math.random() * 1.6,
        opacity: layer.opaBase + (Math.random() - 0.5) * 2 * layer.opaJitter,
      });
    }
    function reassignColors(shape) {
      const colors = shape === 'sakura' ? SAKURA_COLORS : SNOW_COLORS;
      for (const p of particles) p.colorIdx = Math.floor(Math.random() * colors.length);
    }

    // ────────── scroll velocity ──────────
    let scrollVel = 0;
    let lastScroll = window.scrollY;
    const onScroll = () => {
      const s = window.scrollY;
      scrollVel = scrollVel * 0.78 + (s - lastScroll) * 0.06;
      lastScroll = s;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ────────── gust state ──────────
    let gustEndAt   = 0;
    let nextGustAt  = performance.now() + (20 + Math.random() * 20) * 1000;
    let gustVx      = 0;
    let gustVy      = 0;
    let gustMag     = 0;
    let gustDur     = 0;
    let gustStartAt = 0;
    function startGust(now) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      gustMag   = 0.7 + Math.random() * 0.9;            // 0.7-1.6
      gustDur   = 1200 + Math.random() * 800;           // 1.2-2.0s
      gustStartAt = now;
      gustEndAt   = now + gustDur;
      gustVx = dir;
      gustVy = 0.15 + Math.random() * 0.20;             // slight downward bias
      nextGustAt = now + (20 + Math.random() * 20) * 1000;
    }

    // ────────── visibility (pause when tab hidden) ──────────
    let paused = document.hidden;
    const onVis = () => { paused = document.hidden; if (!paused) lastT = performance.now(); };
    document.addEventListener('visibilitychange', onVis);

    // ────────── theme detection + initial cache build ──────────
    const currentShape = () =>
      (document.documentElement.dataset.theme === 'dark') ? 'snowflake' : 'sakura';
    let activeShape = currentShape();
    spriteCache = buildSprites(activeShape);
    reassignColors(activeShape);

    // ────────── animation loop ──────────
    let rafId, lastT = performance.now();
    const tick = (t) => {
      if (paused) { rafId = requestAnimationFrame(tick); return; }
      const dt = Math.min(2.5, (t - lastT) / 16.67);
      lastT = t;
      scrollVel *= 0.94;

      // Theme switch — rebuild sprites if changed
      const shape = currentShape();
      if (shape !== activeShape) {
        activeShape = shape;
        spriteCache = buildSprites(shape);
        reassignColors(shape);
      }
      const sprites = spriteCache.sprites;
      const numColors = sprites.length;

      // Gust
      if (t > nextGustAt && t > gustEndAt) startGust(t);
      let gustFactor = 0;
      if (t < gustEndAt) {
        const elapsed = t - gustStartAt;
        gustFactor = gustMag * (1 - elapsed / gustDur);   // linear decay to 0
      }
      const gxFrame = gustVx * gustFactor;
      const gyFrame = gustVy * gustFactor;

      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const verticalKick = scrollVel * 0.6;
      const horizontalDrift = scrollVel * 0.18;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const layer = LAYERS[p.layerIdx];

        p.tumblePhase += p.tumbleFreq * dt;
        p.swayPhase   += p.swayFreq * dt;
        p.rot         += p.vRot * dt;

        const sway = Math.sin(p.swayPhase) * p.swayAmp;

        p.x += (sway + horizontalDrift + gxFrame * layer.speedMul) * dt;
        p.y += (p.vy + verticalKick + gyFrame * layer.speedMul) * dt;

        // Recycle off-screen
        if (p.y > h + p.size * 2) {
          p.y = -p.size * 2;
          p.x = Math.random() * w;
          p.tumblePhase = Math.random() * Math.PI * 2;
          p.swayPhase = Math.random() * Math.PI * 2;
        }
        if (p.x > w + p.size * 2) p.x = -p.size * 2;
        else if (p.x < -p.size * 2) p.x = w + p.size * 2;

        // Tumble: scaleX based on cosine (1 = face-on, 0.30 = edge-on)
        const cosT = Math.cos(p.tumblePhase);
        const scaleX = 0.30 + 0.70 * Math.abs(cosT);
        // Opacity dips slightly at edge angle
        const opaDip = 1 - (1 - Math.abs(cosT)) * 0.30;
        const opacity = Math.max(0, Math.min(1, p.opacity * opaDip));

        if (opacity < 0.01) continue;

        // Pick sprite
        const colorBank = sprites[p.colorIdx % numColors];
        const sprite = colorBank[p.bucketIdx];
        const drawDim = sprite.dim * (p.size / SIZE_BUCKETS[p.bucketIdx]) * 1.0;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(scaleX, 1);
        ctx.drawImage(sprite.canvas, -drawDim / 2, -drawDim / 2, drawDim, drawDim);
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="ambient-petals" aria-hidden="true" />;
}

/* ───────── Golden-ratio SVG glyphs ───────── */
const Glyph = {
  circle: (
    <svg viewBox="0 0 100 62" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <circle cx="50" cy="31" r="30.6" pathLength="1" />
      <circle cx="50" cy="31" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  goldenRect: (
    <svg viewBox="0 0 162 100" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <rect x="0.5" y="0.5" width="161" height="99" pathLength="1" />
      <line x1="100.5" y1="0" x2="100.5" y2="100" pathLength="1" />
      <line x1="100.5" y1="61.5" x2="162" y2="61.5" pathLength="1" />
      <line x1="138.5" y1="61.5" x2="138.5" y2="100" pathLength="1" />
    </svg>
  ),
  spiral: (
    <svg viewBox="0 0 162 100" fill="none" stroke="currentColor" strokeWidth="0.7" aria-hidden="true">
      <path d="M 0 100 A 100 100 0 0 1 100 0 A 62 62 0 0 1 162 62 A 38 38 0 0 1 124 100 A 24 24 0 0 1 100 76 A 15 15 0 0 1 115 61" pathLength="1" />
    </svg>
  ),
  vesica: (
    <svg viewBox="0 0 144 89" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <circle cx="50" cy="44.5" r="44" pathLength="1" />
      <circle cx="94" cy="44.5" r="44" pathLength="1" />
    </svg>
  ),
  phiLine: (
    <svg viewBox="0 0 162 6" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <line x1="0" y1="3" x2="162" y2="3" pathLength="1" />
      <circle cx="100" cy="3" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  nestedRect: (
    <svg viewBox="0 0 162 100" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden="true">
      <rect x="0.5" y="0.5" width="161" height="99" pathLength="1" />
      <rect x="62.5" y="0.5" width="99" height="99" pathLength="1" />
      <rect x="62.5" y="38.5" width="61" height="61" pathLength="1" />
      <rect x="100.5" y="38.5" width="23" height="23" pathLength="1" />
    </svg>
  ),
  arc: (
    <svg viewBox="0 0 162 100" fill="none" stroke="currentColor" strokeWidth="0.7" aria-hidden="true">
      <path d="M 0 100 A 100 100 0 0 1 100 0" pathLength="1" />
      <line x1="0" y1="100" x2="162" y2="100" strokeOpacity="0.3" pathLength="1" />
    </svg>
  ),
};

/* ───────── Quote tokenizer (preserves <em> spans, splits by word) ───────── */
function tokenizeQuote(html) {
  // Returns: array of { text, em }
  const segments = [];
  let i = 0;
  let inEm = false;
  let buf = "";
  const flush = () => { if (buf) { segments.push({ text: buf, em: inEm }); buf = ""; } };
  while (i < html.length) {
    if (html.slice(i, i + 4) === "<em>") { flush(); inEm = true; i += 4; }
    else if (html.slice(i, i + 5) === "</em>") { flush(); inEm = false; i += 5; }
    else { buf += html[i++]; }
  }
  flush();
  // Word-split each segment
  const words = [];
  segments.forEach(seg => {
    const tokens = seg.text.split(/(\s+)/);
    tokens.forEach(t => {
      if (!t) return;
      if (/^\s+$/.test(t)) {
        if (words.length) words[words.length - 1].space = (words[words.length - 1].space || "") + t;
      } else {
        words.push({ text: t, em: seg.em });
      }
    });
  });
  return words;
}

const AI_QUOTES = [
  {
    text: "Intelligence is not a ladder \u2014 it is <em>multidimensional</em>.",
    by: "Kevin Kelly",
    note: "Author, The Inevitable",
  },
  {
    text: "Society cannot function if no one is <em>accountable</em> for AI.",
    by: "Jaron Lanier",
    note: "Computer scientist & author",
  },
  {
    text: "The first ultraintelligent machine is the <em>last</em> invention that man need ever make.",
    by: "I. J. Good",
    note: "Speculations on the first ultraintelligent machine \u2014 1965",
  },
  {
    text: "The danger isn't that AI destroys us. It's that it drives us <em>insane</em>.",
    by: "Jaron Lanier",
    note: "On the social effects of AI",
  },
  {
    text: "We shape our tools, and thereafter our tools shape <em>us</em>.",
    by: "Marshall McLuhan",
    note: "Paraphrase by John Culkin \u2014 1967",
  },
  {
    text: "The future is already here \u2014 it's just not <em>evenly</em> distributed.",
    by: "William Gibson",
    note: "Quoted across two decades of interviews",
  },
];

const HOME_GATEWAYS = [
  { route: "about",        label: "About",   note: "Operator. Researcher. One essay." },
  { route: "thesis",       label: "Thesis",  note: "Seven chapters \u00b7 in progress \u00b7 contributors welcome.", flagship: true },
  { route: "game",         label: "Deploy",  note: "AI deployment simulation \u00b7 3-minute play.",                flagship: true },
  { route: "blog",         label: "Journal", note: "A few essays a year." },
  { route: "achievements", label: "Awards",  note: "A short, dated ledger." },
  { route: "contact",      label: "Contact", note: AUTHOR.email },
];

/* ───────── Section primitives ───────── */
/* ────────────────────────────────────────────────────────────────
   Compact home — 2-3 viewport layout
   Hero (72vh) · QuoteStrip (rotating) · GatewayGrid (3-col) · SignOff
   ──────────────────────────────────────────────────────────────── */

const HOME_CURRENTLY = [
  "Currently brewing — batch underway at Uiltje",
  "Currently writing — chapter draft in revision",
  "Currently reading — on the design of org structure",
  "Currently testing — a new low-alcohol recipe",
];

function HomeHero({ navigate, auth }) {
  const [idx, setIdx] = useStatePublic(0);
  useEffectPublic(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % HOME_CURRENTLY.length), 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="home2-hero">
      <div className="home2-scroll-cue" aria-hidden="true">
        <span className="home2-scroll-cue-label">Scroll</span>
        <span className="home2-scroll-cue-line"></span>
      </div>
      <div className="home2-hero-inner">
        <h1 className="home2-hero-name">
          <em>{AUTHOR.firstName}</em><br/>
          {AUTHOR.lastName}
        </h1>
        <p className="home2-hero-gist">
          I brew <em>craft beer</em> for a living and <em>research</em> about how organisations build the structures that let <em>AI deployments</em> actually earn their place.
        </p>
        <div className="home2-hero-tag">
          <span className="home2-hero-tag-dot"></span>
          <span>Master Brewer · AI Researcher · {AUTHOR.location}</span>
        </div>
        <div className="home2-hero-currently">
          <span className="home2-hero-currently-dot"></span>
          <span className="home2-hero-currently-text" key={idx}>{HOME_CURRENTLY[idx]}</span>
        </div>
      </div>
    </section>
  );
}

function HomeQuoteStrip({ quotes }) {
  const [idx, setIdx] = useStatePublic(0);
  useEffectPublic(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % quotes.length), 6500);
    return () => clearInterval(id);
  }, [quotes.length]);
  const q = quotes[idx];
  return (
    <section className="home2-quote">
      <div className="home2-quote-inner">
        <div
          className="home2-quote-text"
          key={idx}
          dangerouslySetInnerHTML={{ __html: q.text }}
        />
        <div className="home2-quote-row">
          <div className="home2-quote-by">
            <span className="home2-quote-by-name">{q.by}</span>
            <span className="home2-quote-by-note">{q.note}</span>
          </div>
          <div className="home2-quote-pager">
            {quotes.map((_, i) => (
              <button
                key={i}
                className={"home2-quote-dot" + (i === idx ? " is-active" : "")}
                onClick={() => setIdx(i)}
                aria-label={"Show quote " + (i + 1)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeGatewayGrid({ navigate }) {
  return (
    <section className="home2-grid">
      {HOME_GATEWAYS.map((g, i) => (
        <button
          key={g.route}
          className={"home2-card" + (g.flagship ? " is-flagship" : "")}
          style={{ "--i": i }}
          onClick={() => navigate(g.route)}
          type="button"
        >
          <div className="home2-card-label">{g.label}</div>
          <div className="home2-card-note">{g.note}</div>
          <div className="home2-card-arrow"><em>→</em></div>
        </button>
      ))}
    </section>
  );
}

function HomeSignOff({ navigate, auth }) {
  return (
    <section className="home2-signoff">
      <p>
        <em
          className="home2-signoff-link"
          onClick={() => navigate(auth.user ? "portal" : "signin")}
        >
          Contributors — open the research room.
        </em>
      </p>
    </section>
  );
}

/* ───────── Home ───────── */
function HomePage({ navigate, auth }) {
  return (
    <main className="page-fade home-page">
      <HomeHero navigate={navigate} auth={auth} />
      <HomeQuoteStrip quotes={AI_QUOTES} />
      <HomeGatewayGrid navigate={navigate} />
      <HomeSignOff navigate={navigate} auth={auth} />
    </main>
  );
}

/* ───────── About ───────── */
function AboutPage({ navigate }) {
  return (
    <main className="page-fade">
      <div className="page">
        <div className="about-grid">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ About — who am I</span>
            <h1>
              Brewer.<br/>
              Operator.<br/>
              <em>Researcher</em>.
            </h1>
            <div className="about-body">
              <p>I am a brewer, operations leader, and AI &amp; Business Innovation student based in the Netherlands. My work sits at the intersection of craft beer, operations, digital transformation, and organisational design.</p>
              <p>I currently work in brewery operations at <em>Uiltje Brewing Company</em> and have been closely involved in scaling recipes, improving production systems, managing quality, and building practical tools that help teams work better.</p>
              <p>Over the past few years I have worked across brewing, quality, production planning, procurement, ERP systems, team leadership, and process improvement. I enjoy solving the messy real-world problems where people, systems, data, and business priorities all overlap.</p>
              <p>One of my biggest strengths is <em>building structure where there is complexity</em>. At Uiltje, I helped develop and maintain a custom Google Sheets and Google Cloud-based production, quality, and ERP system that supports day-to-day brewery operations. It gave me a practical understanding of how digital systems can improve decision-making, reduce manual work, and make teams more effective.</p>
              <p>I am also pursuing an MSc in Management with a focus on AI and Business Innovation. My research explores how organisations can deploy AI in a structured, scalable, and responsible way. I am especially interested in how AI transformation should go beyond isolated use cases and become embedded into company structure, governance, workflows, and team capabilities.</p>
              <p>My approach is practical, curious, and systems-driven. I like combining hands-on operational experience with academic thinking to create solutions that are useful in the real world.</p>
              <p>This site is a place to share my work, research, ideas, and projects across <em>brewing, AI deployment, business transformation, and leadership</em>.</p>
            </div>
            <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => navigate("thesis")}>Read the thesis →</button>
              <button className="btn btn-quiet" onClick={() => navigate("contact")}>Write to me</button>
            </div>
          </div>
          <aside className="about-aside">
            <Placeholder label="editorial portrait" className="tall" />
            <Marginalia rows={[
              { k: "Currently brewing", v: "Uiltje · Royal Swinkels · De Molen" },
              { k: "Currently studying", v: "MSc Management · UvA" },
              { k: "Certified", v: "Brewmaster · VLB Berlin (2018)" },
              { k: "Fluent in", v: "English · Telugu · Hindi" },
              { k: "Elementary", v: "German · Dutch" },
              { k: "Based in", v: AUTHOR.location },
              { k: "Connect", v: "linkedin.com/in/adityaparupudi" },
            ]} />
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ───────── Thesis ───────── */
function ThesisPage({ navigate, auth }) {
  return (
    <main className="page-fade">
      <div className="page">
        <div className="thesis-jacket">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 24 }}>§ Thesis — public reading layer</span>
            <h1>Deciding to <em>Deploy</em>.</h1>
            <p className="thesis-abstract">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.
            </p>
            <div style={{ marginTop: 36, maxWidth: "60ch" }}>
              <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--fg-2)", margin: 0 }}>
                <strong style={{ fontWeight: 500, color: "var(--fg)" }}>Foreword (in plain language).</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur — the real foreword will land here once the manuscript settles.
              </p>
            </div>
            <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn btn-primary">Download PDF (placeholder)</button>
              <button className="btn" onClick={() => navigate(auth.user ? "portal" : "signin")}>
                {auth.user ? "Open contributor portal →" : "Contributor sign-in →"}
              </button>
            </div>
          </div>
          <div>
            <div className="thesis-meta">
              <div className="thesis-meta-row">
                <span className="k">Author</span>
                <span className="v">{AUTHOR.full}</span>
              </div>
              <div className="thesis-meta-row">
                <span className="k">Institution</span>
                <span className="v">{AUTHOR.institution}</span>
              </div>
              <div className="thesis-meta-row">
                <span className="k">Status</span>
                <span className="v"><em>{AUTHOR.status}</em></span>
              </div>
              <div className="thesis-meta-row">
                <span className="k">Length</span>
                <span className="v">≈ 272 pp · 7 chapters</span>
              </div>
              <div className="thesis-meta-row">
                <span className="k">Contributors</span>
                <span className="v">17 named · 4 anonymous</span>
              </div>
              <div className="thesis-meta-row">
                <span className="k">Suggested citation</span>
                <span className="v" style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.5, fontStyle: "normal" }}>
                  Parupudi, A. (forthcoming). <em>Deciding to Deploy.</em> MSc Management · AI & Business Innovation.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter index */}
        <section className="section">
          <div className="section-head">
            <div className="kicker">
              <span className="num">§ Table of Chapters</span>
              <span className="label">Placeholders — to be replaced.</span>
            </div>
            <h2>Seven chapters, one <em>argument</em>.</h2>
          </div>
          <div className="chapter-list">
            {CHAPTERS.map((ch, i) => (
              <div key={i} className="chapter-list-row">
                <span className="ch-num">{ch.num}.</span>
                <span className="ch-title">{ch.title}</span>
                <span className="ch-pages">{ch.pages}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Key figures */}
        <section className="section">
          <div className="section-head">
            <div className="kicker">
              <span className="num">§ Key figures</span>
              <span className="label">Selected · placeholder</span>
            </div>
            <h2>The argument, in <em>three</em> figures.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <Placeholder label="fig. 1 — placeholder" className="square" />
            <Placeholder label="fig. 2 — placeholder" className="square" />
            <Placeholder label="fig. 7 — placeholder" className="square" />
          </div>
        </section>

        {/* Sign-in invitation block */}
        <section className="section">
          <div className="portal-door" style={{ marginTop: 0 }}>
            <div>
              <div className="door-title">
                A contributor? Open the <em>research room</em>.
              </div>
              <div className="door-sub">Your contribution · the changelog · add an update</div>
            </div>
            <button className="btn btn-primary" onClick={() => navigate(auth.user ? "portal" : "signin")}>
              {auth.user ? "Open portal →" : "Sign in →"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ───────── Blog index ───────── */
function BlogPage({ navigate }) {
  return (
    <main className="page-fade">
      <div className="page">
        <section style={{ padding: "72px 0 40px" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ The Journal</span>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
            <em>A few</em> posts a year.<br />
            Each one a small <em>event</em>.
          </h1>
          <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-2)", marginTop: 22, maxWidth: "48ch" }}>
            Long essays, field notes from the brewery, and the occasional short marginalia. Nothing scheduled — only published when it's ready.
          </p>
        </section>

        <section className="section">
          <div className="editorial-list">
            {BLOG_POSTS.map(p => (
              <div key={p.slug} className="editorial-list-row" onClick={() => navigate("post/" + p.slug)}>
                <span className="row-date">{p.date}</span>
                <span className="row-cat">{p.category}</span>
                <span className="row-title" dangerouslySetInnerHTML={{ __html: p.title }}></span>
                <span className="row-arrow">→</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ───────── Blog post ───────── */
function BlogPostPage({ navigate, route }) {
  const post = BLOG_POSTS.find(p => p.slug === route.params.id);
  if (!post) {
    return (
      <main className="page-fade">
        <div className="page" style={{ padding: "120px 0" }}>
          <h1>Post not found.</h1>
          <p style={{ marginTop: 18 }}><EditorialLink onClick={() => navigate("blog")}>Back to the journal</EditorialLink></p>
        </div>
      </main>
    );
  }
  return (
    <main className="page-fade">
      <div className="page">
        <div className="post-wrap">
          <div className="post-eyebrow">{post.date} · {post.category} · {post.minutes}</div>
          <h1 className="post-title" dangerouslySetInnerHTML={{ __html: post.title }}></h1>
          <p className="post-dek">{post.dek}</p>
          <div className="post-body">
            {post.body.map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: para }}></p>
            ))}
          </div>
          <div style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <EditorialLink onClick={() => navigate("blog")}>All posts</EditorialLink>
            <span className="label">Filed under · {post.category}</span>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────── Work ───────── */
function WorkPage({ navigate }) {
  return (
    <main className="page-fade">
      <div className="page">
        <section style={{ padding: "72px 0 40px" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Work</span>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 88px)", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
            Selected practice — <em>operator</em>, <em>researcher</em>, <em>advisor</em>.
          </h1>
        </section>

        <section className="section">
          <div className="editorial-list">
            {WORK_ITEMS.map((w, i) => (
              <div key={i} className="editorial-list-row" style={{ cursor: "default" }}>
                <span className="row-date">{w.year}</span>
                <span className="row-cat" dangerouslySetInnerHTML={{ __html: w.role }}></span>
                <span className="row-title">{w.title}</span>
                <span className="row-arrow" style={{ visibility: "hidden" }}>→</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "200px 1fr", gap: 56 }}>
            <span className="label">Notes</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {WORK_ITEMS.map((w, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, padding: "14px 0", borderTop: "1px solid var(--line)" }}>
                  <span className="label" style={{ color: "var(--fg-2)" }}>{w.title}</span>
                  <p style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.5, margin: 0, color: "var(--fg-2)" }}>{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ───────── Achievements ───────── */
function YearAccordion({ group, defaultOpen = false }) {
  const [open, setOpen] = useStatePublic(defaultOpen);
  const medalCount = group.competitions.reduce((sum, c) => sum + c.wins.length, 0);
  return (
    <div className={"year-accordion" + (open ? " is-open" : "")}>
      <button
        type="button"
        className="year-accordion-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="ya-year">{group.year}</span>
        <span className="ya-summary">{group.summary}</span>
        <span className="ya-count">{medalCount} {medalCount === 1 ? "medal" : "medals"}</span>
        <span className="ya-toggle" aria-hidden="true">{open ? "—" : "+"}</span>
      </button>
      <div className="year-accordion-body" aria-hidden={!open}>
        <div className="year-accordion-inner">
          {group.competitions.map((comp, i) => (
            <div key={i} className="comp-block">
              <div className="comp-head">{comp.name}</div>
              <div className="comp-wins">
                {comp.wins.map((win, j) => (
                  <div key={j} className={"win-row win-" + win.medal.toLowerCase()}>
                    <span className="win-medal">{win.medal}</span>
                    <span className="win-beer"><em>{win.beer}</em>{win.note && <span className="win-extra"> — {win.note}</span>}</span>
                    <span className="win-cat">{win.category}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AchievementsPage() {
  return (
    <main className="page-fade">
      <div className="page">
        <section style={{ padding: "72px 0 40px" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Achievements — Uiltje wins</span>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.02em" }}>
            A short, <em>dated</em> ledger.
          </h1>
          <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-2)", marginTop: 22, maxWidth: "56ch" }}>
            Headline wins from six years of brewing at Uiltje. Expand any year for the full medal list.
          </p>
        </section>

        {/* Headline wins — editorial callouts */}
        <section className="section" style={{ borderTop: "1px solid var(--fg)" }}>
          <div className="section-head">
            <div className="kicker">
              <span className="num">§ Headline wins</span>
              <span className="label">Three from the ledger</span>
            </div>
            <h2>The wins <em>worth</em> remembering.</h2>
          </div>
          <div className="headline-wins">
            {HEADLINE_WINS.map((q, i) => (
              <article key={i} className="headline-win">
                <span className="hw-num">{String(i + 1).padStart(2, "0")}</span>
                <blockquote className="hw-quote" dangerouslySetInnerHTML={{ __html: "“" + q.text + "”" }} />
              </article>
            ))}
          </div>
        </section>

        {/* Full ledger — expandable per year */}
        <section className="section">
          <div className="section-head">
            <div className="kicker">
              <span className="num">§ Full ledger</span>
              <span className="label">2021 — 2026 · click to expand</span>
            </div>
            <h2>Every <em>medal</em>, by year.</h2>
          </div>
          <div className="ledger-stack">
            {AWARD_GROUPS.map((g, i) => (
              <YearAccordion key={g.year} group={g} defaultOpen={i === 0} />
            ))}
          </div>
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "200px 1fr", gap: 56 }}>
            <span className="label">Coda</span>
            <p style={{ fontFamily: "var(--serif)", fontSize: 18, color: "var(--fg-2)", maxWidth: "60ch", margin: 0 }}>
              Six years, multiple competitions, dozens of medals. The ledger is updated as new results come in — currently scheduled to refresh after each Dutch Beer Challenge.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ───────── Contact ───────── */
function ContactPage() {
  return (
    <main className="page-fade">
      <div className="page">
        <div className="contact-wrap">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 24 }}>§ Contact — door</span>
            <h1><em>Write</em><br/>to me.</h1>
            <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, color: "var(--fg-2)", marginTop: 24, maxWidth: "32ch", lineHeight: 1.4 }}>
              I read everything. I reply to most of it, eventually.
            </p>
          </div>
          <div>
            <a className="contact-email" href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>
            <div className="contact-lines">
              <div className="contact-line">
                <span className="k">LinkedIn</span>
                <span className="v">
                  <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className="text-link">
                    /in/adityaparupudi
                  </a>
                </span>
              </div>
              <div className="contact-line">
                <span className="k">Thesis &amp; research</span>
                <span className="v">thesis@adityaparupudi.com</span>
              </div>
              <div className="contact-line">
                <span className="k">Based in</span>
                <span className="v"><em>{AUTHOR.location}</em></span>
              </div>
              <div className="contact-line">
                <span className="k">Practice</span>
                <span className="v">{AUTHOR.brewery}</span>
              </div>
              <div className="contact-line">
                <span className="k">Fluent</span>
                <span className="v">English · Telugu · Hindi</span>
              </div>
              <div className="contact-line">
                <span className="k">Elementary</span>
                <span className="v"><em>German · Dutch</em></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, {
  HomePage, AboutPage, ThesisPage, BlogPage, BlogPostPage,
  WorkPage, AchievementsPage, ContactPage,
  AmbientPetals, SectionFlower,
});

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

function AmbientPetals({ enabled = true }) {
  const canvasRef = useRefPublic(null);

  useEffectPublic(() => {
    if (!enabled) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

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

    const KINDS = ['petal','leaf','flower5','flower4','sprig','bud','fern'];
    const KIND_WEIGHTS = [0.28, 0.20, 0.10, 0.08, 0.12, 0.14, 0.08]; // sums to 1
    const pickKind = () => {
      const r = Math.random();
      let acc = 0;
      for (let i = 0; i < KINDS.length; i++) {
        acc += KIND_WEIGHTS[i];
        if (r < acc) return KINDS[i];
      }
      return 'petal';
    };

    const COUNT = 30;
    const particles = [];
    const seed = () => {
      for (let i = 0; i < COUNT; i++) {
        const kind = pickKind();
        particles.push({
          kind,
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight * 1.4 - window.innerHeight * 0.2,
          vx: 0.14 + Math.random() * 0.38,
          vy: 0.04 + Math.random() * 0.20,
          size: 4 + Math.random() * (kind === 'fern' ? 9 : kind.startsWith('flower') ? 7 : 6),
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.012,
          bobPhase: Math.random() * Math.PI * 2,
          bobFreq: 0.4 + Math.random() * 1.3,
          bobAmp: 0.18 + Math.random() * 0.5,
          opacity: 0.06 + Math.random() * 0.13,
          accent: Math.random() < 0.10, // 10% in accent color
        });
      }
    };
    seed();

    let scrollVel = 0;
    let lastScroll = window.scrollY;
    const onScroll = () => {
      const s = window.scrollY;
      scrollVel = scrollVel * 0.78 + (s - lastScroll) * 0.06;
      lastScroll = s;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    let rafId, lastT = performance.now();
    const tick = (t) => {
      const dt = Math.min(2.5, (t - lastT) / 16.67);
      lastT = t;
      scrollVel *= 0.94;

      const styles = getComputedStyle(document.documentElement);
      const baseColor   = (styles.getPropertyValue('--fg-3').trim()  || '#888');
      const accentColor = (styles.getPropertyValue('--accent').trim() || '#2d4fe0');

      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Slight diagonal bias guides the eye downward-right
      const wind = 1 + Math.abs(scrollVel) * 0.35;
      const verticalKick = scrollVel * 0.6;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.bobPhase += p.bobFreq * dt * 0.02;
        const swayX = Math.sin(p.bobPhase + t * 0.0005) * p.bobAmp * 1.4;
        const swayY = Math.cos(p.bobPhase * 0.7) * p.bobAmp * 0.4;
        p.x += (p.vx * wind + swayX) * dt;
        p.y += (p.vy * wind + verticalKick + swayY) * dt;
        p.rot += p.vrot * dt;

        // Wrap around the viewport
        if (p.x > w + 30) { p.x = -30; p.y = Math.random() * h; }
        if (p.x < -30)    { p.x = w + 30; p.y = Math.random() * h; }
        if (p.y > h + 30) { p.y = -30; p.x = Math.random() * w; }
        if (p.y < -30)    { p.y = h + 30; p.x = Math.random() * w; }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        const col = p.accent ? accentColor : baseColor;
        ctx.fillStyle = col;
        ctx.strokeStyle = col;

        const sz = p.size;
        switch (p.kind) {
          case 'petal': {
            ctx.beginPath();
            ctx.moveTo(0, -sz);
            ctx.quadraticCurveTo(sz * 0.75, 0, 0, sz);
            ctx.quadraticCurveTo(-sz * 0.75, 0, 0, -sz);
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'leaf': {
            ctx.beginPath();
            ctx.ellipse(0, 0, sz * 0.36, sz * 1.15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = p.opacity * 0.55;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, -sz * 1.15);
            ctx.lineTo(0, sz * 1.15);
            ctx.stroke();
            break;
          }
          case 'flower5': {
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2;
              ctx.save();
              ctx.rotate(a);
              ctx.beginPath();
              ctx.ellipse(0, -sz * 0.55, sz * 0.36, sz * 0.7, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            ctx.globalAlpha = p.opacity * 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.25, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'flower4': {
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2;
              ctx.save();
              ctx.rotate(a);
              ctx.beginPath();
              ctx.ellipse(0, -sz * 0.55, sz * 0.42, sz * 0.78, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            ctx.globalAlpha = p.opacity * 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.20, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'sprig': {
            ctx.lineWidth = 0.7;
            ctx.globalAlpha = p.opacity * 0.85;
            ctx.beginPath();
            ctx.moveTo(0, -sz);
            ctx.bezierCurveTo(-sz * 0.5, -sz * 0.3, sz * 0.5, sz * 0.3, 0, sz);
            ctx.stroke();
            ctx.globalAlpha = p.opacity * 1.3;
            ctx.beginPath();
            ctx.ellipse(-sz * 0.5, -sz * 0.15, sz * 0.2, sz * 0.45, -0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(sz * 0.45, sz * 0.2, sz * 0.2, sz * 0.45, 0.55, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'bud': {
            ctx.globalAlpha = p.opacity * 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.40, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'fern': {
            ctx.lineWidth = 0.6;
            ctx.globalAlpha = p.opacity * 0.8;
            ctx.beginPath();
            ctx.moveTo(0, -sz);
            ctx.lineTo(0, sz);
            ctx.stroke();
            ctx.globalAlpha = p.opacity * 1.1;
            for (let k = 0; k < 5; k++) {
              const side = k % 2 === 0 ? 1 : -1;
              const y = -sz + (k + 0.5) * (sz * 2 / 5);
              const len = sz * 0.55 * (1 - Math.abs(k - 2) * 0.18);
              ctx.beginPath();
              ctx.ellipse(side * len * 0.5, y, len * 0.45, sz * 0.13, side > 0 ? -0.5 : 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          default: {
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
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
    glyph: "vesica",
    tone: "expansive",
  },
  {
    text: "Society cannot function if no one is <em>accountable</em> for AI.",
    by: "Jaron Lanier",
    note: "Computer scientist & author",
    glyph: "nestedRect",
    tone: "cautionary",
  },
  {
    text: "The first ultraintelligent machine is the <em>last</em> invention that man need ever make.",
    by: "I. J. Good",
    note: "Speculations on the first ultraintelligent machine \u2014 1965",
    glyph: "spiral",
    tone: "philosophical",
  },
  {
    text: "The danger isn't that AI destroys us. It's that it drives us <em>insane</em>.",
    by: "Jaron Lanier",
    note: "On the social effects of AI",
    glyph: "arc",
    tone: "cautionary",
  },
];

const HOME_GATEWAYS = [
  { route: "about",        label: "About",   note: "Operator. Researcher. One essay.", glyph: "goldenRect" },
  { route: "thesis",       label: "Thesis",  note: "Seven chapters · in progress · contributors welcome.", glyph: "spiral", flagship: true },
  { route: "blog",         label: "Journal", note: "A few essays a year.", glyph: "phiLine" },
  { route: "achievements", label: "Awards",  note: "A short, dated ledger.", glyph: "nestedRect" },
  { route: "contact",      label: "Contact", note: AUTHOR.email, glyph: "circle" },
];

/* ───────── Section primitives ───────── */
function HomeQuote({ index, total, quote }) {
  const [ref, shown] = useReveal(0.3);
  const words = tokenizeQuote(quote.text);
  const flowerSide = index % 2 === 0 ? "right" : "left";
  const stampSide  = index % 2 === 0 ? "left"  : "right";
  return (
    <section ref={ref} className="home-section home-section-quote" data-shown={shown}>
      <SectionFlower
        variant={["daisy", "bloom", "fern", "sprig", "rose"][index % 5]}
        placement={flowerSide}
      />
      <SectionStamp index={index} kind={quote.tone} placement={stampSide} shown={shown} />
      <div className="home-section-marker">
        <span className="home-section-num">{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="home-section-kind"><ScrambleText trigger={shown} duration={900}>{`— Voice ${quote.tone}`}</ScrambleText></span>
      </div>
      <div className="home-section-inner">
        <div className="home-glyph">{Glyph[quote.glyph]}</div>
        <blockquote className="home-quote">
          <span className="home-quote-mark home-quote-mark-open">“</span>
          {words.map((w, i) => (
            <span key={i} className="home-quote-word" style={{ "--i": i }}>
              {w.em ? <em>{w.text}</em> : w.text}
              {w.space || " "}
            </span>
          ))}
          <span className="home-quote-mark home-quote-mark-close" style={{ "--i": words.length }}>”</span>
        </blockquote>
        <div className="home-attribution">
          <span className="home-attribution-by">{quote.by}</span>
          <span className="home-attribution-note">{quote.note}</span>
        </div>
      </div>
    </section>
  );
}

function HomeGateway({ index, total, gateway, navigate }) {
  const [ref, shown] = useReveal(0.3);
  const chars = gateway.label.split("");
  const flowerSide = index % 2 === 0 ? "right" : "left";
  const stampSide  = index % 2 === 0 ? "left"  : "right";
  return (
    <section ref={ref} className={"home-section home-section-link" + (gateway.flagship ? " is-flagship" : "")} data-shown={shown} onClick={() => navigate(gateway.route)}>
      <SectionFlower
        variant={["bloom", "rose", "sprig", "daisy", "fern"][index % 5]}
        placement={flowerSide}
      />
      <SectionStamp index={index} kind={gateway.label} placement={stampSide} shown={shown} />
      <div className="home-section-marker">
        <span className="home-section-num">{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="home-section-kind"><ScrambleText trigger={shown} duration={900}>— Section · click to enter</ScrambleText></span>
      </div>
      <div className="home-section-inner">
        <div className="home-glyph">{Glyph[gateway.glyph]}</div>
        <div className="home-link" tabIndex={0} role="link">
          <span className="home-link-label">
            {chars.map((c, i) => (
              <span key={i} className="home-link-letter" style={{ "--i": i }}>{c === " " ? "\u00a0" : c}</span>
            ))}
          </span>
          <span className="home-link-arrow" style={{ "--i": chars.length }}>→</span>
        </div>
        <div className="home-link-meta">
          {gateway.note}
        </div>
      </div>
    </section>
  );
}

/* ───────── Interlude — orbital animation + HUD ───────── */
const HUD_STATES   = ["Steady", "Holding", "Phasing", "Aligned", "Resolving"];
const HUD_PHASES   = ["I", "II", "III", "IV", "V", "VI", "VII"];
const HUD_OUTPUTS  = ["—", "↑", "→", "↓", "○", "·", "✕"];

function HomeInterlude({ index, total }) {
  const [ref, shown] = useReveal(0.35);
  const svgRef = useRefPublic(null);
  const mouseRef = useRefPublic({ x: 0.5, y: 0.5 });
  const tempoRef = useRefPublic(1);
  const [readout, setReadout] = useStatePublic({
    state: "Steady", tempo: "1.000", phase: "I", output: "—",
  });
  const [ripples, setRipples] = useStatePublic([]);
  const [interacted, setInteracted] = useStatePublic(false);

  // rAF orbit loop — direct DOM writes, no React re-renders
  useEffectPublic(() => {
    if (!shown) return;
    let rafId;
    const phi = 1.618;
    const speeds = [0.40, -0.40 / phi, 0.40 / (phi * phi)];
    const radii  = [34, 34 / phi, 34 / (phi * phi)];
    const offsets = [0, 2.094, 4.189]; // 120° apart

    const tick = (ts) => {
      const svg = svgRef.current;
      if (svg) {
        const t = ts / 1000;
        const m = mouseRef.current;
        const dx = (m.x - 0.5) * 5;
        const dy = (m.y - 0.5) * 5;
        const tempo = tempoRef.current;
        for (let i = 0; i < 3; i++) {
          const ang = t * speeds[i] * tempo + offsets[i];
          const x = 50 + Math.cos(ang) * radii[i] + dx;
          const y = 50 + Math.sin(ang) * radii[i] + dy;
          const el = svg.querySelector(`[data-orbit="${i}"]`);
          if (el) el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [shown]);

  // HUD readout cycle
  useEffectPublic(() => {
    if (!shown) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setReadout({
        state:  HUD_STATES[i % HUD_STATES.length],
        tempo:  (1.0 + (Math.random() * 0.618 - 0.309)).toFixed(3),
        phase:  HUD_PHASES[i % HUD_PHASES.length],
        output: HUD_OUTPUTS[i % HUD_OUTPUTS.length],
      });
    }, 1800);
    return () => clearInterval(id);
  }, [shown]);

  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  };
  const handleEnter = () => { tempoRef.current = 1.4; setInteracted(true); };
  const handleLeave = () => { tempoRef.current = 1; };
  const handleClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Math.random().toString(36).slice(2);
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(rr => rr.id !== id)), 1500);
    tempoRef.current = 2.5;
    setTimeout(() => { tempoRef.current = mouseRef.current ? 1.4 : 1; }, 600);
    setInteracted(true);
  };

  return (
    <section ref={ref} className="home-section home-section-interlude" data-shown={shown}>
      <SectionFlower variant="fern" placement="left" />
      <SectionStamp index={index} kind="MOTION" placement="right" shown={shown} />
      <div className="home-section-marker">
        <span className="home-section-num">{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="home-section-kind"><ScrambleText trigger={shown} duration={900}>— Interlude · the work in motion</ScrambleText></span>
      </div>
      <div className="home-section-inner">
        <div className="interlude-eyebrow">
          Three nodes · one center · golden ratios.
        </div>
        <div
          className="interlude-stage"
          onMouseMove={handleMove}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={handleClick}
        >
          <svg ref={svgRef} viewBox="0 0 100 100" className="interlude-canvas" preserveAspectRatio="xMidYMid meet">
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="40%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Orbit guide rings (φ-ratio radii) */}
            <circle cx="50" cy="50" r="34"   fill="none" stroke="currentColor" strokeOpacity="0.10" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="21.0" fill="none" stroke="currentColor" strokeOpacity="0.13" strokeWidth="0.2" />
            <circle cx="50" cy="50" r="13.0" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.2" />

            {/* Center field + dot */}
            <circle cx="50" cy="50" r="16" fill="url(#centerGlow)" />
            <circle cx="50" cy="50" r="0.9" fill="currentColor" />

            {/* Ripples on click */}
            {ripples.map(r => (
              <circle key={r.id} className="interlude-ripple" cx={r.x} cy={r.y} r="0" fill="none" stroke="currentColor" strokeWidth="0.4" />
            ))}

            {/* Orbiting nodes */}
            <g data-orbit="0" className="orbit-node" transform="translate(84 50)">
              <circle cx="0" cy="0" r="2.6" fill="currentColor" />
              <text x="4.5" y="1" className="orbit-label">Operator</text>
            </g>
            <g data-orbit="1" className="orbit-node" transform="translate(50 29)">
              <circle cx="0" cy="0" r="2.0" fill="currentColor" />
              <text x="3.6" y="0.7" className="orbit-label">Researcher</text>
            </g>
            <g data-orbit="2" className="orbit-node orbit-node-accent" transform="translate(60 50)">
              <circle cx="0" cy="0" r="1.6" fill="var(--accent)" />
              <text x="3" y="0.5" className="orbit-label">Model</text>
            </g>
          </svg>

          <aside className="interlude-hud" aria-hidden="true">
            <div className="interlude-hud-row">
              <span className="k">State</span>
              <span className="v">{readout.state}</span>
            </div>
            <div className="interlude-hud-row">
              <span className="k">Tempo</span>
              <span className="v">{readout.tempo}</span>
            </div>
            <div className="interlude-hud-row">
              <span className="k">Phase</span>
              <span className="v">{readout.phase}</span>
            </div>
            <div className="interlude-hud-row">
              <span className="k">Output</span>
              <span className="v">{readout.output}</span>
            </div>
            <div className="interlude-instruction">
              <div>{interacted ? "Click — pulse." : "Move cursor — accelerate."}</div>
              <div className="dim">Three nodes, one model.</div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function HomeHud({ progress, current, total }) {
  const elapsed = useElapsed();
  const counterText = `Section ${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  return (
    <div className="home-hud" aria-hidden="true">
      <span className="home-hud-line">
        <ScrambleText trigger={true} duration={900}>{counterText}</ScrambleText>
      </span>
      <span className="home-hud-line dim">T+ {fmtClock(elapsed)}</span>
      <div className="home-hud-progress"><span style={{ transform: `scaleX(${progress})` }}></span></div>
    </div>
  );
}

/* ───────── Home ───────── */
function HomePage({ navigate, auth }) {
  // 1-indexed sections: hero (1) + items (2..N-1) + sign-off (N)
  const total = 1 + AI_QUOTES.length + HOME_GATEWAYS.length + 1;

  // Track which section is most prominent (for HUD counter)
  const [current, setCurrent] = useStatePublic(1);
  const progress = useScrollProgress();
  const rootRef = useRefPublic(null);
  usePrompter();

  useEffectPublic(() => {
    const sections = document.querySelectorAll(".home-section");
    if (!sections.length) return;
    const obs = new IntersectionObserver((entries) => {
      let best = null;
      entries.forEach(e => {
        if (e.intersectionRatio > (best ? best.intersectionRatio : 0)) best = e;
      });
      if (best && best.intersectionRatio > 0.4) {
        const idx = Array.from(sections).indexOf(best.target);
        if (idx >= 0) setCurrent(idx + 1);
      }
    }, { threshold: [0.4, 0.6, 0.8] });
    sections.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // Build the interleaved order (quote, gateway, quote, gateway, …) — keeps all gateways even when fewer quotes
  const items = [];
  const maxLen = Math.max(AI_QUOTES.length, HOME_GATEWAYS.length);
  for (let i = 0; i < maxLen; i++) {
    if (AI_QUOTES[i])     items.push({ kind: "quote",   quote:   AI_QUOTES[i] });
    if (HOME_GATEWAYS[i]) items.push({ kind: "gateway", gateway: HOME_GATEWAYS[i] });
  }

  return (
    <main className="page-fade home-page" ref={rootRef}>
      <HomeHero navigate={navigate} auth={auth} index={1} total={total} />
      {items.map((item, i) => {
        const idx = i + 2; // hero=1, items start at 2
        if (item.kind === "quote") {
          return <HomeQuote key={"q" + i} index={idx} total={total} quote={item.quote} />;
        }
        return <HomeGateway key={"g" + i} index={idx} total={total} gateway={item.gateway} navigate={navigate} />;
      })}
      <HomeSignOff navigate={navigate} auth={auth} index={total} total={total} />
      <HomeHud progress={progress} current={current} total={total} />
    </main>
  );
}

function HomeHero({ navigate, auth, index, total }) {
  const [ref, shown] = useReveal(0.1);
  const lastBits = AUTHOR.lastName.split(" ");
  const nameWords = [
    { text: AUTHOR.firstName, em: true, br: true },
    ...lastBits.map(w => ({ text: w, em: false })),
  ];
  return (
    <section ref={ref} className="home-section home-section-hero" data-shown={shown}>
      <SectionFlower variant="rose" placement="right" />
      <SectionStamp index={index} kind="INDEX" placement="left" shown={shown} />
      <div className="home-section-marker">
        <span className="home-section-num">{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="home-section-kind"><ScrambleText trigger={shown} duration={900}>— Index</ScrambleText></span>
      </div>
      <div className="home-section-inner">
        <div className="home-glyph">{Glyph.spiral}</div>
        <h1 className="home-hero-name">
          {nameWords.map((w, i) => (
            <React.Fragment key={i}>
              <span className="home-quote-word" style={{ "--i": i }}>
                {w.em ? <em>{w.text}</em> : w.text}
                {w.br ? "" : " "}
              </span>
              {w.br && <br />}
            </React.Fragment>
          ))}
        </h1>
        <div className="home-hero-tag" style={{ "--i": nameWords.length + 1 }}>
          <span className="home-hero-tag-dot"></span>
          <span>Master Brewer · Royal Swinkels · MSc UvA · {AUTHOR.location}</span>
        </div>
        <div className="home-hero-prompt" style={{ "--i": nameWords.length + 2 }}>
          Scroll for quotes and a way in.
        </div>
      </div>
    </section>
  );
}

function HomeSignOff({ navigate, auth, index, total }) {
  const [ref, shown] = useReveal(0.3);
  return (
    <section ref={ref} className="home-section home-section-signoff" data-shown={shown}>
      <SectionFlower variant="sprig" placement="right" />
      <SectionStamp index={index} kind="END" placement="left" shown={shown} />
      <div className="home-section-marker">
        <span className="home-section-num">{String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        <span className="home-section-kind"><ScrambleText trigger={shown} duration={900}>— End of index</ScrambleText></span>
      </div>
      <div className="home-section-inner">
        <div className="home-glyph">{Glyph.phiLine}</div>
        <div className="home-signoff-line">
          You've seen the index.<br/>
          <em onClick={() => navigate(auth.user ? "portal" : "signin")} style={{ cursor: "pointer", borderBottom: "1px solid currentColor" }}>
            Contributors — open the back room.
          </em>
        </div>
        <div className="home-signoff-meta">
          Or pick a door above.
        </div>
      </div>
    </section>
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
                A contributor? Open the <em>back room</em>.
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

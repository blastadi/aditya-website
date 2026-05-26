/* ════════════════════════════════════════════════════════════════
   DEPLOY · app.jsx
   Phase 4 — eight-screen flow:
     landing → theme-select → theme-background → briefing-room
            → pressure-ramp → play → reveal
   Persistent 📚 Research Backbone icon top-right on every screen
   EXCEPT 'play' and 'pressure-ramp' (per brief §7).
   ════════════════════════════════════════════════════════════════ */

const { useState, useEffect, useRef } = React;

const SCREEN = {
  LANDING:    "landing",
  SELECT:     "theme-select",
  BACKGROUND: "theme-background",
  BRIEFING:   "briefing-room",
  RAMP:       "pressure-ramp",
  PLAY:       "play",
  REVEAL:     "reveal",
};

function checkScaffold() {
  return [
    { name: "React 18",          ok: typeof React !== "undefined" && typeof ReactDOM !== "undefined" },
    { name: "Babel Standalone",  ok: typeof window.Babel !== "undefined" },
    { name: "Phaser 3.80+",      ok: typeof window.Phaser !== "undefined" && !!window.Phaser.VERSION },
    { name: "Howler",            ok: typeof window.Howl !== "undefined" },
    { name: "eventBus",          ok: typeof window.eventBus === "object" },
    { name: "engineRules",       ok: typeof window.engineRules === "object" && !!window.engineRules.loadTheme },
    { name: "PreloadScene",      ok: typeof window.PreloadScene === "function" },
    { name: "PlayScene",         ok: typeof window.PlayScene === "function" },
    { name: "PhaserGame",        ok: typeof window.PhaserGame === "function" },
    { name: "HUD",               ok: typeof window.HUD === "function" },
    { name: "PressureFeed",      ok: typeof window.PressureFeed === "function" },
    { name: "Lives",             ok: typeof window.Lives === "function" },
    { name: "QuarterTransition", ok: typeof window.QuarterTransition === "function" },
    { name: "Q4ForcedChoice",    ok: typeof window.Q4ForcedChoice === "function" },
    { name: "ArchetypeReveal",   ok: typeof window.ArchetypeReveal === "function" },
    { name: "ThemeSelect",       ok: typeof window.ThemeSelect === "function" },
    { name: "ThemeBackground",   ok: typeof window.ThemeBackground === "function" },
    { name: "BriefingRoom",      ok: typeof window.BriefingRoom === "function" },
    { name: "PressureRamp",      ok: typeof window.PressureRamp === "function" },
    { name: "ResearchBackbone",  ok: typeof window.ResearchBackbone === "function" },
    { name: "CrisisOverlay",     ok: typeof window.CrisisOverlay === "function" },
  ];
}

/* ──────────────────────────────────────────────────────────────
   Screen 1 · Landing
   ────────────────────────────────────────────────────────────── */
function Landing({ onStart }) {
  const [scaffold] = useState(checkScaffold);
  const allOk = scaffold.every((s) => s.ok);
  const missing = scaffold.filter((s) => !s.ok);

  return (
    <div className="landing">
      <h1>DEPLOY</h1>
      <p className="tagline">
        A 3-minute simulation of one fiscal year as an AI deployment manager. The pattern of your
        choices reveals the manager you became.
      </p>

      {missing.length > 0 && (
        <ul className="scaffold-list" aria-label="missing dependencies">
          {missing.map((s) => (
            <li key={s.name} className="failing">{s.name} MISSING</li>
          ))}
        </ul>
      )}

      <button onClick={onStart} disabled={!allOk}>
        {allOk ? "Start →" : "Scaffold incomplete"}
      </button>

      <div className="landing-foot">
        Master of Management classroom prototype · Phase 4 · five themes (one live, four arriving in Phase 5)
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 6 · PlayScreen — wires HUD / Phaser / Feed + modals
   ────────────────────────────────────────────────────────────── */
function PlayScreen({ theme, onGameEnd, onExit }) {
  const [quarter, setQuarter]               = useState(1);
  const [quarterSecondsLeft, setQSecsLeft]  = useState(60);
  const [transition, setTransition]         = useState(null);
  const [q4Open, setQ4Open]                 = useState(null);

  const clockRef = useRef({ raf: null, startedAtMs: 0, paused: false });

  useEffect(() => {
    const offs = [];

    offs.push(window.eventBus.on("quarter:start", ({ q }) => {
      setQuarter(q);
      setQSecsLeft(60);
      setTransition(null);
      clockRef.current.startedAtMs = performance.now();
      clockRef.current.paused = false;
    }));
    offs.push(window.eventBus.on("quarter:end", ({ q, snapshot }) => {
      if (q < 4) setTransition({ ...snapshot, q });
    }));
    offs.push(window.eventBus.on("q4:forced-choice", ({ options, default: def }) => {
      clockRef.current.paused = true;
      setQ4Open({ options, default: def });
    }));
    offs.push(window.eventBus.on("q4:choice-applied", () => {
      setQ4Open(null);
      clockRef.current.paused = false;
      clockRef.current.startedAtMs = performance.now() - (60 - quarterSecondsLeft) * 1000;
    }));
    offs.push(window.eventBus.on("game:end", (result) => {
      cancelAnimationFrame(clockRef.current.raf);
      onGameEnd(result);
    }));

    function loop() {
      if (!clockRef.current.paused) {
        const elapsed = performance.now() - clockRef.current.startedAtMs;
        setQSecsLeft(Math.max(0, 60 - elapsed / 1000));
      }
      clockRef.current.raf = requestAnimationFrame(loop);
    }
    clockRef.current.startedAtMs = performance.now();
    clockRef.current.raf = requestAnimationFrame(loop);

    // Load theme so HUD/Lives subscribers (already mounted above) receive
    // theme:loaded + meter:update. Defer startGame() to phaser:ready so the
    // PlayScene catches the first quarter:start; 2.5s fallback for cold-start.
    window.engineRules.loadTheme(theme);

    let started = false;
    const startWhenReady = () => {
      if (started) return;
      started = true;
      window.engineRules.startGame();
    };
    offs.push(window.eventBus.on("phaser:ready", startWhenReady));
    const fallback = setTimeout(startWhenReady, 2500);

    return () => {
      clearTimeout(fallback);
      cancelAnimationFrame(clockRef.current.raf);
      for (const o of offs) o();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuarterResume = () => {
    setTransition(null);
    window.engineRules.resumeFromQuarterTransition();
  };
  const handleQ4Choose = (choiceId, timedOut) => {
    window.engineRules.makeQ4Choice(choiceId, timedOut);
  };

  return (
    <div className="play-screen">
      <header className="play-header">
        <span className="play-eyebrow">{theme.name} · Q{quarter}/4 · {theme.composite_firm}</span>
        <window.Lives />
        <button className="play-exit" onClick={onExit}>← exit</button>
      </header>

      <div className="play-grid">
        <window.HUD quarter={quarter} quarterSecondsLeft={quarterSecondsLeft} />
        <div className="phaser-stage">
          <window.PhaserGame width={720} height={480} />
          <window.CrisisOverlay />
        </div>
        <window.PressureFeed />
      </div>

      <div className="play-footnote">
        Mouse or ← → to move paddle. Events emerge after a brief foreshadow. Q4 ends with a board recommendation.
      </div>

      {transition && (
        <window.QuarterTransition snapshot={transition} onResume={handleQuarterResume} />
      )}
      {q4Open && (
        <window.Q4ForcedChoice
          options={q4Open.options}
          defaultChoice={q4Open.default}
          onChoose={handleQ4Choose}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   App — top-level screen router + persistent 📚 overlay
   ────────────────────────────────────────────────────────────── */
function App() {
  const [screen, setScreen]   = useState(SCREEN.LANDING);
  const [theme, setTheme]     = useState(null);   // current theme JSON (or null)
  const [endResult, setEnd]   = useState(null);
  const [busOk, setBusOk]     = useState(false);
  const [showRB, setShowRB]   = useState(false);

  useEffect(() => {
    const off = window.eventBus.on("app:ack", () => setBusOk(true));
    window.eventBus.emit("app:ack", { from: "App" });
    return off;
  }, []);

  // Crisis library — loaded once at app start, injected into the engine so
  // every theme's startGame can schedule from it. (Catalog §9.)
  useEffect(() => {
    let alive = true;
    fetch("themes/crisis_library.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((lib) => { if (alive) window.engineRules.setCrisisLibrary(lib); })
      .catch((e)  => console.warn("[App] crisis library load failed (game still playable):", e));
    return () => { alive = false; };
  }, []);

  // Esc closes Research Backbone overlay
  useEffect(() => {
    if (!showRB) return;
    const onKey = (e) => { if (e.key === "Escape") setShowRB(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showRB]);

  // Screen handlers
  const goSelect      = () => setScreen(SCREEN.SELECT);
  const onLearnMore   = (json) => { setTheme(json); setScreen(SCREEN.BACKGROUND); };
  const onPlayDirect  = (json) => { setTheme(json); setScreen(SCREEN.BRIEFING); };
  const onSkipToPlay  = ()     => setScreen(SCREEN.RAMP);
  const onToBriefing  = ()     => setScreen(SCREEN.BRIEFING);
  const onBackToBg    = ()     => setScreen(SCREEN.BACKGROUND);
  const onBackToSel   = ()     => setScreen(SCREEN.SELECT);
  const onToRamp      = ()     => setScreen(SCREEN.RAMP);
  const onRampDone    = ()     => setScreen(SCREEN.PLAY);
  const onGameEnd     = (r)    => { setEnd(r); setScreen(SCREEN.REVEAL); };
  const onExitPlay    = ()     => setScreen(SCREEN.SELECT);
  const onReplay      = ()     => { setEnd(null); window.eventBus.emit("game:restart"); setScreen(SCREEN.PLAY); };
  const onTryAnother  = ()     => { setEnd(null); setTheme(null); setScreen(SCREEN.SELECT); };

  const showResearchIcon = ![SCREEN.PLAY, SCREEN.RAMP].includes(screen);

  return (
    <div className="app">
      {showResearchIcon && (
        <button
          className="research-icon"
          aria-label="open research backbone"
          title="Research backbone (sources & provenance)"
          onClick={() => setShowRB(true)}
        >📚</button>
      )}

      {screen === SCREEN.LANDING && <Landing onStart={goSelect} />}

      {screen === SCREEN.SELECT && (
        <window.ThemeSelect onLearnMore={onLearnMore} onPlay={onPlayDirect} />
      )}

      {screen === SCREEN.BACKGROUND && theme && (
        <window.ThemeBackground
          theme={theme}
          onContinueToBriefing={onToBriefing}
          onSkipToPlay={onSkipToPlay}
          onBackToSelect={onBackToSel}
        />
      )}

      {screen === SCREEN.BRIEFING && theme && (
        <window.BriefingRoom
          theme={theme}
          onContinueToPlay={onToRamp}
          onBackToBackground={onBackToBg}
        />
      )}

      {screen === SCREEN.RAMP && theme && (
        <window.PressureRamp theme={theme} onComplete={onRampDone} />
      )}

      {screen === SCREEN.PLAY && theme && (
        <PlayScreen theme={theme} onGameEnd={onGameEnd} onExit={onExitPlay} />
      )}

      {screen === SCREEN.REVEAL && endResult && theme && (
        <window.ArchetypeReveal
          result={endResult}
          theme={theme}
          onReplay={onReplay}
          onTryAnother={onTryAnother}
        />
      )}

      {showRB && (
        <window.ResearchBackbone theme={theme} onClose={() => setShowRB(false)} />
      )}

      {!busOk && (
        <div style={{ position: "fixed", bottom: 8, left: 8, fontFamily: "var(--mono)",
                      fontSize: 11, color: "var(--bad)" }}>
          eventBus round-trip FAILED
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

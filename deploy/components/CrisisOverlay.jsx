/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/CrisisOverlay.jsx
   Crisis Events feature (catalog §11) — top-centre warning text +
   timer ring around the canvas + resolution flash. Subscribes to
   crisis:start / crisis:resolve / crisis:response-broken.
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState, useRef } = React;

function CrisisOverlay() {
  const [crisis, setCrisis]     = useState(null); // { id, label, severity, durationMs, startedAt, bricksTotal, bricksBroken, signatures }
  const [flash, setFlash]       = useState(null); // { kind: 'success'|'failure', at }
  const [, force]               = useState(0);    // tick for timer animation
  const rafRef = useRef(null);

  useEffect(() => {
    const offs = [];

    offs.push(window.eventBus.on("crisis:start", (p) => {
      setFlash(null);
      setCrisis({
        id: p.id,
        kind: p.kind || "crisis",
        label: p.label,
        warningText: p.warningText || p.label,
        severity: p.severity || "moderate",
        durationMs: p.durationMs,
        startedAt: performance.now(),
        bricksTotal: (p.responseBricks || []).length,
        bricksBroken: 0,
        signatures: p.physicsSignatures || [],
      });
    }));

    offs.push(window.eventBus.on("crisis:response-broken", (p) => {
      setCrisis((c) => c && c.id === p.crisisId
        ? { ...c, bricksBroken: p.bricksBroken }
        : c);
    }));

    offs.push(window.eventBus.on("crisis:resolve", (p) => {
      setFlash({ kind: p.success ? "success" : "failure", at: performance.now() });
      setCrisis(null);
      setTimeout(() => setFlash(null), 700);
    }));

    return () => { for (const o of offs) o(); };
  }, []);

  // Drive the timer ring animation via rAF — only while a crisis is active.
  useEffect(() => {
    if (!crisis) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      force((n) => n + 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [crisis]);

  // Theme palette: severity → border colour. Opportunities get their own class.
  const severityClass = crisis
    ? (crisis.kind === "opportunity"
        ? "co-sev-opportunity"
        : "co-sev-" + (crisis.severity || "moderate"))
    : "";

  // Timer ring: fraction REMAINING (1.0 → 0.0 over duration)
  let fracRemaining = 1;
  if (crisis) {
    const elapsed = performance.now() - crisis.startedAt;
    fracRemaining = Math.max(0, 1 - elapsed / crisis.durationMs);
  }

  // CSS overlay tint signatures (catalog §8 — screen_tint_amber etc.)
  const sigs = new Set((crisis && crisis.signatures) || []);
  const tintClass = sigs.has("screen_tint_red")   ? "co-tint-red"
                  : sigs.has("screen_tint_green") ? "co-tint-green"
                  : sigs.has("screen_tint_amber") ? "co-tint-amber"
                  : "";
  const glitchClass = sigs.has("screen_glitch") ? " co-glitch" : "";
  const vignetteClass = severityClass + (sigs.has("edge_vignette_green") ? " co-vignette-green" : "");

  return (
    <>
      {/* Tint overlay over the canvas — pointer-events: none so play continues */}
      {crisis && tintClass && <div className={"co-tint " + tintClass + glitchClass} aria-hidden="true" />}

      {/* Edge vignette pulse (used by major crises; opportunities flip green) */}
      {crisis && <div className={"co-vignette " + vignetteClass} aria-hidden="true" />}

      {/* Top-centre warning text + bricks-progress */}
      {crisis && (
        <div className={"co-banner " + severityClass} role="status" aria-live="polite">
          <span className="co-warn">⚠ {crisis.warningText}</span>
          <span className="co-sep">·</span>
          <span className="co-progress">{crisis.bricksBroken}/{crisis.bricksTotal} contained</span>
          <span className="co-sep">·</span>
          <span className="co-timer">{(fracRemaining * crisis.durationMs / 1000).toFixed(1)}s</span>
        </div>
      )}

      {/* Timer ring — SVG arc around the canvas */}
      {crisis && (
        <svg className="co-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="48" className={"co-ring-bg"} />
          <circle
            cx="50" cy="50" r="48"
            className={"co-ring-fg " + severityClass}
            style={{
              strokeDasharray: 2 * Math.PI * 48,
              strokeDashoffset: 2 * Math.PI * 48 * (1 - fracRemaining),
            }}
          />
        </svg>
      )}

      {/* Resolution flash */}
      {flash && <div className={"co-flash co-flash-" + flash.kind} aria-hidden="true" />}
    </>
  );
}

window.CrisisOverlay = CrisisOverlay;

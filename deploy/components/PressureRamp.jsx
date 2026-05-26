/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/PressureRamp.jsx
   Phase 4 — 5s countdown overlay. Three phrases fade in over the first
   3 seconds; final 2 seconds show a shrinking ring + "3", "2", "1".
   Click anywhere or hit Esc to skip immediately.
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

const TOTAL_MS = 5000;
const PHRASES_MS = 3000; // first 3s for phrase fades
const COUNTDOWN_FROM = 3; // last 3s shows 3 → 2 → 1 (last 1s blank then handoff)

function PressureRamp({ theme, onComplete }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let raf;
    const tick = () => {
      const t = Date.now() - start;
      setElapsed(t);
      if (t >= TOTAL_MS) onComplete();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onKey = (e) => { if (e.key === "Escape" || e.key === "Enter") onComplete(); };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [onComplete]);

  if (!theme) return null;

  const firmName = theme.composite_firm || theme.name;
  const showFirm = elapsed > 100;
  const showRole = elapsed > 1100;
  const showScale = elapsed > 2100;
  const inCountdown = elapsed >= PHRASES_MS;
  const countdownLeftMs = Math.max(0, TOTAL_MS - elapsed);
  const countdownNumber = Math.max(1, Math.ceil(countdownLeftMs / 1000));
  const ringPct = inCountdown ? (countdownLeftMs / (TOTAL_MS - PHRASES_MS)) * 100 : 100;

  return (
    <div className="ramp" onClick={onComplete} role="dialog" aria-label="Year One begins">
      <div className="ramp-phrases">
        <div className={"ramp-phrase ramp-phrase-firm" + (showFirm ? " is-visible" : "")}>
          {firmName}
        </div>
        <div className={"ramp-phrase ramp-phrase-role" + (showRole ? " is-visible" : "")}>
          You are the AI deployment lead.
        </div>
        <div className={"ramp-phrase ramp-phrase-scale" + (showScale ? " is-visible" : "")}>
          Four quarters. One model. The pattern of your bounds is the year.
        </div>
      </div>

      {inCountdown && (
        <div className="ramp-countdown">
          <svg className="ramp-ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="36" className="ramp-ring-bg" />
            <circle
              cx="40" cy="40" r="36"
              className="ramp-ring-fg"
              style={{
                strokeDasharray: 2 * Math.PI * 36,
                strokeDashoffset: 2 * Math.PI * 36 * (1 - ringPct / 100),
              }}
            />
          </svg>
          <div className="ramp-count-num">{countdownNumber}</div>
        </div>
      )}

      <div className="ramp-skip">click or press Esc to skip</div>
    </div>
  );
}

window.PressureRamp = PressureRamp;

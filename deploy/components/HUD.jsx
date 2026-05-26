/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/HUD.jsx
   Phase 3 — theme-driven meter rail. Subscribes to:
     - theme:loaded   → builds meter list from theme.meters
     - meter:update   → updates value (and pulses on change)
     - event:foreshadow → shimmer on top border + intensify responsible meter
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

function toneFor(meter, value) {
  const [lo, hi] = meter.safe_band || [0, 100];
  const inverse = meter.tone_logic === "inverse";
  if (inverse) {
    // higher = worse
    if (value >= hi + 20) return "red";
    if (value >= hi)       return "amber";
    return "green";
  }
  if (value <= lo - 15) return "red";
  if (value <= lo)      return "amber";
  if (value >= hi + 15) return "amber";
  return "green";
}

function HUD({ quarter = null, quarterSecondsLeft = null }) {
  const [meters, setMeters]     = useState([]);   // [{ id, label, safe_band, tone_logic }]
  const [values, setValues]     = useState({});   // { id: number }
  const [pulse, setPulse]       = useState({});   // { id: counter }
  const [foreshadow, setFore]   = useState(null); // { meter, until }

  useEffect(() => {
    const offs = [];

    offs.push(window.eventBus.on("theme:loaded", ({ theme }) => {
      setMeters(theme.meters);
      const v = {};
      for (const m of theme.meters) v[m.id] = m.start;
      setValues(v);
      setPulse({});
    }));

    offs.push(window.eventBus.on("meter:update", ({ meter, newValue }) => {
      setValues((p) => ({ ...p, [meter]: newValue }));
      setPulse((p) => ({ ...p, [meter]: (p[meter] || 0) + 1 }));
    }));

    offs.push(window.eventBus.on("event:foreshadow", ({ secondsUntil, label }) => {
      setFore({ until: Date.now() + (secondsUntil || 5) * 1000, label });
      const id = setTimeout(() => setFore(null), (secondsUntil || 5) * 1000);
      return () => clearTimeout(id);
    }));

    return () => { for (const o of offs) o(); };
  }, []);

  const shimmering = !!foreshadow;

  return (
    <aside className={"hud" + (shimmering ? " hud-foreshadow" : "")}>
      <div className="hud-head">
        <span className="hud-eyebrow">§ Meters</span>
        {quarter != null && (
          <span className="hud-quarter">
            Q{quarter}
            {quarterSecondsLeft != null && (
              <span className={"hud-quarter-sec" + (quarterSecondsLeft <= 10 ? " hud-quarter-sec-low" : "")}>
                {" "}· {String(Math.max(0, Math.ceil(quarterSecondsLeft))).padStart(2, "0")}s
              </span>
            )}
          </span>
        )}
      </div>

      {meters.length === 0 && <div className="feed-empty">— theme not loaded —</div>}

      {meters.map((m) => {
        const v = values[m.id] ?? m.start;
        const tone = toneFor(m, v);
        return (
          <div key={m.id} className={"hud-meter tone-" + tone} data-pulse={pulse[m.id] || 0}>
            <div className="hud-meter-head">
              <span className="hud-meter-label">{m.label}</span>
              <span className="hud-meter-value">{Math.round(v)}</span>
            </div>
            <div className="hud-meter-track">
              <div className="hud-meter-fill" style={{ width: v + "%" }} />
            </div>
          </div>
        );
      })}
    </aside>
  );
}

window.HUD = HUD;

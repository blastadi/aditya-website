/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/ArchetypeReveal.jsx
   Phase 3 — end screen. Three paced sections:
     1. Pattern recap   (typewriter brick counts)
     2. Archetype name  (large)
     3. Reveal text + provenance click-through
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

function ArchetypeReveal({ result, theme, onReplay, onTryAnother }) {
  const [step, setStep] = useState(0); // 0: pattern, 1: name, 2: text, 3: provenance/buttons
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1400);
    const t2 = setTimeout(() => setStep(2), 2700);
    const t3 = setTimeout(() => setStep(3), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (!result) return null;
  const { archetype, state, ended } = result;
  const bc = state.brickCounts || {};
  const total = Object.values(bc).reduce((a, b) => a + b, 0);
  const catEntries = Object.entries(bc).filter(([_, n]) => n > 0);

  // Build provenance for the archetype
  const sources = (archetype && archetype.sources) || [];
  const sourceObjs = sources.map((sid) =>
    [...(theme.anchor_sources || []), ...(theme.contributing_sources || [])].find((s) => s.id === sid)
  ).filter(Boolean);

  return (
    <div className="reveal" role="region" aria-label="Archetype reveal">
      <div className="reveal-eyebrow">
        Year One · {ended === "early" ? "concluded early" : "complete"} · {theme.name}
      </div>

      <div className="reveal-pattern">
        Across the year you broke{" "}
        {total === 0 ? <em>almost nothing</em> :
          catEntries.map(([cat, n], i) => (
            <span key={cat}>
              <strong>{n}</strong> {labelFor(cat, theme)}
              {i < catEntries.length - 1 ? ", " : ""}
            </span>
          ))
        }
        .
        {state.crisisLog && state.crisisLog.fired && state.crisisLog.fired.length > 0 && (
          <div className="reveal-crisis-log">
            Crises faced: <strong>{state.crisisLog.fired.length}</strong>
            {" · "}contained: <strong>{state.crisisLog.resolved.length}</strong>
            {state.crisisLog.livesLostToCrises > 0 && (
              <> {" · "}lives lost to crises: <strong>{state.crisisLog.livesLostToCrises}</strong></>
            )}
          </div>
        )}
      </div>

      <div className={"reveal-name" + (step >= 1 ? " is-visible" : "")}>
        You played as <span className="reveal-name-strong">
          <span className="reveal-icon">{archetype.icon}</span> {archetype.label}.
        </span>
      </div>

      <div className={"reveal-text" + (step >= 2 ? " is-visible" : "")}>
        {archetype.reveal_text}
      </div>

      <div className={"reveal-provenance" + (step >= 3 ? " is-visible" : "")}>
        <div className="reveal-prov-label">
          Tag: <span className={"prov-tag prov-tag-" + (archetype.tag || "derived")}>{(archetype.tag || "derived").toUpperCase()}</span>
        </div>
        {sourceObjs.length > 0 && (
          <ul className="reveal-prov-list">
            {sourceObjs.map((s) => (
              <li key={s.id}>
                <span className="reveal-prov-cite">{s.citation}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={"reveal-actions" + (step >= 3 ? " is-visible" : "")}>
        <button className="reveal-btn reveal-btn-primary" onClick={onReplay}>Play again</button>
        <button className="reveal-btn"                  onClick={onTryAnother}>Try a different theme</button>
      </div>
    </div>
  );
}

function labelFor(cat, theme) {
  const c = theme.categories && theme.categories[cat];
  return (c && c.label && c.label.toLowerCase()) || cat;
}

window.ArchetypeReveal = ArchetypeReveal;

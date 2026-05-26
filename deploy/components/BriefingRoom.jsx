/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/BriefingRoom.jsx
   Phase 4 — brick pool grouped by category, click-to-expand modal.
   **NO numeric effects rendered** (brief §13). Qualitative description,
   research note, source list with DOI links, tag pill (direct/derived/composite).
   ════════════════════════════════════════════════════════════════ */

const { useState } = React;

function hitsLabel(hits) {
  if (!hits || hits === 1) return "Single break";
  if (hits === 2) return "Two-hit";
  if (hits === 3) return "Three-hit";
  return hits + "-hit";
}

function BriefingRoom({ theme, onContinueToPlay, onBackToBackground }) {
  const [selected, setSelected] = useState(null); // brick obj or null
  if (!theme) return null;

  // Group bricks by category
  const groups = {};
  for (const b of theme.bricks) {
    const cat = b.category;
    (groups[cat] = groups[cat] || []).push(b);
  }
  const categoryOrder = Object.keys(theme.categories || {}).filter((c) => groups[c]);

  const topAnchors = (theme.anchor_sources || []).slice(0, 4);

  // Source lookup for the modal
  const allSources = [...(theme.anchor_sources || []), ...(theme.contributing_sources || [])];
  const sourceById = Object.fromEntries(allSources.map((s) => [s.id, s]));

  return (
    <div className="briefing">
      <header className="brf-head">
        <button className="brf-back" onClick={onBackToBackground} aria-label="Back to theme background">← background</button>
        <div className="brf-eyebrow">Briefing room · {theme.name}</div>
        <h1 className="brf-title">{theme.composite_firm || theme.name}</h1>
        <p className="brf-tension">{theme.central_tension}</p>
      </header>

      <section className="brf-anchors">
        <div className="brf-anchors-label">Anchor papers</div>
        <ul className="brf-anchors-list">
          {topAnchors.map((s) => (
            <li key={s.id}>
              <span className="brf-anchor-cite">{s.citation.split(".")[0]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="brf-dimensions">
        <div className="brf-section-head">The five dimensions</div>
        <div className="brf-meter-grid">
          {(theme.meters || []).map((m) => (
            <div key={m.id} className="brf-meter">
              <div className="brf-meter-name">{m.label}</div>
              <div className="brf-meter-narrative">{narrativeFor(theme.id, m.id)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="brf-bricks">
        <div className="brf-section-head">The brick pool <span className="brf-section-sub">({theme.bricks.length} cards · click any to read the source)</span></div>
        {categoryOrder.map((cat) => {
          const cmeta = theme.categories[cat];
          return (
            <div key={cat} className="brf-cat-section">
              <div className="brf-cat-label" style={{ "--cat-accent": cmeta.color }}>
                <span className="brf-cat-swatch" />
                {cmeta.label}
                <span className="brf-cat-count">({groups[cat].length})</span>
              </div>
              <div className="brf-cat-grid">
                {groups[cat].map((b) => (
                  <button
                    key={b.id}
                    className={"brf-brick" + (b.hits > 1 ? " brf-brick-heavy" : "") + (b.recovery ? " brf-brick-recovery" : "")}
                    style={{ "--brick-color": cmeta.color }}
                    onClick={() => setSelected(b)}
                  >
                    <span className="brf-brick-label">{b.label}</span>
                    <span className="brf-brick-meta">
                      {hitsLabel(b.hits)}{b.recovery ? " · recovery" : ""}
                      <span className={"brf-brick-tag brf-brick-tag-" + (b.tag || "derived")}>{(b.tag || "derived")}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <div className="brf-actions">
        <button className="brf-btn brf-btn-primary" onClick={onContinueToPlay}>Continue to play →</button>
      </div>

      {selected && (
        <div className="brf-modal" onClick={() => setSelected(null)} role="dialog" aria-label={selected.label}>
          <div className="brf-modal-card" onClick={(e) => e.stopPropagation()} style={{ "--brick-color": theme.categories[selected.category]?.color }}>
            <button className="brf-modal-close" onClick={() => setSelected(null)} aria-label="close">×</button>
            <div className="brf-modal-eyebrow">
              <span className="brf-modal-cat" style={{ background: theme.categories[selected.category]?.color }} />
              {theme.categories[selected.category]?.label}
              <span className="brf-modal-id">· {selected.id}</span>
            </div>
            <h2 className="brf-modal-title">{selected.label}</h2>
            <div className="brf-modal-hits">{hitsLabel(selected.hits)}{selected.recovery ? " · recovery brick (Q3 only)" : ""}</div>
            <p className="brf-modal-desc">{selected.briefing_description}</p>
            <div className="brf-modal-section-head">Research justification</div>
            <p className="brf-modal-note">{selected.research_note}</p>
            <div className="brf-modal-section-head">Sources</div>
            <ul className="brf-modal-sources">
              {(selected.sources || []).map((sid) => {
                const s = sourceById[sid];
                if (!s) return <li key={sid}><span className="brf-modal-source-cite">{sid} (citation pending)</span></li>;
                return (
                  <li key={sid}>
                    <span className="brf-modal-source-cite">{s.citation}</span>
                  </li>
                );
              })}
            </ul>
            <div className="brf-modal-tag-row">
              <span className="brf-modal-tag-label">Provenance:</span>
              <span className={"prov-tag prov-tag-" + (selected.tag || "derived")}>{(selected.tag || "derived").toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Per-theme meter narrative (qualitative — no numbers). Phase 5 adds per
   non-Envelopment theme; for now we narrate Envelopment in full and fall
   back to a generic blurb so the component is theme-agnostic. */
function narrativeFor(themeId, meterId) {
  const env = {
    bnd:        "How tightly you've bounded what the AI is allowed to see, say, and do. High = inscrutable model contained; low = AI ranging freely.",
    perf:       "What the model actually delivers in the operational metric the business cares about. The thing the COO points at.",
    trust:      "Whether clinicians and risk staff believe the program is run with intent. Earned through documentation, surveys, and survival.",
    risk:       "Lagging indicator of override rates, near-misses, and quiet drift. Lower is safer; this one runs inverse.",
    board_conf: "How much the board feels the program is theirs to defend. Collapses fast under public incidents."
  };
  if (themeId === "envelopment" && env[meterId]) return env[meterId];
  return "Tracked across the year. Stays in its safe band when your choices add up.";
}

window.BriefingRoom = BriefingRoom;

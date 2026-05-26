/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/ResearchBackbone.jsx
   Phase 4 — 📚 source-of-truth screen. Anchor + contributing sources
   with DOI links. Computes which game elements reference each source.
   Tag distribution (direct/derived/composite). Methodology footer.
   Rendered as a full-screen overlay; close to return.
   ════════════════════════════════════════════════════════════════ */

const { useState } = React;

function ResearchBackbone({ theme, onClose }) {
  const [expanded, setExpanded] = useState(null); // sourceId or null

  if (!theme) {
    return (
      <div className="rb-overlay" onClick={onClose} role="dialog" aria-label="Research backbone">
        <div className="rb-card rb-empty" onClick={(e) => e.stopPropagation()}>
          <button className="rb-close" onClick={onClose} aria-label="close">×</button>
          <h2 className="rb-empty-headline">📚 Research Backbone</h2>
          <p className="rb-empty-body">Pick a theme first — the sources are organised per theme.</p>
        </div>
      </div>
    );
  }

  const anchors = theme.anchor_sources || [];
  const contrib = theme.contributing_sources || [];
  const allSources = [...anchors, ...contrib];

  // Compute reverse map: source id → elements (bricks/archetypes/events) that cite it
  const refsBy = {};
  const reg = (sid, kind, id, label) => {
    (refsBy[sid] = refsBy[sid] || []).push({ kind, id, label });
  };
  for (const b of theme.bricks || []) {
    for (const sid of b.sources || []) reg(sid, "brick", b.id, b.label);
  }
  for (const a of theme.archetypes || []) {
    for (const sid of a.sources || []) reg(sid, "archetype", a.id, a.label);
  }
  // events may have their own sources in future; not in Phase 3 JSON

  // Tag distribution
  const tagCounts = { direct: 0, derived: 0, composite: 0 };
  for (const b of theme.bricks || [])    tagCounts[b.tag || "derived"]++;
  for (const a of theme.archetypes || []) tagCounts[a.tag || "derived"]++;
  const tagTotal = tagCounts.direct + tagCounts.derived + tagCounts.composite;

  function renderSource(s, isAnchor) {
    const isOpen = expanded === s.id;
    const refs = refsBy[s.id] || [];
    return (
      <li key={s.id} className={"rb-source" + (isAnchor ? " rb-source-anchor" : " rb-source-contrib")}>
        <button
          className="rb-source-head"
          aria-expanded={isOpen}
          onClick={() => setExpanded(isOpen ? null : s.id)}
        >
          <span className="rb-source-cite">{s.citation}</span>
          <span className="rb-source-chevron">{isOpen ? "▾" : "▸"}</span>
        </button>
        <div className="rb-source-meta">
          {s.read_time_min != null && <span className="rb-source-time">~{s.read_time_min} min read</span>}
          {s.skim_section && <span className="rb-source-skim">skim: {s.skim_section}</span>}
        </div>
        {isOpen && (
          <div className="rb-source-detail">
            {s.contribution && <p className="rb-source-contribution">{s.contribution}</p>}
            {refs.length > 0 && (
              <div className="rb-source-refs">
                <div className="rb-section-sub">Referenced by:</div>
                <ul>
                  {refs.map((r, i) => (
                    <li key={i} className={"rb-ref rb-ref-" + r.kind}>
                      <span className="rb-ref-kind">{r.kind}</span>
                      <span className="rb-ref-id">{r.id}</span>
                      <span className="rb-ref-label">{r.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {refs.length === 0 && (
              <div className="rb-source-refs rb-source-refs-empty">
                — no direct element references; supports the theme framing.
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="rb-overlay" onClick={onClose} role="dialog" aria-label="Research backbone">
      <div className="rb-card" onClick={(e) => e.stopPropagation()}>
        <button className="rb-close" onClick={onClose} aria-label="close">×</button>

        <header className="rb-head">
          <div className="rb-eyebrow">📚 Research Backbone</div>
          <h1 className="rb-title">{theme.name}</h1>
          <p className="rb-sub">{theme.central_tension}</p>
        </header>

        <section className="rb-section">
          <div className="rb-section-head">Provenance breakdown <span className="rb-section-sub">({tagTotal} elements tagged)</span></div>
          <div className="rb-tag-grid">
            <div className="rb-tag-row">
              <span className="prov-tag prov-tag-direct">DIRECT</span>
              <span className="rb-tag-count">{tagCounts.direct}</span>
              <span className="rb-tag-pct">{tagTotal > 0 ? Math.round(tagCounts.direct / tagTotal * 100) : 0}%</span>
              <span className="rb-tag-def">source explicitly names this element</span>
            </div>
            <div className="rb-tag-row">
              <span className="prov-tag prov-tag-derived">DERIVED</span>
              <span className="rb-tag-count">{tagCounts.derived}</span>
              <span className="rb-tag-pct">{tagTotal > 0 ? Math.round(tagCounts.derived / tagTotal * 100) : 0}%</span>
              <span className="rb-tag-def">source's framework implies it when operationalised</span>
            </div>
            <div className="rb-tag-row">
              <span className="prov-tag prov-tag-composite">COMPOSITE</span>
              <span className="rb-tag-count">{tagCounts.composite}</span>
              <span className="rb-tag-pct">{tagTotal > 0 ? Math.round(tagCounts.composite / tagTotal * 100) : 0}%</span>
              <span className="rb-tag-def">multiple sources combine to support it</span>
            </div>
          </div>
        </section>

        <section className="rb-section">
          <div className="rb-section-head">Anchor sources <span className="rb-section-sub">({anchors.length})</span></div>
          <ul className="rb-source-list">
            {anchors.map((s) => renderSource(s, true))}
          </ul>
        </section>

        {contrib.length > 0 && (
          <section className="rb-section">
            <div className="rb-section-head">Contributing sources <span className="rb-section-sub">({contrib.length})</span></div>
            <ul className="rb-source-list">
              {contrib.map((s) => renderSource(s, false))}
            </ul>
          </section>
        )}

        <footer className="rb-footer">
          <div className="rb-footer-label">Methodology</div>
          <p className="rb-footer-text">
            Every brick, event, and archetype carries one of three tags. <strong>[direct]</strong> means the cited source explicitly names or describes the element. <strong>[derived]</strong> means the source's framework implies it once you operationalise it as a game mechanic. <strong>[composite]</strong> means multiple sources jointly underwrite it. The tag is the most honest answer to the question "did the researchers actually say this, or did we read into them?"
          </p>
          <p className="rb-footer-text">
            DEPLOY's design rule: every mechanic traces back. If a brick has no source, it doesn't ship.
          </p>
        </footer>
      </div>
    </div>
  );
}

window.ResearchBackbone = ResearchBackbone;

/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/ThemeBackground.jsx
   Phase 4 — plain-language theme description + annotated anchor papers.
   Honest time-commitment breakdown. Two exits: briefing room / skip to play.
   ════════════════════════════════════════════════════════════════ */

function ThemeBackground({ theme, onContinueToBriefing, onSkipToPlay, onBackToSelect }) {
  if (!theme) return null;
  const anchors = theme.anchor_sources || [];
  const contrib = theme.contributing_sources || [];

  return (
    <div className="theme-bg">
      <header className="tbg-head">
        <button className="tbg-back" onClick={onBackToSelect} aria-label="Back to theme select">← themes</button>
        <div className="tbg-eyebrow">Theme background</div>
        <h1 className="tbg-title">{theme.name}</h1>
        <p className="tbg-tension">{theme.central_tension}</p>
      </header>

      <section className="tbg-section tbg-copy">
        <p>{theme.background_copy}</p>
      </section>

      <section className="tbg-section">
        <div className="tbg-section-head">Anchor sources <span className="tbg-section-count">({anchors.length})</span></div>
        <ul className="tbg-source-list">
          {anchors.map((s) => (
            <li key={s.id} className="tbg-source">
              <div className="tbg-source-cite">{s.citation}</div>
              <div className="tbg-source-meta">
                {s.read_time_min != null && <span className="tbg-source-time">~{s.read_time_min} min read</span>}
                {s.skim_section && <span className="tbg-source-skim">skim: {s.skim_section}</span>}
              </div>
              {s.contribution && <p className="tbg-source-contrib">{s.contribution}</p>}
            </li>
          ))}
        </ul>
      </section>

      {contrib.length > 0 && (
        <section className="tbg-section">
          <div className="tbg-section-head">Contributing sources <span className="tbg-section-count">({contrib.length})</span></div>
          <ul className="tbg-source-list tbg-source-list-contrib">
            {contrib.map((s) => (
              <li key={s.id} className="tbg-source">
                <div className="tbg-source-cite">{s.citation}</div>
                <div className="tbg-source-meta">
                  {s.read_time_min != null && <span className="tbg-source-time">~{s.read_time_min} min read</span>}
                </div>
                {s.contribution && <p className="tbg-source-contrib">{s.contribution}</p>}
                {s.elements_contributed && s.elements_contributed.length > 0 && (
                  <div className="tbg-source-contrib tbg-source-contrib-elements">
                    Contributes to: {s.elements_contributed.join(", ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tbg-section tbg-time">
        <div className="tbg-section-head">Time commitment — honest breakdown</div>
        <div className="tbg-time-grid">
          <div className="tbg-time-row">
            <span className="tbg-time-label">Full prep (read every anchor)</span>
            <span className="tbg-time-val">~3 hr</span>
          </div>
          <div className="tbg-time-row">
            <span className="tbg-time-label">Skim (skim-section per anchor)</span>
            <span className="tbg-time-val">~25 min</span>
          </div>
          <div className="tbg-time-row">
            <span className="tbg-time-label">Cold play (no prep)</span>
            <span className="tbg-time-val">0 min</span>
          </div>
        </div>
        <p className="tbg-time-note">
          Cold play works. The reveal at the end still lands — the question is whether you'll want to look up the sources afterwards or before.
        </p>
      </section>

      <div className="tbg-actions">
        <button className="tbg-btn tbg-btn-secondary" onClick={onSkipToPlay}>Skip to play →</button>
        <button className="tbg-btn tbg-btn-primary"   onClick={onContinueToBriefing}>Continue to briefing room →</button>
      </div>
    </div>
  );
}

window.ThemeBackground = ThemeBackground;

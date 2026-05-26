/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/ThemeSelect.jsx
   Five theme cards. Single action per card: "Open briefing →"
   routes the player through Theme Background and Briefing Room before
   they reach Play. No direct-play shortcut — every run starts with
   orientation.
   ════════════════════════════════════════════════════════════════ */

const { useState } = React;

/* Static catalog. Anchor counts + framings match brief §6 spec. All five
   themes live as of Phase 5; the catalog drives card rendering. */
const THEME_CATALOG = [
  {
    id: "envelopment",
    name: "Envelopment",
    central_tension: "Performance versus boundedness for inscrutable AI",
    anchor_count: 4,
    industry_framings: ["Healthcare ED triage", "Credit scoring", "HR screening"],
    available: true,
    json: "themes/envelopment.json",
    accent: "#2d4fe0",
  },
  {
    id: "paradox",
    name: "The Paradox",
    central_tension: "Automation depth versus augmentation breadth — paradoxical, not alternatives",
    anchor_count: 5,
    industry_framings: ["Audit / advisory"],
    available: true,
    json: "themes/paradox.json",
    accent: "#6d4cae",
  },
  {
    id: "inheritance",
    name: "Inheritance",
    central_tension: "Living with a deployed system you didn't design",
    anchor_count: 5,
    industry_framings: ["Criminal justice", "Child welfare", "Unemployment"],
    available: true,
    json: "themes/inheritance.json",
    accent: "#c0392b",
  },
  {
    id: "trust-framing",
    name: "Trust & Framing",
    central_tension: "Perception versus reality in customer-facing AI",
    anchor_count: 5,
    industry_framings: ["Telecom support", "Retail", "Insurance", "Healthcare"],
    available: true,
    json: "themes/trust-framing.json",
    accent: "#d4a01b",
  },
  {
    id: "strategic-posture",
    name: "Strategic Posture",
    central_tension: "AI as initiatives versus AI as operating-model change",
    anchor_count: 5,
    industry_framings: ["Industrial mfg", "Financial services", "CPG", "Tech platform"],
    available: true,
    json: "themes/strategic-posture.json",
    accent: "#5a6473",
  },
];

function ThemeSelect({ onLearnMore }) {
  const [loadingId, setLoadingId] = useState(null);
  const [err, setErr] = useState(null);

  async function load(theme) {
    setErr(null);
    setLoadingId(theme.id);
    try {
      const res = await fetch(theme.json, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      setLoadingId(null);
      return json;
    } catch (e) {
      setErr(String(e));
      setLoadingId(null);
      return null;
    }
  }

  async function handleLearnMore(theme) {
    if (!theme.available) return;
    const json = await load(theme);
    if (json) onLearnMore(json);
  }

  return (
    <div className="theme-select">
      <header className="theme-select-head">
        <div className="ts-eyebrow">Choose your theme</div>
        <h1 className="ts-title">Five fiscal years.</h1>
        <p className="ts-tagline">Each theme is a different shape of the AI-deployment problem. Pick the one whose central tension fits the class you're teaching — or the manager you want to find out you are.</p>
      </header>

      <div className="theme-grid">
        {THEME_CATALOG.map((t) => (
          <article
            key={t.id}
            className={"theme-card" + (t.available ? "" : " theme-card-disabled")}
            style={{ "--card-accent": t.accent }}
          >
            <div className="tc-name-row">
              <h2 className="tc-name">{t.name}</h2>
              {!t.available && <span className="tc-pill">Phase 5</span>}
            </div>
            <p className="tc-tension">{t.central_tension}</p>
            <div className="tc-meta">
              <span className="tc-anchors">{t.anchor_count} anchor source{t.anchor_count === 1 ? "" : "s"}</span>
              <span className="tc-dot">·</span>
              <span className="tc-framings">
                {t.industry_framings.length} framing{t.industry_framings.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="tc-framing-list">
              {t.industry_framings.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="tc-actions">
              <button
                className="tc-btn tc-btn-primary"
                disabled={!t.available || loadingId === t.id}
                onClick={() => handleLearnMore(t)}
                aria-label={t.available ? "Open briefing for " + t.name : t.name + " — coming in Phase 5"}
              >
                {loadingId === t.id ? "Loading…" : t.available ? "Open briefing →" : "Coming in Phase 5"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {err && <div className="theme-select-err">Couldn't load theme: {err}</div>}
    </div>
  );
}

window.ThemeSelect = ThemeSelect;
window.THEME_CATALOG = THEME_CATALOG; // exposed for ResearchBackbone fallback

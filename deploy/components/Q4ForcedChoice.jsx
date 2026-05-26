/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/Q4ForcedChoice.jsx
   Phase 3 — Q4 oversized brick choice. 3 options, click to commit.
   Description only — no numeric effects shown (brief §13).
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

const TIMEOUT_MS = 30_000; // Player has 30s of remaining quarter to decide

function Q4ForcedChoice({ options, defaultChoice, onChoose }) {
  const [remaining, setRemaining] = useState(TIMEOUT_MS);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const left = TIMEOUT_MS - (Date.now() - start);
      setRemaining(Math.max(0, left));
      if (left <= 0) { clearInterval(t); onChoose(defaultChoice, true); }
    }, 100);
    return () => clearInterval(t);
  }, [defaultChoice, onChoose]);

  return (
    <div className="q4-modal" role="dialog" aria-label="Year-end recommendation">
      <div className="q4-card">
        <div className="q4-eyebrow">Year-end recommendation · Q4</div>
        <div className="q4-headline">How do you brief the board?</div>
        <div className="q4-sub">
          You speak for ten minutes. The board votes on Year Two right after. Choose how you frame what you built.
        </div>

        <div className="q4-options">
          {options.map((o) => (
            <button
              key={o.id}
              className={"q4-option q4-option-" + o.id}
              onClick={() => onChoose(o.id, false)}
            >
              <span className="q4-option-label">{o.label}</span>
              <span className="q4-option-desc">{o.description}</span>
            </button>
          ))}
        </div>

        <div className="q4-timer">
          {Math.ceil(remaining / 1000)}s before the secretary picks for you ({defaultChoice})
        </div>
      </div>
    </div>
  );
}

window.Q4ForcedChoice = Q4ForcedChoice;

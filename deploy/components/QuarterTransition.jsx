/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/QuarterTransition.jsx
   Phase 3 — between-quarter synthesis card. Shows quarter snapshot,
   counts down a 4s pause, then dismisses. Player can also click to
   skip the pause. Calls engineRules.resumeFromQuarterTransition().
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

const PAUSE_MS = 4000;

function QuarterTransition({ snapshot, onResume }) {
  const [remaining, setRemaining] = useState(PAUSE_MS);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const left = PAUSE_MS - (Date.now() - start);
      setRemaining(Math.max(0, left));
      if (left <= 0) { clearInterval(t); onResume(); }
    }, 80);
    return () => clearInterval(t);
  }, [onResume]);

  if (!snapshot) return null;
  const { q, meters, lives, eventsHistory, brickCountsPerQuarter, brickCounts } = snapshot;
  const justFired = (eventsHistory || []).slice(-3);
  const qb = brickCountsPerQuarter || {};
  const total = Object.values(qb).reduce((a, b) => a + b, 0);
  const nextQ = q < 4 ? q + 1 : null;

  return (
    <div className="quarter-transition" onClick={onResume} role="dialog" aria-label={"Quarter " + q + " complete"}>
      <div className="qt-card">
        <div className="qt-eyebrow">Quarter {q} · closed</div>
        <h2 className="qt-headline">
          You broke {total} brick{total === 1 ? "" : "s"} this quarter
        </h2>
        <div className="qt-row">
          {Object.entries(qb).map(([cat, n]) => (
            <span key={cat} className={"qt-cat qt-cat-" + cat}>{cat.toUpperCase()} · {n}</span>
          ))}
        </div>
        <div className="qt-meters">
          {meters && Object.entries(meters).map(([id, v]) => (
            <div key={id} className="qt-meter">
              <span className="qt-meter-id">{id}</span>
              <span className="qt-meter-val">{Math.round(v)}</span>
            </div>
          ))}
        </div>
        {justFired.length > 0 && (
          <div className="qt-events">
            <div className="qt-sublabel">Recent</div>
            {justFired.map((e, i) => <div key={i} className="qt-event">{e}</div>)}
          </div>
        )}
        <div className="qt-footer">
          <div className="qt-lives">lives · {lives}</div>
          {nextQ
            ? <div className="qt-next">Q{nextQ} begins in {Math.ceil(remaining / 1000)}s — click to skip</div>
            : <div className="qt-next">Year closes in {Math.ceil(remaining / 1000)}s</div>}
        </div>
      </div>
    </div>
  );
}

window.QuarterTransition = QuarterTransition;

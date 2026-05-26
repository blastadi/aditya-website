/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/Lives.jsx
   Phase 3 — N-life indicator (filled/spent) with shatter on loss.
   Reads start from theme.lives_start; falls back to prop.
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

function Lives({ start = 3 }) {
  const [total, setTotal] = useState(start);
  const [remaining, setRemaining] = useState(start);
  const [shatterAt, setShatterAt] = useState(-1);

  useEffect(() => {
    const offs = [];

    offs.push(window.eventBus.on("theme:loaded", ({ theme }) => {
      const t = theme.lives_start || 3;
      setTotal(t);
      setRemaining(t);
      setShatterAt(-1);
    }));

    offs.push(window.eventBus.on("life:lost", ({ remaining: r }) => {
      setShatterAt(r);
      setRemaining(r);
      const id = setTimeout(() => setShatterAt(-1), 500);
      return () => clearTimeout(id);
    }));

    offs.push(window.eventBus.on("game:restart", () => {
      setRemaining(total);
      setShatterAt(-1);
    }));

    return () => { for (const o of offs) o(); };
  }, [total]);

  return (
    <div className="lives" aria-label={remaining + " of " + total + " lives remaining"}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < remaining;
        const shattering = i === shatterAt;
        return (
          <span
            key={i}
            className={
              "life " + (filled ? "life-filled" : "life-spent") + (shattering ? " life-shatter" : "")
            }
          >
            ●
          </span>
        );
      })}
    </div>
  );
}

window.Lives = Lives;

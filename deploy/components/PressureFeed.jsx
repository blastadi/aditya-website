/* ════════════════════════════════════════════════════════════════
   DEPLOY · components/PressureFeed.jsx
   Phase 3 — event log + Tier 1 foreshadow shimmer on top border.
   Severity-coloured slide-in. Newest item at top.
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useState } = React;

function PressureFeed() {
  const [items, setItems]   = useState([]);
  const [shimmer, setShim]  = useState(false);

  useEffect(() => {
    let nextId = 1;
    const offs = [];

    offs.push(window.eventBus.on("feed:add", (payload) => {
      const item = { id: nextId++, t: Date.now(), ...payload };
      setItems((prev) => [item, ...prev].slice(0, 12));
    }));

    offs.push(window.eventBus.on("event:foreshadow", ({ secondsUntil }) => {
      setShim(true);
      const id = setTimeout(() => setShim(false), (secondsUntil || 5) * 1000);
      return () => clearTimeout(id);
    }));

    offs.push(window.eventBus.on("event:fire", () => setShim(false)));

    offs.push(window.eventBus.on("theme:loaded", () => setItems([])));
    offs.push(window.eventBus.on("game:restart", () => setItems([])));

    return () => { for (const o of offs) o(); };
  }, []);

  return (
    <aside className={"feed" + (shimmer ? " feed-foreshadow" : "")}>
      <div className="hud-head">
        <span className="hud-eyebrow">§ Pressure feed</span>
        {shimmer && <span className="feed-foreshadow-tag">▲ event imminent</span>}
      </div>
      {items.length === 0 && <div className="feed-empty">Quiet — start a quarter.</div>}
      {items.map((it) => (
        <div key={it.id} className={"feed-item severity-" + (it.severity || "neutral")}>
          <span className="feed-text">{it.text}</span>
        </div>
      ))}
    </aside>
  );
}

window.PressureFeed = PressureFeed;

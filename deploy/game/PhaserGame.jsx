/* ════════════════════════════════════════════════════════════════
   DEPLOY · game/PhaserGame.jsx
   React wrapper around the Phaser game. Mounts a Phaser.Game on first
   render, destroys it cleanly on unmount. The DOM element is the
   canvas parent; React doesn't touch it after mount.
   ════════════════════════════════════════════════════════════════ */

const { useEffect, useRef } = React;

function PhaserGame({ width = 720, height = 480 }) {
  const wrapRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current || gameRef.current) return;
    if (typeof window.Phaser === "undefined") {
      // eslint-disable-next-line no-console
      console.error("[PhaserGame] Phaser CDN not loaded.");
      return;
    }

    const config = {
      type: window.Phaser.AUTO,
      parent: wrapRef.current,
      width,
      height,
      backgroundColor: "#fafaf7",
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false },
      },
      scene: [window.PreloadScene, window.PlayScene],
      scale: {
        mode: window.Phaser.Scale.NONE,
        autoCenter: window.Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new window.Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      // Clean up bus listeners that might have been registered by scenes
      // (each scene unsubscribes on its own shutdown, but clear() is a safety net)
    };
  }, [width, height]);

  return <div className="phaser-wrap" ref={wrapRef} style={{ width, height }} />;
}

window.PhaserGame = PhaserGame;

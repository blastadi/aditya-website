/* ════════════════════════════════════════════════════════════════
   DEPLOY · game/scenes/PreloadScene.js
   Phaser scene: asset loading. Phase 1 stub (no assets to load yet).
   ════════════════════════════════════════════════════════════════ */

(function () {
  if (typeof window.Phaser === "undefined") return; // CDN not loaded yet — Phaser scene registers in Phase 2

  window.PreloadScene = class PreloadScene extends window.Phaser.Scene {
    constructor() {
      super("preload");
    }
    preload() {
      // Phase 6: load sprite atlases, audio sprites here.
    }
    create() {
      this.scene.start("play");
    }
  };
})();

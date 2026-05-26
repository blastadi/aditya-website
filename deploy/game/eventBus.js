/* ════════════════════════════════════════════════════════════════
   DEPLOY · game/eventBus.js
   Pub/sub bridge between Phaser scenes and React UI.
   See §5.1 of DEPLOY_BUILD_BRIEF.md for the canonical event contract.
   ════════════════════════════════════════════════════════════════ */

(function () {
  if (window.eventBus) return; // hot-reload guard

  const listeners = {};

  window.eventBus = {
    /**
     * Subscribe to an event. Returns an unsubscribe function.
     * @param {string} event
     * @param {(payload: any) => void} fn
     * @returns {() => void}
     */
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return () => {
        listeners[event] = (listeners[event] || []).filter((f) => f !== fn);
      };
    },

    /**
     * Emit an event synchronously to all subscribers.
     * Listener errors are caught and logged so one bad handler doesn't break others.
     */
    emit(event, payload) {
      (listeners[event] || []).forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`[eventBus] listener for "${event}" threw:`, e);
        }
      });
    },

    /** Remove all listeners for all events. Useful between games / hot reloads. */
    clear() {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    },

    /** Inspect-only — returns subscriber counts per event. */
    _stats() {
      const out = {};
      Object.keys(listeners).forEach((k) => (out[k] = listeners[k].length));
      return out;
    },
  };

  // ────────────────── Self-test (Phase 1 smoke) ──────────────────
  // Logs once on load to confirm pub/sub works before any other module subscribes.
  (function selfTest() {
    let got = null;
    const off = window.eventBus.on("__selftest__", (p) => (got = p));
    window.eventBus.emit("__selftest__", { ok: true });
    off();
    window.eventBus.emit("__selftest__", { ok: false }); // should NOT be received
    if (got && got.ok === true) {
      // eslint-disable-next-line no-console
      console.info("[eventBus] self-test passed.");
    } else {
      // eslint-disable-next-line no-console
      console.warn("[eventBus] self-test FAILED — pub/sub is broken.");
    }
  })();
})();

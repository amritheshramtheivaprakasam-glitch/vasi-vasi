/* ============================================================
   Vasi Vasi — announcer
   Writes short status messages into visually-hidden live
   regions so screen readers speak them ("Playing",
   "Sentence 12 of 48", "Paused"). Polite vs assertive.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  let politeEl = null;
  let assertiveEl = null;
  let lastMessage = '';
  let lastAt = 0;

  function speak(el, message) {
    if (!el || !message) return;
    // Avoid flooding the screen reader with rapid repeats.
    const now = Date.now();
    if (message === lastMessage && now - lastAt < 800) return;
    lastMessage = message;
    lastAt = now;
    el.textContent = '';
    // Re-set on next tick so assistive tech sees the change.
    setTimeout(() => { el.textContent = message; }, 30);
  }

  VV.announcer = {
    init() {
      politeEl = document.getElementById('announcer-polite');
      assertiveEl = document.getElementById('announcer-assertive');
    },
    polite(message) { speak(politeEl, message); },
    assertive(message) { speak(assertiveEl || politeEl, message); }
  };
})();

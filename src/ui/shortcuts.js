/* ============================================================
   Vasi Vasi — keyboard shortcuts
   Global key handling. Inert while typing in form fields or
   while any dialog is open. Every action announces itself.

     Space        play / pause
     ← →          previous / next sentence
     Shift + ← →  previous / next paragraph
     ↑ ↓          faster / slower
     Home / End   first / last sentence
     Esc          back to library
     ?            help
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  function dialogOpen() {
    return !!document.querySelector('dialog[open]');
  }

  VV.shortcuts = {
    init() {
      document.addEventListener('keydown', (e) => {
        if (isTyping(e.target) || dialogOpen() || e.ctrlKey || e.metaKey || e.altKey) {
          return;
        }
        const app = VV.app;
        const inReader = app.currentView() === 'reader';

        // Help is available everywhere.
        if (e.key === '?') {
          e.preventDefault();
          VV.dialogs.openHelp();
          return;
        }
        if (!inReader) return;

        switch (e.key) {
          case ' ':
            e.preventDefault();
            app.togglePlayback();
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (e.shiftKey) app.nextParagraph(); else app.nextSentence();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) app.prevParagraph(); else app.prevSentence();
            break;
          case 'ArrowUp':
            e.preventDefault();
            app.adjustRate(+1);
            break;
          case 'ArrowDown':
            e.preventDefault();
            app.adjustRate(-1);
            break;
          case 'Home':
            e.preventDefault();
            app.firstSentence();
            break;
          case 'End':
            e.preventDefault();
            app.lastSentence();
            break;
          case 'Escape':
            e.preventDefault();
            app.showLibrary();
            break;
          default:
            break;
        }
      });
    }
  };
})();

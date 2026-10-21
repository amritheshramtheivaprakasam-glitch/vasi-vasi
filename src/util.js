/* ============================================================
   Vasi Vasi — shared utilities
   Tiny event emitter, id generator, language detection,
   time estimates and assorted helpers. Framework-free.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  /* Minimal pub/sub used by every engine and store. */
  class Emitter {
    constructor() {
      this._handlers = Object.create(null);
    }
    on(event, fn) {
      (this._handlers[event] || (this._handlers[event] = [])).push(fn);
      return () => this.off(event, fn);
    }
    off(event, fn) {
      const list = this._handlers[event];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    }
    emit(event, payload) {
      const list = this._handlers[event];
      if (!list) return;
      list.slice().forEach((fn) => {
        try { fn(payload); } catch (err) { console.error('[VV] listener error', err); }
      });
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  /* Heuristic language detection: Tamil block U+0B80–U+0BFF. */
  function detectLang(text) {
    if (/[஀-௿]/.test(text)) return 'ta';
    return 'en';
  }

  function langLabel(code) {
    return code === 'ta' ? 'தமிழ் / Tamil' : code === 'en' ? 'English' : code;
  }

  function countWords(text) {
    const m = text.trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function estimateMinutes(words, rate) {
    const wpm = VV.config.READING.wordsPerMinute * (rate || 1);
    return Math.max(1, Math.round(words / wpm));
  }

  function debounce(fn, ms) {
    let t = null;
    const debounced = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
    debounced.flush = function (...args) {
      clearTimeout(t);
      fn.apply(this, args);
    };
    return debounced;
  }

  function truncate(text, max) {
    text = text.trim();
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  VV.util = {
    Emitter, uid, clamp, detectLang, langLabel,
    countWords, estimateMinutes, debounce, truncate
  };
})();

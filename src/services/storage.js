/* ============================================================
   Vasi Vasi — storage service
   Safe JSON wrapper around localStorage. Falls back to in-memory
   storage when localStorage is unavailable (private windows,
   file:// in some browsers, quota errors). Never throws.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const memory = new Map();

  function backend() {
    try {
      if (typeof localStorage !== 'undefined') {
        const probe = '__vv_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
      }
    } catch (e) { /* fall through to memory */ }
    return null;
  }

  const store = backend();

  VV.storage = {
    persistent: !!store,

    get(key, fallback) {
      try {
        const raw = store ? store.getItem(key) : memory.get(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        console.warn('[VV] storage read failed for', key, e);
        return fallback;
      }
    },

    set(key, value) {
      try {
        const raw = JSON.stringify(value);
        if (store) store.setItem(key, raw);
        else memory.set(key, raw);
        return true;
      } catch (e) {
        console.warn('[VV] storage write failed for', key, e);
        return false;
      }
    },

    remove(key) {
      try {
        if (store) store.removeItem(key);
        else memory.delete(key);
      } catch (e) { /* ignore */ }
    }
  };
})();

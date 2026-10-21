/* ============================================================
   Vasi Vasi — settings store
   Loads, saves and broadcasts user settings (theme, voice,
   speed, text size...). Subscribers re-render on 'change'.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const { Emitter } = VV.util;

  const emitter = new Emitter();
  let settings = null;

  function load() {
    const saved = VV.storage.get(VV.config.STORAGE.settings, null);
    settings = Object.assign({}, VV.defaults.settings, saved || {});
    return settings;
  }

  function persist() {
    VV.storage.set(VV.config.STORAGE.settings, settings);
  }

  VV.settingsStore = {
    onChange: (fn) => emitter.on('change', fn),

    load,

    get() {
      if (!settings) load();
      return Object.assign({}, settings);
    },

    update(patch) {
      if (!settings) load();
      Object.assign(settings, patch);
      persist();
      emitter.emit('change', this.get());
    },

    reset() {
      settings = Object.assign({}, VV.defaults.settings);
      persist();
      emitter.emit('change', this.get());
    }
  };
})();

/* Minimal browser-ish environment for dependency-free unit tests.
   Provides just enough window/localStorage for the Vasi Vasi
   plain-script modules to load under Node. */
'use strict';
const path = require('path');

function createEnv() {
  const map = new Map();
  global.window = globalThis;
  window.VV = {};
  global.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    _map: map
  };
  return { storage: map };
}

function loadScripts(...relPaths) {
  for (const rel of relPaths) {
    const abs = path.join(__dirname, '..', '..', rel);
    delete require.cache[require.resolve(abs)];
    require(abs);
  }
}

module.exports = { createEnv, loadScripts };

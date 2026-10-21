/* Offline tests:
   1. Every file the service worker precaches must exist on disk.
   2. The app must make no external network references — the ₹0,
      offline-first model depends on this invariant. */
'use strict';
const fs = require('fs');
const path = require('path');
const { assert, assertEqual, summary } = require('../helpers/harness');

const ROOT = path.join(__dirname, '..', '..');

/* --- 1. service worker shell integrity --- */
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shellRefs = [...swSource.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
assert(shellRefs.length >= 20, `sw: shell lists ${shellRefs.length} assets`);
for (const ref of shellRefs) {
  const file = ref === '' ? 'index.html' : ref;
  assert(fs.existsSync(path.join(ROOT, file)), `sw: precached file exists — ${file}`);
}

/* --- 2. zero external network references in shipped code --- */
const scanned = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'tests') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs);
    else if (/\.(html|css|js)$/.test(entry.name)) scanned.push(abs);
  }
})(ROOT);

const urlPattern = /(https?:)?\/\/[\w.-]+\.[a-z]{2,}/i;
const allowedFragments = [
  'xmlns',               // SVG namespace identifiers are not fetches
  'w3.org',              // same, namespace URIs
  'serviceWorker',       // comments / identifiers
  ':$/.test(location',   // protocol check in main.js
  'fonts.googleapis',    // legacy comments
];
// Files allowed to carry outbound http(s) references: these are
// user-initiated links only (never fetched by code), in the optional,
// decoupled support module — never in the reading core.
const linkAllowedFiles = new Set(['src/support/supportConfig.js']);
let violations = 0;
for (const file of scanned) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (!urlPattern.test(line)) return;
    if (allowedFragments.some((f) => line.includes(f))) return;
    if (linkAllowedFiles.has(rel)) return;
    if (/\/\/\w/.test(line)) {
      violations += 1;
      console.error(`  external ref: ${rel}:${i + 1} → ${trimmed.slice(0, 90)}`);
    }
  });
}
assertEqual(violations, 0, 'offline: zero automatic external network references in app code');

/* --- 3. no fetch/XHR/beacon in the reading core --- */
let netCalls = 0;
function walkNet(rel) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) {
    fs.readdirSync(abs).forEach((f) => walkNet(path.join(rel, f)));
    return;
  }
  if (!abs.endsWith('.js')) return;
  const src = fs.readFileSync(abs, 'utf8');
  const hits = src.match(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/g);
  if (hits) netCalls += hits.length;
}
['src/main.js', 'src/core', 'src/services', 'src/ui', 'src/content'].forEach(walkNet);
assertEqual(netCalls, 0, 'offline: core contains no outbound network calls');

summary('sw-shell.test');

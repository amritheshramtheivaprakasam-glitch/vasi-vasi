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
    if (['.git', 'node_modules', 'tests', 'vendor'].includes(entry.name)) continue;
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
  'example.com',         // user-facing placeholder text in the URL dialog
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

/* --- 3. no AUTOMATIC outbound network calls ---
   Exactly one sanctioned caller exists: src/documents/urlAdapter.js,
   whose fetch is the explicit, user-requested "import from URL" feature
   (credentials omitted, direct origin only, no proxy, abortable). The
   invariant: network access must live in that one file and nowhere else. */
const SANCTIONED_NET_FILES = new Set(['src/documents/urlAdapter.js']);
const unapproved = [];
let sanctionedFound = false;
function walkNet(rel) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) {
    fs.readdirSync(abs).forEach((f) => walkNet(path.join(rel, f)));
    return;
  }
  if (!abs.endsWith('.js')) return;
  const normalized = rel.replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  const hits = src.match(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/g);
  if (!hits || !hits.length) return;
  if (SANCTIONED_NET_FILES.has(normalized)) sanctionedFound = true;
  else unapproved.push(normalized);
}
['src/main.js', 'src/core', 'src/services', 'src/ui', 'src/content', 'src/documents'].forEach(walkNet);
assertEqual(unapproved.length, 0,
  'offline: network calls confined to the sanctioned URL adapter' +
  (unapproved.length ? ' (violations: ' + unapproved.join(', ') + ')' : ''));
assert(sanctionedFound, 'offline: sanctioned URL adapter present');

/* --- 4. vendored libraries are pinned by content hash ---
   The vendor/ tree contains third-party parser builds procured at fixed
   versions (see NOTICE.md). Their internal strings legitimately contain
   license URLs and XML namespace identifiers, so the URL scan above
   excludes them — and THIS hash pin is the stronger guarantee: every
   vendored byte exactly matches the version we audited. Any tampering
   or unreviewed upgrade fails here. */
const crypto = require('crypto');
const PINNED_VENDOR = {
  'vendor/jszip/jszip.min.js': 'acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e',
  'vendor/mammoth/mammoth.browser.min.js': 'deb07bf230d1cb3e190bc5adc6743f35c6531b6571d1e5469b24f452a7f0f4ab',
  'vendor/readability/Readability.js': '61521a78d29e60def9623a14ebcc5a54aff88c61fd11326d7c016478a4f23047',
  'vendor/pdfjs/pdf.min.js': '5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946',
  'vendor/pdfjs/pdf.worker.min.js': 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b'
};
for (const [rel, sha] of Object.entries(PINNED_VENDOR)) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { assert(false, `vendor: missing pinned file ${rel}`); continue; }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  assertEqual(hash, sha, `vendor: ${path.basename(rel)} matches pinned SHA-256 (audited version)`);
}

summary('sw-shell.test');

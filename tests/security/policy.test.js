/* Security policy suite — release-blocking invariants (SEC-PDF-002,
   SEC-CSP-001, SEC-URL-001) plus hygiene scans. Fails the build if any
   security control silently disappears. No network access here. */
'use strict';
const fs = require('fs');
const path = require('path');
const { assert, assertEqual, summary } = require('../helpers/harness');
const { createEnv, loadScripts } = require('../helpers/env');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* SEC-CSP-001 — restrictive headers on the shipped shell */
const html = read('index.html');
const cspMatch = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
assert(cspMatch, 'CSP meta present in index.html');
const csp = cspMatch ? cspMatch[1] : '';
["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'none'",
  "form-action 'self'", "worker-src 'self' blob:", "connect-src 'self' https:"]
  .forEach((d) => assert(csp.includes(d), `CSP requires: ${d}`));
assert(!/script-src[^;]*unsafe-inline/.test(csp), 'script-src forbids inline scripts');
assert(!/script-src[^;]*unsafe-eval/.test(csp), 'script-src forbids eval');
assert(html.includes('name="referrer" content="no-referrer"'), 'Referrer-Policy: no-referrer');
assert(/http-equiv="Permissions-Policy"[^>]*camera=\(\)/.test(html), 'Permissions-Policy restricts camera/mic/geo');

/* SEC-PDF-002 — CVE-2024-4367 mitigation must survive refactors */
const pdfSrc = read('src/documents/pdfAdapter.js');
assert(/getDocument\(\{[\s\S]*?isEvalSupported:\s*false/.test(pdfSrc),
  'pdf.js getDocument calls carry isEvalSupported: false (CVE-2024-4367)');
assert(!/isEvalSupported:\s*true/.test(pdfSrc), 'no code path re-enables PDF font eval');

/* SEC-URL-001 — HTTPS only, behavior-verified before any fetch happens */
createEnv();
loadScripts('src/util.js', 'src/documents/urlAdapter.js');

(async () => {
  let httpErr = null;
  try { await window.VV.urlAdapter.importUrl('http://example.com/story'); }
  catch (e) { httpErr = e; }
  assert(httpErr && /https/i.test(httpErr.userMessage || ''), 'http:// URLs are rejected with an honest message');

  let upperErr = null;
  try { await window.VV.urlAdapter.importUrl('HTTP://EXAMPLE.COM/story'); }
  catch (e) { upperErr = e; }
  assert(upperErr && /https/i.test(upperErr.userMessage || ''), 'uppercase HTTP:// cannot bypass the gate');

  let junkErr = null;
  try { await window.VV.urlAdapter.importUrl('javascript:alert(1)'); }
  catch (e) { junkErr = e; }
  assert(junkErr, 'non-web schemes cannot enter the fetch pipeline');

  const urlSrc = read('src/documents/urlAdapter.js');
  assert(/credentials:\s*'omit'/.test(urlSrc), 'URL fetch cannot send cookies/credentials cross-origin');

  /* Hygiene scans over everything we ship */
  const shipped = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else shipped.push(p);
    }
  })(path.join(ROOT, 'src'));
  ['sw.js', 'index.html', 'manifest.webmanifest', '_headers'].forEach((f) => shipped.push(path.join(ROOT, f)));

  const secrets = [
    /AIza[0-9A-Za-z_-]{35}/,                 // Google API key
    /AKIA[0-9A-Z]{16}/,                       // AWS access key
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /ghp_[A-Za-z0-9]{20,}/,                   // GitHub token
    /xox[baprs]-[A-Za-z0-9-]{10,}/,           // Slack token
    /sk-ant-[A-Za-z0-9_-]{20,}/,              // Anthropic key (API-style)
    /sk-proj-[A-Za-z0-9_-]{20,}/              // OpenAI key
  ];
  const debugCalls = /console\.(log|debug)\(/;
  let secretHits = 0, debugHits = 0;
  for (const file of shipped) {
    if (!fs.existsSync(file)) { if (path.basename(file) === '_headers') assert(false, '_headers file ships with the repo for Cloudflare Pages'); continue; }
    const text = fs.readFileSync(file, 'utf8');
    for (const re of secrets) if (re.test(text)) { secretHits++; }
    if (debugCalls.test(text)) { debugHits++; }
  }
  assertEqual(secretHits, 0, 'no API keys, tokens or private keys anywhere in shipped code');
  assertEqual(debugHits, 0, 'no debug logging left in production shipped files');

  /* APK readiness surface: manifest must satisfy install/TWA requirements */
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert(manifest.display === 'standalone', 'manifest display=standalone');
  assert(manifest.start_url, 'manifest has start_url');
  const png512 = (manifest.icons || []).some((i) => /512/.test(i.sizes || '') && /png/.test(i.type || ''));
  const maskPng = (manifest.icons || []).some((i) => (i.purpose || '').includes('maskable') && /png/.test(i.type || ''));
  assert(png512 && maskPng, 'manifest ships 512px PNG icons incl. maskable (required for install + TWA/APK)');
  for (const icon of manifest.icons) {
    if (!/png/.test(icon.type)) continue;
    const p = path.join(ROOT, icon.src);
    assert(fs.existsSync(p) && fs.statSync(p).size > 2000, `icon on disk and non-trivial: ${icon.src}`);
  }

  const headers = read('_headers');
  assert(headers.includes('Content-Security-Policy') && headers.includes('Referrer-Policy'),
    '_headers enforces real HTTP security headers on static hosting');

  summary('policy.test');
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('CRASH:', e && e.message);
  process.exit(1);
});

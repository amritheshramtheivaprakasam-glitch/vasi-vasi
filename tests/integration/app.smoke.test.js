/* Integration test: full app boot under jsdom with a mocked
   speech engine. Requires the optional dev dependency jsdom
   (npm install). Skips cleanly when it is not installed —
   the app itself never needs jsdom. */
'use strict';
const { assert, assertEqual, summary } = require('../helpers/harness');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.log('SKIP: jsdom not installed (run `npm install` once to enable integration tests)');
  summary('app.smoke.test');
  process.exit(0);
}

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:8000/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

window.__spoken = [];
window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
window.speechSynthesis = {
  speaking: false,
  paused: false,
  getVoices: () => [
    { name: 'Google தமிழ்', lang: 'ta-IN', voiceURI: 'ta1', localService: true, default: false },
    { name: 'Google US English', lang: 'en-US', voiceURI: 'en1', localService: true, default: true }
  ],
  addEventListener() {},
  speak(u) {
    window.__spoken.push(u.text);
    this.speaking = true;
    setTimeout(() => u.onstart && u.onstart(), 0);
    setTimeout(() => u.onboundary && u.onboundary({ charIndex: 0, charLength: 5 }), 1);
    setTimeout(() => u.onend && u.onend(), 40);
  },
  cancel() { this.speaking = false; },
  pause() { this.paused = true; },
  resume() { this.paused = false; }
};
window.Element.prototype.scrollIntoView = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {} }));

// jsdom@24 does not implement HTMLDialogElement methods — polyfill the
// small open/close surface the app uses (mirrors native behavior closely
// enough for logic-level integration testing).
document.querySelectorAll('dialog').forEach((dlg) => {
  dlg.showModal = function () { this.setAttribute('open', ''); };
  dlg.show = function () { this.setAttribute('open', ''); };
  dlg.close = function (returnValue) {
    this.removeAttribute('open');
    if (returnValue != null) this.returnValue = returnValue;
    this.dispatchEvent(new window.Event('close'));
  };
  Object.defineProperty(dlg, 'open', {
    get() { return this.hasAttribute('open'); },
    configurable: true
  });
});

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
for (const s of scripts) window.eval(fs.readFileSync(path.join(ROOT, s), 'utf8'));

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  assert(window.VV && window.VV.app, 'app booted');
  await tick(5);

  const docs = window.VV.libraryStore.all();
  assertEqual(docs.length, 3, 'starter library seeded');
  assertEqual($('doc-list').children.length, 3, 'library cards rendered');
  assert(docs.some((d) => d.lang === 'ta'), 'Tamil doc detected');

  const enDoc = docs.find((d) => d.lang === 'en');
  window.VV.app.openDocument(enDoc.id);
  assert(!$('view-reader').hidden && $('view-library').hidden, 'reader view opened');
  assert(qs('#reader-heading').textContent === enDoc.title, 'reader heading matches doc');
  assert(document.querySelectorAll('#reader-content .sentence').length > 5, 'sentences rendered');

  const picked = window.VV.speech.pickVoice(null, 'ta');
  assert(picked && picked.lang === 'ta-IN', 'voice auto-pick prefers Tamil for Tamil text');

  window.VV.app.togglePlayback();
  await tick(4);
  assert(window.__spoken.length >= 1, 'play speaks');
  assert(qs('.sentence.active'), 'active sentence highlighted');
  assert(qs('.w'), 'karaoke word spans created');
  assertEqual(qs('#btn-play .play-label').textContent, 'Pause', 'play button state');

  window.VV.app.togglePlayback();
  const atPause = window.__spoken.length;
  await tick(60);
  assertEqual(window.__spoken.length, atPause, 'pause halts speech');

  // stop mid-utterance must never advance the cursor
  window.VV.app.playFrom(1);
  window.VV.reader.stop();
  await tick(60);
  assertEqual(window.VV.reader.index, 1, 'stop mid-sentence preserves position');

  // paragraph navigation always lands on paragraph starts
  const starts = window.VV.reader.paragraphStarts;
  window.VV.app.nextParagraph();
  assert(starts.includes(window.VV.reader.index), 'nextParagraph lands on paragraph start');
  window.VV.app.nextParagraph();
  window.VV.app.nextParagraph();
  window.VV.app.nextParagraph();
  assert(starts.includes(window.VV.reader.index), 'repeated nextParagraph stays valid at the end');
  window.VV.app.firstSentence();
  assertEqual(window.VV.reader.index, 0, 'firstSentence');
  window.VV.app.lastSentence();
  assertEqual(window.VV.reader.index, window.VV.reader.total - 1, 'lastSentence');
  window.VV.app.stopReading();
  await tick(4);
  assertEqual(qs('#btn-play .play-label').textContent, 'Play', 'stop resets the play button');

  // resume flow: save position, leave, come back
  const d2 = window.VV.libraryStore.add('P', 'One. Two. Three.', 'paste');
  window.VV.app.openDocument(d2.id);
  window.VV.app.playFrom(1);
  await tick(4);
  window.VV.app.showLibrary();
  window.VV.libraryStore.flushProgress();
  const prog = window.VV.libraryStore.getProgress(d2.id);
  assert(prog && prog.index >= 1, 'progress persisted');
  window.VV.app.openDocument(d2.id);
  assert(window.VV.reader.index >= 1, 'reopen resumes at saved position');

  // settings propagate
  window.VV.settingsStore.update({ theme: 'contrast', rate: 1.5 });
  assertEqual(document.documentElement.dataset.theme, 'contrast', 'theme applied');
  assert($('rate-display').textContent.includes('1.5'), 'rate display synced');

  // full-document playback completes
  window.__spoken.length = 0;
  window.VV.app.playFrom(0);
  await tick(200);
  assertEqual(window.__spoken.length, 3, 'short doc read to completion');
  assertEqual(window.VV.reader.status, 'ended', 'status=ended');
  assertEqual(qs('#btn-play .play-label').textContent, 'Play again', 'replay offered');

  // support dialog exists and opens; core unaffected
  document.getElementById('btn-support').click();
  assert($('dlg-support').open, 'support dialog opens');
  $('dlg-support').close();
  window.VV.app.showLibrary();
  assert(!$('view-library').hidden, 'back to library');
  assert(window.localStorage.getItem('vasivasi.library.v1').length > 100, 'library persisted');

  summary('app.smoke.test');
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('CRASH:', e);
  process.exit(1);
});

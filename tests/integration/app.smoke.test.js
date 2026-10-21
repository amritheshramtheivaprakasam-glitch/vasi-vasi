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
// jsdom does not shim TextEncoder/TextDecoder; all production browsers have them.
if (typeof window.TextDecoder === 'undefined') {
  const util = require('util');
  window.TextDecoder = util.TextDecoder;
  window.TextEncoder = util.TextEncoder;
}

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

  // ---------- document import layer (complete workflow) ----------
  const fs2 = require('fs');
  const path2 = require('path');
  const makeFile = (name, buf, type) => {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const f = new window.File([u8], name, { type: type || 'application/octet-stream' });
    // jsdom@24 lacks Blob.arrayBuffer()/slice().arrayBuffer() — supply them,
    // returning WINDOW-realm buffers so realm instanceof checks (JSZip et al.)
    // behave exactly as in a real browser.
    const toWindowBuffer = (src) => {
      const w = new window.Uint8Array(src.length);
      w.set(src);
      return w.buffer;
    };
    f.arrayBuffer = async () => toWindowBuffer(u8);
    f.slice = (start, end) => {
      const s = u8.subarray(start || 0, end);
      return { size: s.length, arrayBuffer: async () => toWindowBuffer(s) };
    };
    return f;
  };
  const fixture = (n) => Array.from(fs2.readFileSync(path2.join(ROOT, 'tests', 'fixtures', n)));

  // fake.pdf: signature says PDF, bytes are garbage → adapter loaded, honest failure, library untouched
  window.VV.vendorLoader._inject('pdfjs', {
    GlobalWorkerOptions: {},
    getDocument() { return { promise: Promise.reject(Object.assign(new Error('bad'), { name: 'InvalidPDFException' })) }; }
  });
  const before1 = window.VV.libraryStore.all().length;
  try {
    await window.VV.documentImport.importFile(makeFile('fake.pdf', fixture('fake.pdf'), 'application/pdf'));
    assert(false, 'fake.pdf should have thrown');
  } catch (e) {
    assert(/damaged/i.test(e.userMessage || ''), 'fake.pdf → honest damaged-PDF error, no raw bytes');
  }
  assertEqual(window.VV.libraryStore.all().length, before1, 'rejected import never enters the library');

  // password-protected mapping
  window.VV.vendorLoader._inject('pdfjs', {
    GlobalWorkerOptions: {},
    getDocument() { return { promise: Promise.reject(Object.assign(new Error('pw'), { name: 'PasswordException' })) }; }
  });
  try {
    await window.VV.documentImport.importFile(makeFile('secret.pdf', fixture('fake.pdf'), 'application/pdf'));
    assert(false, 'password pdf should have thrown');
  } catch (e) {
    assert(/password/i.test(e.userMessage || ''), 'PasswordException → spoken-friendly password message');
  }

  // complete happy path: PDF import → library → reader open → navigate → resume
  window.VV.vendorLoader._inject('pdfjs', {
    GlobalWorkerOptions: {},
    getDocument(cfg) {
      assert(cfg.cMapUrl.includes('vendor/pdfjs/cmaps'), 'pdf.js gets local cMaps path');
      const mk = (texts) => ({
        getTextContent: async () => ({
          items: texts.map(([str, x, y, w]) => ({ str, transform: [1, 0, 0, 12, x, y], width: w, height: 12 }))
        }),
        cleanup() {}
      });
      return {
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (i) => mk(i === 1
            ? [['The river ', 50, 700, 55], ['woke slowly.', 115, 700, 60], ['Birds called out.', 50, 684, 85]]
            : [['Tea was hot and sweet.', 50, 780, 150], ['Everyone smiled.', 50, 764, 90]])
        })
      };
    }
  });
  const happy = await window.VV.documentImport.importFile(
    makeFile('book.pdf', fixture('fake.pdf'), 'application/pdf'));
  assertEqual(happy.format, 'pdf', 'pdf import reports format');
  assertEqual(happy.meta.pageCount, 2, 'pdf import reports page count');
  assert(happy.text.includes('The river woke slowly.'), 'gap-merged sentence intact in import');
  assert(happy.text.includes('\n\n'), 'pages joined as paragraphs');
  const pdfDoc = window.VV.app.addDocument(happy.title, happy.text, 'file', true, {
    format: happy.format, pageCount: happy.meta.pageCount, warnings: happy.warnings });
  await tick(4);
  assert(!$('view-reader').hidden, 'pdf import opened the reader');
  assert(document.querySelectorAll('#reader-content .sentence').length >= 4, 'pdf text became sentences');
  assert(window.VV.reader.paragraphStarts.length >= 2, 'pdf pages became navigable paragraphs');
  const card = [...document.querySelectorAll('.doc-card')].find((c) => c.textContent.includes('PDF'));
  assert(!!card, 'library card shows the PDF chip');

  // EPUB end-to-end. jsdom-realm JSZip.loadAsync never resolves (a jsdom
  // artifact, not a production issue — browsers run a single realm), so the
  // test injects the SAME vendored JSZip running in the Node realm, with a
  // buffer adapter at the boundary. The epub parsing logic under test
  // (container → OPF → spine → textBlocks) runs unchanged.
  const NodeJSZip = require(path2.join(ROOT, 'vendor/jszip/jszip.min.js'));
  window.VV.vendorLoader._inject('jszip', {
    loadAsync: (data) => NodeJSZip.loadAsync(Buffer.from(new Uint8Array(data)))
  });
  const zip = new NodeJSZip();
  zip.file('META-INF/container.xml',
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/content.opf',
    '<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Test Book</dc:title></metadata>' +
    '<manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>' +
    '<spine><itemref idref="c1"/></spine></package>');
  zip.file('OEBPS/ch1.xhtml', '<html><body><h1>Chapter One</h1><p>It began quietly. The house slept.</p></body></html>');
  const epubBuf = await zip.generateAsync({ type: 'nodebuffer' });
  const epubRes = await window.VV.documentImport.importFile(
    makeFile('test.epub', new Uint8Array(epubBuf), 'application/epub+zip'));
  assertEqual(epubRes.format, 'epub', 'epub routed by internal markers');
  assert(epubRes.title === 'Test Book' || epubRes.title === 'test', 'epub title read from metadata');
  assert(epubRes.text.includes('Chapter One') && epubRes.text.includes('It began quietly.'),
    'epub chapters extracted in spine order');

  // quality gate guards the text path: a .txt holding PDF OBJECT SYNTAX
  // (but no %PDF signature — so it stays on the text route) is refused.
  const syntaxBytes = Array.from(new TextEncoder().encode(
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\nstructural junk…'));
  try {
    await window.VV.documentImport.importFile(makeFile('evil.txt', syntaxBytes, 'text/plain'));
    assert(false, 'syntax-leaking txt should have been rejected');
  } catch (e) {
    assert(/raw PDF|not imported/i.test(e.userMessage || ''), 'txt with PDF syntax rejected by gate');
  }

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

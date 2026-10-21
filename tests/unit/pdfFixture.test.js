/* PDF fixture test — the REAL engine end-to-end.
   Parses tests/fixtures/hello.pdf with the actual vendored pdf.js build
   and drives it through the production line-reconstruction geometry.
   This is the closest possible regression to importing a real book,
   without needing a browser. Runs in plain Node (no window shims) —
   pdfjs-dist 3.x ships a supported Node entry in build/pdf.min.js. */
'use strict';
const { assert, assertEqual, summary, pass, fail } = require('../helpers/harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const pdfjs = require(path.join(ROOT, 'vendor/pdfjs/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT, 'vendor/pdfjs/pdf.worker.min.js');
const adapter = require(path.join(ROOT, 'src/documents/pdfAdapter.js'));

(async () => {
  /* --- real text-layer PDF --- */
  const data = new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/hello.pdf')));
  const pdf = await pdfjs.getDocument({
    data,
    cMapUrl: path.join(ROOT, 'vendor/pdfjs/cmaps') + '/',
    cMapPacked: true,
    standardFontDataUrl: path.join(ROOT, 'vendor/pdfjs/standard_fonts') + '/'
  }).promise;

  assertEqual(pdf.numPages, 2, 'real pdf.js: hello.pdf page count');

  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(adapter.rebuildLines(content.items).join('\n').trim());
    if (page.cleanup) page.cleanup();
  }

  const joined = pageTexts.filter((t) => t.length >= 20).join('\n\n');
  assert(/woke\s+slowly/.test(joined),
    'real pdf.js: styled runs separated by spaces — no fused words reaching speech');
  assert(joined.includes('The river woke slowly over Madurai.'),
    'real pdf.js: exact sentence preserved on page 1');
  assert(joined.includes('Vaigai Morning'), 'real pdf.js: heading extracted');
  assert(pageTexts.every((t) => t.length >= 20), 'real pdf.js: no page flagged as scanned');
  assertEqual(pageTexts.length, 2, 'real pdf.js: pages joined as 2 paragraphs');

  /* --- scanned-style PDF (zero extractable text) --- */
  const scannedData = new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/scanned-look.pdf')));
  const scannedPdf = await pdfjs.getDocument({
    data: scannedData,
    cMapUrl: path.join(ROOT, 'vendor/pdfjs/cmaps') + '/',
    cMapPacked: true
  }).promise;
  let scannedChars = 0;
  for (let i = 1; i <= scannedPdf.numPages; i++) {
    const page = await scannedPdf.getPage(i);
    const content = await page.getTextContent();
    scannedChars += adapter.rebuildLines(content.items).join('').trim().length;
    if (page.cleanup) page.cleanup();
  }
  assertEqual(scannedChars, 0,
    'real pdf.js: scanned-look.pdf yields zero text → production code must report OCR-required');

  /* --- fake.pdf (syntax header, garbage body) must fail damaged, not leak --- */
  const fakeData = new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/fake.pdf')));
  let threw = false;
  try {
    await pdfjs.getDocument({ data: fakeData }).promise;
  } catch (e) {
    threw = true;
    pass(`real pdf.js: fake.pdf rejected (${e.name || 'error'}) — adapter maps to spoken "damaged" error`);
  }
  assert(threw, 'real pdf.js: fake.pdf is rejected, never misread as text');

  summary('pdfFixture.test');
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('CRASH:', e && e.message);
  process.exit(1);
});

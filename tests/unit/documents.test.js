/* Unit tests: document import layer
   - byte-signature routing (never trust extensions)
   - BOM-aware text decoding
   - quality gate: reject/warn/ok contracts
   - PDF line reconstruction (gap-based spaces, dehyphenation)
   - zip container sniffing (real JSZip-built EPUB/DOCX) */
'use strict';
const { assert, assertEqual, summary } = require('../helpers/harness');
const { createEnv, loadScripts } = require('../helpers/env');
const fs = require('fs');
const path = require('path');

const env = createEnv();
loadScripts('src/config.js', 'src/util.js');
const VV = window.VV;

const qualityGate = require('../../src/documents/qualityGate.js');
const pdfAdapter = require('../../src/documents/pdfAdapter.js');
const importManager = require('../../src/documents/importManager.js');

/* ---------- signature detection ---------- */
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
assertEqual(importManager.detectSignature(pdfBytes), 'pdf', 'signature: %PDF routes to pdf');
const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2]);
assertEqual(importManager.detectSignature(zipBytes), 'zip', 'signature: PK zip container');
assertEqual(importManager.detectSignature(new Uint8Array([72, 101, 108, 108, 111])), 'text',
  'signature: ordinary text stays text');

/* real fixtures route correctly */
const fx = (n) => new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'fixtures', n)));
assertEqual(importManager.detectSignature(fx('hello.pdf')), 'pdf', 'fixture: hello.pdf → pdf');
assertEqual(importManager.detectSignature(fx('fake.pdf')), 'pdf', 'fixture: fake.pdf → pdf (signature, not extension)');
assertEqual(importManager.detectSignature(fx('note.txt')), 'text', 'fixture: note.txt → text');
assert(pdfAdapter.isPdf(fx('hello.pdf')), 'isPdf: valid fixture passes');
assert(pdfAdapter.isPdf(fx('fake.pdf')), 'isPdf: fake also has signature (adapter must fail damaged, not leak bytes)');

/* ---------- text decoding ---------- */
const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, 72, 105]);
assertEqual(importManager.decodeText(utf8Bom.buffer), 'Hi', 'decode: UTF-8 BOM stripped');
const utf16le = new Uint8Array([0xff, 0xfe, 72, 0, 105, 0]);
assertEqual(importManager.decodeText(utf16le.buffer), 'Hi', 'decode: UTF-16LE BOM');
const plain = new TextEncoder().encode('வணக்கம் world');
assertEqual(importManager.decodeText(plain.buffer), 'வணக்கம் world', 'decode: UTF-8 Tamil preserved');

/* ---------- quality gate ---------- */
let g = qualityGate.assess('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
assertEqual(g.verdict, 'reject', 'gate: raw PDF syntax rejected');
assert(g.messages[0].length > 20, 'gate: rejection has spoken-friendly message');

g = qualityGate.assess('The river flows past the city. People gather on its banks every morning. '.repeat(6));
assertEqual(g.verdict, 'ok', 'gate: clean prose passes');

g = qualityGate.assess('');
assertEqual(g.verdict, 'reject', 'gate: empty rejected');

g = qualityGate.assess('1234567890 !@#$%^&*() 9876543210 ~`|}{[]\\<>_-+=;:. '.repeat(8));
assertEqual(g.verdict, 'reject', 'gate: symbol soup rejected');

g = qualityGate.assess(('xqz bvkj qzxjk vqkxz bqjw xqzkv jq kxbz qxvjk zqbvk xjqk zbv kqjxkz qjvbkz jqkxzv qzxvkjk '.repeat(9)));
assertEqual(g.verdict, 'warn', 'gate: legacy-font gibberish warns (not silent)');
assert(/font|unicode/i.test(g.messages[0]), 'gate: gibberish message explains the old-font trap');

g = qualityGate.assess(('word ').repeat(400) + '�'.repeat(200));
assertEqual(g.verdict, 'reject', 'gate: heavy replacement-char corruption rejected');
g = qualityGate.assess(('word ').repeat(400) + '�'.repeat(60));
assertEqual(g.verdict, 'warn', 'gate: mild replacement chars warn');

/* ---------- PDF line reconstruction (the fused-words fix) ---------- */
const t = (x, y, w = 50) => [1, 0, 0, 12, x, y];
let items = [
  { str: 'The river ', transform: t(50, 700, 52) },
  { str: 'woke', transform: t(50 + 52 + 8, 700, 24) },   // gap → space (already has trailing space, no double)
  { str: 'slowly', transform: t(50 + 52 + 8 + 24 + 3, 700, 30) }, // tiny gap → direct join guard
  { str: 'over Madurai.', transform: t(50, 684, 60) }    // y jump → new line
];
// craft the dangerous case: two runs, same line, clear word gap, NO trailing space
items = [
  { str: 'Hello', transform: t(50, 700, 30) },
  { str: 'World.', transform: t(50 + 30 + 12, 700, 34) },
  { str: 'hyphen-', transform: t(50, 686, 40) },
  { str: 'ation continues.', transform: t(50, 672, 70) }
];
const lines = pdfAdapter.rebuildLines(items);
assertEqual(lines[0], 'Hello World.', 'pdf geometry: gap inserts exactly one space (no fused words)');
assertEqual(lines[1], 'hyphenation continues.', 'pdf geometry: hyphen line-break joined');
assertEqual(lines.length, 2, 'pdf geometry: line count');

const tightRun = pdfAdapter.rebuildLines([
  { str: 'River', transform: t(50, 700, 28) },
  { str: 'bank.', transform: t(50 + 28 + 0.5, 700, 24) } // kerning gap below threshold → join
]);
assertEqual(tightRun[0], 'Riverbank.', 'pdf geometry: sub-threshold gap joins runs');

const keep = pdfAdapter.dehyphenate(['self-', 'Respect']);
assert(keep.length === 2 && keep[0] === 'self-', 'dehyphenate: proper-noun hyphen kept');
const lower = pdfAdapter.dehyphenate(['informa-', 'tion flows']);
assertEqual(lower.join('|'), 'information flows', 'dehyphenate: lowercase join drops hyphen');

/* ---------- zip sniffing (real zips built with vendored JSZip) ---------- */
(async () => {
  const JSZip = require('../../vendor/jszip/jszip.min.js');

  const epub = new JSZip();
  epub.file('mimetype', 'application/epub+zip');
  epub.file('META-INF/container.xml',
    '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
  epub.file('OEBPS/content.opf', '<package/>');

  const docx = new JSZip();
  docx.file('[Content_Types].xml', '<Types/>');
  docx.file('word/document.xml', '<w:document/>');

  const mystery = new JSZip();
  mystery.file('random.bin', 'x');

  assertEqual(importManager.sniffZipKind(await epub.loadAsync(await epub.generateAsync({ type: 'nodebuffer' }))),
    'epub', 'zip sniff: container.xml → epub');
  assertEqual(importManager.sniffZipKind(await docx.loadAsync(await docx.generateAsync({ type: 'nodebuffer' }))),
    'docx', 'zip sniff: [Content_Types]+word/document.xml → docx');
  assertEqual(importManager.sniffZipKind(await mystery.loadAsync(await mystery.generateAsync({ type: 'nodebuffer' }))),
    null, 'zip sniff: unknown zip → null (honest unsupported error)');

  /* ---------- epub path resolution (pure helper, window-global module) ---------- */
  require('../../src/documents/epubAdapter.js');
  assertEqual(window.VV.epubAdapter._resolvePath('OEBPS', 'text/ch1.xhtml'),
    'OEBPS/text/ch1.xhtml', 'epub resolve: simple join');
  assertEqual(window.VV.epubAdapter._resolvePath('OEBPS', '../xhtml/ch1.html'),
    'xhtml/ch1.html', 'epub resolve: dot-dot normalized');

  summary('documents.test');
  process.exit(process.exitCode || 0);
})().catch((e) => { console.error('CRASH:', e); process.exit(1); });

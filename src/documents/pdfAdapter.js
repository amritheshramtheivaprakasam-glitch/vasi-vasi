/* ============================================================
   Vasi Vasi — PDF adapter (vendored pdf.js, Apache-2.0)
   Extracts readable text page by page from the PDF text layer.
   Corrections applied vs the naive adapter:

     1. Zero-build: plain script + lazily loaded vendored UMD
        build (worker bundled locally; falls back to main-thread
        parsing when workers cannot load, e.g. file://).
     2. Gap-based space insertion between text runs, so styled or
        justified text never fuses into "HelloWorld" for the
        speech engine.
     3. Pages join with a blank line, so each PDF page becomes a
        paragraph in the reader — Shift+←/→ = page navigation.

   Scanned pages are detected and reported honestly; OCR is not
   included in this release.
   ============================================================ */
(function () {
  'use strict';
  const VV = (typeof window !== 'undefined' ? window : globalThis);
  VV.VV = VV.VV || {};

  const MIN_CHARS_PER_PAGE = 20;
  const LINE_Y_TOLERANCE = 2;
  const SPACE_GAP_RATIO = 0.25; // fraction of item height → word gap

  /* ---------------- pure helpers (node-testable) ---------------- */

  function isPdf(bytes) {
    return (
      bytes.length > 4 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
      bytes[3] === 0x46 && bytes[4] === 0x2d // "%PDF-"
    );
  }

  /* Join "hyphen-\nation" line splits (only when the next line starts
     lowercase — keeps real hyphens on proper nouns). */
  function dehyphenate(lines) {
    const out = [];
    for (const line of lines) {
      if (out.length && /-$/.test(out[out.length - 1]) && /^[a-zàâäéèêëîïôöùûüÿçæœ]/.test(line)) {
        out[out.length - 1] = out[out.length - 1].slice(0, -1) + line;
      } else {
        out.push(line);
      }
    }
    return out;
  }

  /* pdf.js emits positioned text runs, not sentences. Rebuild lines
     from (x, y, width, height) geometry: new line on vertical jumps,
     a space when the horizontal gap between runs is clearly a word gap. */
  function rebuildLines(items) {
    const lines = [];
    let cur = '';
    let prev = null; // { xEnd, y, h }

    const flush = () => {
      if (cur.trim()) lines.push(cur.trimEnd());
      cur = '';
    };

    for (const it of items) {
      if (!it || typeof it.str !== 'string' || it.str === '') continue;
      const t = it.transform || [];
      const y = t[5] || 0;
      const x = t[4] || 0;
      const h = it.height || Math.abs(t[3]) || 10;
      const w = typeof it.width === 'number' ? it.width : it.str.length * h * 0.5;

      if (prev) {
        if (Math.abs(y - prev.y) > LINE_Y_TOLERANCE) {
          flush();
        } else if (x - prev.xEnd > h * SPACE_GAP_RATIO) {
          if (cur && !/\s$/.test(cur)) cur += ' ';
        }
      }
      cur += it.str;
      prev = { xEnd: x + w, y, h };
    }
    flush(); // trailing line
    return dehyphenate(lines);
  }

  /* ---------------- extraction (browser) ---------------- */

  function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
  }

  async function extract(file, onProgress) {
    const pdfjsLib = await VV.VV.vendorLoader.load('pdfjs');
    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (!isPdf(bytes)) {
      throw userError('This file is not a valid PDF document.');
    }

    const base = document.baseURI;
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({
        data: bytes,
        cMapUrl: new URL('vendor/pdfjs/cmaps/', base).href,
        cMapPacked: true,
        standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', base).href,
        // SEC-PDF-002: never compile JavaScript embedded in a PDF's fonts
        // (CVE-2024-4367, fixed upstream in pdf.js 4.2.67 — we pin v3 for
        // classic-script/file:// compatibility, so mitigation is required
        // here). Text extraction does not depend on font-program eval.
        isEvalSupported: false
      }).promise;
    } catch (err) {
      const name = err && err.name;
      if (name === 'PasswordException') {
        throw userError('This PDF is password protected. Please unlock it and try again.');
      }
      throw userError('This PDF could not be opened. The file may be damaged or incomplete.');
    }

    const pages = [];
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Skip marked-content marker items; real glyphs carry .str
      const text = rebuildLines(content.items).join('\n').trim();
      pages.push({ pageNumber: i, text, likelyScanned: text.length < MIN_CHARS_PER_PAGE });
      if (typeof page.cleanup === 'function') page.cleanup();
      if (onProgress) onProgress({ page: i, total });
    }

    const scannedPages = pages.filter((p) => p.likelyScanned);
    const warnings = [];

    if (scannedPages.length === pages.length) {
      throw userError(
        'This PDF looks like scanned page images and has no readable text. ' +
        'Scanned-page reading (OCR) is not available yet — ' +
        total + (total === 1 ? ' page' : ' pages') + ' checked.'
      );
    }
    if (scannedPages.length > 0) {
      warnings.push(
        scannedPages.length + ' of ' + total +
        ' pages have no readable text (scanned images) and were skipped.'
      );
    }

    const text = pages.filter((p) => !p.likelyScanned).map((p) => p.text).join('\n\n');
    return {
      text,
      meta: { pageCount: total, skippedPages: scannedPages.length },
      warnings
    };
  }

  VV.VV.pdfAdapter = { extract, isPdf, rebuildLines, dehyphenate };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VV.VV.pdfAdapter; // pure helpers are node-testable
  }
})();

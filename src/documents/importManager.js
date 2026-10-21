/* ============================================================
   Vasi Vasi — import manager
   The single gate every file passes through. Routing is by
   BYTE SIGNATURE, never by extension:

     %PDF-    → PDF adapter (vendored pdf.js)
     PK\x03\x04 → ZIP container → sniffed as EPUB or DOCX
     anything else → text path (BOM-aware decoding)

   Then the quality gate runs: rejected text never enters the
   library and never reaches the speech engine. This replaces
   the old accept-hint + readAsText path, which let raw PDF
   bytes through when the picker was bypassed.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const { truncate } = VV.util;

  function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
  }

  /* ---------- signature detection (pure, node-testable) ---------- */

  function detectSignature(bytes) {
    if (bytes.length > 4 &&
        bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
        bytes[3] === 0x46 && bytes[4] === 0x2d) {
      return 'pdf';
    }
    if (bytes.length > 3 &&
        bytes[0] === 0x50 && bytes[1] === 0x4b &&
        (bytes[2] === 0x03 && bytes[3] === 0x04 ||
         bytes[2] === 0x05 && bytes[3] === 0x06)) {
      return 'zip';
    }
    return 'text';
  }

  /** Decide EPUB vs DOCX from the zip's internal structure. */
  function sniffZipKind(zip) {
    if (zip.file('META-INF/container.xml')) return 'epub';
    if (zip.file('[Content_Types].xml') && zip.file('word/document.xml')) return 'docx';
    return null;
  }

  /* ---------- text decoding (BOM-aware; pure, node-testable) ---------- */

  function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3));
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  function titleFromName(name) {
    return truncate(
      String(name || 'Imported document').replace(/\.[^.]+$/, '').trim() || 'Imported document',
      VV.config.LIMITS.titleMax
    );
  }

  /* ---------- format adapters (replaceable for tests) ---------- */

  const adapters = {
    pdf: (file, onProgress) => VV.pdfAdapter.extract(file, onProgress),
    docx: (file, onProgress) => VV.docxAdapter.extract(file, onProgress),
    epub: (zip, onProgress) => VV.epubAdapter.extract(zip, onProgress)
  };

  /* ---------- public API ---------- */

  async function importFile(file, options) {
    const opts = options || {};
    const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

    if (file.size > VV.config.LIMITS.importMaxChars * 4) {
      throw userError('That file is too large. Try a file under ' +
        Math.round(VV.config.LIMITS.importMaxChars * 4 / 1048576) + ' MB.');
    }

    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const kind = detectSignature(head);
    let result;
    let format;

    if (kind === 'pdf') {
      format = 'pdf';
      result = await adapters.pdf(file, onProgress);
    } else if (kind === 'zip') {
      const JSZip = await VV.vendorLoader.load('jszip');
      // Read bytes explicitly rather than passing the File down: avoids
      // Blob-API quirks across environments and gives one clear path.
      const zipBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);
      const zipKind = sniffZipKind(zip);
      if (zipKind === 'epub') {
        format = 'epub';
        result = await adapters.epub(zip, onProgress);
      } else if (zipKind === 'docx') {
        format = 'docx';
        result = await adapters.docx(file, onProgress);
      } else {
        throw userError('That zip-based format is not supported yet. ' +
          'Try PDF, DOCX, EPUB or plain text.');
      }
    } else {
      format = 'text';
      const buffer = await file.arrayBuffer();
      result = { text: decodeText(buffer), meta: {}, warnings: [] };
    }

    /* Quality gate — reject verdicts never reach the library. */
    const gate = VV.qualityGate.assess(result.text);
    if (gate.verdict === 'reject') throw userError(gate.messages[0]);

    if (!result.text || !result.text.trim()) {
      throw userError('No readable text was found in that file.');
    }

    const warnings = (result.warnings || []).concat(
      gate.verdict === 'warn' ? gate.messages : []
    );

    return {
      title: opts.titleHint || result.title || titleFromName(file.name),
      text: result.text,
      format,
      meta: Object.assign({ format }, result.meta || {}),
      warnings
    };
  }

  async function importUrl(url, options) {
    const r = await VV.urlAdapter.importUrl(url, options && options.onProgress);
    const gate = VV.qualityGate.assess(r.text);
    if (gate.verdict === 'reject') throw userError(gate.messages[0]);
    return {
      title: r.title,
      text: r.text,
      format: 'url',
      meta: Object.assign({ format: 'url' }, r.meta || {}),
      warnings: (r.warnings || []).concat(gate.verdict === 'warn' ? gate.messages : [])
    };
  }

  VV.documentImport = {
    importFile,
    importUrl,
    detectSignature,
    sniffZipKind,
    decodeText,
    _setAdapter(name, fn) { adapters[name] = fn; } // test hook
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VV.documentImport; // pure helpers are node-testable
  }
})();

/* ============================================================
   Vasi Vasi — DOCX adapter (vendored Mammoth, BSD-2-Clause)
   A .docx is a zip of XML; Mammoth converts it to clean HTML
   entirely in the browser, and textBlocks turns that HTML into
   reading-order paragraphs. Complex floating layouts collapse
   to plain reading order — documented, not hidden.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  async function extract(file, onProgress) {
    const mammoth = await VV.vendorLoader.load('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    if (onProgress) onProgress({ phase: 'convert' });
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const paragraphs = VV.textBlocks.parse(result.value || '');

    if (!paragraphs.length) {
      const err = new Error('No readable text was found in that DOCX document.');
      err.userMessage = err.message;
      throw err;
    }

    const warnings = [];
    if ((result.messages || []).some((m) => m.type === 'warning')) {
      warnings.push('Some complex formatting was simplified during import.');
    }

    return { text: paragraphs.join('\n\n'), meta: {}, warnings };
  }

  VV.docxAdapter = { extract };
})();

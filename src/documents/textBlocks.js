/* ============================================================
   Vasi Vasi — text blocks
   Shared helper that converts HTML into clean paragraphs in
   reading order. Used by the DOCX, EPUB and URL adapters.
   Only the top-most block element is emitted (a blockquote
   containing <p>s becomes one paragraph), so text is never
   duplicated. Script/style/navigation content is dropped.
   ============================================================ */
(function () {
  'use strict';
  const VV = (typeof window !== 'undefined' ? window : globalThis);
  VV.VV = VV.VV || {};

  const BLOCKS = new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'TH', 'DT', 'DD', 'FIGCAPTION'
  ]);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

  function norm(s) {
    return String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  function fromElement(root) {
    const out = [];
    (function visit(el) {
      if (!el || el.nodeType !== 1) return;
      const tag = el.tagName;
      if (SKIP.has(tag)) return;
      if (BLOCKS.has(tag)) {
        const t = norm(el.textContent);
        if (t) out.push(t);
        return; // do not descend — nested blocks already included
      }
      for (const child of el.children || []) visit(child);
    })(root);
    return out;
  }

  function parse(html) {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser is not available in this environment.');
    }
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return fromElement(doc.body);
  }

  VV.VV.textBlocks = { parse, fromElement, BLOCKS };
})();

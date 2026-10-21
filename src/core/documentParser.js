/* ============================================================
   Vasi Vasi — document parser
   Turns raw text into a navigable reading structure:

     { sentences: [{ text, paragraph }], paragraphStarts: [i, ...] }

   Sentence splitting prefers the built-in Intl.Segmenter
   (handles Tamil and English punctuation rules properly) and
   falls back to a conservative regular expression.
   Pure module: no DOM, no storage — fully unit-testable.
   ============================================================ */
(function () {
  'use strict';
  const VV = (typeof window !== 'undefined' ? window : globalThis);
  VV.VV = VV.VV || {};

  const hasSegmenter =
    typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

  function normalize(text) {
    return String(text)
      .replace(/\r\n?/g, '\n')             // unify line endings
      .replace(/ /g, ' ')              // non-breaking spaces
      .replace(/[ \t]+/g, ' ');            // collapse horizontal whitespace
  }

  function splitSentences(paragraphText) {
    paragraphText = paragraphText.trim();
    if (!paragraphText) return [];

    if (hasSegmenter) {
      try {
        const segmenter = new Intl.Segmenter('und', { granularity: 'sentence' });
        const parts = [];
        for (const seg of segmenter.segment(paragraphText)) {
          const t = seg.segment.trim();
          if (t) parts.push(t);
        }
        if (parts.length) return parts;
      } catch (e) { /* use fallback */ }
    }

    // Fallback: split after sentence-final punctuation (incl. Tamil/Indian danda).
    const matches =
      paragraphText.match(/[^.!?।।…]+(?:[.!?।।…]+["'”’)\]»]*)?/g) || [paragraphText];
    return matches.map((s) => s.trim()).filter(Boolean);
  }

  function parseDocument(rawText) {
    const text = normalize(rawText);
    const rawParagraphs = text.split(/\n\s*\n+/);
    const sentences = [];
    const paragraphStarts = [];

    rawParagraphs.forEach((rawP) => {
      // Single newlines inside a paragraph are soft wraps — join them.
      const paragraphText = rawP.replace(/\s*\n\s*/g, ' ').trim();
      if (!paragraphText) return;
      paragraphStarts.push(sentences.length);
      splitSentences(paragraphText).forEach((t) => {
        sentences.push({ text: t, paragraph: paragraphStarts.length - 1 });
      });
    });

    // Degenerate case: some whitespace-only doc became empty.
    if (!sentences.length && text.trim()) {
      paragraphStarts.push(0);
      sentences.push({ text: text.trim(), paragraph: 0 });
    }

    return { sentences, paragraphStarts };
  }

  (VV.VV = VV.VV || {}).documentParser = { parseDocument, splitSentences };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VV.VV.documentParser; // enables Node-based testing
  }
})();

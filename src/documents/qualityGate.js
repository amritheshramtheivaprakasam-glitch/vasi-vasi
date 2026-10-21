/* ============================================================
   Vasi Vasi — quality gate
   Every imported text passes through this gate before it may
   reach the library, the screen or the speech engine. Pure
   statistical checks — no AI — designed so that bad extraction
   fails loudly and accessibly instead of being read aloud.

   Verdicts:
     reject — text is unusable (raw PDF syntax, symbol soup).
              The import is refused with a spoken reason.
     warn   — text is readable but suspicious (possible legacy
              non-Unicode font). Imported with a notice.
     ok     — clean.
   ============================================================ */
(function () {
  'use strict';
  const VV = (typeof window !== 'undefined' ? window : globalThis);
  VV.VV = VV.VV || {};

  const THRESHOLDS = {
    checkWindow: 2000,        // chars scanned for syntax leaks
    minLenForStats: 200,      // shorter texts skip ratio checks
    replacementReject: 0.05,  // >5% U+FFFD → corrupted
    replacementWarn: 0.01,
    letterSpaceMin: 0.35,     // real prose is mostly letters+space
    gibberishSampleWords: 400,
    gibberishMinLen: 500
  };

  /* Common English words — if a long "English-looking" text contains
     NONE of these, it is very likely legacy-font mojibake (the classic
     old Tamil PDF trap), not a real Latin-alphabet text. */
  const COMMON_WORDS = /\b(the|and|of|to|in|is|was|for|with|that|this|it|on|as|are|be|at|by|an|or|not|have|from|we|you|his|her|they|all|one|said)\b/i;

  function assess(text) {
    const t = String(text || '');
    const window2k = t.slice(0, THRESHOLDS.checkWindow);

    /* 1. Raw PDF syntax must NEVER reach a reader. */
    if (/%PDF-\d|^\s*%PDF|\/Type\s*\/Catalog|\bendobj\b|\d+\s+\d+\s+obj\b/.test(window2k)) {
      return {
        verdict: 'reject',
        reasons: ['raw-pdf-syntax'],
        messages: [
          'That file shows raw PDF internal data instead of readable text, so it was not imported. ' +
          'Please re-save it as a proper PDF document and try again.'
        ]
      };
    }

    if (!t.trim()) {
      return {
        verdict: 'reject',
        reasons: ['empty'],
        messages: ['No readable text was found in that document.']
      };
    }

    const reasons = [];
    const messages = [];
    const len = t.length;

    if (len >= THRESHOLDS.minLenForStats) {
      const sample = t.slice(0, 20000);
      const replacementChars = (sample.match(/�/g) || []).length;
      const replacementRatio = replacementChars / sample.length;

      /* 2. Corrupted decoding. */
      if (replacementRatio > THRESHOLDS.replacementReject) {
        return {
          verdict: 'reject',
          reasons: ['corrupted-encoding'],
          messages: [
            'The text appears to be corrupted (wrong character encoding). ' +
            'Try saving the file as UTF-8 text and import it again.'
          ]
        };
      }
      if (replacementRatio > THRESHOLDS.replacementWarn) {
        reasons.push('some-replacement-chars');
        messages.push('Some characters could not be decoded and may look wrong.');
      }

      /* 3. Letter-to-symbol ratio — prose is mostly letters and spaces. */
      const letters = (sample.match(/[a-zA-Z஀-௿ⶀ-ꟿᄀ-ᅟ぀-ヿ一-鿿]/gu) || []).length;
      const spaces = (sample.match(/\s/g) || []).length;
      if ((letters + spaces) / sample.length < THRESHOLDS.letterSpaceMin) {
        return {
          verdict: 'reject',
          reasons: ['mostly-symbols'],
          messages: [
            'That document is mostly numbers or symbols, not readable text. It was not imported.'
          ]
        };
      }

      /* 4. Old non-Unicode font trap (classic in Tamil PDFs): very long
         Latin-looking text with no real words in it. */
      if (len >= THRESHOLDS.gibberishMinLen) {
        const words = t.slice(0, 8000).split(/\s+/).filter(Boolean)
          .slice(0, THRESHOLDS.gibberishSampleWords);
        if (words.length >= 50) {
          const latinWords = words.filter((w) => /^[a-zA-Z][a-zA-Z'’.-]*$/.test(w)).length;
          if (latinWords / words.length > 0.9 && !COMMON_WORDS.test(t.slice(0, 8000))) {
            reasons.push('possible-legacy-font');
            messages.push(
              'This text looks like it uses an old non-Unicode font, so the words may not read ' +
              'correctly (a known issue with many older Tamil PDFs). You can still listen to it, ' +
              'but if it sounds like gibberish, the original file needs a text layer.'
            );
          }
        }
      }
    }

    return {
      verdict: reasons.length ? 'warn' : 'ok',
      reasons,
      messages
    };
  }

  VV.VV.qualityGate = { assess, THRESHOLDS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VV.VV.qualityGate; // enables Node-based testing
  }
})();

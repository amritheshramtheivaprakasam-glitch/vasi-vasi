/* ============================================================
   Vasi Vasi — configuration
   Storage keys, limits, reading constants and default settings.
   No code here talks to any network: this app is fully offline.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  VV.config = {
    STORAGE: {
      settings: 'vasivasi.settings.v1',
      library: 'vasivasi.library.v1',
      progress: 'vasivasi.progress.v1',
      seeded: 'vasivasi.seeded.v1'
    },
    LIMITS: {
      maxDocumentChars: 2000000, // ~2 MB of text — protects storage quota
      importMaxChars: 2000000,
      titleMax: 120
    },
    READING: {
      rateMin: 0.5,
      rateMax: 2,
      rateStep: 0.1,
      pitchMin: 0.5,
      pitchMax: 2,
      wordsPerMinute: 160 // average spoken English; used for time estimates
    },
    THEMES: ['auto', 'light', 'dark', 'contrast']
  };

  VV.defaults = {
    settings: {
      theme: 'auto',
      fontScale: 1.1,
      fontFamily: 'sans',
      voiceURI: null, // null = auto-pick a voice that matches the document language
      rate: 1,
      pitch: 1,
      volume: 1,
      resumeReading: true
    }
  };
})();

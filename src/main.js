/* ============================================================
   Vasi Vasi — bootstrap
   Wires every layer together: stores → engines → views.
   Exposes VV.app, the single command surface used by the UI
   (view router, open/add document, playback commands).

   This app is deliberately build-free: plain scripts loaded in
   dependency order, so it runs from file:// or any static
   host, with zero installation and zero network calls.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const $ = (id) => document.getElementById(id);
  const { clamp, countWords } = VV.util;

  const views = { library: null, reader: null };
  let current = 'library';

  /* ---------- reader engine wiring ---------- */

  const speech = new VV.SpeechEngine();
  VV.speech = speech;

  const reader = new VV.ReaderEngine(speech, {
    getSettings: () => VV.settingsStore.get(),
    saveProgress: (docId, index) => VV.libraryStore.saveProgress(docId, index)
  });
  VV.reader = reader;

  /* ---------- theme + appearance ---------- */

  function applySettings(s) {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.setProperty('--reader-font-scale', s.fontScale);
    document.documentElement.style.setProperty(
      '--reader-ff',
      s.fontFamily === 'serif' ? 'var(--ff-serif)' : 'var(--ff-sans)'
    );
  }

  /* ---------- view router ---------- */

  function show(name) {
    current = name;
    views.library.hidden = name !== 'library';
    views.reader.hidden = name !== 'reader';
    $('btn-home').hidden = name === 'library';
    const heading = name === 'library' ? $('library-heading') : $('reader-heading');
    heading.focus({ preventScroll: true });
  }

  /* ---------- document commands ---------- */

  function openDocument(id) {
    const doc = VV.libraryStore.get(id);
    if (!doc) return;
    const s = VV.settingsStore.get();
    const parsed = VV.documentParser.parseDocument(doc.text, doc.lang);
    if (!parsed.sentences.length) {
      VV.announcer.assertive('This document appears to be empty.');
      return;
    }
    let startIndex = 0;
    if (s.resumeReading) {
      const p = VV.libraryStore.getProgress(id);
      if (p) startIndex = clamp(p.index, 0, parsed.sentences.length - 1);
    }
    reader.load(doc, parsed, startIndex);
    VV.readerView.renderDocument(doc, parsed, countWords(doc.text));
    VV.readerView.syncSettings(s);
    show('reader');
    document.title = `${doc.title} — Vasi Vasi`;
    if (startIndex > 0) {
      VV.announcer.polite(
        `Opened "${doc.title}". Resuming at sentence ${startIndex + 1} of ${parsed.sentences.length}. Press Space to play.`);
    } else {
      VV.announcer.polite(
        `Opened "${doc.title}". ${parsed.sentences.length} sentences. Press Space to play.`);
    }
  }

  function addDocument(title, text, source, openNow) {
    const doc = VV.libraryStore.add(title, text, source);
    VV.announcer.polite(`Saved "${title}" to your library.`);
    if (openNow) openDocument(doc.id);
    return doc;
  }

  /* ---------- playback commands ---------- */

  function announceState() {
    const map = { playing: 'Playing.', paused: 'Paused.', idle: 'Stopped.', ended: 'Finished.' };
    VV.announcer.polite(map[reader.status] || reader.status);
  }

  const app = {
    currentView: () => current,

    showLibrary() {
      if (reader.status === 'playing') reader.pause();
      VV.libraryStore.flushProgress();
      show('library');
      document.title = 'Vasi Vasi — Offline Reading Companion';
      VV.libraryView.render();
      VV.announcer.polite('Back in your library.');
    },

    openDocument,
    addDocument,

    togglePlayback() {
      if (!speech.supported) return;
      reader.toggle();
      announceState();
    },
    nextSentence() { reader.next(); },
    prevSentence() { reader.prev(); },
    nextParagraph() { reader.nextParagraph(); },
    prevParagraph() { reader.prevParagraph(); },
    firstSentence() { reader.first(); },
    lastSentence() { reader.last(); },
    playFrom(index) { reader.play(index); VV.announcer.polite('Playing.'); },
    stopReading() {
      reader.stopAndRewind();
      VV.announcer.polite('Stopped. Back to the beginning.');
    },

    adjustRate(direction) {
      const s = VV.settingsStore.get();
      const r = VV.config.READING;
      const next = clamp(
        Math.round((s.rate + direction * r.rateStep) * 10) / 10,
        r.rateMin, r.rateMax);
      VV.settingsStore.update({ rate: next });
      VV.announcer.polite(`Speed ${next.toFixed(1)} times.`);
    }
  };
  VV.app = app;

  /* ---------- boot ---------- */

  function boot() {
    views.library = $('view-library');
    views.reader = $('view-reader');

    VV.announcer.init();
    VV.settingsStore.load();
    VV.libraryStore.init();

    // Speech support first — UI adapts if unavailable.
    speech.init();
    if (!speech.supported) {
      $('no-speech-banner').hidden = false;
    }
    speech.on('voices', () => {
      VV.readerView.populateVoiceSelect($('voice-select'), VV.settingsStore.get().voiceURI);
      const settingsVoice = $('set-voice');
      if (settingsVoice) {
        VV.readerView.populateVoiceSelect(settingsVoice, VV.settingsStore.get().voiceURI);
      }
    });

    // Initialize UI layers (order: reader binds to engine events early).
    VV.readerView.init(reader);
    VV.libraryView.init();
    VV.dialogs.init();
    VV.shortcuts.init();

    if (!speech.supported) VV.readerView.setUnsupported();

    // Live settings → appearance + player.
    applySettings(VV.settingsStore.get());
    VV.settingsStore.onChange((s) => {
      applySettings(s);
      VV.readerView.syncSettings(s);
    });

    $('btn-home').addEventListener('click', app.showLibrary);
    $('btn-back').addEventListener('click', app.showLibrary);

    // Pause when the tab is hidden; flush progress when leaving.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && reader.status === 'playing') {
        reader.pause();
        VV.announcer.polite('Paused — tab hidden.');
      }
      if (document.hidden) VV.libraryStore.flushProgress();
    });
    window.addEventListener('beforeunload', () => VV.libraryStore.flushProgress());

    // Offline install support (PWA) — only meaningful over http(s).
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline copy simply not cached */ });
    }

    show('library');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

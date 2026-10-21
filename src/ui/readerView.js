/* ============================================================
   Vasi Vasi — reader view
   Renders the active document, drives the player UI, paints
   the active sentence and the word-level "karaoke" highlight,
   and keeps progress, speed, voice and timer controls in sync.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const $ = (id) => document.getElementById(id);
  const { clamp, estimateMinutes, countWords } = VV.util;

  const els = {};
  let sentenceEls = [];        // <span class="sentence"> per sentence
  let wrappedFlags = [];       // per sentence: words already wrapped?
  let engine = null;           // VV.ReaderEngine
  let settingsGetter = () => VV.settingsStore.get();
  let docWordCount = 0;
  let sleepTimer = null;

  const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Rendering ---------- */

  function renderDocument(doc, parsed, wordCount) {
    docWordCount = wordCount;
    els.heading.textContent = doc.title;
    els.article.setAttribute('lang', doc.lang);

    // Document structure: paragraphs containing sentence spans.
    els.article.textContent = '';
    sentenceEls = [];
    wrappedFlags = parsed.sentences.map(() => false);

    let currentP = null;
    let currentParagraphIndex = -1;
    parsed.sentences.forEach((s, i) => {
      if (s.paragraph !== currentParagraphIndex) {
        currentP = document.createElement('p');
        els.article.appendChild(currentP);
        currentParagraphIndex = s.paragraph;
      }
      const span = document.createElement('span');
      span.className = 'sentence';
      span.dataset.i = String(i);
      span.textContent = s.text;
      currentP.appendChild(span);
      currentP.appendChild(document.createTextNode(' '));
      sentenceEls.push(span);
    });

    els.progress.max = String(Math.max(0, parsed.sentences.length - 1));
    els.progress.value = '0';
    updateMeta();
    updatePosition(0, parsed.sentences.length);
  }

  function updateMeta() {
    const s = settingsGetter();
    const labels = { ta: 'தமிழ்', en: 'English' };
    const total = engine ? engine.total : 0;
    els.meta.textContent =
      `${labels[engine.doc.lang] || engine.doc.lang} · ${total} sentences · ` +
      `about ${estimateMinutes(docWordCount, s.rate)} min at current speed`;
  }

  function updatePosition(index, total) {
    if (!total) {
      els.position.textContent = 'No text to read.';
      return;
    }
    const percent = Math.round(((index + 1) / total) * 100);
    const s = settingsGetter();
    const wordsLeft = Math.max(0, docWordCount * (1 - index / total));
    const minsLeft = estimateMinutes(Math.round(wordsLeft), s.rate);
    els.position.textContent =
      `Sentence ${index + 1} of ${total} · ${percent}% · ~${minsLeft} min left`;
    if (document.activeElement !== els.progress) {
      els.progress.value = String(index);
    }
  }

  /* ---------- Highlighting ---------- */

  function wrapWords(span, text) {
    const parts = text.split(/(\s+)/);
    span.textContent = '';
    let offset = 0;
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        span.appendChild(document.createTextNode(part));
      } else {
        const w = document.createElement('span');
        w.className = 'w';
        w.dataset.start = String(offset);
        w.dataset.end = String(offset + part.length);
        w.textContent = part;
        span.appendChild(w);
      }
      offset += part.length;
    });
  }

  function markWord(span, charIndex) {
    const words = span.querySelectorAll('.w');
    let hit = null;
    for (const w of words) {
      const start = parseInt(w.dataset.start, 10);
      const end = parseInt(w.dataset.end, 10);
      if (charIndex >= start && charIndex < end) { hit = w; break; }
      if (charIndex < start && !hit) hit = w; // nearest upcoming word
    }
    if (hit && !hit.classList.contains('active')) {
      span.querySelectorAll('.w.active').forEach((w2) => w2.classList.remove('active'));
      hit.classList.add('active');
    }
  }

  function activateSentence(index) {
    const span = sentenceEls[index];
    if (!span) return;
    sentenceEls.forEach((el, i) => {
      el.classList.toggle('active', i === index);
      el.classList.toggle('played', i < index);
      if (i !== index) {
        const actives = el.querySelectorAll('.w.active');
        actives.forEach((w) => w.classList.remove('active'));
      }
    });
    // Eagerly wrap so word boundary highlighting works immediately.
    if (!wrappedFlags[index]) {
      wrapWords(span, engine.sentences[index].text);
      wrappedFlags[index] = true;
    }
    span.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
    updatePosition(index, engine.total);
  }

  /* ---------- Voices ---------- */

  function populateVoiceSelect(selectEl, selectedURI, includeAuto) {
    if (!selectEl) return;
    if (includeAuto == null) includeAuto = true;
    const current = selectedURI != null ? selectedURI : selectEl.value;
    selectEl.textContent = '';

    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = includeAuto ? 'Automatic (match document language)' : 'Default voice';
    selectEl.appendChild(auto);

    const groups = [
      { label: 'தமிழ் (Tamil)', test: (l) => l.startsWith('ta') },
      { label: 'English', test: (l) => l.startsWith('en') },
      { label: 'Other voices', test: () => true }
    ];
    const voices = VV.speech ? VV.speech.voices() : [];
    groups.forEach((g) => {
      const vs = voices.filter((v) => g.test((v.lang || '').toLowerCase()));
      if (!vs.length) return;
      const group = document.createElement('optgroup');
      group.label = g.label;
      vs.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})${v.localService ? '' : ' · online'}`;
        group.appendChild(opt);
      });
      selectEl.appendChild(group);
    });

    // Restore selection if still present
    const has = Array.from(selectEl.options).some((o) => o.value === current);
    selectEl.value = has ? current : '';

    if (!voices.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'System default voice';
      selectEl.appendChild(opt);
    }
  }

  /* ---------- Player state ---------- */

  function reflectState(status, index, total) {
    const playing = status === 'playing';
    const paused = status === 'paused';
    els.play.setAttribute('aria-pressed', playing ? 'true' : 'false');
    els.playIcon.textContent = playing ? '⏸' : '▶';
    els.playLabel.textContent =
      playing ? 'Pause' : paused ? 'Resume' : status === 'ended' ? 'Play again' : 'Play';
    els.play.setAttribute('aria-label',
      (playing ? 'Pause' : paused ? 'Resume' : 'Play') + ' (Space bar)');

    const atStart = index <= 0;
    const atEnd = index >= total - 1;
    els.prev.disabled = atStart;
    els.prevPara.disabled = atStart;
    els.next.disabled = atEnd;
    els.nextPara.disabled = atEnd;
    els.stop.disabled = status === 'idle' && index === 0;
  }

  function syncSettings(s) {
    els.rateDisplay.textContent = Number(s.rate).toFixed(1) + '×';
    populateVoiceSelect(els.voice, s.voiceURI);
    updateMeta();
    if (engine && engine.total) updatePosition(engine.index, engine.total);
  }

  /* ---------- Sleep timer ---------- */

  function armSleepTimer(minutes) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
    if (!minutes) return;
    sleepTimer = setTimeout(() => {
      if (engine.status === 'playing') engine.pause();
      els.sleep.value = '0';
      VV.announcer.assertive('Sleep timer finished. Reading paused.');
    }, minutes * 60000);
    VV.announcer.polite(`Sleep timer set for ${minutes} minutes.`);
  }

  /* ---------- Public ---------- */

  VV.readerView = {
    init(readerEngine) {
      engine = readerEngine;
      const playBtn = $('btn-play');
      Object.assign(els, {
        heading: $('reader-heading'),
        meta: $('reader-meta'),
        play: playBtn,
        playIcon: playBtn.querySelector('.play-icon'),
        playLabel: playBtn.querySelector('.play-label'),
        prev: $('btn-prev-sentence'),
        next: $('btn-next-sentence'),
        prevPara: $('btn-prev-para'),
        nextPara: $('btn-next-para'),
        stop: $('btn-stop'),
        rateDown: $('btn-rate-down'),
        rateUp: $('btn-rate-up'),
        rateDisplay: $('rate-display'),
        voice: $('voice-select'),
        sleep: $('sleep-select'),
        progress: $('progress-range'),
        position: $('position-text'),
        article: $('reader-content')
      });

      els.play.addEventListener('click', () => VV.app.togglePlayback());
      els.prev.addEventListener('click', () => VV.app.prevSentence());
      els.next.addEventListener('click', () => VV.app.nextSentence());
      els.prevPara.addEventListener('click', () => VV.app.prevParagraph());
      els.nextPara.addEventListener('click', () => VV.app.nextParagraph());
      els.stop.addEventListener('click', () => VV.app.stopReading());

      els.rateDown.addEventListener('click', () => VV.app.adjustRate(-1));
      els.rateUp.addEventListener('click', () => VV.app.adjustRate(+1));
      els.voice.addEventListener('change', () =>
        VV.settingsStore.update({ voiceURI: els.voice.value || null }));
      els.sleep.addEventListener('change', () =>
        armSleepTimer(parseInt(els.sleep.value, 10) || 0));
      els.progress.addEventListener('input', () =>
        engine.jumpTo(parseInt(els.progress.value, 10) || 0));

      // Click / tap any sentence to read from there.
      els.article.addEventListener('click', (e) => {
        const span = e.target.closest('.sentence');
        if (!span) return;
        VV.app.playFrom(parseInt(span.dataset.i, 10));
      });

      // Engine → UI wiring
      engine.on('sentence', (p) => {
        activateSentence(p.index);
        VV.announcer.polite(`Sentence ${p.index + 1} of ${p.total}`);
      });
      engine.on('state', (p) => reflectState(p.status, p.index, p.total));
      engine.on('boundary', (p) => {
        const span = sentenceEls[p.index];
        if (!span) return;
        if (!wrappedFlags[p.index]) {
          wrapWords(span, engine.sentences[p.index].text);
          wrappedFlags[p.index] = true;
        }
        markWord(span, p.charIndex);
      });
      engine.on('finished', () => {
        VV.announcer.polite('Finished reading. Well done!');
        armSleepTimer(0);
        els.sleep.value = '0';
      });
      engine.on('error', (p) => VV.announcer.assertive(p.message));

      els.article.dataset.clickable = 'true';
    },

    renderDocument,
    syncSettings,
    populateVoiceSelect,
    setUnsupported() {
      ['btn-play', 'btn-prev-sentence', 'btn-next-sentence',
       'btn-prev-para', 'btn-next-para', 'btn-stop'].forEach((id) => {
        $(id).disabled = true;
      });
    },
    reflectState: (status, index, total) => reflectState(status, index, total)
  };
})();

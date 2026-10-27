/* ============================================================
   Vasi Vasi — speech engine
   A careful wrapper around the browser's built-in
   speechSynthesis (device voices — completely offline, no AI
   or cloud services involved).

   Responsibilities:
     • voice discovery (async), grouped + sorted (Tamil first)
     • speak one sentence at a time with start/end/boundary events
     • cancellation that is race-safe (stale 'end' events are
       ignored via sequence tokens)
     • keep-alive workaround for Chrome's long-speech pause bug
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const { Emitter } = VV.util;

  class SpeechEngine extends Emitter {
    constructor() {
      super();
      this.supported =
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        'SpeechSynthesisUtterance' in window;
      this._voices = [];
      this._seq = 0;            // monotonically increasing utterance id
      this._cancelled = false;
      this._keepAlive = null;
      this._startWatchdog = null;
      // If no audio starts within this window, or an utterance ends
      // suspiciously fast without ever starting, the engine produced
      // SILENCE — the worst possible failure for a blind reader. We
      // surface an honest, actionable error (VOICE-001) instead of
      // letting the highlight march on through an unheard book.
      this._silenceMs = SpeechEngine.SILENCE_MS;
    }

    init() {
      if (!this.supported) return;
      this._loadVoices();
      // Voices often arrive asynchronously — probe a few times.
      if (typeof speechSynthesis.addEventListener === 'function') {
        speechSynthesis.addEventListener('voiceschanged', () => this._loadVoices());
      } else {
        speechSynthesis.onvoiceschanged = () => this._loadVoices();
      }
      [100, 400, 1200].forEach((ms) => setTimeout(() => this._loadVoices(), ms));
    }

    _loadVoices() {
      const list = speechSynthesis.getVoices();
      if (!list || !list.length) return;
      const langRank = (v) => {
        const l = (v.lang || '').toLowerCase();
        if (l.startsWith('ta')) return 0; // Tamil first — our namesake
        if (l.startsWith('en')) return 1;
        return 2;
      };
      this._voices = list.slice().sort((a, b) => {
        const r = langRank(a) - langRank(b);
        if (r !== 0) return r;
        return (a.lang || '').localeCompare(b.lang || '') || a.name.localeCompare(b.name);
      });
      this.emit('voices', this._voices);
    }

    voices() {
      return this._voices.slice();
    }

    /* Choose a voice: explicit setting > language match > English > default. */
    pickVoice(preferredURI, docLang) {
      const vs = this._voices;
      if (!vs.length) return null;
      if (preferredURI) {
        const exact = vs.find((v) => v.voiceURI === preferredURI);
        if (exact) return exact;
      }
      if (docLang) {
        const match = vs.find((v) => (v.lang || '').toLowerCase().startsWith(docLang));
        if (match) return match;
      }
      const en = vs.find((v) => (v.lang || '').toLowerCase().startsWith('en'));
      if (en) return en;
      return vs.find((v) => v.default) || vs[0];
    }

    /**
     * Speak `text` once.
     * opts: { voiceURI, lang, rate, pitch, volume }
     * handlers: { onStart, onEnd(stopped), onBoundary(charIndex, charLength), onError }
     */
    speak(text, opts, handlers) {
      handlers = handlers || {};
      if (!this.supported) {
        handlers.onError && handlers.onError(new Error('unsupported'));
        return;
      }
      const seq = ++this._seq;
      this._cancelled = false;
      this._clearStartWatchdog();

      const enqueue = () => {
        if (seq !== this._seq) return; // superseded while deferred
        this._speakNow(text, opts, handlers, seq);
      };

      // Chrome/Android can silently drop an utterance that is queued in
      // the same tick as cancel() — the classic "text moves but no voice"
      // bug (VOICE-001). Only defer when there is actually something to
      // cancel, so the common first-play path stays synchronous.
      if (speechSynthesis.speaking || speechSynthesis.pending) {
        speechSynthesis.cancel();
        setTimeout(enqueue, SpeechEngine.CANCEL_GAP_MS);
      } else {
        speechSynthesis.cancel(); // clear any leftovers
        enqueue();
      }
    }

    _speakNow(text, opts, handlers, seq) {
      const startedAt = Date.now();
      let started = false;
      const u = new SpeechSynthesisUtterance(text);
      const voice = this.pickVoice(opts.voiceURI, opts.lang);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = opts.lang || 'en';
      }
      u.rate = opts.rate != null ? opts.rate : 1;
      u.pitch = opts.pitch != null ? opts.pitch : 1;
      u.volume = opts.volume != null ? opts.volume : 1;

      // Watchdog: if the engine never starts producing audio, or ends
      // almost immediately without ever starting, speech is SILENT.
      // We cancel it and report honestly so the reader can react.
      this._startWatchdog = setTimeout(() => {
        if (seq !== this._seq || started) return;
        this._reportSilence(handlers, seq);
      }, this._silenceMs);

      u.onstart = () => {
        if (seq !== this._seq) return;
        started = true;
        this._clearStartWatchdog();
        this._startKeepAlive();
        handlers.onStart && handlers.onStart();
      };
      u.onend = () => {
        if (seq !== this._seq) {
          handlers.onEnd && handlers.onEnd(true); // stale — treat as stopped
          return;
        }
        this._clearStartWatchdog();
        this._stopKeepAlive();
        // Fast-end guard: ended almost instantly and never started —
        // no audio was produced. Report it as silence, not as success.
        if (!started && Date.now() - startedAt < SpeechEngine.FAST_END_MS) {
          this._reportSilence(handlers, seq);
          return;
        }
        handlers.onEnd && handlers.onEnd(this._cancelled);
      };
      u.onerror = (e) => {
        const kind = e && e.error;
        if (seq === this._seq) {
          this._clearStartWatchdog();
          this._stopKeepAlive();
        }
        if (kind === 'interrupted' || kind === 'canceled') {
          if (seq === this._seq) handlers.onEnd && handlers.onEnd(true);
          return;
        }
        console.warn('[VV] speech error', kind);
        if (seq === this._seq) handlers.onError && handlers.onError(e);
      };
      u.onboundary = (e) => {
        if (seq !== this._seq) return;
        if (e.charIndex == null) return;
        handlers.onBoundary && handlers.onBoundary(e.charIndex, e.charLength || 0);
      };

      speechSynthesis.speak(u);
    }

    pause() {
      if (!this.supported) return;
      if (speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.pause();
      }
    }

    resume() {
      if (!this.supported) return;
      if (speechSynthesis.paused) speechSynthesis.resume();
    }

    stop() {
      if (!this.supported) return;
      this._cancelled = true;
      this._seq++; // invalidate pending callbacks
      speechSynthesis.cancel();
      this._stopKeepAlive();
      this._clearStartWatchdog();
    }

    _clearStartWatchdog() {
      clearTimeout(this._startWatchdog);
      this._startWatchdog = null;
    }

    /* The engine produced no audio for this sentence. Cancel the dead
       utterance and surface an honest, actionable error instead of
       letting the highlight advance through silence (VOICE-001). */
    _reportSilence(handlers, seq) {
      this._clearStartWatchdog();
      this._stopKeepAlive();
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      const err = new Error('no-audio');
      err.silent = true;
      err.userMessage =
        'No sound came from the device voice for this sentence. ' +
        'Open Settings and pick a voice whose language matches this document, ' +
        'and make sure the device volume is up. (If no matching voice exists, ' +
        'install a voice for that language in your device text-to-speech settings.)';
      if (seq === this._seq) handlers.onError && handlers.onError(err);
    }

    /* Chrome on desktop silently pauses long speech — nudge it. */
    _startKeepAlive() {
      if (this._keepAlive) return;
      this._keepAlive = setInterval(() => {
        try {
          if (speechSynthesis.speaking && !speechSynthesis.paused) {
            speechSynthesis.resume();
          }
        } catch (e) { /* ignore */ }
      }, 10000);
    }

    _stopKeepAlive() {
      clearInterval(this._keepAlive);
      this._keepAlive = null;
    }
  }

  SpeechEngine.SILENCE_MS = 1500;   // no onstart within this → declared silent
  SpeechEngine.FAST_END_MS = 120;   // onend this fast without onstart → silent
  SpeechEngine.CANCEL_GAP_MS = 60;  // gap between cancel() and speak()

  VV.SpeechEngine = SpeechEngine;
})();

/* ============================================================
   Vasi Vasi — reader engine
   The reading state machine. Given a parsed document it plays
   sentence by sentence, tracks the current position, saves
   progress, and emits UI events.

   Statuses: idle → playing → paused → (ended) → idle

   Events emitted:
     'state'    { status, index, total }
     'sentence' { index, text, total }         — new active sentence
     'boundary' { index, charIndex, charLength } — word-level sync
     'finished' {}                              — document completed
     'error'    { message }
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const { Emitter, clamp } = VV.util;

  class ReaderEngine extends Emitter {
    /**
     * @param speech  VV.SpeechEngine instance
     * @param hooks   { getSettings(), saveProgress(docId, index) }
     */
    constructor(speech, hooks) {
      super();
      this.speech = speech;
      this.hooks = hooks;
      this.doc = null;
      this.sentences = [];
      this.paragraphStarts = [];
      this.index = 0;
      this.status = 'idle';
    }

    get total() { return this.sentences.length; }

    load(doc, parsed, startIndex) {
      this.stop(false);
      this.doc = doc;
      this.sentences = parsed.sentences;
      this.paragraphStarts = parsed.paragraphStarts;
      this.index = clamp(startIndex || 0, 0, Math.max(0, this.total - 1));
      this.status = 'idle';
      this._emitState();
      if (this.total) this._emitSentence();
    }

    play(fromIndex) {
      if (!this.total) return;
      if (fromIndex != null) this.index = clamp(fromIndex, 0, this.total - 1);
      if (this.status === 'ended') this.index = 0; // replay from the top
      this.status = 'playing';
      this._emitState();
      this._speakCurrent();
    }

    toggle() {
      if (this.status === 'playing') this.pause();
      else if (this.status === 'paused') this.resume();
      else this.play();
    }

    pause() {
      if (this.status !== 'playing') return;
      this.status = 'paused';
      this.speech.pause();
      this._emitState();
    }

    resume() {
      if (this.status !== 'paused') return;
      this.status = 'playing';
      this.speech.resume();
      this._emitState();
    }

    stop(emit = true) {
      this.speech.stop();
      this.status = 'idle';
      if (emit) this._emitState();
    }

    /* Stop and rewind to the very beginning. */
    stopAndRewind() {
      this.stop(false);
      this.index = 0;
      this._saveProgress();
      this._emitState();
      this._emitSentence();
    }

    next() { this.jumpTo(this.index + 1); }
    prev() { this.jumpTo(this.index - 1); }

    nextParagraph() {
      const next = this.paragraphStarts.find((s) => s > this.index);
      const lastStart = this.paragraphStarts[this.paragraphStarts.length - 1] || 0;
      this.jumpTo(next != null ? next : lastStart); // never land mid-paragraph
    }

    prevParagraph() {
      // First press inside a paragraph: go to its start. At start: previous one.
      const starts = this.paragraphStarts;
      let target = 0;
      for (let i = starts.length - 1; i >= 0; i--) {
        if (starts[i] < this.index) { target = starts[i]; break; }
      }
      // If we are mid-paragraph, prefer the current paragraph's start.
      const currentStart = starts.filter((s) => s <= this.index).pop();
      if (currentStart != null && this.index > currentStart) target = currentStart;
      this.jumpTo(target);
    }

    jumpTo(index) {
      const target = clamp(index, 0, Math.max(0, this.total - 1));
      const wasPlaying = this.status === 'playing' || this.status === 'paused';
      this.speech.stop();
      this.index = target;
      this._saveProgress();
      if (this.status === 'ended') this.status = 'idle';
      this._emitSentence();
      if (wasPlaying) {
        this.status = 'playing';
        this._emitState();
        this._speakCurrent();
      } else {
        this._emitState();
      }
    }

    first() { this.jumpTo(0); }
    last() { this.jumpTo(this.total - 1); }

    /* ---------- internals ---------- */

    _voiceOpts() {
      const s = this.hooks.getSettings();
      return {
        voiceURI: s.voiceURI,
        lang: this.doc ? this.doc.lang : 'en',
        rate: s.rate,
        pitch: s.pitch,
        volume: s.volume
      };
    }

    _speakCurrent() {
      const i = this.index;
      if (i >= this.total) { this._finish(); return; }
      const sentence = this.sentences[i];
      this._emitSentence();
      this.speech.speak(sentence.text, this._voiceOpts(), {
        onEnd: (stopped) => {
          if (stopped || this.status !== 'playing') return;
          if (this.index < this.total - 1) {
            this.index += 1;
            this._saveProgress();
            this._speakCurrent();
          } else {
            this._finish();
          }
        },
        onBoundary: (charIndex, charLength) => {
          this.emit('boundary', { index: i, charIndex, charLength });
        },
        onError: () => {
          this.status = 'idle';
          this._emitState();
          this.emit('error', {
            message: 'The voice could not read this sentence. Try a different voice in Settings.'
          });
        }
      });
    }

    _finish() {
      this.status = 'ended';
      this._emitState();
      this.emit('finished', {});
    }

    _saveProgress() {
      if (this.doc) this.hooks.saveProgress(this.doc.id, this.index);
    }

    _emitState() {
      this.emit('state', { status: this.status, index: this.index, total: this.total });
    }

    _emitSentence() {
      if (!this.total) return;
      const s = this.sentences[this.index];
      this.emit('sentence', { index: this.index, text: s.text, total: this.total });
      this._saveProgress();
    }
  }

  VV.ReaderEngine = ReaderEngine;
})();

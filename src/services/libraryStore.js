/* ============================================================
   Vasi Vasi — library store
   CRUD for the user's documents plus per-document reading
   progress. Everything is persisted locally; nothing is
   transmitted. Document shape:

   {
     id, title, text, lang ('ta'|'en'),
     source ('sample'|'paste'|'file'),
     addedAt, updatedAt,
     stats: { characters, words, sentences }
   }
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const { Emitter, uid, clamp, detectLang, countWords } = VV.util;

  const emitter = new Emitter();
  let documents = [];
  let progress = {};
  let loaded = false;

  function save() {
    VV.storage.set(VV.config.STORAGE.library, documents);
    VV.storage.set(VV.config.STORAGE.progress, progress);
  }

  const saveSoon = VV.util.debounce(save, 400);

  function computeStats(text) {
    const parsed = VV.documentParser.parseDocument(text);
    return {
      characters: text.length,
      words: countWords(text),
      sentences: parsed.sentences.length
    };
  }

  VV.libraryStore = {
    onChange: (fn) => emitter.on('change', fn),

    init() {
      if (loaded) return;
      documents = VV.storage.get(VV.config.STORAGE.library, []);
      progress = VV.storage.get(VV.config.STORAGE.progress, {});
      loaded = true;
      this.ensureSeeded();
    },

    /* First run: give the user something to listen to right away. */
    ensureSeeded() {
      const already = VV.storage.get(VV.config.STORAGE.seeded, false);
      if (already || documents.length > 0) return;
      (VV.starterDocuments || []).forEach((d) => {
        documents.push(this._build(d.title, d.text, 'sample'));
      });
      save();
      VV.storage.set(VV.config.STORAGE.seeded, true);
      emitter.emit('change');
    },

    _build(title, text, source) {
      const now = Date.now();
      title = VV.util.truncate(title || 'Untitled', VV.config.LIMITS.titleMax);
      if (text.length > VV.config.LIMITS.maxDocumentChars) {
        text = text.slice(0, VV.config.LIMITS.maxDocumentChars);
      }
      return {
        id: uid(),
        title,
        text,
        lang: detectLang(text),
        source,
        addedAt: now,
        updatedAt: now,
        stats: computeStats(text)
      };
    },

    all() {
      this.init();
      return documents.slice();
    },

    get(id) {
      this.init();
      return documents.find((d) => d.id === id) || null;
    },

    add(title, text, source) {
      this.init();
      const doc = this._build(title, text, source || 'paste');
      documents.unshift(doc); // newest first
      save();
      emitter.emit('change');
      return doc;
    },

    remove(id) {
      this.init();
      documents = documents.filter((d) => d.id !== id);
      delete progress[id];
      save();
      emitter.emit('change');
    },

    saveProgress(docId, sentenceIndex) {
      progress[docId] = { index: sentenceIndex, updatedAt: Date.now() };
      saveSoon();
    },

    flushProgress() {
      saveSoon.flush();
    },

    getProgress(docId) {
      this.init();
      const p = progress[docId];
      return p ? p : null;
    },

    progressPercent(doc) {
      const p = progress[doc.id];
      if (!p || !doc.stats.sentences) return 0;
      return clamp(Math.round((p.index / doc.stats.sentences) * 100), 0, 100);
    }
  };
})();

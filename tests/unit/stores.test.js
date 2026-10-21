/* Unit tests: storage, settingsStore, libraryStore
   using the dependency-free browser-ish harness. */
'use strict';
const { assert, assertEqual, summary } = require('../helpers/harness');
const { createEnv, loadScripts } = require('../helpers/env');

const env = createEnv();
loadScripts(
  'src/config.js',
  'src/util.js',
  'src/content/starterLibrary.js',
  'src/services/storage.js',
  'src/services/settingsStore.js',
  'src/services/libraryStore.js',
  'src/core/documentParser.js'
);

const VV = window.VV;

/* storage: JSON round-trip + fallback for missing keys */
VV.storage.set('t.key', { a: 1 });
assertEqual(VV.storage.get('t.key').a, 1, 'storage: round-trip');
assertEqual(VV.storage.get('t.missing', 'fb'), 'fb', 'storage: fallback on missing key');

/* settingsStore: defaults, update, reset, change events */
const s0 = VV.settingsStore.get();
assertEqual(s0.theme, 'auto', 'settings: default theme');
assertEqual(s0.resumeReading, true, 'settings: default resume flag');
let observed = null;
VV.settingsStore.onChange((s) => { observed = s; });
VV.settingsStore.update({ rate: 1.5 });
assert(observed && observed.rate === 1.5, 'settings: change event broadcast');
const persisted = JSON.parse(env.storage.get(VV.config.STORAGE.settings));
assertEqual(persisted.rate, 1.5, 'settings: persisted to storage');
VV.settingsStore.reset();
assertEqual(VV.settingsStore.get().rate, 1, 'settings: reset to defaults');

/* libraryStore: seeding, CRUD, stats, progress, persistence */
VV.libraryStore.init();
const docs = VV.libraryStore.all();
assertEqual(docs.length, 3, 'library: starter docs seeded on first run');
assert(docs.some((d) => d.lang === 'ta'), 'library: Tamil starter detected');
assert(docs.every((d) => d.stats.sentences > 0 && d.stats.words > 0), 'library: stats computed');

const added = VV.libraryStore.add('Note', 'One. Two. Three.', 'paste');
assertEqual(VV.libraryStore.all().length, 4, 'library: add');
assertEqual(added.stats.sentences, 3, 'library: sentence stats on add');
assertEqual(added.lang, 'en', 'library: language detection on add');

const tamil = VV.libraryStore.add('குறிப்பு', 'ஒன்று. இரண்டு.', 'paste');
assertEqual(tamil.lang, 'ta', 'library: Tamil detection on add');

VV.libraryStore.saveProgress(added.id, 2);
VV.libraryStore.flushProgress();
const progress = VV.libraryStore.getProgress(added.id);
assertEqual(progress.index, 2, 'library: progress saved');
assert(VV.libraryStore.progressPercent(added) > 0, 'library: progress percent computed');
assert(
  env.storage.get(VV.config.STORAGE.progress).includes(added.id),
  'library: progress persisted to storage'
);

const before = VV.libraryStore.all().length;
VV.libraryStore.remove(added.id);
assertEqual(VV.libraryStore.all().length, before - 1, 'library: remove');
assertEqual(VV.libraryStore.getProgress(added.id), null, 'library: progress removed with doc');

/* oversized input is truncated to the configured limit */
const big = 'x'.repeat(100) + '. '.repeat(10);
const tinyLimit = VV.config.LIMITS.maxDocumentChars;
assert(tinyLimit > 0, 'library: size limit configured');
const huge = VV.libraryStore.add('Huge', big.repeat(5), 'paste');
assert(huge.text.length <= VV.config.LIMITS.maxDocumentChars, 'library: oversized text truncated');
VV.libraryStore.remove(huge.id);
VV.libraryStore.remove(tamil.id);

summary('stores.test');

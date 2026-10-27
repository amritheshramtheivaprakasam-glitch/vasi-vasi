/* VOICE-001 regression: the "text moves but no voice" silent-failure class.
   A per-utterance watchdog must detect silence (no onstart, or an
   impossibly fast end with no start) and surface an honest, actionable
   error. The cancel→speak gap must defer only when a queue exists, and
   stop() must make everything safe afterward. */
'use strict';
const { createEnv, loadScripts } = require('../helpers/env');
const { assert, assertEqual, summary, pass } = require('../helpers/harness');

createEnv();
loadScripts('src/util.js', 'src/core/speechEngine.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastU = null;
const calls = { speak: 0, cancel: 0 };
function resetMocks() {
  calls.speak = 0; calls.cancel = 0; lastU = null;
  global.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.onstart = null; this.onend = null; this.onerror = null; this.onboundary = null;
    }
  };
  global.speechSynthesis = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [
      { name: 'Test Tamil', lang: 'ta-IN', voiceURI: 'ta-test', localService: true, default: false },
      { name: 'Test English', lang: 'en-US', voiceURI: 'en-test', localService: true, default: true }
    ],
    speak(u) { calls.speak++; lastU = u; },
    cancel() { calls.cancel++; this.speaking = false; this.pending = false; },
    pause() {}, resume() {},
    addEventListener() {}
  };
}

function makeEngine() {
  resetMocks();
  const engine = new window.VV.SpeechEngine();
  engine._loadVoices();
  return engine;
}

(async () => {
  /* normal path: speaks synchronously, start then end, no error */
  const e1 = makeEngine();
  let started = false, ended = null, erred = null;
  e1.speak('வணக்கம் — hello.', { lang: 'ta' }, {
    onStart: () => { started = true; },
    onEnd: (stopped) => { ended = stopped; },
    onError: (e) => { erred = e; }
  });
  assertEqual(calls.speak, 1, 'speaks synchronously when nothing is queued (no needless delay)');
  lastU.onstart();
  await sleep(20);
  lastU.onend();
  assert(started && ended === false && !erred, 'normal utterance: start → end, no error');

  /* silence watchdog: never starts → honest error, engine cancelled */
  const e2 = makeEngine();
  e2._silenceMs = 40;
  let silenceErr = null, ended2 = null;
  e2.speak('This sentence will never make a sound.', {}, {
    onEnd: (s) => { ended2 = s; },
    onError: (e) => { silenceErr = e; }
  });
  await sleep(120);
  assert(silenceErr && silenceErr.silent === true,
    'watchdog fires: silent utterance produces a detected error');
  assert(/voice|Settings/i.test(silenceErr.userMessage || ''),
    'silence error is honest and actionable (mentions voice choice / Settings)');
  assert(!ended2, 'silent utterance is never reported as a completed read');
  assert(calls.cancel >= 2, 'silent utterance is cancelled so it cannot queue-block audio');

  /* fast-end heuristics: end almost instantly, never started → silence */
  const e3 = makeEngine();
  let err3 = null, ended3 = null;
  e3.speak('Quick fake read.', {}, {
    onEnd: (s) => { ended3 = s; },
    onError: (e) => { err3 = e; }
  });
  lastU.onend(); // no onstart, ended within microseconds
  assert(err3 && err3.silent === true && ended3 == null,
    'impossibly fast end without a start is declared silence, not success');

  /* cancel-gap: busy queue defers the next utterance instead of racing */
  const e4 = makeEngine();
  speechSynthesis.speaking = true;
  e4.speak('Second sentence.', {}, {});
  assertEqual(calls.speak, 0, 'utterance is NOT enqueued in the same tick as cancel (the drop race)');
  await sleep(window.VV.SpeechEngine.CANCEL_GAP_MS + 40);
  assertEqual(calls.speak, 1, 'utterance is enqueued after the cancel gap');
  assert(calls.cancel >= 1, 'cancel was issued for the busy queue');
  speechSynthesis.speaking = false;

  /* stop() safety: nothing straggles after stop */
  const e5 = makeEngine();
  e5._silenceMs = 40;
  speechSynthesis.speaking = true;
  let err5 = null;
  e5.speak('About to be stopped.', {}, { onError: (e) => { err5 = e; } });
  e5.stop();
  await sleep(150);
  assertEqual(calls.speak, 0, 'deferred utterance never speaks after stop()');
  assert(!err5, 'no spurious watchdog error fires after stop()');
  speechSynthesis.speaking = false;

  /* voices: Tamil sorts ahead of English (our namesake policy) */
  const e6 = makeEngine();
  const vs = e6.voices();
  assert(vs[0].lang.startsWith('ta'), 'voice list keeps Tamil first');
  pass('voice switching across speak calls');
  const voice = e6.pickVoice(null, 'ta');
  assert(voice && voice.lang.startsWith('ta'), 'pickVoice matches the document language');

  summary('speech.test');
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error('CRASH:', e && e.message);
  process.exit(1);
});

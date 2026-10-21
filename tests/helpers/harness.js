/* Tiny zero-dependency test harness shared by all test files. */
'use strict';

let passed = 0;
let failed = 0;

function pass(msg) {
  passed += 1;
  console.log('PASS:', msg);
}

function fail(msg) {
  failed += 1;
  process.exitCode = 1;
  console.error('FAIL:', msg);
}

function assert(condition, msg) {
  condition ? pass(msg) : fail(msg);
}

function assertEqual(actual, expected, msg) {
  if (Object.is(actual, expected)) pass(`${msg} (${JSON.stringify(actual)})`);
  else fail(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function summary(label) {
  console.log(`\n${label}: ${passed} passed, ${failed} failed`);
}

module.exports = { assert, assertEqual, summary, pass, fail };

/* Test runner: executes every suite in dependency-free isolation.
   Usage: node tests/run.js   (or: npm test) */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  'unit/documentParser.test.js',
  'unit/stores.test.js',
  'unit/documents.test.js',
  'unit/pdfFixture.test.js',
  'offline/sw-shell.test.js',
  'accessibility/markup.test.js',
  'integration/app.smoke.test.js'
];

let failedSuites = 0;
for (const suite of suites) {
  const file = path.join(__dirname, suite);
  console.log(`\n=== ${suite} ${'='.repeat(Math.max(4, 60 - suite.length))}`);
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) failedSuites += 1;
}

console.log('\n' + '='.repeat(64));
if (failedSuites === 0) {
  console.log(`ALL SUITES GREEN (${suites.length}/${suites.length})`);
} else {
  console.error(`${failedSuites} of ${suites.length} suites FAILED`);
}
process.exit(failedSuites === 0 ? 0 : 1);

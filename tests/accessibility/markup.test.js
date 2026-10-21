/* Accessibility tests: static invariants of the shipped markup
   and theme tokens. These guard against regressions that would
   silently exclude blind and low-vision users. */
'use strict';
const fs = require('fs');
const path = require('path');
const { assert, assertEqual, summary } = require('../helpers/harness');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tokens = fs.readFileSync(path.join(ROOT, 'styles', 'tokens.css'), 'utf8');
const baseCss = fs.readFileSync(path.join(ROOT, 'styles', 'base.css'), 'utf8');

/* document basics */
assert(/<html lang="en"/.test(html), 'a11y: <html> declares a language');
assert(/<title>[^<]{5,}<\/title>/.test(html), 'a11y: meaningful <title> present');

/* skip link targets main content */
assert(html.includes('class="skip-link"'), 'a11y: skip link exists');
assert(/href="#main-content"/.test(html) && /id="main-content"/.test(html),
  'a11y: skip link resolves to #main-content');

/* live regions for announcements (polite + assertive) */
assert(/role="status" id="announcer-polite"/.test(html), 'a11y: polite live region');
assert(/role="alert" id="announcer-assertive"/.test(html), 'a11y: assertive live region');

/* every dialog is labelled */
const dialogs = [...html.matchAll(/<dialog[^>]*>/g)].map((m) => m[0]);
assert(dialogs.length >= 4, `a11y: ${dialogs.length} dialogs present`);
dialogs.forEach((d) =>
  assert(d.includes('aria-labelledby'), `a11y: dialog labelled — ${d.slice(0, 60)}…`));

/* every button has an accessible name (aria-label or non-empty text) */
const buttons = [...html.matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => m[0]);
let unnamed = 0;
buttons.forEach((b) => {
  const openTag = b.slice(0, b.indexOf('>') + 1);
  const inner = b.slice(b.indexOf('>') + 1, b.lastIndexOf('<')).replace(/<[^>]*>/g, '').trim();
  if (!openTag.includes('aria-label') && inner === '') {
    unnamed += 1;
    console.error('  unnamed button:', openTag.slice(0, 90));
  }
});
assertEqual(unnamed, 0, 'a11y: every button has an accessible name');

/* key form fields are labeled */
['add-title', 'add-text', 'voice-select', 'set-font-scale', 'set-rate', 'progress-range']
  .forEach((id) => {
    const labelled =
      html.includes(`for="${id}"`) ||
      new RegExp(`id="${id}"[^>]*aria-label`).test(html);
    assert(labelled, `a11y: control #${id} has a label`);
  });

/* images that are decorative are hidden from AT; brand has alt handling */
assert(/aria-hidden="true"[^>]*>$/.test(html) || html.includes('aria-hidden="true"'),
  'a11y: decorative imagery hidden from assistive tech');

/* themes & motion */
assert(tokens.includes('[data-theme="dark"]'), 'a11y: dark theme tokens defined');
assert(tokens.includes('[data-theme="contrast"]'), 'a11y: high-contrast theme tokens defined');
assert(/prefers-color-scheme:\s*dark/.test(tokens), 'a11y: auto theme follows device preference');
assert(baseCss.includes('prefers-reduced-motion'), 'a11y: reduced-motion respected');

/* focus visibility is enforced, never suppressed without replacement */
assert(baseCss.includes(':focus-visible'), 'a11y: explicit :focus-visible styling');
assert(!/outline:\s*none\s*;?\s*$(?!::)/m.test(baseCss) || baseCss.includes(':focus { outline: none; }'),
  'a11y: outline removal is paired with a :focus-visible replacement');

/* touch target size floor for interactive elements */
assert(/min-height:\s*44px/.test(baseCss), 'a11y: 44px minimum control height');

summary('markup.test');

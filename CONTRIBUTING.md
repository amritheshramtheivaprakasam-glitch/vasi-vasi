# Contributing to Vasi Vasi

Thank you for helping blind and low-vision readers. Every contribution —
code, translation, testing on real devices, or a clear bug report — matters.

## Ground rules (non-negotiable)

1. **Reading never depends on money or network.** Contributions must not
   add mandatory backends, paywalls, analytics, ads, or remote AI calls.
2. **Accessibility is a requirement, not polish.** New interactive UI needs
   keyboard access, accessible names, and adequate contrast.
3. **Zero runtime dependencies.** The app ships as static files with no
   build step. Proposing a new dependency requires a strong written
   justification in the PR.
4. **Privacy by design.** Nothing about a user's library or behavior may
   leave their device.

## Local development

No build tools are required:

```bash
python3 -m http.server 8000   # or any static file server
# open http://localhost:8000
```

## Tests

```bash
node tests/run.js     # all suites (no dependencies required)
npm install           # once, only if you want the jsdom integration suite
npm test              # same as node tests/run.js, plus jsdom suite active
```

Please run the suite before opening a PR, and add tests for behavior you
change. The suites cover: parser units, store behavior, offline invariants
(no network references), accessibility markup invariants, and a jsdom
end-to-end smoke test.

## Code conventions

- Plain scripts (no modules/bundler): each file is an IIFE that attaches
  to the `window.VV` namespace. Files load in dependency order in
  `index.html` — keep that order correct when adding files.
- `core/` and `services/` never touch the DOM.
- `support/` is strictly optional and decoupled; core must never import it.
- All UI text that a screen reader may announce should be short and clear.
- Follow the existing style: 2-space indent, descriptive names, comment
  header per file explaining purpose and contracts.

## Reporting issues

Open a GitHub issue. For accessibility bugs, include the browser, OS and
assistive technology (e.g. "Android 15, Chrome, TalkBack") — device speech
behavior varies widely and that detail is essential.

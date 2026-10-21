# Test fixtures

Tiny, purpose-built files that keep the import pipeline honest. They are
deliberately small; the acceptance matrix they support:

| File | What it proves |
|---|---|
| `hello.pdf` | Valid 2-page text-layer PDF (built with pdf-lib) — routing + extraction path target for browser QA |
| `scanned-look.pdf` | PDF with zero extractable text — must produce the "scanned, OCR not yet available" error, never silence |
| `fake.pdf` | Text bytes that merely begin with `%PDF-` — signature routing engages the adapter, which must fail with a *damaged PDF* message (not raw bytes) |
| `note.txt` | Plain UTF-8 — must pass through unchanged (2 paragraphs, 3 sentences) |

Regenerating the PDFs: `npm i pdf-lib` anywhere, then re-run the snippet in
git history (see the commit that introduced this folder). The fixtures are
committed so tests never need a network.

Browser acceptance flow (manual, per release): import `hello.pdf` →
expect title "hello", format chip PDF, 9 sentences across 2 page-paragraphs,
Shift+←/→ jumps between pages, playback completes, resume works.
`hello.pdf` is also parsed by the real vendored pdf.js inside the offline
suite — see `tests/offline/sw-shell.test.js` (PDF section).

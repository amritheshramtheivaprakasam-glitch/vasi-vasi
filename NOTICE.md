# Notices & acknowledgements

## Third-party code

All application code in `index.html`, `styles/` and `src/` is original,
written for this project and licensed under the MIT License (see LICENSE).
All bundled reading samples in `src/content/starterLibrary.js`
("Welcome to Vasi Vasi", "வைகை ஆற்றின் காலை", "The Lighthouse Keeper")
are original works written for this project.

### Vendored libraries (`vendor/`)

The document-import formats are handled by pinned, locally bundled builds
of these open-source libraries. They are loaded lazily (only when the
matching format is imported) and make no network calls themselves:

| Library | Version | License | Used for |
|---|---|---|---|
| pdf.js (`pdfjs-dist`, Mozilla) | 3.11.174 | Apache-2.0 | PDF text-layer extraction |
| JSZip (Stuart Knightley) | 3.10.1 | MIT | EPUB/DOCX container reading |
| Mammoth.js (Michael Williamson) | 1.8.0 | BSD-2-Clause | DOCX → HTML conversion |
| Readability.js (Mozilla) | 0.5.0 | Apache-2.0 | Web article extraction |

Each `vendor/<name>/` directory contains the library's own license file.
No GPL/AGPL code is included, so commercial and institutional distribution
remains permitted.

## Platform APIs used (no code included, no licence obligations)

- W3C Web Speech API (`speechSynthesis`) — implemented by the browser/OS.
- W3C Service Worker, Cache Storage, `localStorage`, `Intl.Segmenter`.
- Speech **voices** are provided by the user's operating system and remain
  the property of their respective vendors; the app merely requests them.

## Development-only dependencies

The optional test suite uses **jsdom** (MIT) under `devDependencies`.
It is never shipped, bundled or executed in production.

## Trademark note

"Vasi Vasi" (வாசி வாசி, "read, read") is used here as a descriptive project
name in Tamil.

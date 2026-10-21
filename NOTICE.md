# Notices & acknowledgements

## Third-party code

**None.** The shipped application contains no third-party runtime code,
no CDN references, no bundled fonts and no copied snippets.

- All application code in `index.html`, `styles/` and `src/` is original,
  written for this project and licensed under the MIT License (see LICENSE).
- All bundled reading samples in `src/content/starterLibrary.js`
  ("Welcome to Vasi Vasi", "வைகை ஆற்றின் காலை", "The Lighthouse Keeper")
  are original works written for this project.

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

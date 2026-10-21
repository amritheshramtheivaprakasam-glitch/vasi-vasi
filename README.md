<div align="center">

<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>Built with AI Studio</h2>

  <p>The fastest path from prompt to production with Gemini.</p>

  <a href="https://aistudio.google.com/apps">Start building</a>

</div>

---

# வாசி வாசி · Vasi Vasi

> **"Read, Read" (வாசி, வாசி)** — a free, fully **offline reading companion** that reads any text
> aloud for **blind and low-vision readers**.

Vasi Vasi turns any text — a newspaper article, a lesson, a story, a letter — into clear,
sentence-by-sentence audio using the voices **already built into your device**.

## ✨ Principles

| Principle | What it means |
|---|---|
| 🔌 **100% offline** | No internet needed after the first load. Works from a plain static host or a local file server. |
| 🚫 **No AI services** | Zero API keys, zero cloud calls, zero data collection. Speech comes from your device's own text-to-speech voices. |
| 🔒 **Private by design** | Every document and setting lives only in your browser's local storage. Nothing ever leaves your device. |
| ♿ **Accessibility first** | Full keyboard control, screen-reader announcements, high-contrast theme, large touch targets (44px+). |
| 🧱 **No build step** | Plain HTML/CSS/JS in clearly separated modules. No npm, no bundler — open it and it runs. |

## 🎯 Features

- **Library on your device** — paste text or import `.txt` files; keep as many documents as you like.
- **Sentence-by-sentence reading** with the current sentence always highlighted and auto-scrolled.
- **Word-level "karaoke" highlight** — each word lights up as it is spoken (in supported browsers).
- **Tamil & English voices** — voices are grouped by language; Tamil voices automatically take priority.
- **Full playback control** — play/pause, previous/next sentence, previous/next paragraph, speed (0.5×–2×), pitch, volume.
- **Resume where you stopped** — reading position is saved automatically for every document.
- **Sleep timer** — stop reading after 5/10/15/30/45 minutes.
- **Click any sentence** to start reading from exactly there.
- **Themes** — light (warm paper), dark, and a **high-contrast** theme for low vision, plus adjustable reading text size and serif/sans font.
- **Installable (PWA)** — "Add to Home screen" to use it like a regular app, fully offline.

## 🚀 Running the app

No installation, no API keys. Pick either option:

**Option 1 — any static server (recommended, enables offline install):**

```bash
# from this folder, choose one:
python3 -m http.server 8000
npx serve .
```

Then open `http://localhost:8000`.

**Option 2 — direct:** simply open `index.html` in a browser. Everything works
(the service worker that enables install/offline-cache only activates over http/https).

## ⌨️ Keyboard shortcuts (while reading)

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Previous / next sentence |
| `Shift` + `←` / `→` | Previous / next paragraph |
| `↑` / `↓` | Faster / slower |
| `Home` / `End` | First / last sentence |
| `Esc` | Back to library |
| `?` | Open help |

## 🗂️ Project structure

```
vasi-vasi/
├── index.html                  # App shell: views + dialogs + script load order
├── manifest.webmanifest        # PWA metadata
├── sw.js                       # Service worker: offline app-shell caching
├── assets/icons/               # App icon (SVG, maskable)
├── styles/
│   ├── tokens.css              # Design tokens + light/dark/high-contrast themes
│   ├── base.css                # Reset, typography, buttons, forms, dialogs
│   ├── layout.css              # Shell, header, views, footer
│   └── components.css          # Doc cards, player, highlights, settings
└── src/
    ├── config.js               # Storage keys, limits, reading constants, defaults
    ├── util.js                 # Emitter, uid, language detection, estimates
    ├── content/
    │   └── starterLibrary.js   # Original bundled texts (EN + தமிழ்)
    ├── services/
    │   ├── storage.js          # Safe localStorage wrapper (memory fallback)
    │   ├── settingsStore.js    # Theme/voice/speed settings + pub-sub
    │   └── libraryStore.js     # Document CRUD + reading progress
    ├── core/
    │   ├── announcer.js        # aria-live announcements for screen readers
    │   ├── documentParser.js   # Text → paragraphs → sentences (Intl.Segmenter)
    │   ├── speechEngine.js     # Device TTS wrapper (voices, events, keep-alive)
    │   └── readerEngine.js     # Reading state machine: play/pause/jump/progress
    ├── ui/
    │   ├── shortcuts.js        # Keyboard map
    │   ├── dialogs.js          # Settings / add-text / confirm / help dialogs
    │   ├── libraryView.js      # Library rendering + import
    │   └── readerView.js       # Player UI + sentence/word highlighting
    └── main.js                 # Bootstrap + view router + app commands
```

Scripts are deliberately plain (no modules/bundler) and load in dependency order,
so the app runs even from `file://`.

## 🔊 About voices

Voices come from the operating system, not from this app:

- **Android** — Google Speech Services usually includes Tamil (தமிழ்) and English.
- **Windows** — Settings → Time & Language → Speech → add voices (Microsoft தமிழ் voices available).
- **ChromeOS / Chrome** — built-in Google voices work out of the box.
- **macOS / iOS** — Settings → Accessibility → Spoken Content → Voices.

If no Tamil voice is installed, Vasi Vasi falls back to the closest match automatically.

## 📄 License

Free to use, copy and adapt for any personal or community purpose.

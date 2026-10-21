# Vasi Vasi — Privacy Policy

**Effective: 2026-10-21 · Scope: the Vasi Vasi web application**

Vasi Vasi was built for blind and low-vision readers. Privacy is not a
feature checkbox here — it is an architectural guarantee.

## What the app collects

**Nothing.** Vasi Vasi has no analytics, no telemetry, no advertising SDKs,
no error-reporting service and no accounts. There is no server-side code to
collect anything with.

## Where your data lives

Everything the app stores stays on **your device**, in your browser's local
storage:

- your documents (pasted or imported text)
- your reading position per document
- your settings (theme, voice choice, speed, text size)

You can erase all of it at any time from your browser's site settings
("Clear site data"), or simply by uninstalling / never visiting again.

## Network activity

The app makes **zero network requests of its own**:

- No API keys, no AI services, no cloud speech.
- Text-to-speech is performed by your **device's built-in voices**
  (Web Speech API). Note: on some platforms a chosen voice may itself be
  provided by the OS vendor's online speech service (e.g. certain Chrome
  voices). If absolute offline speech matters, install an `on-device`/local
  voice in your system settings — Vasi Vasi labels voices that are local.
- The service worker caches the app's own files for offline use. It talks
  only to the same origin that served the app.

## If you self-host or fork

You may add your own integrations. If you do, you are responsible for your
own privacy disclosures to your users.

## Contact

Open an issue on the public repository for privacy questions.

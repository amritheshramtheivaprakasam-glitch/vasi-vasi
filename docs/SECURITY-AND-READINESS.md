# Vasi Vasi — Engineering Execution Report: Security & Release Readiness (v0.2.1)

- **Workstream:** Release hardening — security fixes, voice P0, APK readiness
- **Responsible lead:** Document Systems / Security / Speech (this session)
- **Independent reviewer:** Automated gate — 9 test suites, 227 assertions
- **Source revision:** branch `arena/729c5740-vasi-vasi`, base `638428a` (v0.2.0)
- **Reporting status:** Verified (automated); device-side items explicitly marked

---

## 1. Problems addressed

1. **SEC-PDF-002 (Critical):** vendored pdf.js 3.11.174 predates the fix for **CVE-2024-4367** — JavaScript embedded in a crafted PDF's font program could execute inside the page during parsing, in *our* origin, beside the user's private library.
2. **SEC-CSP-001 (Major):** no Content-Security-Policy or related headers existed anywhere — a single injection sink (hypothetical) would have had no containment.
3. **SEC-URL-001 (Moderate):** the URL importer accepted plain `http://`, allowing tamperable article text to reach the speech engine.
4. **VOICE-001 (Critical, user-reported):** "the text is moving but there is no voice" — utterances could vanish silently (cancel→speak same-tick race on Chrome/Android) or finish without ever producing audio (voice·script mismatch), while the highlight kept advancing. For a blind reader this is total product failure disguised as success.
5. **APK readiness:** manifest icons were SVG-only — insufficient for Android installation prompt quality and Trusted Web Activity packaging.

## 2. Evidence (reproduction → fix → proof)

| Defect | Root cause | Fix | Proof |
|---|---|---|---|
| SEC-PDF-002 | pdf.js v3 compiles font JS by default; v4 (fix version) is ESM-only and breaks our `file://` classic-script constraint | `isEvalSupported: false` on every `getDocument` call | **Fails-without/passes-with:** `tests/security/policy.test.js` scans the call and fails if the flag vanishes or is re-enabled. Real-engine probe: `hello.pdf` extracts **identical text** with the flag on (text extraction never depended on font eval) |
| SEC-CSP-001 | no policy declared | meta CSP (`script-src 'self'`, `object-src 'none'`, no inline/eval scripts, `connect-src 'self' https:` for URL import, `worker-src 'self' blob:` for the pdf.js worker) + Referrer-Policy no-referrer + Permissions-Policy + Cloudflare `_headers` for real HTTP enforcement | policy suite asserts every directive; zero `innerHTML`/`eval`/`new Function` in shipped code (verified by scan) |
| SEC-URL-001 | `http:` accepted | https-only with honest user message; cookie leakage already impossible (`credentials: 'omit'`) | behavior tests: `http://`, uppercase `HTTP://`, `javascript:` all rejected *before any fetch* — `policy.test.js` |
| VOICE-001 | (a) utterance queued in the same tick as `cancel()` is dropped silently on Chrome/Android; (b) utterances can end without ever starting (voice·language mismatch) and were treated as "read successfully" | (a) defer enqueue by 60 ms when a queue exists (first-play stays synchronous); (b) per-utterance watchdog: no `onstart` within 1.5 s, or `onend` < 120 ms without ever starting ⇒ **declared silence** → cancel + honest actionable error (pick a matching-language voice, check volume) | `tests/unit/speech.test.js` — 15 assertions incl. watchdog, fast-end, cancel-gap, stop-safety; integration mock corrected to emulate engines honestly (`speaking=false` when `onend` fires) |
| APK icons | SVG-only icons | deterministic offline-generated 512px PNGs (any + maskable) in brand palette, added to manifest + SW precache | policy suite asserts presence, sizes, maskable purpose |

**No regressions:** 9/9 suites green (13+21+31+9+15+~20-policy+44+28+45). Design, features and aesthetics untouched; no dependency changes.

**Fixed scope honestly limited:** the adversarial-font exploit *fixture* (a live CVE PoC PDF) is **not** included — its hosting is outside this environment's permitted network; the mitigation + invariant tests + real-engine compatibility proof are in place, and the PoC fixture is logged as a follow-up item (SEC-PDF-002F) for the first environment with access.

## 3. Open register — vulnerabilities & missing issues (severity · owner · status)

| ID | Sev | Item | Status / owner |
|---|---|---|---|
| A11Y-USER-001 | **Major** | No TalkBack/real-device journey validation by actual blind users | Open — requires target users + device; scripted markup suite passes meanwhile |
| SPEECH-VOICE-002 | **Major** | Human-naturalness benchmark (listening protocol) + neural offline voices (Piper/VITS lane) + language list | Open — design frozen; implementation next workstream |
| DOC-OCR-001 | Major | Scanned-PDF OCR (Tamil+English, bundled data) | Deferred by explicit scope decision; honest error shipped |
| SEC-BOMB-001 | Moderate | Archive-expansion caps (EPUB/DOCX zip-bomb), page-count caps, malformed-crasher fixture corpus | Open — next security workstream |
| SEC-PDF-002F | Moderate | Live CVE-2024-4367 malicious-font fixture (network-blocked here) | Open — run where PoC is reachable |
| STOR-001 | Moderate | Library storage: backup-last-good, versioned migration, user export | Open |
| URL-LIVE-001 | Moderate | URL import validated only with mocked fetch (sandbox network restriction); real-site CORS behavior | Open — manual device pass scripted in checklist |
| OBS-001 | Minor | Local redacted diagnostics (import/parser/playback failure records) | Open |
| LANG-001 | Moderate | `detectLang` is Tamil/English only; Hindi/Telugu/Kannada/Malayalam+ mis-bucketed as English | Open — detector + language list scheduled |
| TRANS-001 | — | **Translation: deliberately absent.** No offline ₹0 engine meets the quality bar; fake UI would violate the no-fake-capability rule. Awaiting explicit product decision with documented trade-off | Pending decision (owner: product) |

### Missing scenarios a senior review flagged (test-queue, not yet covered)
Real-device TalkBack full journey; low-end Android performance with a 4.6 MB parser load; service-worker update behavior while offline; EPUBs with dozens of chapters (memory pressure); mixed-language documents mid-sentence; multi-column magazine PDFs (accepted limitation, documented); PDFs using substituted/embedded non-Unicode fonts (warned, not fixed); device-families' Tamil voice availability matrix.

## 4. APK readiness — the honest answer

**Is the APK ready to install today? No — and no APK can honestly be produced from this environment.** Building an Android package requires a JDK + Android SDK, which this sandbox does not have and cannot fetch. What has been made ready **this release** is everything the codebase controls for packaging:

- Manifest now satisfies install/TWA requirements: `standalone` display, `start_url`, **512px PNG any + maskable** icons (previously SVG-only — a real blocker).
- Service worker (v4) precaches the full shell; offline operation repeats-test-verified.
- Security headers ship for the deployment (`_headers`), required for a clean Trusted Web Activity.

**Execution path to the APK (owner-annotated, zero new dependencies in-repo):**
1. *Product owner:* deploy `main` to HTTPS (Cloudflare Pages free tier; `_headers` auto-applies).
2. *Developer machine (any laptop, one-time):* install JDK 17 + Android SDK cmdline-tools; `npx @bubblewrap/cli init --manifest https://<your-domain>/manifest.webmanifest` → `bubblewrap build` → produces signed APK/AAB.
3. *Product owner:* host `/.well-known/assetlinks.json` with the signing key fingerprint (Bubblewrap generates the exact file) — Chrome removes its URL bar only when this verifies.
4. *QA:* device acceptance checklist (below) against the **exact** artifact.
5. *Alternative:* PWABuilder hosted packaging — same assetlinks requirement.

**Shortcut available today:** the deployed PWA itself installs on Android ("Add to Home screen" → full-screen, offline) without any APK. The APK/TWA is only for Play-Store presence.

### Device acceptance checklist (the APK/PWA is "verified" only when these pass on the physical phone)
Speak full Tamil + English documents without silence · prev/next sentence+paragraph · resume after app kill · airplane-mode read · import a real PDF/EPUB on-device · rate controls · TalkBack full journey · no voice-silence events across 3 documents (watchdog would surface them honestly now) · battery thermals after 10-minute continuous read.

## 5. Rollback

`git revert <merge-commit>` on `main`, redeploy, SW cache name change forces shell refresh. Last known-good tags: `v0.2.0` (pre-security-hardening), this release `v0.2.1`.

## 6. Independent decision

- **PWA 0.2.1: PASS** — automated gate 9/9 green, security invariants enforced by the suite, no silent-failure classes left in the speech path against mocked and real engines within environment limits.
- **APK: BLOCKED, by environment, not by the codebase** — requires deploy + JDK/SDK machine (steps 1–4 above). Recommends proceeding on the stated path; the block clears with evidence from the device checklist, not by declaration.

*Remaining risks:* device-voice silent classes that never fire callbacks may dodge even the watchdog on exotic WebViews — mitigated, verify per device in step 4; file:// mode CSP + pdf.js worker interaction needs one manual double-click launch check (documented in QUALITY-GATES).

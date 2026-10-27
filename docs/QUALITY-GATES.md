# Vasi Vasi — Quality Gates (the permanent release checklist)

Every update — any size, any urgency — is checked against these gates **before merge to main**. A gate cannot be satisfied by description; only by evidence (test, scan, probe, or a cited manual check with date and device). If a gate cannot pass, the limitation ships *documented*, never claimed. This file is the standing standard copied into every future release report.

## Gates

- **G0 Core ideology** — ₹0 recurring cost; no AI APIs/accounts/keys; offline-first; existing aesthetics and features preserved (regression suites prove it).
- **G1 Voice is the product** — no text-to-speech path may fail silently. Watchdog on; language·voice mismatch produces an honest actionable message; claim only what the listening protocol measured.
- **G2 Zero raw syntax** — no PDF/DOCX/EPUB bytes ever reach reader or speech (qualityGate + signature routing; unit + integration pinned).
- **G3 Language policy** — every document path names its detected language and voice fallback; new languages extend the detector with fixtures; fallback silence is never allowed silently.
- **G4 Network confinement** — exactly one sanctioned network call (URL adapter); vendor files SHA-256 pinned; any new fetch/XHR/beacon/WebSocket fails the suite.
- **G5 Accessibility** — markup suite (announcers, focus, labels, dialogs) green; TalkBack device pass scripted for release candidates.
- **G6 Gate discipline** — each PR states which gates it touches, with the evidence; QA (the suites) must pass independently of the author's description.
- **G7 Voice naturalness** — no "human-quality" claim without the listening protocol: reference passages per language, blinded A/B vs baseline, documented threshold.
- **G8 Security headers & eval policy** — CSP/Referrer/Permissions present (active modes noted); `isEvalSupported:false` on pdf.js; https-only URL import; secrets/debug scans clean.
- **G9 Dependency admission** — new dependencies: license review → pin → hash → `NOTICE.md` entry → suite verifies hashes. Free is not an endorsement; dubious provenance fails closed.

## Release procedure

1. `node tests/run.js` → **9/9 green** (required).
2. `npm audit --omit=dev` → 0 (required).
3. Version bump in `package.json` and SW cache name (`vasi-vasi-vN`).
4. Release report (template: `docs/SECURITY-AND-READINESS.md` §1–§6) with evidence per touched gate.
5. PR → independent suite pass → merge → tag.
6. Device checklist for anything touching speech, import, or packaging.

## Manual checks that cannot be automated here

- `file://` double-click launch + CSP + pdf.js worker (one device check).
- URL import against 3 real sites (CORS outcomes documented honestly).
- TalkBack full journey with a blind tester (A11Y-USER-001).
- Listening protocol scoring (G7).

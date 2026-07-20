# Security Findings — SiberX Crisis Command Platform

**Live URL assessed:** https://siberx-t.vercel.app/

Each finding lists what was checked, what was found, evidence from the actual codebase, and a severity rating. Where a finding's danger depends heavily on context, two ratings are given:

- **Base severity** — how dangerous this pattern would be in a normal production app with real data behind it.
- **Contextual severity** — how dangerous it actually is *in this specific app*, which has no backend and no real data.

Both are reported. Contextual severity drives prioritization; base severity is there so a genuinely risky pattern doesn't get quietly dismissed just because today's stakes happen to be low.

**Severity scale:** Critical → High → Medium → Low → Informational (no risk, but worth recording — includes confirmed-clean "pass" results).

---

## Analysis Methodology — Steps Performed

This assessment was source-driven, not template-driven: every finding below traces back to one of the following concrete steps, run against the actual repository.

1. **Repository inventory.** Listed every file in the project tree to establish scope — 8 HTML pages, 9 JavaScript files, 1 CSS file, config/CI files, and repo scaffolding (`.gitignore`, `LICENSE`, `SECURITY.md`, etc.).
2. **Secret pattern scan.** Ran a regex sweep across every `.js`, `.html`, `.json`, `.yml`, `.md`, and `.toml` file for common secret shapes — AWS-style `AKIA...` keys, Stripe-style `sk_live_`/`sk-proj-` tokens, PEM private-key headers, and generic `api_key=`/`secret_key=`/`access_token=` assignments. One match returned (see SEC-01/SEC-02).
3. **XSS sink enumeration.** Located all 48 `innerHTML` assignment sites across the 9 JavaScript files and manually confirmed, site by site, whether user-influenced data reaches them and whether `escapeHtml()` wraps it before insertion. Followed up with a heuristic grep for interpolations of likely-user-controlled fields (`.text`, `.name`, `.author`, `value`) not wrapped in `escapeHtml()` on the same line, to catch anything the manual pass might have missed (see FE-01).
4. **CSS-injection check.** Searched specifically for any dynamic value flowing into a `style="..."` HTML attribute, since the CSP allows `'unsafe-inline'` for styles — confirmed every such site uses only clamped numbers or fixed internal color tokens, never free-text user input (see FE-02).
5. **Authentication & session logic trace.** Read `login.js`, `requireAuth()`, `logout()`, and `touchActivity()` end-to-end to determine what is and isn't actually verified, how session state is stored, and what happens at sign-out — this is how the logout data-isolation bug (AUTH-03) was found; it wasn't caught by pattern-matching, it was found by asking "does this function's behavior match what its name promises."
6. **Security header & CSP validation.** Parsed `vercel.json` as JSON, confirmed it was structurally valid, and checked the configured header set (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) against current OWASP secure-header guidance directive by directive.
7. **Configuration & repo-readiness review.** Checked `.gitignore` coverage against what actually needs to stay untracked, scanned for leftover placeholder values (`REPLACE-WITH...`, example emails, bracketed names), and reviewed the GitHub Actions workflows for version-pinning practice and Dependabot coverage.
8. **AI-integration review.** Read through the "AI Triage Assistant" feature's implementation to confirm it makes no network calls, holds no API key, and only matches fixed templates against keyword patterns — verifying it does not reproduce the anti-pattern the app's own training content warns against.
9. **Local smoke test.** Served the site with a local static file server and issued a request to every page and static asset (`index.html` through `response.html`, CSS, JS, `robots.txt`, `security.txt`) to confirm a clean `200` response with no unintended routes exposed.
10. **Live deployment verification.** Fetched the deployed site at **https://siberx-t.vercel.app/** directly and confirmed the live content matches the reviewed source (login flow, copy, and structure all present as built). Note the scope of this step: content-level fetching confirms *what's deployed matches what was reviewed*; it does not by itself confirm live HTTP response headers, since that requires either inspecting raw headers via a browser/`curl` or using the app's own built-in **Security Review Lab → "Run live header check"** tool, which is designed for exactly that purpose and was not re-run as part of compiling this document.
11. **Remediation.** For the two findings with an unambiguous, low-risk fix (AUTH-03/SURF-02 and CFG-03), applied the fix directly in the codebase rather than only documenting it, then re-ran steps 1–3 and 6 against the patched files to confirm no regression.

---

## 1. Exposed API Keys / Secrets

### SEC-01 — No real secrets found in the codebase — **Informational (Pass)**
A pattern scan across every `.js`, `.html`, `.json`, `.yml`, `.md`, and `.toml` file in the repo, matching common secret shapes (AWS `AKIA...` keys, Stripe-style `sk_live_`/`sk-proj-` tokens, PEM private-key headers, generic `api_key=`/`secret_key=`/`access_token=` assignments), returned exactly one match — see SEC-02. No real credential, key, or token exists anywhere in the codebase.

### SEC-02 — Fictional secret string in training content may trigger third-party scanners — **Low**
`assets/js/security-review.js` intentionally contains a fake, non-functional API key (`sk_live_4f9a2b8e7c1d4a3b9f0e6c2d8a7b5e31`) as the "spot the hardcoded secret" exercise in the Security Review Lab. It's allowlisted in `.gitleaks.toml` and excluded from the custom CI grep, so this repo's own automation won't false-positive on it. However, if this repo is scanned by a *different* tool that doesn't read `.gitleaks.toml` — GitHub's native secret scanning, a client's internal scanner, a security team's SIEM ingesting the repo — it may still flag and require a manual dismissal each time. Not a real leak, but worth pre-empting.

---

## 2. Input Validation Issues

### INP-01 — `sanitizeText()` is a defense-in-depth layer, not a full sanitizer — **Low**
`sanitizeText()` (in `assets/js/app.js`) strips only `<` and `>` characters and caps length. It is *not* a comprehensive HTML/JS sanitizer — it doesn't strip `javascript:` URIs, event-handler-like strings, or other markup-adjacent syntax. This is architecturally acceptable *because* the primary XSS defense is `escapeHtml()` at render time (confirmed applied at every relevant sink — see FE-01), and `sanitizeText()` exists as a secondary, defense-in-depth layer. The risk is purely one of future maintenance: if a contributor ever mistakes `sanitizeText()` alone for sufficient protection and skips `escapeHtml()` at a new render site, that assumption would be wrong.

### INP-02 — All validation is client-side only, because there is no server — **Base: High / Contextual: Informational**
Every `maxlength`, `pattern`, and JS-level check in this app runs in the browser and can be bypassed via devtools (editing the DOM, calling `setState()` directly, or writing to `localStorage`). In a normal app this would mean an attacker can submit anything to the server regardless of what the UI allows — a real, serious problem. Here there is no server to submit to; bypassing validation only lets a user inject malformed data into *their own* browser session. Flagged at full base severity because "there's no backend yet" is a common phase in real projects, and this exact assumption (client-side checks are sufficient) is exactly what breaks the moment a backend gets added later without someone re-deriving server-side validation from scratch.

---

## 3. Authentication Flaws

### AUTH-01 — Authentication is fully simulated — **Base: Critical / Contextual: Informational**
`assets/js/login.js` accepts any name (2–40 chars), any password (≥4 chars), and any 6-digit string as the "MFA" code — there is no real identity verification, no password hashing or comparison, and no server-side session. This is disclosed in-product ("Any name, code, and 6-digit verification work — this is a self-contained simulation") and is intentional for a training tool with no real accounts to protect. Rated at full Critical base severity anyway: this is precisely the shape of a broken-authentication vulnerability, and the only thing making it safe today is the absence of anything worth protecting — a fact that will not survive this pattern being reused, copy-pasted, or extended into a real product.

### AUTH-02 — Session state can be forged from the browser console — **Base: High / Contextual: Low**
Because "authentication" is just a `user` object in `localStorage`, anyone with devtools access to a browser can run `localStorage.setItem('siberx_state_v1', JSON.stringify({user:{name:'x',role:'y'}, ...}))` and be treated as signed in, skipping the login/MFA flow entirely. No real access is gained (there's nothing behind the login besides more simulation), but it is a textbook broken-access-control pattern that would be dangerous if this app ever gained a real protected resource.

### AUTH-03 — Logout did not clear prior participant's data — **Medium — Fixed in this revision**
Confirmed by code review: `logout()` in `assets/js/app.js` previously set `user = null` and nothing else, leaving case notes, chat transcripts, decision history, Security Review Lab progress, and form submissions intact in `localStorage`. On a shared or public training-room computer, the next person to sign in would see the previous participant's forensic notes, chat messages, and quiz answers rather than a clean slate. This is a genuine data-isolation/privacy-hygiene issue independent of the app's fictional subject matter — it's about one real person seeing another real person's input. **Status: fixed** — `logout()` now calls `resetState()` to fully clear the exercise before returning to sign-in. See `05-REMEDIATION-INSTRUCTIONS.md` for the diff.

---

## 4. Front-End Vulnerabilities

### FE-01 — No unescaped user-controlled data reaches the DOM — **Informational (Pass)**
All 48 `innerHTML` assignment sites across the 9 JavaScript files were reviewed. Every site that interpolates user-influenced data (chat messages, case notes, tips, reports, names, card-check digits) wraps that data in `escapeHtml()` before insertion. A heuristic grep for likely-unescaped interpolations (`${...text}`, `${...name}`, `${...value}` not wrapped in `escapeHtml()`) returned one match, in `security-review.js`'s "copy findings report" feature — reviewed and confirmed **not exploitable**: that string is written to the clipboard as plain text via `navigator.clipboard.writeText()`, never inserted into the DOM, so there is no HTML-injection context for it to exploit.

### FE-02 — CSP `style-src` includes `'unsafe-inline'` — **Low**
The Content-Security-Policy in `vercel.json` sets `style-src 'self' 'unsafe-inline'`, which is required because the app sets `style="..."` attributes directly from JavaScript (e.g., score-bar widths, verdict text color). Reviewed every site where a dynamic value flows into a `style="..."` attribute (`decisions.js`, lines rendering score bars and the debrief verdict): in every case the interpolated values are either a **clamped number 0–100** or a **fixed CSS-variable name from an internal lookup table** — never free-text user input. So while `'unsafe-inline'` in `style-src` is a broader CSP allowance than ideal, there is currently no path for it to be abused for CSS-based data exfiltration. Flagged as Low because it's a latent risk that would matter more if a future change ever put user text into a `style` attribute.

### FE-03 — No Trusted Types policy — **Low**
The app relies on manual escaping discipline (`escapeHtml()`) rather than a browser-enforced [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) policy, which would make it structurally impossible to assign unsanitized strings to `innerHTML` at all, regardless of reviewer diligence. Not a current vulnerability (FE-01 confirms the manual discipline holds today) but a forward-looking hardening opportunity.

### FE-04 — No third-party scripts; SRI is not applicable — **Informational (Pass)**
Confirmed zero `<script src="https://...">` or CDN-loaded assets anywhere in the app — every script is same-origin. Subresource Integrity is therefore not a gap; there's simply nothing external to protect against tampering.

---

## 5. Misconfigurations

### CFG-01 — Placeholder values remain in disclosure/legal files — **Medium (partially resolved)**
Confirmed present at assessment time:
- `.well-known/security.txt` — `Canonical` and `Policy` fields read `REPLACE-WITH-YOUR-VERCEL-DOMAIN`. **Status: fixed** — now that the app is live at **https://siberx-t.vercel.app/**, both fields point to the real domain.
- `SECURITY.md` — contact email is still the placeholder `security@example.com`. **Open** — needs a real address only the site owner can provide.
- `LICENSE` — copyright line still reads `Copyright (c) 2026 [Your Name]`. **Open** — needs the real name only the site owner can provide.

The domain portion is no longer exploitable-by-omission (a security researcher visiting `security.txt` today reaches a real policy document at a real URL). The remaining two items don't block deployment but should still be completed — see `05-REMEDIATION-INSTRUCTIONS.md`.

### CFG-02 — GitHub Actions pinned to mutable tags, not commit SHAs — **Low**
`.github/workflows/*.yml` reference `actions/checkout@v4` and `gitleaks/gitleaks-action@v2` — version tags, which (unlike commit SHAs) can be moved by the upstream maintainer or, in a supply-chain-attack scenario, by an attacker who compromises that maintainer's account. Pinning to a full commit SHA is the stronger practice recommended by GitHub's own security hardening guidance.

### CFG-03 — No Dependabot coverage for GitHub Actions — **Informational — Fixed in this revision**
The project has zero npm dependencies (by design — see Reflection document), but the GitHub Actions used in CI are themselves a dependency surface with no update tracking. **Status: fixed** — `.github/dependabot.yml` added, tracking the `github-actions` ecosystem on a weekly schedule.

### CFG-04 — Security header set is complete and valid — **Informational (Pass)**
`vercel.json` was JSON-validated and confirmed to set `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, and `X-XSS-Protection: 0` (correct modern guidance — the legacy XSS auditor is disabled in favor of CSP, per current OWASP recommendations).

### CFG-05 — No CSP violation reporting configured — **Low**
The CSP has no `report-to`/`report-uri` directive. If a future change accidentally introduced a CSP-violating pattern, the browser would silently block it in production with no alert to anyone. Not urgent (would require standing up a reporting endpoint, which means adding a backend), but worth planning for.

---

## 6. Unsafe AI Integrations

### AI-01 — The shipped AI feature is safe by construction — **Informational (Pass)**
The one AI-branded feature in the app, the "AI Triage Assistant" (`assets/js/simulator.js`), is confirmed to be fully rule-based: a fixed array of regex-matched templates with zero `fetch()` calls, zero API keys, and zero external dependencies. There is no prompt-injection surface (no real model is being prompted) and no key-exposure surface (no key exists). This is a deliberate, and confirmed, contrast to the "hardcoded LLM key + unsanitized output" pattern the Security Review Lab teaches people to spot.

### AI-02 — No written policy prevents a future unsafe AI integration — **Low (process gap)**
Nothing in the repo *documents* the rule "AI/LLM calls must go through a backend, never hold a key in client code" as an actual engineering policy — it currently exists only as training content inside the Security Review Lab, which a future contributor extending the app might never read. If someone later wires the AI Triage Assistant up to a real LLM API "to make it smarter," there is nothing in `SECURITY.md` or a contributing guide stopping them from reproducing the exact anti-pattern the app teaches against.

---

## 7. Public Repositories / Exposed Data

### REPO-01 — Repository has not yet been published — **Informational**
At the time of this assessment, the codebase has not been pushed to GitHub or any public host. This assessment covers *repo-readiness*, not live exposure, because there is no live repository yet to scan.

### REPO-02 — `.gitignore` and secret posture are ready for public release — **Informational (Pass, contingent on CFG-01)**
`.gitignore` correctly excludes `.env*` (with an explicit `.env.example` allowlist exception), OS/editor artifacts, and `.vercel`. Combined with SEC-01 (no real secrets found), the repository is safe to make public *once* the CFG-01 placeholders are resolved with real values.

### REPO-03 — Branch protection cannot be verified from the file tree — **Low**
CI workflows (`secret-scan.yml`, `static-checks.yml`) exist and pass locally, but whether they're actually *required* to pass before a merge to `main` is a GitHub repository setting, not something expressible in a file. Until branch protection rules are configured, these checks are advisory only — a maintainer could merge past a failing check without noticing.

---

## 8. General Attack Surface Exposure

### SURF-01 — Minimal attack surface by architecture — **Informational (Pass)**
No backend, no database, no API routes, no cookies, and (per FE-04) no third-party scripts. This is an unusually small surface for an 8-page, feature-rich application, and it's the direct result of the "static site, all state in the browser" architectural choice.

### SURF-02 — See AUTH-03 — **Medium (Fixed)**
The most significant real attack-surface item in this app was never network-facing — it was the cross-participant data bleed from an incomplete logout, now fixed.

### SURF-03 — Route inventory confirmed clean — **Informational (Pass)**
Every page and static asset (`index.html` through `response.html`, CSS, JS, `robots.txt`, `security.txt`, `SECURITY.md`) was smoke-tested over a local HTTP server and returned `200` with no unintended routes, no directory listing, and no stray files exposed.

---

## Severity Summary Table

| ID | Finding | Base | Contextual | Status |
|---|---|---|---|---|
| SEC-01 | No real secrets found | — | Informational (Pass) | Confirmed |
| SEC-02 | Fictional secret may trip 3rd-party scanners | — | Low | Open |
| INP-01 | `sanitizeText()` is defense-in-depth only | — | Low | Open (by design, document it) |
| INP-02 | Client-only validation | High | Informational | Open (accepted for now) |
| AUTH-01 | Fully simulated auth | Critical | Informational | Open (accepted, disclosed) |
| AUTH-02 | Session forgeable via devtools | High | Low | Open (accepted, disclosed) |
| AUTH-03 | Logout didn't clear prior data | — | Medium | **Fixed** |
| FE-01 | No unescaped DOM sinks | — | Informational (Pass) | Confirmed |
| FE-02 | CSP `style-src unsafe-inline` | — | Low | Open |
| FE-03 | No Trusted Types | — | Low | Open |
| FE-04 | No 3rd-party scripts | — | Informational (Pass) | Confirmed |
| CFG-01 | Placeholder contact/domain/name | — | Medium | Partially fixed (domain resolved; email/name still needed) |
| CFG-02 | Actions pinned by tag not SHA | — | Low | Open |
| CFG-03 | No Dependabot for Actions | — | Informational | **Fixed** |
| CFG-04 | Security headers complete | — | Informational (Pass) | Confirmed |
| CFG-05 | No CSP reporting endpoint | — | Low | Open |
| AI-01 | Shipped AI feature is safe | — | Informational (Pass) | Confirmed |
| AI-02 | No written safe-AI policy | — | Low | Open |
| REPO-01 | Not yet published | — | Informational | N/A |
| REPO-02 | `.gitignore`/secrets ready | — | Informational (Pass) | Confirmed |
| REPO-03 | Branch protection unverifiable from files | — | Low | Open (GitHub setting) |
| SURF-01 | Minimal architecture-level surface | — | Informational (Pass) | Confirmed |
| SURF-02 | (= AUTH-03) | — | Medium | **Fixed** |
| SURF-03 | Route inventory clean | — | Informational (Pass) | Confirmed |

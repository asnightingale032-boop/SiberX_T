# Security Policy

SiberX Crisis Command Platform is a **fictional training simulation**. It has
no backend, no real user accounts, and no real transit or company data. That
said, the app itself is real code, and we treat its security seriously —
partly because it's good practice, and partly because the app's whole premise
is teaching good practice.

## Scope

**In scope** — reports about the actual web application are welcome:
- Cross-site scripting (XSS), DOM-based or reflected
- Ways to bypass the client-side session/MFA flow
- Any evidence of a secret, key, or token actually committed to this repo
- CSP or security-header bypasses
- Any way this static site could be made to make an unintended network request

**Out of scope:**
- The fictional "vulnerabilities" inside `assets/js/security-review.js` —
  those are intentional training content (a "spot the bug" exercise), not
  real bugs in the app itself.
- The fictional narrative content (news updates, alerts, chat scripts) —
  these are scenario flavor text, not a factual claim about anything real.
- Anything requiring physical or social-engineering access to a maintainer's
  machine or accounts.

## Reporting a Vulnerability

Please report findings privately rather than opening a public issue:

- Email: **security@example.com** (placeholder — replace with a real
  address you control before publishing this repo)
- Or see `/.well-known/security.txt`, published per [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)

Please include:
1. A clear description of the issue and its impact
2. Steps to reproduce (a minimal example is ideal)
3. Any suggested fix, if you have one

## Response Expectations

This is a small demo/training project, not a funded security team, so please
treat these as best-effort targets rather than guarantees:

- Acknowledgement: within 5 business days
- Initial assessment: within 10 business days
- Fix or mitigation: timeline depends on severity, communicated after triage

## What We Do to Stay Secure

- **No secrets in the codebase.** There is nothing to leak because nothing
  sensitive is stored here — see `.gitignore` and `.env.example`.
- **Strict Content-Security-Policy** with no `unsafe-inline`/`unsafe-eval`
  for scripts, enforced via `vercel.json`.
- **All user-supplied text is sanitized on entry and escaped on render**
  (see `sanitizeText` / `escapeHtml` in `assets/js/app.js`).
- **No inline event handlers** (`onclick="..."` etc.) anywhere in the HTML —
  every interaction is bound with `addEventListener`, which is what makes
  the strict CSP above possible in the first place.
- **Zero third-party scripts or font requests** — everything is served
  same-origin, reducing what an attacker (or a compromised dependency)
  could ever reach.
- **Automated checks on every push**: `.github/workflows/secret-scan.yml`
  runs gitleaks, and `.github/workflows/static-checks.yml` blocks
  `eval`/`document.write`, inline event handlers, and obvious hardcoded
  secrets before they can land on `main`.
- **Client-side session expiry** — a signed-in session times out after 30
  minutes of inactivity.

For a guided walkthrough of these ideas — including deliberately vulnerable
*examples* to practice spotting — open the app and visit the **Security
Review Lab** page.

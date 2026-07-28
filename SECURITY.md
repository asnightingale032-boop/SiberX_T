Security Policy
SiberX Crisis Command Platform is a fictional training simulation. It has
no backend, no real user accounts, and no real transit or company data. That
said, the app itself is real code, and we treat its security seriously —
partly because it's good practice, and partly because the app's whole premise
is teaching good practice.
Scope
In scope — reports about the actual web application are welcome:
Cross-site scripting (XSS), DOM-based or reflected
Ways to bypass the client-side session/MFA flow
Any evidence of a secret, key, or token actually committed to this repo
CSP or security-header bypasses
Any way this static site could be made to make an unintended network request
Out of scope:
The fictional "vulnerabilities" inside `assets/js/security-review.js` —
those are intentional training content (a "spot the bug" exercise), not
real bugs in the app itself.
The fictional narrative content (news updates, alerts, chat scripts) —
these are scenario flavor text, not a factual claim about anything real.
Anything requiring physical or social-engineering access to a maintainer's
machine or accounts.
Reporting a Vulnerability
Please report findings privately rather than opening a public issue:
Email: security@siberx-transit.com
Or see `/.well-known/security.txt`, published per RFC 9116
Please include:
A clear description of the issue and its impact
Steps to reproduce (a minimal example is ideal)
Any suggested fix, if you have one
Response Expectations
This is a small demo/training project, not a funded security team, so please
treat these as best-effort targets rather than guarantees:
Acknowledgement: within 5 business days
Initial assessment: within 10 business days
Fix or mitigation: timeline depends on severity, communicated after triage
What We Do to Stay Secure
No secrets in the codebase. There is nothing to leak because nothing
sensitive is stored here — see `.gitignore` and `.env.example`.
Strict Content-Security-Policy with no `unsafe-inline`/`unsafe-eval`
for scripts or styles, `require-trusted-types-for 'script'`, and CSP
violation reporting to `/api/csp-report` — enforced via `vercel.json`.
Structural output escaping. Every dynamic value written to the DOM
goes through the `html` auto-escaping tagged template or direct
`createElement`/`textContent` construction in `assets/js/app.js` — not
a manually-called escaping function that a new call site could forget.
A CI check blocks any un-tagged `.innerHTML =` template literal with an interpolation.
No inline `style=""` attributes anywhere — same reasoning as
script-src: a CI check blocks their reintroduction, which is what lets
`style-src` stay free of `'unsafe-inline'` too.
Subresource Integrity on every stylesheet and script tag, so a
tampered or swapped asset is refused by the browser rather than executed.
State lives in `sessionStorage`, not `localStorage`, whitelisted
field-by-field on load with type/range checking — a tampered or replayed
storage blob is discarded rather than trusted. Cleared on explicit
logout and automatically when the tab/window closes.
No inline event handlers (`onclick="..."` etc.) anywhere in the HTML —
every interaction is bound with `addEventListener`.
Zero third-party scripts or font requests — everything is served
same-origin, reducing what an attacker (or a compromised dependency)
could ever reach.
Automated checks on every push: `.github/workflows/secret-scan.yml`
runs gitleaks (both per-push and, on a schedule, over full git history),
and `.github/workflows/static-checks.yml` blocks `eval`/`document.write`,
inline event handlers, inline styles, un-escaped innerHTML
interpolation, and obvious hardcoded secrets before they can land on
`main`. GitHub Actions are pinned to commit SHAs, not mutable tags.
Client-side session expiry — a signed-in session times out after 30
minutes of inactivity, and stored state older than 24 hours is discarded
outright regardless of login state.
For a guided walkthrough of these ideas — including deliberately vulnerable
examples to practice spotting — open the app and visit the Security
Review Lab page.
Forward Guidance for Future Changes
These rules don't apply to anything in the app today — nothing here has a
backend, sets a cookie, or calls a real AI API — but they're written down
now so a future change doesn't have to rediscover them:
If a backend is ever added: secrets (API keys, database credentials,
etc.) must live only in server-side environment variables or a secrets
manager, and must never be shipped to the client in any form — no
exceptions for "just for now" or internal tools. Client-side validation in
this codebase (`sanitizeText`, `NAME_ALLOWLIST`, etc.) was never a
substitute for server-side validation and must be re-derived from scratch
at that point.
If real cookies are ever introduced (e.g., server-backed
authentication): set them `Secure`, `HttpOnly`, and `SameSite=Strict`, and
scope them as narrowly as possible. There are no cookies in this
application today by design.
If an AI/LLM integration is ever added beyond the existing rule-based
"AI Triage Assistant": it must call a backend that holds the provider's
API key — the browser must never hold that key directly — and model output
must be treated as untrusted text (escaped via `html` or `textContent`,
never inserted with a bare `innerHTML =`) before it reaches the DOM,
exactly like any other untrusted string. The "Unsafe AI Integrations"
finding in the Security Review Lab (`security-review.html`) shows precisely
what not to do — a real key hardcoded in browser JS, with raw model
output written via `innerHTML`.

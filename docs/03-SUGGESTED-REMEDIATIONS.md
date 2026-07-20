# Suggested Remediations — SiberX Crisis Command Platform

Strategic view of what to do about each finding, grouped by priority. For exact commands, code diffs, and click-by-click steps, see `05-REMEDIATION-INSTRUCTIONS.md`.

## Priority 1 — Do before making the repo public or sharing the live URL

| Finding | Recommendation |
|---|---|
| AUTH-03 / SURF-02 | **Done.** Logout now clears all exercise state, not just identity. |
| CFG-01 | **Domain resolved** — `security.txt` now points to the real live URL, https://siberx-t.vercel.app/. Still needed: replace `security@example.com` in `SECURITY.md` with a real contact address, and `[Your Name]` in `LICENSE` with the real copyright holder. Both require information only you have. |
| CFG-03 | **Done.** `.github/dependabot.yml` added for the `github-actions` ecosystem. |
| REPO-03 | Once the repo exists on GitHub: Settings → Branches → add a protection rule on `main` requiring the `Secret Scan` and `Static Security Checks` jobs to pass before merge. This is a five-minute setting, but without it the CI you already have is advisory, not enforced. |

## Priority 2 — Worth doing soon, not urgent

| Finding | Recommendation |
|---|---|
| AUTH-01 / AUTH-02 | Keep the simulated login exactly as it is — it's correctly scoped for a training tool and clearly disclosed. The only action item is **process**, not code: never reuse this login pattern (accept-anything credentials, forgeable client-side session) in a project that has real users or real data behind it. Treat this as a permanent rule, not a one-time note. |
| CFG-02 | Pin `actions/checkout@v4` and `gitleaks/gitleaks-action@v2` to their current commit SHAs instead of tags. Dependabot (now configured) will keep the pin current going forward via automated PRs. |
| FE-02 | If you ever add a feature that puts *user-typed* text into a `style="..."` attribute, refactor it to use `element.style.setProperty()` on a fixed allowlist of CSS custom properties instead of string-interpolating into a `style` attribute — then `'unsafe-inline'` can be dropped from `style-src` entirely. Not urgent today because no current code path does this. |
| AI-02 | Add a short, explicit rule to `SECURITY.md` or a `CONTRIBUTING.md`: *"Any AI/LLM integration must call a backend that holds the API key; the browser must never hold a model provider key."* Point to the Security Review Lab's own "Unsafe AI Integrations" finding as the canonical bad example. |

## Priority 3 — Nice-to-have hardening

| Finding | Recommendation |
|---|---|
| FE-03 | Consider adopting a Trusted Types CSP policy (`require-trusted-types-for 'script'`) as a structural backstop to the manual escaping discipline that FE-01 confirms is currently correct. This is meaningfully more work (every DOM-writing site needs a Trusted Types–compatible policy function) and is best scheduled as its own piece of work rather than bolted on. |
| CFG-05 | If a backend is ever added to this project for any reason, stand up a CSP reporting endpoint (`report-to`) at the same time, so CSP violations surface instead of failing silently. |
| INP-01 / INP-02 | No code change needed today — both are accepted, documented trade-offs of a backend-free architecture. Revisit the moment a real backend is introduced: server-side validation must be re-derived from scratch at that point; client-side checks were never a substitute for it. |
| SEC-02 | No code change needed — already allowlisted correctly in this repo's own tooling. Just be prepared to manually dismiss it if a different organization's scanner (that doesn't read `.gitleaks.toml`) flags it later. |

## What "good" looks like once Priority 1 and 2 are complete

- No open Medium-or-higher findings with real, current exploitability.
- A public repo with a working disclosure contact and complete license.
- Enforced (not just present) CI checks on every merge to `main`.
- A written rule preventing the one category of future mistake (a real AI key in client code) that this codebase currently only *teaches about* rather than *prevents*.

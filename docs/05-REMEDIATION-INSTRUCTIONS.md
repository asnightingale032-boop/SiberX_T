# Remediation Instructions — SiberX Crisis Command Platform

**Live URL:** https://siberx-t.vercel.app/

A step-by-step runbook to close every finding in `02-SECURITY-FINDINGS.md`. Items marked **✅ Already fixed** are included so you can verify the fix; everything else is an action for you to take, in order of priority.

Legend: ✅ Fixed in this revision · 🔧 Action needed from you · 📋 Ongoing/process

---

## Priority 1 — Before you make the repo public

### ✅ AUTH-03 / SURF-02 — Logout now clears all exercise data
**Already fixed.** `assets/js/app.js` — `logout()` now calls `resetState()` instead of only nulling `user`:

```js
function logout(){
  resetState();
  window.location.href = 'index.html';
}
```

**Verify it yourself:**
1. Sign in, add a case note on the Crisis Simulator page, send a chat message on the dashboard.
2. Sign out.
3. Sign in again with a different name.
4. Confirm the case notes and chat history from step 1 are gone.

---

### 🔧 CFG-01 — Replace remaining placeholder contact/name values
The domain placeholder is **already resolved** — `.well-known/security.txt` now points to the real live URL:
```
Canonical: https://siberx-t.vercel.app/.well-known/security.txt
Policy: https://siberx-t.vercel.app/SECURITY.md
```

Two values still need information only you have:

1. **Decide on a real contact address** for vulnerability reports (a personal email, a `security@` alias, or a GitHub Security Advisories link) and update:
   - `.well-known/security.txt` → `Contact:` line
   - `SECURITY.md` → the "Email:" line under **Reporting a Vulnerability**
2. **Fill in the license holder's name:**
   - `LICENSE` → `Copyright (c) 2026 [Your Name]`

**Verify:** `grep -RIn "security@example.com\|\[Your Name\]" .` should return no matches when you're done (the `REPLACE-WITH` domain placeholder is already gone).

---

### ✅ CFG-03 — Dependabot now tracks GitHub Actions
**Already fixed.** `.github/dependabot.yml` added:

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

**Verify:** once the repo is on GitHub, check the **Insights → Dependency graph → Dependabot** tab — it should list `github-actions` as a tracked ecosystem.

---

### 🔧 REPO-03 — Turn on branch protection (this is a GitHub setting, not a file)
1. Push the repo to GitHub.
2. Go to **Settings → Branches → Add branch protection rule**.
3. Branch name pattern: `main`.
4. Enable **"Require status checks to pass before merging"** and select both:
   - `Secret Scan / gitleaks`
   - `Static Security Checks / frontend-hygiene`
5. Enable **"Require a pull request before merging"** (recommended even for solo projects — it gives CI a chance to run before code lands).
6. Save.

**Verify:** try pushing directly to `main` — it should be rejected, or open a PR with a failing check and confirm the merge button is blocked.

7. **Also enable, in the same Settings area:**
   - **Settings → Code security → Secret scanning** (GitHub's native scanner, in addition to the gitleaks Action already running in CI — belt and suspenders, see "Additional Measures" below).
   - **Settings → Code security → Push protection** — blocks commits containing recognizable secret patterns *before* they're even pushed.

---

## Priority 2 — Soon, not urgent

### 📋 AUTH-01 / AUTH-02 — No code fix; adopt as a permanent rule
Nothing to change in this codebase — the simulated login is correctly scoped and disclosed for a training tool. The action item is a rule for *future* projects:

> **Never reuse this login pattern — accept-any credentials, client-side-only session state — in any project with real users or real data.** If you fork this repo as a starting point for something real, authentication is the first thing to replace, not the last.

Consider adding this exact sentence to the top of `README.md` under a "⚠️ Before you fork this" heading if you expect this repo to be reused as a template.

---

### 🔧 CFG-02 — Pin GitHub Actions to commit SHAs
1. Look up the current commit SHA for each action's version tag:
   ```bash
   git ls-remote https://github.com/actions/checkout refs/tags/v4.*
   git ls-remote https://github.com/gitleaks/gitleaks-action refs/tags/v2.*
   ```
   (Take the SHA for the latest patch release under each major tag.)
2. In both `.github/workflows/*.yml`, change:
   ```yaml
   uses: actions/checkout@v4
   ```
   to:
   ```yaml
   uses: actions/checkout@<full-40-char-sha>  # v4.x.x
   ```
   (Keep the version as a trailing comment so it stays human-readable.)
3. Repeat for `gitleaks/gitleaks-action@v2`.
4. Because `.github/dependabot.yml` is already in place (CFG-03), Dependabot will open a PR to bump these SHAs automatically whenever a new release ships — you get the SHA-pinning security benefit without manually tracking updates.

**Verify:** `grep -RIn "uses:" .github/workflows/*.yml` should show 40-character hex strings instead of `@v4`/`@v2`.

---

### 🔧 FE-02 — Remove `'unsafe-inline'` from `style-src` (only if/when needed)
No action required today — confirmed no user-controlled text currently reaches a `style="..."` attribute. **If you add a feature that does need dynamic per-user styling:**
1. Instead of:
   ```js
   el.innerHTML = `<div style="width:${value}%"></div>`;
   ```
   use a CSS custom property set via the DOM API, not string interpolation:
   ```js
   el.style.setProperty('--fill', `${clampedNumericValue}%`);
   ```
   ```css
   .fill { width: var(--fill); }
   ```
2. Once no code path interpolates into `style="..."` attributes at all, remove `'unsafe-inline'` from `style-src` in `vercel.json`.

---

### 🔧 AI-02 — Write down the safe-AI-integration rule
Add this section to `SECURITY.md` (or a new `CONTRIBUTING.md`):

```markdown
## AI / LLM Integration Policy

Any feature that calls a third-party AI/LLM API must:
1. Call the provider from a backend/serverless function, never from client-side JS.
2. Store the provider API key as a server-side environment variable, never in
   any file under `assets/` or in any HTML/JS shipped to the browser.
3. Treat model output as untrusted text: escape it before inserting into the
   DOM, exactly like any other user-supplied string.

The "Unsafe AI Integrations" example in the Security Review Lab
(`security-review.html`) shows exactly what *not* to do — a real key
hardcoded in browser JS, with raw model output written via `innerHTML`.
```

---

## Priority 3 — Nice-to-have hardening

### 🔧 FE-03 — Adopt Trusted Types (larger effort — schedule separately)
1. Add `require-trusted-types-for 'script'; trusted-types default;` to the CSP in `vercel.json`.
2. Add a small Trusted Types policy in `assets/js/app.js`:
   ```js
   if (window.trustedTypes && trustedTypes.createPolicy) {
     trustedTypes.createPolicy('default', {
       createHTML: (input) => input // already-escaped strings only — see note below
     });
   }
   ```
3. **Important:** this only adds real protection if every `innerHTML` assignment already goes through `escapeHtml()` first (FE-01 confirms this is true today) — the policy above is a backstop, not a substitute for that discipline. Treat this as a multi-file change to schedule deliberately, test thoroughly (Trusted Types will throw in the console anywhere it's violated), and roll out with feature-flag caution rather than as a quick patch.

### 🔧 CFG-05 — CSP violation reporting (only relevant once a backend exists)
Not actionable today (would require a collection endpoint). Revisit if/when this project gains any backend for any other reason — add `report-to` pointing at that backend, and self-host CSP violation logging rather than sending it to a third party.

### 📋 SEC-02 / INP-01 / INP-02 — No action needed
Already correctly handled by design; documented here only so a future reviewer doesn't waste time "fixing" something that isn't broken.

---

## Additional Cybersecurity Measures Worth Adopting (beyond this specific findings list)

These weren't findings against the current code — they're broader practices worth adding given the app is about to go from "local files" to "live, public, and possibly reused as a template":

1. **Secure your actual GitHub and Vercel accounts, not just the app.** The single highest-value security action available to you right now isn't in this codebase at all — it's turning on real two-factor authentication on the GitHub and Vercel accounts that can push code and change deployment settings. The app's simulated MFA teaches the concept; it protects nothing real. Your account credentials are what actually gates who can modify this project.
2. **Enable GitHub's native secret scanning and push protection** (see REPO-03, step 7) as a second, independent layer alongside the gitleaks Action already in CI — different tools catch different patterns, and push protection stops a leak before it's even committed, not just after.
3. **Set a recurring calendar reminder to re-run this assessment** (or a tool like it) every time a meaningful feature is added — especially anything touching state lifecycle (login/logout, new data fields) or anything that introduces a new `innerHTML` sink. This review found one real bug specifically because it asked structural questions a checklist-only pass didn't; that only stays true if it happens again periodically, not once.
4. **If you ever add a backend to this project, treat it as a full re-assessment trigger, not an incremental add-on.** Several findings here (INP-02, AUTH-01/02, CFG-05) are explicitly rated low-impact *because* there's no backend. The day one is added, every one of those ratings needs to be redone from scratch — server-side validation, real authentication, and CSP reporting are not optional "eventually" items at that point.
5. **Consider Vercel's built-in DDoS/bot mitigation and rate limiting** if this project ever sees meaningful public traffic — not a current gap (static sites are inherently cheap to serve and hard to meaningfully DoS), but worth knowing it's available rather than assuming a static site needs no traffic-layer protection at all.
6. **Keep `SECURITY.md` and `security.txt` as living documents.** Update the `Expires:` field in `security.txt` before it lapses, and revisit the response-time commitments in `SECURITY.md` if the project's maintenance level changes.
7. **If this repo is ever forked or used as a template for a real product**, require whoever does that to explicitly re-read `04-AI-ASSISTED-DEVELOPMENT-REFLECTION.md` and this runbook's Priority 1 items before launch — the fictional-context "Informational" ratings on AUTH-01/AUTH-02/INP-02 do not carry over to a real product, and treating them as if they do is the single most likely way this specific codebase could cause real harm later.

---

## Final Verification Checklist

Run through this once all Priority 1 and 2 items are complete:

- [ ] `grep -RIn "security@example.com\|\[Your Name\]" .` → no matches (domain placeholder already resolved)
- [ ] Logging out and back in as a different name shows no prior participant's data
- [ ] Branch protection on `main` requires both CI workflows to pass
- [ ] GitHub native secret scanning + push protection enabled
- [ ] GitHub Actions pinned to commit SHAs (or a Dependabot PR is open to do so)
- [ ] `SECURITY.md` includes the AI Integration Policy section
- [ ] Real 2FA is enabled on the GitHub and Vercel accounts controlling this project
- [ ] This document's "Priority 3" items are scheduled, even if not done yet

# Release Checklist

Run through this before publishing a new version of the deployed site, per
the Secrets Management recommendation ("add that swap to a release
checklist").

## Every release

- [ ] `node --check` passes on every file in `assets/js/` and `api/`
- [ ] No `style=""` attributes exist anywhere in `*.html` or JS-generated
      markup (`grep -RIn 'style="' *.html`) — required for the CSP's
      `style-src` to stay free of `'unsafe-inline'`
- [ ] No un-tagged `.innerHTML =` template literal with a `${...}`
      interpolation bypasses the `html` auto-escaping helper in
      `assets/js/app.js`
- [ ] SRI hashes are current: run `bash scripts/generate-sri.sh` and
      confirm every `<script>`/`<link>` `integrity=""` value in every
      `*.html` file matches (a stale hash fails safe — the browser blocks
      the asset — but it does mean the page will look visibly broken)
- [ ] `.gitleaks.toml`'s allowlist still only covers
      `assets/js/security-review.js` — confirm no other file needed an
      exception before merging
- [ ] `gitleaks` and `static-checks` CI workflows are both green
- [ ] `security.txt` is reachable at the real path:
      `https://<your-domain>/.well-known/security.txt` (not
      `.wellknown/secutiry.txt` or any other typo'd path — this has
      happened before on this project, see SECURITY_FINDINGS.md, CFG-06)

## Before making the repository public / first deploy

- [ ] Real contact address is set in both `SECURITY.md` and
      `.well-known/security.txt` — not `security@example.com`
- [ ] Real name is set in `LICENSE` — not `[Your Name]`
- [ ] Real domain is set in `.well-known/security.txt`'s `Canonical` and
      `Policy` fields
- [ ] Branch protection is enabled on `main`, requiring `Secret Scan` and
      `Static Security Checks` to pass before merge
- [ ] GitHub's native secret scanning + push protection are enabled
      (Settings → Code security), as a second layer alongside gitleaks
- [ ] Real two-factor authentication is enabled on the GitHub and Vercel
      accounts that control this project — this protects the project more
      than anything in the codebase itself

## Whenever a dependency/Action bump PR appears (Dependabot)

- [ ] Read the linked release notes for breaking changes, not just the
      version diff
- [ ] Confirm CI passes on the PR before merging
- [ ] If it's a major version bump, re-run `scripts/generate-sri.sh` only
      if the bump touched `assets/` (Action bumps do not affect SRI)
- [ ] After merging, re-pin the new version to its commit SHA in the
      relevant `.github/workflows/*.yml` file (Dependabot bumps the tag
      reference; re-verify a SHA is used) — this project also uses
      SHA-pinned Actions, so a Dependabot-authored PR that bumps a
      version tag still needs the SHA form applied by hand or via a SHA-
      pinning tool before merge

## If this repository is ever forked or used as a template for a real product

- [ ] Read `docs/04-AI-ASSISTED-DEVELOPMENT-REFLECTION.md` and this
      checklist's "Priority 1" items in the security assessment first
- [ ] Replace the simulated login/MFA flow — it is intentionally
      accept-anything and must never be reused where real access control
      matters
- [ ] Re-derive server-side input validation from scratch — nothing here
      was ever meant to substitute for it

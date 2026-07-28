# SiberX Crisis Command Platform

An immersive, fictional cyber-crisis training simulation built around
**SiberX Transit Systems** — a made-up transit operator hit by a coordinated
attack on its digital signage, PA systems, mobile app, and interconnected
microservices, with an insider-assisted compromise thrown in.

It's a static site with one deliberate, minimal exception: no build step, no
npm dependencies, and every page is plain HTML/CSS/JS. All "live" data
(alerts, chat, scores, submissions) is generated client-side and stored in
your browser's `sessionStorage` — cleared automatically when the tab or
window closes, in addition to being wiped on explicit sign-out. Nothing you
type into this app is ever transmitted anywhere. The one exception is
`api/csp-report.js`, a single stateless serverless function that only
receives the browser's own CSP violation reports and logs them — see
[Security, for real](#security-for-real).

This version also ships a genuine security posture — see
[**Security, for real**](#security-for-real) below — plus a dedicated
**Security Review Lab** where you practice the exact review skills the brief
asked for: spotting exposed secrets, input-validation gaps, front-end
vulnerabilities, misconfigurations, broken auth logic, unsafe AI
integrations, and unnecessary attack surface.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Sign in — two-step flow: name/role, then a simulated 6-digit MFA code. Any values work; nothing is transmitted. |
| `dashboard.html` | Executive dashboard: KPIs, transit line status, live alert feed, executive actions, crisis command chat, and a site security-posture summary. |
| `simulator.html` | Interactive crisis console: animated system topology map, hijacked-channel transcript, containment/eradication actions, a forensic case notebook, and a safe rule-based **AI Triage Assistant**. |
| `decisions.html` | Six-stage branching decision simulator with a running scorecard and a post-incident debrief. |
| `security-review.html` | **Vulnerability assessment lab.** Seven realistic (but inert) findings to review — exposed secrets, input validation, front-end XSS, misconfigurations, auth logic, unsafe AI integration, and attack-surface exposure — plus a live check of this site's own HTTP security headers. |
| `news.html` | ODTN News–style live incident coverage: breaking bar, live updates, rider quotes, tip form. |
| `training.html` | Short training modules plus a scored quiz. |
| `response.html` | Public-facing breach notice: what happened, FAQ, a simulated "am I affected" tool, and a report form. |

## Run locally

```bash
npm run dev
# equivalent to: python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html`.

> Note: the security headers below (CSP, HSTS, etc.) are applied by Vercel's
> edge network per `vercel.json` — they won't show up when previewing with a
> plain local file server. The Security Review Lab's live header check
> explains this in place and tells you what to expect.

## Deploy to Vercel

This repo is ready to push to GitHub and import into Vercel as-is — no build
command, no environment variables, no framework preset needed (choose
"Other" if asked).

```bash
npm i -g vercel   # one-time
vercel            # preview deploy
vercel --prod     # promote to production
```

or: push to GitHub → Vercel dashboard → **Add New Project** → import the repo.

After your first deploy, update the placeholder domain in
`.wellknown/security.txt` and in `SECURITY.md` to your real
`*.vercel.app` URL (or custom domain). See `RELEASE_CHECKLIST.md` for the
full pre-launch checklist.

## Live deployment

**https://siberx-t.vercel.app/**

## Security, for real

This project doesn't just *simulate* a security-conscious organization — it
tries to *be* one. A full self-assessment (findings, severity ratings,
remediations, and a reflection on AI-assisted development's security
impact) lives in **[`docs/`](./docs/00-INDEX.md)** — start there if you want
the detailed picture, including one real bug that was found and fixed.

Summary of what's in place today:

- **No secrets anywhere in the codebase.** Nothing here needs an API key, so
  none exist to leak. `.gitignore` still blocks `.env*` as a guardrail.
- **Strict Content-Security-Policy** — `script-src 'self'` *and*
  `style-src 'self'`, neither with `unsafe-inline`, plus
  `require-trusted-types-for 'script'`, CSP violation reporting, HSTS,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy`, and
  COOP/CORP — all set in [`vercel.json`](./vercel.json).
- **Zero inline anything.** No inline `onclick="..."`, no inline
  `style="..."` anywhere in the codebase — both are enforced by CI, not
  just by discipline. That's what makes the CSP above actually
  enforceable rather than theoretical.
- **Structural output escaping.** Every dynamic value written to the DOM
  goes through the auto-escaping `html` tagged template or direct
  `createElement`/`textContent` construction (see `assets/js/app.js`) —
  not a manually-invoked escaping function a call site could forget to
  use. A CI check blocks any un-escaped `.innerHTML` interpolation.
- **Subresource Integrity** on every stylesheet and script tag — a
  tampered or swapped asset is refused by the browser. Regenerate with
  `scripts/generate-sri.sh` after editing any CSS/JS file.
- **State lives in `sessionStorage`**, whitelisted field-by-field on load
  with type/range coercion (`coerceState()`) — a hand-edited or replayed
  storage blob is discarded rather than trusted, and is cleared both on
  explicit logout and automatically when the tab/window closes.
- **Zero third-party requests.** Fonts are a system stack, not a Google
  Fonts import — there is no third-party domain this site talks to at all
  except itself.
- **Session auto-expiry** after 30 minutes of inactivity, with a clear
  "session expired" message on the way back to sign-in, plus a hard
  24-hour cap on stored state regardless of login status.
- **`.vercelignore`** restricts the deployed surface to exactly the app
  pages, assets, and the one API route — assessment docs, CI config, and
  scripts stay in the git repo but are never served publicly.
- **Automated CI on every push** — see `.github/workflows/`:
  - `secret-scan.yml` runs [gitleaks](https://github.com/gitleaks/gitleaks)
    on every push/PR, plus a full git-history scan on a weekly schedule.
  - `static-checks.yml` blocks `eval`/`document.write`, inline event
    handlers, inline styles, un-escaped `innerHTML` interpolation, and
    obvious hardcoded secrets before merge.
  - Both workflows pin GitHub Actions to commit SHAs, not mutable tags.
- **[`SECURITY.md`](./SECURITY.md)** and **[`/.well-known/security.txt`](./.well-known/security.txt)**
  publish a real, RFC 9116–compliant vulnerability-disclosure path, with
  forward guidance for secrets/cookies/AI integrations if this project
  ever grows a real backend.
- **The Security Review Lab is intentionally the one place fake
  vulnerabilities live** — `assets/js/security-review.js` contains clearly
  fictional, non-functional example snippets used as training content. Both
  CI checks and `.gitleaks.toml` explicitly allowlist that one file so
  legitimate training material doesn't trip the very checks it's teaching
  people about.

## Project structure

```
siberx/
├── index.html                     sign in (2-step + simulated MFA)
├── dashboard.html                 executive dashboard
├── simulator.html                 crisis simulator + AI triage assistant
├── decisions.html                 branching decision simulator
├── security-review.html           vulnerability assessment lab
├── news.html                      ODTN News coverage
├── training.html                  training portal + quiz
├── response.html                  public breach response page
├── 404.html                        static, generic — reflects no request data
├── api/csp-report.js               CSP violation report collector (Vercel function)
├── assets/
│   ├── css/style.css               design system (system fonts only)
│   └── js/                         one file per page + shared app.js
├── scripts/generate-sri.sh         regenerates SRI hashes after asset changes
├── docs/                           full security assessment (not deployed — see .vercelignore)
├── .well-known/security.txt        RFC 9116 disclosure contact
├── .github/workflows/              secret-scan.yml, static-checks.yml
├── .gitleaks.toml                  allowlist for intentional training content
├── .gitignore / .env.example / .vercelignore
├── vercel.json                     security headers + clean URLs
├── SECURITY.md
├── RELEASE_CHECKLIST.md
├── LICENSE
└── package.json
```

## Notes

- This is an educational tabletop exercise. SiberX Transit Systems, ODTN
  News, and every named person, vendor, and event are fictional.
- All login/auth is a client-side simulation for the exercise — there is no
  server to authenticate to, which is also why no real credentials should
  ever be typed into it.

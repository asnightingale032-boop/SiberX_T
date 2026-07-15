# SiberX Crisis Command Platform

An immersive, fictional cyber-crisis training simulation built around
**SiberX Transit Systems** — a made-up transit operator hit by a coordinated
attack on its digital signage, PA systems, mobile app, and interconnected
microservices, with an insider-assisted compromise thrown in.

It's a static site: no backend, no build step, no dependencies. Every page is
plain HTML/CSS/JS, and all "live" data (alerts, chat, scores, submissions) is
generated client-side and stored in your browser's `localStorage`. Nothing
you type into this app is ever transmitted anywhere.

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
`.well-known/security.txt` and in `SECURITY.md` to your real
`*.vercel.app` URL (or custom domain).

## Security, for real

This project doesn't just *simulate* a security-conscious organization — it
tries to *be* one:

- **No secrets anywhere in the codebase.** Nothing here needs an API key, so
  none exist to leak. `.gitignore` still blocks `.env*` as a guardrail.
- **Strict Content-Security-Policy**, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  a locked-down `Permissions-Policy`, HSTS, and COOP/CORP — all set in
  [`vercel.json`](./vercel.json).
- **script-src 'self' with no `unsafe-inline`** — every single script is an
  external file, and there is not one inline `onclick="..."` (or similar)
  anywhere in the HTML. That's what makes the strict CSP above actually
  enforceable rather than theoretical.
- **Input is sanitized on entry and escaped on render**, everywhere user
  text flows through the app (chat, notes, tips, reports) — see
  `sanitizeText()` / `escapeHtml()` in `assets/js/app.js`.
- **Zero third-party requests.** Fonts are a system stack, not a Google
  Fonts import — there is no third-party domain this site talks to at all
  except itself.
- **Session auto-expiry** after 30 minutes of inactivity, with a clear
  "session expired" message on the way back to sign-in.
- **Automated CI on every push** — see `.github/workflows/`:
  - `secret-scan.yml` runs [gitleaks](https://github.com/gitleaks/gitleaks)
    against the whole repo.
  - `static-checks.yml` blocks `eval`/`document.write`, inline event-handler
    attributes, and obvious hardcoded-secret patterns before merge.
- **[`SECURITY.md`](./SECURITY.md)** and **[`/.well-known/security.txt`](./.well-known/security.txt)**
  publish a real, RFC 9116–compliant vulnerability-disclosure path.
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
├── assets/
│   ├── css/style.css               design system (system fonts only)
│   └── js/                         one file per page + shared app.js
├── .well-known/security.txt        RFC 9116 disclosure contact
├── .github/workflows/              secret-scan.yml, static-checks.yml
├── .gitleaks.toml                  allowlist for intentional training content
├── .gitignore / .env.example
├── vercel.json                     security headers + clean URLs
├── SECURITY.md
├── LICENSE
└── package.json
```

## Notes

- This is an educational tabletop exercise. SiberX Transit Systems, ODTN
  News, and every named person, vendor, and event are fictional.
- All login/auth is a client-side simulation for the exercise — there is no
  server to authenticate to, which is also why no real credentials should
  ever be typed into it.

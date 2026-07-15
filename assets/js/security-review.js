requireAuth();
renderControlBar('security-review.html');

/* -----------------------------------------------------------------------
   Every snippet below is illustrative and inert — none of it is working
   exploit code, and none of it touches a real system. The goal is
   pattern recognition: the same shapes show up in real code review and
   real vulnerability scanners (Semgrep, CodeQL, Snyk, etc). Fictional
   values only (e.g. the "API key" is a random-looking placeholder, not
   a real credential of any kind).
   ----------------------------------------------------------------------- */

const FINDINGS = [
  {
    id: 'secrets',
    title: 'Exposed Secrets & API Keys',
    severity: 'critical',
    system: 'siberx-signage-client.js',
    code:
`const client = new TransitAI({
  apiKey: "sk_live_4f9a2b8e7c1d4a3b9f0e6c2d8a7b5e31",
  endpoint: "https://api.siberx-ai.internal/v1/chat"
});`,
    verdict: 'vulnerable',
    options: [
      'This is fine — API keys are supposed to live in the client so the browser can call the service directly.',
      'A live API key is hardcoded directly into client-side JavaScript, so anyone who opens dev tools or views source can steal it.',
      'The endpoint URL is too long and should be shortened.',
      'The variable should be named api_Key instead of apiKey.'
    ],
    correct: 1,
    explanation: 'Anything shipped in front-end JavaScript is public, full stop — view-source or the network tab exposes it instantly. Secrets belong server-side, injected at runtime from environment variables (or a secrets manager), and the browser should talk to your own backend, never directly to a third-party API with a live key.'
  },
  {
    id: 'input',
    title: 'Input Validation',
    severity: 'critical',
    system: 'rider-lookup-service (pseudocode)',
    code:
`app.get('/api/rider-lookup', (req, res) => {
  const q = "SELECT * FROM riders WHERE card_id = '"
          + req.query.card + "'";
  db.execute(q, (err, rows) => res.json(rows));
});`,
    verdict: 'vulnerable',
    options: [
      'Missing a HTTPS redirect.',
      'The card_id value from the URL is concatenated directly into a SQL string — classic SQL injection.',
      'The response should be XML instead of JSON.',
      'db.execute should be renamed to db.query.'
    ],
    correct: 1,
    explanation: 'Untrusted input flowing straight into a query string lets an attacker supply something like \' OR \'1\'=\'1 and read (or delete) the whole table. Use parameterized queries / prepared statements, and validate the shape of input (e.g. card IDs should match a fixed pattern) before it ever reaches the database layer.'
  },
  {
    id: 'frontend',
    title: 'Front-End Vulnerabilities',
    severity: 'high',
    system: 'siberx-app-banner.js',
    code:
`function showAlert(msg) {
  document.getElementById('banner').innerHTML = msg;
}
const notice = new URLSearchParams(location.search).get('notice');
showAlert(notice);`,
    verdict: 'vulnerable',
    options: [
      'This is a safe, standard way to show a banner message.',
      'Reflected cross-site scripting — an attacker-controlled URL parameter is written into the page via innerHTML with no escaping.',
      'URLSearchParams is deprecated and should not be used.',
      'The function name should be showBanner instead of showAlert.'
    ],
    correct: 1,
    explanation: 'Anything read from location.search is attacker-controlled — a crafted link like ?notice=<img src=x onerror=...> executes in the victim\u2019s browser the moment they open it. Use textContent for plain text, and if HTML is genuinely required, escape it or run it through a sanitizer first.'
  },
  {
    id: 'misconfig',
    title: 'Misconfigurations',
    severity: 'medium',
    system: 'edge response headers (observed)',
    code:
`Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
X-Powered-By: Express/4.17.1
Server: nginx/1.14.0 (Ubuntu)`,
    verdict: 'vulnerable',
    options: [
      'Nothing unusual — these are typical default headers.',
      'A wildcard CORS origin combined with allow-credentials is a dangerous misconfiguration, and version-revealing headers hand attackers a recon shortcut.',
      'Headers should be written in lowercase to be valid.',
      'There are too many headers being sent.'
    ],
    correct: 1,
    explanation: '`Access-Control-Allow-Origin: *` paired with credentials is exactly the combination browsers try to protect against, and reflects an overly permissive intent. Meanwhile `X-Powered-By` / detailed `Server` strings tell an attacker your exact framework and OS version — free reconnaissance you should not be handing out. Compare this to SiberX\u2019s own vercel.json, which sets a strict CSP and omits stack-revealing headers entirely.'
  },
  {
    id: 'auth',
    title: 'Authentication Logic',
    severity: 'critical',
    system: 'legacy-admin-login (pseudocode)',
    code:
`function login(user, pass) {
  if (user === "admin") {
    return { role: "admin", token: btoa(user) };
  }
  return checkNormalUser(user, pass);
}`,
    verdict: 'vulnerable',
    options: [
      'This is fine — admin is a special, trusted username.',
      'The password is never checked for the admin path — anyone who simply sends username "admin" is granted admin, and the "token" is just base64 (not signed, not encrypted, trivially forged).',
      'btoa runs too slowly for production use.',
      'The role field should be capitalized as "Admin".'
    ],
    correct: 1,
    explanation: 'This is a broken-authentication / privilege-escalation bug hiding behind a special case: the password check is skipped entirely for one username. And base64 is an encoding, not a cryptographic protection — anyone can decode or fabricate that "token" by hand. Compare to SiberX Crisis Command\u2019s own login flow, which requires a second, independent verification step before granting access to any responder, and never trusts a claimed identity on its own.'
  },
  {
    id: 'ai',
    title: 'Unsafe AI Integrations',
    severity: 'high',
    system: 'siberx-ai-triage-widget.js (hypothetical)',
    code:
`const r = await fetch("https://api.example-llm.com/v1/chat", {
  method: "POST",
  headers: { "Authorization": "Bearer sk-proj-REDACTED" },
  body: JSON.stringify({ messages: userMessages })
});
const data = await r.json();
document.getElementById('ai-reply').innerHTML = data.choices[0].text;
`,
    verdict: 'vulnerable',
    options: [
      'This is standard practice for adding an AI assistant to a page.',
      'The LLM provider is called directly from the browser with a secret key embedded in client code, and the model\u2019s raw output is inserted via innerHTML with no sanitization.',
      'The request should use GET instead of POST.',
      'messages should be a single string instead of an array.'
    ],
    correct: 1,
    explanation: 'Two stacked problems: (1) calling a paid third-party AI API straight from the browser exposes the key to instant theft, exactly like the secrets finding above; (2) rendering model output via innerHTML without sanitizing it opens a path from prompt injection straight to XSS — a manipulated response can carry executable markup. The fix is a thin backend that holds the key and forwards only the text, and treating model output like any other untrusted string on the way into the DOM. SiberX\u2019s own AI Triage Assistant (on the Crisis Simulator page) is intentionally rule-based and fully client-side with zero external calls and zero keys, specifically to avoid this pattern.'
  },
  {
    id: 'surface',
    title: 'General Attack Surface Exposure',
    severity: 'medium',
    system: 'siberx-api-gateway (route inventory)',
    code:
`Reachable from the public internet:
  /admin
  /debug
  /api/v1/*
  /internal/metrics
  /.git/
  /backup.sql`,
    verdict: 'vulnerable',
    options: [
      'More reachable endpoints means better availability — this is a good thing.',
      'Debug, internal, and backup/version-control paths should never be reachable from the public internet at all — each one is unnecessary surface for an attacker to probe.',
      'Endpoints should be renamed to use snake_case.',
      'There are too few endpoints exposed here.'
    ],
    correct: 1,
    explanation: 'Attack-surface reduction means only exposing what genuinely needs to be public. Exposed `.git` directories and stray SQL backups are among the most common real-world sources of breaches, and debug/metrics endpoints routinely leak internal state. These should be network-isolated or removed outright, not just left off a sitemap.'
  },
];

function labScore(){
  const s = getState();
  const done = Object.values(s.labProgress || {});
  const correct = done.filter(v => v.correct).length;
  return { correct, total: FINDINGS.length, attempted: done.length };
}

function renderGrid(){
  const s = getState();
  const mount = document.getElementById('lab-grid');
  mount.innerHTML = FINDINGS.map(f=>{
    const progress = (s.labProgress || {})[f.id];
    const doneClass = progress ? 'done' : '';
    const doneBadge = progress ? `<span class="pill pill--${progress.correct?'ok':'critical'}" style="float:right;"><span class="dot"></span>${progress.correct?'Correct':'Missed'}</span>` : '';
    return `
      <div class="lab-card ${doneClass}" data-finding="${f.id}" tabindex="0" role="button">
        <span class="sev sev-${f.severity}">${f.severity}</span>
        ${doneBadge}
        <h4 style="margin:6px 0 4px; font-size:15px; text-transform:none;">${escapeHtml(f.title)}</h4>
        <p class="text-sm mono" style="margin:0;">${escapeHtml(f.system)}</p>
      </div>
    `;
  }).join('');
  document.querySelectorAll('[data-finding]').forEach(card=>{
    card.addEventListener('click', ()=> openFinding(card.dataset.finding));
    card.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openFinding(card.dataset.finding); } });
  });
}

function openFinding(id){
  const f = FINDINGS.find(x=>x.id===id);
  if(!f) return;
  const s = getState();
  const already = (s.labProgress || {})[id];

  const detail = document.getElementById('finding-detail');
  detail.style.display = 'block';
  detail.innerHTML = `
    <div class="flex between center wrap gap-8">
      <div>
        <span class="sev sev-${f.severity}">${f.severity}</span>
        <h3 style="text-transform:none; margin:8px 0 2px;">${escapeHtml(f.title)}</h3>
        <p class="text-sm mono" style="margin:0;">${escapeHtml(f.system)}</p>
      </div>
    </div>
    <div class="code-block mt-16">${escapeHtml(f.code)}</div>
    <div class="verdict-row">
      <button class="btn" data-verdict="secure" type="button">Mark as Secure</button>
      <button class="btn btn-danger" data-verdict="vulnerable" type="button">Mark as Vulnerable</button>
    </div>
    <div id="verdict-followup" class="mt-16"></div>
  `;
  detail.querySelectorAll('[data-verdict]').forEach(btn=>{
    btn.addEventListener('click', ()=> handleVerdict(f, btn.dataset.verdict));
  });
  detail.scrollIntoView({ behavior:'smooth', block:'nearest' });

  if(already){
    renderFollowupResult(f, already.pickedOption);
  }
}

function handleVerdict(f, verdict){
  const follow = document.getElementById('verdict-followup');
  if(verdict !== f.verdict){
    follow.innerHTML = `
      <div class="banner" style="border-color:rgba(245,166,35,.4);">
        <span>\u26a0\ufe0f</span>
        <span>Not quite — this snippet is <b>${f.verdict}</b>. Take another look, then try again.</span>
      </div>
    `;
    return;
  }
  follow.innerHTML = `
    <p class="text-sm">Correct call \u2014 this is <b>${f.verdict}</b>. Now pinpoint exactly what's wrong:</p>
    <div id="option-list"></div>
  `;
  const list = document.getElementById('option-list');
  f.options.forEach((opt,i)=>{
    const label = document.createElement('label');
    label.className = 'quiz-opt';
    label.dataset.o = i;
    label.innerHTML = `<input type="radio" name="opt-${f.id}" value="${i}"> `;
    label.appendChild(document.createTextNode(opt));
    list.appendChild(label);
  });
  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary mt-16';
  submitBtn.type = 'button';
  submitBtn.textContent = 'Submit finding';
  submitBtn.addEventListener('click', ()=> submitOption(f, false));
  follow.appendChild(submitBtn);
}

/* isReplay=true means we're just re-displaying a previously recorded
   answer (e.g. reopening a finding you already completed) — in that
   case we must not touch state or score again, only render. */
function submitOption(f, isReplay){
  const selected = document.querySelector(`input[name="opt-${f.id}"]:checked`);
  if(!selected) return;
  const picked = Number(selected.value);
  const correct = picked === f.correct;

  document.querySelectorAll(`label.quiz-opt`).forEach(label=>{
    const oi = Number(label.dataset.o);
    label.classList.remove('correct','incorrect');
    if(oi === f.correct) label.classList.add('correct');
    else if(oi === picked) label.classList.add('incorrect');
  });

  if(!isReplay){
    const s = getState();
    s.labProgress = s.labProgress || {};
    s.labProgress[f.id] = { correct, pickedOption: picked };
    s.score.security = clamp(s.score.security + (correct ? 6 : 1), 0, 100);
    setState(s);
  }

  const follow = document.getElementById('verdict-followup');
  const explain = document.createElement('div');
  explain.className = 'banner mt-16';
  explain.style.borderColor = correct ? 'rgba(45,212,191,.4)' : 'rgba(229,57,80,.4)';
  explain.innerHTML = `<span>${correct?'\u2705':'\ud83d\udcdd'}</span><span>${escapeHtml(f.explanation)}</span>`;
  follow.appendChild(explain);

  renderGrid();
  renderScorecard();
}

function renderFollowupResult(f, pickedOption){
  handleVerdict(f, f.verdict);
  setTimeout(()=>{
    const radio = document.querySelector(`input[name="opt-${f.id}"][value="${pickedOption}"]`);
    if(radio){ radio.checked = true; submitOption(f, true); }
  }, 0);
}

function renderScorecard(){
  const { correct, total } = labScore();
  document.getElementById('lab-score').textContent = `${correct} / ${total}`;

  const s = getState();
  const rows = FINDINGS.map(f=>{
    const p = (s.labProgress||{})[f.id];
    const status = !p ? 'Not reviewed' : (p.correct ? 'Correctly identified' : 'Needs re-review');
    const tagClass = !p ? 'warn' : (p.correct ? 'ok' : 'critical');
    return `<div class="feed-row" style="grid-template-columns:150px 90px 1fr;">
      <span class="msg">${escapeHtml(f.title)}</span>
      <span class="tag tag--${tagClass}">${escapeHtml(f.severity)}</span>
      <span class="msg text-dim">${escapeHtml(status)}</span>
    </div>`;
  }).join('');
  document.getElementById('lab-report').innerHTML = `<div class="feed" style="max-height:260px;">${rows}</div>`;
}

document.getElementById('copy-report-btn').addEventListener('click', async ()=>{
  const s = getState();
  const { correct, total } = labScore();
  const lines = [
    `SiberX Crisis Command — Security Review Lab Findings Report`,
    `Reviewer: ${s.user.name} (${s.user.role})`,
    `Score: ${correct} / ${total} categories correctly assessed`,
    ``,
    ...FINDINGS.map(f=>{
      const p = (s.labProgress||{})[f.id];
      const status = !p ? 'NOT REVIEWED' : (p.correct ? 'CORRECT' : 'NEEDS RE-REVIEW');
      return `[${f.severity.toUpperCase()}] ${f.title} — ${status}`;
    }),
  ];
  const text = lines.join('\n');
  try{
    await navigator.clipboard.writeText(text);
    showToast('REPORT COPIED', 'Findings report copied to your clipboard.');
  }catch(e){
    showToast('COPY UNAVAILABLE', 'Clipboard access was blocked by the browser — select and copy the scorecard manually.');
  }
});

/* ---------- live header self-check ---------- */
const EXPECTED_HEADERS = [
  { key:'content-security-policy', label:'Content-Security-Policy' },
  { key:'x-frame-options', label:'X-Frame-Options' },
  { key:'x-content-type-options', label:'X-Content-Type-Options' },
  { key:'referrer-policy', label:'Referrer-Policy' },
  { key:'permissions-policy', label:'Permissions-Policy' },
  { key:'strict-transport-security', label:'Strict-Transport-Security' },
];

async function runHeaderCheck(){
  const list = document.getElementById('header-check-list');
  const note = document.getElementById('header-check-note');
  list.innerHTML = `<p class="text-sm">Checking...</p>`;
  try{
    const res = await fetch(window.location.href, { method:'GET', cache:'no-store' });
    let anyPresent = false;
    list.innerHTML = EXPECTED_HEADERS.map(c=>{
      const present = res.headers.has(c.key);
      if(present) anyPresent = true;
      return `<div class="flex between center" style="padding:6px 0; border-bottom:1px solid var(--grid-line);">
        <span class="text-sm">${escapeHtml(c.label)}</span>
        <span class="pill pill--${present?'ok':'degraded'}"><span class="dot"></span>${present?'Present':'Not detected'}</span>
      </div>`;
    }).join('');
    note.textContent = anyPresent
      ? 'Headers detected — this deployment is serving the hardened configuration from vercel.json.'
      : 'No security headers detected in this environment. That\u2019s expected when previewing locally (e.g. python3 -m http.server): those headers are applied by Vercel\u2019s edge network per vercel.json, and will appear once deployed.';
  }catch(e){
    list.innerHTML = `<p class="text-sm">Could not run the live check in this environment.</p>`;
    note.textContent = '';
  }
}
document.getElementById('run-header-check').addEventListener('click', runHeaderCheck);

renderGrid();
renderScorecard();
renderTicker();
runHeaderCheck();

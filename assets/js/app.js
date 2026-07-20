/* ==========================================================================
   SiberX Crisis Command Platform — shared runtime
   -----------------------------------------------------------------------
   Security posture of this file (see /SECURITY.md for full detail):
   - No secrets, keys, or tokens of any kind live in this codebase.
   - All state is local to the browser (localStorage) — there is no
     backend, so there is nothing here to authenticate to or exfiltrate
     from. This is a self-contained training exercise.
   - Every render function below escapes user-supplied text before
     inserting it into the DOM (see escapeHtml). Free-text inputs are
     also constrained at entry time via sanitizeText (see below) as
     defense in depth.
   - No inline event handler attributes (onclick="") are used anywhere
     in this app — every interaction is bound with addEventListener so
     the site can run under a strict script-src 'self' CSP with no
     'unsafe-inline'. See vercel.json.
   ========================================================================== */

const SIBERX_KEY = 'siberx_state_v1';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle timeout

const DEFAULT_STATE = () => ({
  user: null, // { name, role }
  lastActivity: null,
  threatLevel: 2,
  sentiment: 61,
  availability: 78,
  systems: {
    signage:  'degraded',
    pa:       'critical',
    mobile:   'degraded',
    gateway:  'critical',
    ticketing:'ok'
  },
  lines: {
    A: { name: 'Meridian Line',     status: 'degraded' },
    B: { name: 'Harbourfront Line', status: 'ok' },
    C: { name: 'Crosstown Line',    status: 'critical' },
    D: { name: 'Danforth Loop',     status: 'ok' },
    E: { name: 'Airport Link',      status: 'degraded' }
  },
  alerts: [],
  notes: [],
  decisionsLog: [],
  submissions: [],
  score: { security: 50, trust: 50, continuity: 50, leadership: 50 },
  simStage: 0,
  decisionStage: 0,
  labProgress: {},
  incidentDeclared: false,
  startedAt: Date.now()
});

function getState(){
  try{
    const raw = localStorage.getItem(SIBERX_KEY);
    if(!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    return Object.assign(DEFAULT_STATE(), parsed);
  }catch(e){ return DEFAULT_STATE(); }
}
function setState(patch){
  const s = Object.assign(getState(), patch);
  localStorage.setItem(SIBERX_KEY, JSON.stringify(s));
  return s;
}
function resetState(){ localStorage.removeItem(SIBERX_KEY); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function nowTs(){ const d = new Date(); return d.toTimeString().slice(0,8); }

/* ---------- input handling ----------
   Belt-and-suspenders: constrain free text at the point of entry
   (strip angle brackets, cap length) in addition to escaping at the
   point of render. Neither replaces the other. */
function sanitizeText(str, maxLen){
  maxLen = maxLen || 300;
  return String(str == null ? '' : str)
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}
function isSixDigitCode(str){ return /^\d{6}$/.test(String(str||'').trim()); }
function isFourDigits(str){ return /^\d{4}$/.test(String(str||'').trim()); }

/* ---------- auth guard + session expiry ---------- */
function requireAuth(){
  const s = getState();
  if(!s.user){
    window.location.href = 'index.html';
    return s;
  }
  if(s.lastActivity && (Date.now() - s.lastActivity > SESSION_TIMEOUT_MS)){
    s.user = null;
    localStorage.setItem(SIBERX_KEY, JSON.stringify(s));
    window.location.href = 'index.html?expired=1';
    return s;
  }
  s.lastActivity = Date.now();
  localStorage.setItem(SIBERX_KEY, JSON.stringify(s));
  document.addEventListener('click', touchActivity, { passive:true });
  document.addEventListener('keydown', touchActivity, { passive:true });
  return s;
}
function touchActivity(){
  const s = getState();
  if(s.user){
    s.lastActivity = Date.now();
    localStorage.setItem(SIBERX_KEY, JSON.stringify(s));
  }
}
function logout(){
  /* Fixed per SECURITY_FINDINGS.md (AUTH-03 / SURF-02): logout used to
     null out only `user`, leaving every other field (case notes, chat
     transcripts, decision history, lab progress, submissions) intact
     in localStorage. The next person to sign in on the same browser —
     entirely plausible on a shared training-room machine — inherited
     the previous participant's data. Logout now wipes the whole
     exercise state, not just the identity field. */
  resetState();
  window.location.href = 'index.html';
}

/* ---------- control bar / nav ---------- */
const NAV_ITEMS = [
  { href:'dashboard.html',       label:'Exec Dashboard' },
  { href:'simulator.html',       label:'Crisis Simulator' },
  { href:'decisions.html',       label:'Decision Simulator' },
  { href:'security-review.html', label:'Security Review Lab' },
  { href:'news.html',            label:'ODTN News' },
  { href:'training.html',        label:'Training Portal' },
  { href:'response.html',        label:'Public Response' },
];

function renderControlBar(activeHref){
  const s = getState();
  const mount = document.getElementById('control-bar');
  if(!mount) return;
  const navHtml = NAV_ITEMS.map(item =>
    `<a href="${item.href}" class="${item.href===activeHref?'active':''}">${item.label}</a>`
  ).join('');

  mount.innerHTML = `
    <a href="dashboard.html" class="control-bar__brand" style="text-decoration:none;color:inherit;">
      <span class="dot"></span> SIBERX // CRISIS COMMAND
    </a>
    <nav class="control-bar__nav">${navHtml}</nav>
    <div class="control-bar__meta">
      <span id="clock">--:--:--</span>
      <span class="pill pill--${threatPillClass(s.threatLevel)}"><span class="dot"></span>THREAT L${s.threatLevel}</span>
    </div>
    ${s.user ? `
    <div class="control-bar__user">
      <span>${escapeHtml(s.user.name)}</span>
      <span class="role-chip">${escapeHtml(s.user.role)}</span>
      <button class="logout-btn" id="cb-logout-btn" type="button">Sign out</button>
    </div>` : ''}
  `;

  const logoutBtn = document.getElementById('cb-logout-btn');
  if(logoutBtn) logoutBtn.addEventListener('click', logout);

  setInterval(()=>{ const el=document.getElementById('clock'); if(el) el.textContent = nowTs(); }, 1000);
  const clockEl = document.getElementById('clock');
  if(clockEl) clockEl.textContent = nowTs();
}

function threatPillClass(level){
  if(level>=4) return 'critical';
  if(level>=3) return 'degraded';
  return 'ok';
}
function statusPillClass(status){
  if(status==='critical') return 'critical';
  if(status==='degraded') return 'degraded';
  if(status==='offline') return 'offline';
  return 'ok';
}

/* ---------- ticker ---------- */
function renderTicker(){
  const s = getState();
  const mount = document.getElementById('ticker');
  if(!mount) return;
  const lineText = Object.entries(s.lines).map(([code,l])=>
    `<span>LINE ${code} — ${escapeHtml(l.name)}: <b>${l.status.toUpperCase()}</b></span>`
  ).join('');
  const extra = `<span>SYSTEM AVAILABILITY: <b>${s.availability}%</b></span><span>PUBLIC SENTIMENT INDEX: <b>${s.sentiment}</b></span>`;
  mount.innerHTML = `
    <div class="ticker__label">Service Status</div>
    <div class="ticker__track"><div class="ticker__content">${lineText}${extra}${lineText}${extra}</div></div>
  `;
}

/* ---------- toasts (fake alerts) ---------- */
function showToast(title, body){
  let stack = document.getElementById('toast-stack');
  if(!stack){
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(16px)'; el.style.transition='all .3s'; setTimeout(()=>el.remove(),300); }, 6000);
}

function addAlert(tag, msg){
  const s = getState();
  s.alerts.unshift({ ts: nowTs(), tag, msg });
  s.alerts = s.alerts.slice(0,60);
  setState(s);
  return s;
}

/* ---------- output escaping ----------
   Used by every render function before text derived from user input
   (or from the fixed content pools below) is written into the DOM. */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const ALERT_POOL = [
  { tag:'critical', msg:'Digital signage network broadcasting unauthorized "SERVICE SUSPENDED — EVACUATE" message at 6 stations.' },
  { tag:'critical', msg:'PA system audio feed hijacked on Crosstown Line — synthetic voice announcement detected.' },
  { tag:'warn',      msg:'Mobile app push notification queue shows 40,000 messages sent from unrecognized service account.' },
  { tag:'warn',      msg:'Anomalous outbound traffic from fare-gateway microservice to unlisted external IP range.' },
  { tag:'info',      msg:'SOC correlation engine flags timing overlap between signage, PA, and app incidents (±90s).' },
  { tag:'critical', msg:'API key "svc-signage-prod-04" used from two geographically inconsistent locations within 3 minutes.' },
  { tag:'warn',      msg:'Ticketing microservice reporting elevated 5xx error rate (approx. 12% of requests).' },
  { tag:'info',      msg:'Employee badge log shows after-hours access to signage content server by contractor account.' },
  { tag:'critical', msg:'Social media mentions of "@SiberXTransit hacked" up 640% in the last 20 minutes.' },
  { tag:'warn',      msg:'Customer support queue receiving reports of fake refund prompts inside the mobile app.' },
  { tag:'info',      msg:'Forensics: signage CMS deployment pipeline shows an unscheduled build triggered outside change window.' },
  { tag:'critical', msg:'Insider-assist indicator: compromised credentials belong to a vendor account inactive for 11 months, reactivated yesterday.' },
];

function pushRandomAlert(){
  const item = ALERT_POOL[Math.floor(Math.random()*ALERT_POOL.length)];
  addAlert(item.tag, item.msg);
  showToast(item.tag==='critical'?'CRITICAL ALERT':item.tag==='warn'?'WARNING':'SOC NOTICE', item.msg);
  return item;
}

document.addEventListener('DOMContentLoaded', () => {
  renderTicker();
});

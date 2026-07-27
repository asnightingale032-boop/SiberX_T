/* ==========================================================================
   SiberX Crisis Command Platform — shared runtime
   -----------------------------------------------------------------------
   Security posture of this file (see /SECURITY.md and /docs for full
   detail). Summary of controls implemented here, per the security
   recommendations this revision applies:

   - Trusted Types (Dimension 1): a 'default' policy is registered before
     anything else runs, so every innerHTML/outerHTML/document.write sink
     app-wide is routed through one named, auditable chokepoint, per the
     CSP `require-trusted-types-for 'script'` directive in vercel.json.
   - Structural escaping (Dimension 1): the html`` tagged template below
     auto-escapes every interpolated value unless explicitly wrapped with
     safe(), so a call site cannot forget to escape. Pre-built HTML
     fragments (e.g. from Array.map().join('')) must be wrapped in safe()
     to opt out — that's a deliberate, visible signal at the call site.
   - Storage hardening (Dimension 14): state now lives in sessionStorage,
     not localStorage — cleared automatically when a tab/window closes,
     as an additional backstop beyond the explicit logout wipe. Loaded
     state is whitelisted field-by-field with type/range coercion
     (coerceState) rather than blindly merged, and carries a schema
     version so an unknown-shape or stale blob is discarded rather than
     trusted.
   - Input handling (Dimension 2): sanitizeText now also NFC-normalizes
     and strips zero-width/control characters, in addition to the
     existing angle-bracket stripping and length cap. Length caps are
     re-enforced at the storage boundary (coerceState), not just at the
     input boundary, so a tampered/replayed state blob cannot reintroduce
     an over-length value.
   - Fail-safe error handling (Dimension 12): storage reads/writes are
     wrapped in try/catch; failures degrade gracefully (in-memory state
     continues to work even if persistence fails) and are only logged
     with console.warn when running on localhost, never in production.
   ========================================================================== */

/* ---------- Trusted Types default policy ----------
   Registered first, before any other code runs. This does not add new
   sanitization on its own — that job belongs to escapeHtml()/html()/
   sanitizeText() below — it adds a browser-enforced guarantee that no
   innerHTML/outerHTML/document.write assignment can happen *outside*
   this one named policy. Feature-detected: Trusted Types is not yet
   supported in every browser, and the app must keep working where it
   isn't (the CSP directive itself is what those browsers simply ignore). */
if (typeof window !== 'undefined' && window.trustedTypes && trustedTypes.createPolicy) {
  try {
    trustedTypes.createPolicy('default', {
      createHTML: (input) => input,
      createScript: (input) => input,
      createScriptURL: (input) => input,
    });
  } catch (e) {
    // A policy named 'default' may already exist (e.g. hot-reload in a
    // dev tool) — never let policy registration itself break the page.
  }
}

const SIBERX_KEY = 'siberx_state_v1';
const SCHEMA_VERSION = 2; // bump whenever DEFAULT_STATE's shape changes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min idle timeout
const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000; // discard state older than 24h regardless of login state
const TEXT_MAX = 500; // hard ceiling for any single free-text field, enforced again at storage time

function isDevHost(){
  try{
    return ['localhost','127.0.0.1','::1',''].includes(window.location.hostname);
  }catch(e){ return false; }
}
function devWarn(...args){
  if(isDevHost()) console.warn('[siberx]', ...args);
}

const DEFAULT_STATE = () => ({
  _v: SCHEMA_VERSION,
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
  startedAt: Date.now(),
  // seed/log fields owned by individual pages — declared here so
  // coerceState() knows about them and doesn't discard them on load
  chatSeeded: false, chatLog: [],
  paSeeded: false, paLog: [], paNext: 0,
  aiSeeded: false, aiLog: [],
  newsSeeded: false, newsUpdates: [], viewerBase: 0,
});

const VALID_SYSTEM_STATUS = ['ok','degraded','critical','offline','restored'];
const VALID_LINE_STATUS = ['ok','degraded','critical','offline','restored'];

/* ---------- state coercion (whitelist fields on load) ----------
   Replaces a blind Object.assign(DEFAULT_STATE(), parsed). Every field
   coming out of storage is type/range-checked against DEFAULT_STATE's
   shape; unknown keys are dropped and out-of-range/wrong-type values
   fall back to the default. This means a hand-edited or replayed
   storage blob can't smuggle in unexpected fields or oversized text. */
function clampNum(v, fallback, min, max){
  const n = Number(v);
  if(!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}
function capText(v, max){
  if(typeof v !== 'string') return '';
  return v.slice(0, max || TEXT_MAX);
}
function coerceLogArray(arr, shapeFn, maxItems){
  if(!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems || 200).map(shapeFn).filter(Boolean);
}
function coerceState(parsed){
  const d = DEFAULT_STATE();
  if(!parsed || typeof parsed !== 'object') return d;
  if(parsed._v !== SCHEMA_VERSION) return d; // unknown/old schema — start clean rather than guess

  const out = d;

  if(parsed.user && typeof parsed.user === 'object'){
    const name = capText(parsed.user.name, 40).trim();
    const role = capText(parsed.user.role, 40).trim();
    out.user = (name && role) ? { name, role } : null;
  }
  out.lastActivity = Number.isFinite(Number(parsed.lastActivity)) ? Number(parsed.lastActivity) : null;
  out.threatLevel = Math.round(clampNum(parsed.threatLevel, d.threatLevel, 1, 5));
  out.sentiment = Math.round(clampNum(parsed.sentiment, d.sentiment, 0, 100));
  out.availability = Math.round(clampNum(parsed.availability, d.availability, 0, 100));
  out.incidentDeclared = parsed.incidentDeclared === true;
  out.simStage = Math.round(clampNum(parsed.simStage, 0, 0, 999));
  out.decisionStage = Math.round(clampNum(parsed.decisionStage, 0, 0, 999));
  out.startedAt = Number.isFinite(Number(parsed.startedAt)) ? Number(parsed.startedAt) : Date.now();
  out.viewerBase = Math.round(clampNum(parsed.viewerBase, 0, 0, 1000000));
  out.paNext = Math.round(clampNum(parsed.paNext, 0, 0, 999));
  out.chatSeeded = parsed.chatSeeded === true;
  out.paSeeded = parsed.paSeeded === true;
  out.aiSeeded = parsed.aiSeeded === true;
  out.newsSeeded = parsed.newsSeeded === true;

  if(parsed.systems && typeof parsed.systems === 'object'){
    Object.keys(d.systems).forEach(k=>{
      const v = parsed.systems[k];
      out.systems[k] = VALID_SYSTEM_STATUS.includes(v) ? v : d.systems[k];
    });
  }
  if(parsed.lines && typeof parsed.lines === 'object'){
    Object.keys(d.lines).forEach(k=>{
      const v = parsed.lines[k];
      if(v && typeof v === 'object'){
        out.lines[k] = {
          name: capText(v.name, 60) || d.lines[k].name,
          status: VALID_LINE_STATUS.includes(v.status) ? v.status : d.lines[k].status,
        };
      }
    });
  }
  if(parsed.score && typeof parsed.score === 'object'){
    Object.keys(d.score).forEach(k=>{
      out.score[k] = Math.round(clampNum(parsed.score[k], d.score[k], 0, 100));
    });
  }
  if(parsed.labProgress && typeof parsed.labProgress === 'object'){
    Object.keys(parsed.labProgress).slice(0, 50).forEach(k=>{
      const v = parsed.labProgress[k];
      if(v && typeof v === 'object'){
        out.labProgress[k] = { correct: v.correct === true, pickedOption: Math.round(clampNum(v.pickedOption, 0, 0, 20)) };
      }
    });
  }

  out.alerts = coerceLogArray(parsed.alerts, a => a && typeof a==='object' ? { ts: capText(a.ts,20), tag: capText(a.tag,20), msg: capText(a.msg, TEXT_MAX) } : null, 80);
  out.notes = coerceLogArray(parsed.notes, n => n && typeof n==='object' ? { ts: capText(n.ts,20), author: capText(n.author,40), text: capText(n.text, TEXT_MAX) } : null, 200);
  out.decisionsLog = coerceLogArray(parsed.decisionsLog, x => x && typeof x==='object' ? { ts: capText(x.ts,20), text: capText(x.text, TEXT_MAX) } : null, 300);
  out.submissions = coerceLogArray(parsed.submissions, x => x && typeof x==='object' ? { ts: capText(x.ts,20), kind: capText(x.kind,60), text: capText(x.text, TEXT_MAX), author: capText(x.author,40) } : null, 200);
  out.chatLog = coerceLogArray(parsed.chatLog, m => m && typeof m==='object' ? { who: capText(m.who,20), text: capText(m.text, TEXT_MAX), ts: capText(m.ts,20) } : null, 200);
  out.paLog = coerceLogArray(parsed.paLog, m => m && typeof m==='object' ? { who: capText(m.who,20), text: capText(m.text, TEXT_MAX), ts: capText(m.ts,20) } : null, 200);
  out.aiLog = coerceLogArray(parsed.aiLog, m => m && typeof m==='object' ? { who: capText(m.who,20), text: capText(m.text, TEXT_MAX), ts: capText(m.ts,20) } : null, 200);
  out.newsUpdates = coerceLogArray(parsed.newsUpdates, u => u && typeof u==='object' ? { ts: capText(u.ts,20), text: capText(u.text, TEXT_MAX) } : null, 200);

  return out;
}

/* ---------- storage ----------
   sessionStorage, not localStorage: state is cleared automatically when
   the tab/window closes, which is a meaningful additional backstop for
   shared training-room machines beyond the explicit logout wipe (a
   participant who simply closes the tab without clicking "Sign out"
   still leaves nothing behind for the next person). */
function getState(){
  try{
    const raw = sessionStorage.getItem(SIBERX_KEY);
    if(!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const state = coerceState(parsed);
    if(state.startedAt && (Date.now() - state.startedAt > MAX_STATE_AGE_MS)){
      return DEFAULT_STATE();
    }
    return state;
  }catch(e){
    devWarn('getState: failed to parse stored state, falling back to defaults', e);
    return DEFAULT_STATE();
  }
}
function writeState(s){
  try{
    sessionStorage.setItem(SIBERX_KEY, JSON.stringify(s));
    return true;
  }catch(e){
    // Private-browsing quota limits, storage disabled, etc. Degrade
    // gracefully — the caller still has the in-memory value even if
    // persistence failed, so rendering can continue this turn.
    devWarn('writeState: sessionStorage.setItem failed, continuing in-memory only', e);
    return false;
  }
}
function setState(patch){
  const s = Object.assign(getState(), patch);
  writeState(s);
  return s;
}
function resetState(){
  try{ sessionStorage.removeItem(SIBERX_KEY); }
  catch(e){ devWarn('resetState failed', e); }
}
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function nowTs(){ const d = new Date(); return d.toTimeString().slice(0,8); }

/* ---------- input handling ----------
   Belt-and-suspenders: constrain free text at the point of entry
   (strip angle brackets and control/zero-width characters, normalize
   Unicode, cap length) in addition to escaping at the point of render,
   and again at the storage boundary via coerceState(). None of these
   layers replaces another. */
function sanitizeText(str, maxLen){
  maxLen = maxLen || 300;
  let s = String(str == null ? '' : str);
  // Unicode-normalize first so visually-identical strings compare and
  // display consistently (defends against homoglyph tricks that rely
  // on non-normalized combining forms).
  if(typeof s.normalize === 'function') s = s.normalize('NFC');
  s = s
    .replace(/[<>]/g, '')
    // Zero-width / bidi-control characters: invisible but can be used
    // to spoof or split displayed text. [<>]-stripping does not catch
    // these because they aren't angle brackets.
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    // C0/C1 control characters other than tab/newline.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  return s.slice(0, maxLen);
}
function isSixDigitCode(str){ return /^\d{6}$/.test(String(str||'').trim()); }
function isFourDigits(str){ return /^\d{4}$/.test(String(str||'').trim()); }
// Allowlist for the one structured free-text field the UI collects: the
// responder's display name. Letters, numbers, spaces, hyphens, and
// apostrophes only — rejects with visible feedback rather than silently
// stripping characters the way sanitizeText does for unstructured text.
const NAME_ALLOWLIST = /^[A-Za-z0-9 '\-]{2,40}$/;

/* ---------- auth guard + session expiry ---------- */
function requireAuth(){
  const s = getState();
  if(!s.user){
    window.location.href = 'index.html';
    return s;
  }
  if(s.lastActivity && (Date.now() - s.lastActivity > SESSION_TIMEOUT_MS)){
    s.user = null;
    writeState(s);
    window.location.href = 'index.html?expired=1';
    return s;
  }
  s.lastActivity = Date.now();
  writeState(s);
  document.addEventListener('click', touchActivity, { passive:true });
  document.addEventListener('keydown', touchActivity, { passive:true });
  return s;
}
function touchActivity(){
  const s = getState();
  if(s.user){
    s.lastActivity = Date.now();
    writeState(s);
  }
}
function logout(){
  /* Fixed per SECURITY_FINDINGS.md (AUTH-03 / SURF-02): logout used to
     null out only `user`, leaving every other field (case notes, chat
     transcripts, decision history, lab progress, submissions) intact.
     The next person to sign in on the same browser — entirely plausible
     on a shared training-room machine — inherited the previous
     participant's data. Logout now wipes the whole exercise state, not
     just the identity field. Combined with the sessionStorage move
     above, state is now cleared both on explicit logout AND on tab/
     window close. */
  resetState();
  window.location.href = 'index.html';
}

/* ---------- structural output escaping ----------
   escapeHtml is the underlying primitive; html`` is the preferred way
   to build markup from here on, because it makes escaping automatic
   instead of something every call site has to remember. Wrap an
   already-built, trusted HTML fragment (e.g. the result of
   Array.map(...).join('')) in safe() to insert it verbatim — anything
   NOT wrapped in safe() is always escaped, with no way to opt out by
   accident. */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
class SafeString {
  constructor(value){ this.value = String(value); }
  toString(){ return this.value; }
}
function safe(str){ return new SafeString(str); }
function html(strings, ...values){
  return strings.reduce((out, s, i) => {
    if(i >= values.length) return out + s;
    const v = values[i];
    const rendered = (v instanceof SafeString) ? v.toString() : escapeHtml(v == null ? '' : v);
    return out + s + rendered;
  }, '');
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
  const navHtml = safe(NAV_ITEMS.map(item =>
    html`<a href="${item.href}" class="${item.href===activeHref?'active':''}">${item.label}</a>`
  ).join(''));

  mount.innerHTML = html`
    <a href="dashboard.html" class="control-bar__brand brand-link">
      <span class="dot"></span> SIBERX // CRISIS COMMAND
    </a>
    <nav class="control-bar__nav">${navHtml}</nav>
    <div class="control-bar__meta">
      <span id="clock">--:--:--</span>
      <span class="pill pill--${threatPillClass(s.threatLevel)}"><span class="dot"></span>THREAT L${s.threatLevel}</span>
    </div>
    ${safe(s.user ? html`
    <div class="control-bar__user">
      <span>${s.user.name}</span>
      <span class="role-chip">${s.user.role}</span>
      <button class="logout-btn" id="cb-logout-btn" type="button">Sign out</button>
    </div>` : '')}
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
  const lineText = safe(Object.entries(s.lines).map(([code,l])=>
    html`<span>LINE ${code} — ${l.name}: <b>${l.status.toUpperCase()}</b></span>`
  ).join(''));
  const extra = html`<span>SYSTEM AVAILABILITY: <b>${s.availability}%</b></span><span>PUBLIC SENTIMENT INDEX: <b>${s.sentiment}</b></span>`;
  mount.innerHTML = html`
    <div class="ticker__label">Service Status</div>
    <div class="ticker__track"><div class="ticker__content">${lineText}${safe(extra)}${lineText}${safe(extra)}</div></div>
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
  // Structural escaping via element creation (the pattern used in
  // security-review.js's submitOption(), generalized here) rather than
  // a template string, for the two dynamic values.
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  el.append(strong, p);
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

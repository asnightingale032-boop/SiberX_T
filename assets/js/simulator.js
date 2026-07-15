requireAuth();
renderControlBar('simulator.html');

const NODES = [
  { key:'signage',   label:'Digital Signage', x:90,  y:70  },
  { key:'pa',        label:'PA System',       x:390, y:70  },
  { key:'gateway',   label:'Microservices Gateway', x:240, y:190 },
  { key:'mobile',    label:'Mobile App',      x:90,  y:310 },
  { key:'ticketing', label:'Ticketing DB',    x:390, y:310 },
];

const STATUS_COLOR = {
  ok: 'var(--status-ok)',
  degraded: 'var(--status-degraded)',
  critical: 'var(--status-critical)',
  offline: 'var(--status-offline)',
  restored: 'var(--status-ok)',
};

function renderNetMap(){
  const s = getState();
  const svg = document.getElementById('net-map');
  const cx=240, cy=190;
  let edges = NODES.map(n => `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="var(--hairline)" stroke-width="2"/>`).join('');
  let core = `
    <circle cx="${cx}" cy="${cy}" r="30" fill="var(--panel-raised)" stroke="var(--line-c)" stroke-width="2"/>
    <text x="${cx}" y="${cy+4}" text-anchor="middle" class="net-node-label" font-size="9">CORE</text>
  `;
  let nodes = NODES.map(n=>{
    const status = s.systems[n.key] || 'ok';
    const color = STATUS_COLOR[status] || STATUS_COLOR.ok;
    const pulse = (status==='critical') ? `<circle cx="${n.x}" cy="${n.y}" r="26" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"><animate attributeName="r" values="20;30;20" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite"/></circle>` : '';
    return `
      ${pulse}
      <circle cx="${n.x}" cy="${n.y}" r="22" fill="var(--panel)" stroke="${color}" stroke-width="3"/>
      <circle cx="${n.x}" cy="${n.y}" r="5" fill="${color}"/>
      <text x="${n.x}" y="${n.y+38}" text-anchor="middle" class="net-node-label">${n.label}</text>
      <text x="${n.x}" y="${n.y+50}" text-anchor="middle" class="net-node-label" fill="${color}" font-size="9">${status.toUpperCase()}</text>
    `;
  }).join('');
  svg.innerHTML = edges + core + nodes;
}

const PA_SCRIPT = [
  { who:'sys', text:'⚠ AUTOMATED ANNOUNCEMENT: "Service suspended system-wide. Please evacuate the platform immediately." (unauthorized)' },
  { who:'sys', text:'Digital signage at Union interchange now displaying attacker splash message on 14 screens.' },
  { who:'sys', text:'Mobile app users report a fake "Refund available — tap to claim" push notification.' },
  { who:'sys', text:'PA feed on Crosstown Line switches to synthetic voice: "Fare gates are open, boarding is free." (false)' },
  { who:'RO', text:'SOC: confirming these are spoofed — real ops center never issued them. Do not act on in-app prompts.' },
  { who:'sys', text:'Signage CMS shows a new unscheduled deployment pushed 6 minutes ago from a dormant contractor account.' },
];

function seedPaOnce(){
  const s = getState();
  if(!s.paSeeded){
    s.paLog = [ { ...PA_SCRIPT[0], ts: nowTs() } ];
    s.paSeeded = true;
    s.paNext = 1;
    setState(s);
  }
}
seedPaOnce();

function renderPaLog(){
  const s = getState();
  const mount = document.getElementById('pa-log');
  const log = s.paLog || [];
  mount.innerHTML = log.map(m=>{
    if(m.who==='RO'){
      return `<div class="msg-row"><div class="msg-avatar">RO</div>
        <div><div class="msg-meta">CISO — R. Okafor · ${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
    }
    return `<div class="msg-row system"><div class="msg-avatar">⚠</div>
      <div><div class="msg-meta">Hijacked channel · ${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
  }).join('');
  mount.scrollTop = mount.scrollHeight;
}

function tickPaScript(){
  const s = getState();
  if(s.paNext < PA_SCRIPT.length){
    s.paLog = s.paLog || [];
    s.paLog.push({ ...PA_SCRIPT[s.paNext], ts: nowTs() });
    s.paNext += 1;
    setState(s);
    renderPaLog();
  }
}

const SIM_EVENT_POOL = [
  'Correlation engine links signage, PA, and push-notification incidents to a shared service credential.',
  'Network flow analysis shows beaconing from the microservices gateway every 47 seconds.',
  'Contractor vendor account "svc-signage-prod-04" reactivated after 11 months dormant.',
  'Change management log shows no approved ticket for the signage CMS deployment.',
  'Ticketing database read replica shows unusual bulk export query at 02:14.',
  'Endpoint detection flags a credential-dumping tool on the signage content server.',
];

function pushSimEvent(){
  const s = getState();
  const msg = SIM_EVENT_POOL[Math.floor(Math.random()*SIM_EVENT_POOL.length)];
  s.decisionsLog.push({ ts: nowTs(), text: 'SOC: ' + msg });
  setState(s);
  renderSimFeed();
}

function renderSimFeed(){
  const s = getState();
  const mount = document.getElementById('sim-feed');
  const items = s.decisionsLog.slice().reverse().slice(0,14);
  if(!items.length){
    mount.innerHTML = `<p class="text-sm">No events logged yet.</p>`;
    return;
  }
  mount.innerHTML = items.map(d=>`
    <div class="feed-row">
      <span class="ts">${escapeHtml(d.ts)}</span>
      <span class="tag tag--info">soc</span>
      <span class="msg">${escapeHtml(d.text)}</span>
    </div>
  `).join('');
}

function applySysAction(spec, btn){
  const s = getState();
  const parts = spec.split(';');
  parts.forEach(p=>{
    const [key,status] = p.split(':');
    if(s.systems[key] !== undefined){ s.systems[key] = status; }
  });
  const restoring = spec.includes('restored');
  s.threatLevel = clamp(s.threatLevel - 1, 1, 5);
  s.availability = clamp(s.availability + (restoring ? 9 : 4), 0, 100);
  s.score.security = clamp(s.score.security + (restoring ? 8 : 5), 0, 100);
  const label = btn.textContent.trim();
  s.decisionsLog.push({ ts: nowTs(), text: `Action taken: ${label}` });
  setState(s);
  showToast('ACTION LOGGED', label);
  renderNetMap();
  renderSimFeed();
  renderTicker();
}

document.querySelectorAll('[data-sys-action]').forEach(btn=>{
  btn.addEventListener('click', ()=> applySysAction(btn.dataset.sysAction, btn));
});

function renderNotes(){
  const s = getState();
  const mount = document.getElementById('notes-list');
  if(!s.notes.length){
    mount.innerHTML = `<p class="text-sm">No case notes yet. Add your first forensic observation above.</p>`;
    return;
  }
  mount.innerHTML = s.notes.slice().reverse().map(n=>`
    <div class="card mono text-sm" style="margin-bottom:8px; padding:12px;">
      <div class="text-dim" style="margin-bottom:4px;">${escapeHtml(n.ts)} — ${escapeHtml(n.author)}</div>
      <div>${escapeHtml(n.text)}</div>
    </div>
  `).join('');
}

document.getElementById('note-submit').addEventListener('click', ()=>{
  const ta = document.getElementById('note-input');
  const text = sanitizeText(ta.value, 500);
  if(!text) return;
  const s = getState();
  s.notes.push({ ts: nowTs(), author: s.user.name, text });
  setState(s);
  ta.value = '';
  renderNotes();
});

/* ---------- AI Triage Assistant ----------
   Deliberately NOT a real LLM integration: no network call, no API
   key, no external dependency of any kind. Replies are chosen from a
   small fixed set of templates by keyword match. This is the "safe"
   counterpart to the hardcoded-key example reviewed in the Security
   Review Lab. */
const AI_RULES = [
  { test: /isolat|contain/i, reply: 'Priority order for isolation: shared service accounts first (they\u2019re the lateral-movement path), then the systems using them — signage, PA, mobile push — before touching anything unaffected like ticketing.' },
  { test: /key|credential|secret|rotat/i, reply: 'Revoke the exposed key at the identity provider first, then rotate it everywhere it\u2019s used. Rotating without revoking leaves the old key valid until every consumer updates.' },
  { test: /insider|vendor|contractor/i, reply: 'Suspend the account and preserve its access logs before contacting anyone — you want a clean forensic trail before the situation becomes adversarial.' },
  { test: /comms|public|statement|media|press/i, reply: 'A short, factual holding statement beats silence. Acknowledge the disruption, tell riders to trust only official channels, and promise an update — don\u2019t wait for every fact to be confirmed.' },
  { test: /green\s?field|restore|rebuild/i, reply: 'Rebuild from a verified clean image rather than patching in place — you can\u2019t be fully certain a compromised environment is clean just because the symptoms stopped.' },
  { test: /help|what|how/i, reply: 'I can weigh in on containment order, key rotation, insider-threat handling, public comms timing, or restoration approach — ask about any of those.' },
];
const AI_FALLBACK = 'I don\u2019t have a scripted answer for that — this assistant only matches a small set of incident-response keywords. Try asking about isolation, keys, insider threat, comms, or restoration.';

function seedAiOnce(){
  const s = getState();
  if(!s.aiSeeded){
    s.aiLog = [{ who:'ai', text:'AI Triage Assistant online — rule-based, client-side only, no external calls. Ask me about containment order, key rotation, or comms timing.', ts: nowTs() }];
    s.aiSeeded = true;
    setState(s);
  }
}
seedAiOnce();

function renderAiLog(){
  const s = getState();
  const mount = document.getElementById('ai-log');
  const log = s.aiLog || [];
  mount.innerHTML = log.map(m=>{
    if(m.who==='me'){
      return `<div class="msg-row me"><div class="msg-avatar">${escapeHtml((s.user.name||'ME').slice(0,2).toUpperCase())}</div>
        <div><div class="msg-meta">${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
    }
    return `<div class="msg-row"><div class="msg-avatar">AI</div>
      <div><div class="msg-meta">Triage Assistant \u00b7 ${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
  }).join('');
  mount.scrollTop = mount.scrollHeight;
}

function askAi(){
  const input = document.getElementById('ai-input');
  const text = sanitizeText(input.value, 200);
  if(!text) return;
  const s = getState();
  s.aiLog = s.aiLog || [];
  s.aiLog.push({ who:'me', text, ts: nowTs() });
  setState(s);
  input.value = '';
  renderAiLog();

  const rule = AI_RULES.find(r => r.test.test(text));
  const reply = rule ? rule.reply : AI_FALLBACK;
  setTimeout(()=>{
    const s2 = getState();
    s2.aiLog.push({ who:'ai', text: reply, ts: nowTs() });
    setState(s2);
    renderAiLog();
  }, 500);
}
document.getElementById('ai-send').addEventListener('click', askAi);
document.getElementById('ai-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') askAi(); });

renderNetMap();
renderPaLog();
renderSimFeed();
renderNotes();
renderAiLog();
renderTicker();

setInterval(tickPaScript, 9000);
setInterval(()=>{ if(Math.random()>0.4) pushSimEvent(); }, 7000);

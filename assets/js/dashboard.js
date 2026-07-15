requireAuth();
renderControlBar('dashboard.html');

const CHAT_CAST = [
  { name:'CISO — R. Okafor', key:'RO' },
  { name:'COO — M. Delacroix', key:'MD' },
  { name:'Comms Director — S. Petrova', key:'SP' },
];

const CHAT_SCRIPT = [
  { who:'RO', text:'Confirmed: signage CMS and PA gateway share the same service-account credential. That is our lateral movement path.' },
  { who:'MD', text:'Manual PA override is ready at 4 of 6 stations. Need a call on suspending Crosstown service or running degraded.' },
  { who:'SP', text:'Media are already calling this a "hack." We need a holding statement within the hour or the story writes itself.' },
];

function seedChatOnce(){
  const s = getState();
  if(!s.chatSeeded){
    s.chatLog = CHAT_SCRIPT.map(m => ({ who:m.who, text:m.text, ts: nowTs() }));
    s.chatSeeded = true;
    setState(s);
  }
}
seedChatOnce();

function renderKpis(){
  const s = getState();
  const mount = document.getElementById('kpi-row');
  mount.innerHTML = `
    <div class="panel ${s.threatLevel>=4?'panel--alert':''}">
      <h3>Threat Level</h3>
      <div class="big-stat">${s.threatLevel} / 5</div>
      <span class="pill pill--${threatPillClass(s.threatLevel)}"><span class="dot"></span>${s.threatLevel>=4?'Severe':s.threatLevel>=3?'Elevated':'Contained'}</span>
    </div>
    <div class="panel">
      <h3>Service Availability</h3>
      <div class="big-stat">${s.availability}%</div>
      <span class="text-sm text-dim">across 5 lines</span>
    </div>
    <div class="panel">
      <h3>Public Sentiment Index</h3>
      <div class="big-stat">${s.sentiment}</div>
      <span class="text-sm text-dim">0 hostile — 100 confident</span>
    </div>
    <div class="panel ${s.incidentDeclared?'panel--ok':''}">
      <h3>Incident Status</h3>
      <div class="big-stat" style="font-size:20px;">${s.incidentDeclared ? 'DECLARED' : 'MONITORING'}</div>
      <span class="text-sm text-dim">${s.decisionsLog.length} actions logged</span>
    </div>
  `;
}

function renderLinesTable(){
  const s = getState();
  const mount = document.getElementById('lines-table');
  mount.innerHTML = Object.entries(s.lines).map(([code,l])=>`
    <tr><td>Line ${escapeHtml(code)}</td><td>${escapeHtml(l.name)}</td>
    <td><span class="pill pill--${statusPillClass(l.status)}"><span class="dot"></span>${escapeHtml(l.status)}</span></td></tr>
  `).join('');
}

function renderAlertFeed(){
  const s = getState();
  const mount = document.getElementById('alert-feed');
  if(!s.alerts.length){
    mount.innerHTML = `<p class="text-sm">No alerts yet. Pull the latest SOC feed to begin.</p>`;
    return;
  }
  mount.innerHTML = s.alerts.slice(0,12).map(a=>`
    <div class="feed-row">
      <span class="ts">${escapeHtml(a.ts)}</span>
      <span class="tag tag--${escapeHtml(a.tag)}">${escapeHtml(a.tag)}</span>
      <span class="msg">${escapeHtml(a.msg)}</span>
    </div>
  `).join('');
}

function renderDecisionLog(){
  const s = getState();
  const mount = document.getElementById('decision-log');
  if(!s.decisionsLog.length){
    mount.innerHTML = `<p class="text-sm">No executive actions taken yet.</p>`;
    return;
  }
  mount.innerHTML = s.decisionsLog.slice().reverse().map(d=>`
    <div class="feed-row">
      <span class="ts">${escapeHtml(d.ts)}</span>
      <span class="tag tag--ok">action</span>
      <span class="msg">${escapeHtml(d.text)}</span>
    </div>
  `).join('');
}

function renderChat(){
  const s = getState();
  const mount = document.getElementById('chat-log');
  const log = s.chatLog || [];
  mount.innerHTML = log.map(m=>{
    if(m.who==='me'){
      const initials = escapeHtml((s.user.name||'ME').slice(0,2).toUpperCase());
      return `<div class="msg-row me"><div class="msg-avatar">${initials}</div>
        <div><div class="msg-meta">${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
    }
    const person = CHAT_CAST.find(c=>c.key===m.who) || { name:'Unknown', key:'??' };
    return `<div class="msg-row"><div class="msg-avatar">${escapeHtml(person.key)}</div>
      <div><div class="msg-meta">${escapeHtml(person.name)} · ${escapeHtml(m.ts)}</div><div class="msg-bubble">${escapeHtml(m.text)}</div></div></div>`;
  }).join('');
  mount.scrollTop = mount.scrollHeight;
}

const AUTO_REPLIES = [
  "Copy that — updating the ops board now.",
  "Noted. Looping in the forensic team for corroboration.",
  "Agreed. I'll brief the executive team in the next sync.",
  "That aligns with what we're seeing on the gateway logs.",
  "Understood — flagging that for the public statement draft.",
];

function sendChat(){
  const input = document.getElementById('chat-input');
  const text = sanitizeText(input.value, 240);
  if(!text) return;
  const s = getState();
  s.chatLog = s.chatLog || [];
  s.chatLog.push({ who:'me', text, ts: nowTs() });
  setState(s);
  input.value = '';
  renderChat();
  setTimeout(()=>{
    const s2 = getState();
    const person = CHAT_CAST[Math.floor(Math.random()*CHAT_CAST.length)];
    const reply = AUTO_REPLIES[Math.floor(Math.random()*AUTO_REPLIES.length)];
    s2.chatLog.push({ who:person.key, text:reply, ts: nowTs() });
    setState(s2);
    renderChat();
  }, 900);
}

const ACTIONS = {
  declare: () => {
    const s = getState();
    s.incidentDeclared = true;
    s.threatLevel = clamp(s.threatLevel+1,1,5);
    s.decisionsLog.push({ ts: nowTs(), text: 'Level 3 incident formally declared. Crisis command activated.' });
    setState(s);
    showToast('INCIDENT DECLARED', 'Level 3 incident declared — full crisis command protocol active.');
  },
  statement: () => {
    const s = getState();
    s.sentiment = clamp(s.sentiment+6,0,100);
    s.decisionsLog.push({ ts: nowTs(), text: 'Public statement authorized: acknowledging disruption, urging riders to verify alerts only via official channels.' });
    setState(s);
    showToast('STATEMENT AUTHORIZED', 'Comms team is publishing the holding statement now.');
  },
  bcp: () => {
    const s = getState();
    s.availability = clamp(s.availability+8,0,100);
    s.decisionsLog.push({ ts: nowTs(), text: 'Business continuity plan activated — manual station operations and backup fare collection engaged.' });
    setState(s);
    showToast('BCP ACTIVATED', 'Manual operations engaged across affected stations.');
  },
  convene: () => {
    const s = getState();
    s.score.leadership = clamp(s.score.leadership+7,0,100);
    s.decisionsLog.push({ ts: nowTs(), text: 'Crisis committee convened — technical, executive, and comms leads aligned on response plan.' });
    setState(s);
    showToast('COMMITTEE CONVENED', 'Cross-functional crisis committee is now aligned.');
  },
  revoke: () => {
    const s = getState();
    s.systems.gateway = 'restored';
    s.threatLevel = clamp(s.threatLevel-1,1,5);
    s.score.security = clamp(s.score.security+10,0,100);
    s.decisionsLog.push({ ts: nowTs(), text: 'Compromised API keys revoked and rotated across signage and PA service accounts.' });
    setState(s);
    showToast('KEYS REVOKED', 'Compromised API keys revoked. Attacker access path closed.');
  },
  greenfield: () => {
    const s = getState();
    s.systems.signage = 'restored';
    s.systems.pa = 'restored';
    s.availability = clamp(s.availability+10,0,100);
    s.decisionsLog.push({ ts: nowTs(), text: 'Trusted green-field environment restored for signage and PA systems from verified clean backups.' });
    setState(s);
    showToast('ENVIRONMENT RESTORED', 'Signage and PA systems rebuilt from a trusted green-field image.');
  },
};

document.querySelectorAll('[data-action]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    ACTIONS[btn.dataset.action]();
    renderAll();
  });
});

document.getElementById('chat-send').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendChat(); });
document.getElementById('pull-alert-btn').addEventListener('click', ()=>{ pushRandomAlert(); renderAll(); });

function renderAll(){
  renderKpis();
  renderLinesTable();
  renderAlertFeed();
  renderDecisionLog();
  renderChat();
  renderTicker();
}
renderAll();

if(!getState().alerts.length){
  setTimeout(()=>{ pushRandomAlert(); renderAll(); }, 1200);
}

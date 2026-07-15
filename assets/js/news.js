requireAuth();
renderControlBar('news.html');

const UPDATE_POOL = [
  'SiberX confirms digital signage network isolated at all affected stations.',
  'Local transit authority says backup PA scripts now in use while systems are rebuilt.',
  'SiberX SOC statement: "We identified the compromised credential and have begun rotation."',
  'Mobile app updated to disable push notifications temporarily as a precaution.',
  'Rider advocacy group calls for an independent review once service is restored.',
  'SiberX confirms it is cooperating with national cybersecurity authorities.',
  'Fare gateway service restored from a verified clean environment, operator says.',
  'City officials say there is no evidence of harm to riders beyond the false alerts.',
];

function seedNewsOnce(){
  const s = getState();
  if(!s.newsSeeded){
    s.newsUpdates = [
      { ts: nowTs(), text: 'ODTN has confirmed reports of falsified signage and PA messages across the SiberX network.' },
      { ts: nowTs(), text: 'SiberX Transit Systems issues first statement acknowledging "a cybersecurity incident affecting some customer-facing systems."' },
    ];
    s.newsSeeded = true;
    s.viewerBase = 4200 + Math.floor(Math.random()*2600);
    setState(s);
  }
}
seedNewsOnce();

function renderClock(){ document.getElementById('news-clock').textContent = nowTs(); }
function renderViewers(){
  const s = getState();
  const jitter = Math.floor(Math.random()*180) - 90;
  document.getElementById('viewer-count').textContent = (s.viewerBase + jitter).toLocaleString();
}

function renderUpdates(){
  const s = getState();
  const mount = document.getElementById('live-updates');
  const items = (s.newsUpdates || []).slice().reverse();
  mount.innerHTML = items.map(u=>`
    <div class="feed-row" style="grid-template-columns:70px 1fr;">
      <span class="ts">${escapeHtml(u.ts)}</span>
      <span class="msg">${escapeHtml(u.text)}</span>
    </div>
  `).join('');
}

function pushNewsUpdate(){
  const s = getState();
  const msg = UPDATE_POOL[Math.floor(Math.random()*UPDATE_POOL.length)];
  s.newsUpdates = s.newsUpdates || [];
  s.newsUpdates.push({ ts: nowTs(), text: msg });
  setState(s);
  renderUpdates();
}

const QUOTES = [
  { name:'Commuter, Meridian Line', text:'"The screen at my platform said to evacuate, but the trains were still running. Nobody knew what to believe."' },
  { name:'Station Staff', text:'"We switched to megaphones and paper signs within about fifteen minutes of the manual-ops call."' },
  { name:'Daily rider', text:'"I got a weird refund popup in the app so I just closed it. Glad I didn\u2019t tap anything."' },
  { name:'Local business owner', text:'"Service felt normal by the afternoon commute, which honestly surprised me given the morning."' },
];

function renderQuotes(){
  const mount = document.getElementById('witness-quotes');
  mount.innerHTML = QUOTES.map(q=>`
    <div class="card">
      <p style="font-style:italic; margin-bottom:8px;">${escapeHtml(q.text)}</p>
      <span class="text-sm mono text-dim">— ${escapeHtml(q.name)}</span>
    </div>
  `).join('');
}

function renderSnapshot(){
  const s = getState();
  document.getElementById('snapshot-body').innerHTML = `
    <div class="flex between" style="margin-bottom:10px;"><span class="text-sm">Threat level</span><span class="pill pill--${threatPillClass(s.threatLevel)}"><span class="dot"></span>L${s.threatLevel}</span></div>
    <div class="flex between" style="margin-bottom:10px;"><span class="text-sm">Service availability</span><span class="mono">${s.availability}%</span></div>
    <div class="flex between" style="margin-bottom:10px;"><span class="text-sm">Public sentiment index</span><span class="mono">${s.sentiment}</span></div>
    <div class="flex between"><span class="text-sm">Incident status</span><span class="mono">${s.incidentDeclared ? 'Declared' : 'Monitoring'}</span></div>
  `;
}

document.getElementById('tip-submit').addEventListener('click', ()=>{
  const ta = document.getElementById('tip-text');
  const text = sanitizeText(ta.value, 400);
  if(!text) return;
  const s = getState();
  s.submissions.push({ ts: nowTs(), kind:'News tip', text, author: s.user.name });
  setState(s);
  ta.value = '';
  document.getElementById('tip-confirm').style.display = 'block';
  setTimeout(()=> document.getElementById('tip-confirm').style.display='none', 3000);
});

renderClock(); renderViewers(); renderUpdates(); renderQuotes(); renderSnapshot(); renderTicker();
setInterval(renderClock, 1000);
setInterval(renderViewers, 4000);
setInterval(()=>{ if(Math.random()>0.35) pushNewsUpdate(); }, 8000);

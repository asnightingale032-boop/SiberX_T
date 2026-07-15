requireAuth();
renderControlBar('training.html');

const MODULES = [
  { title:'Phishing & Insider Threats', desc:'Recognize how dormant or vendor accounts become an attacker\u2019s easiest way in, and what to watch for internally.', tag:'20 min' },
  { title:'API Key & Secrets Hygiene', desc:'Rotation schedules, least privilege, and why one shared credential across systems is a single point of failure.', tag:'15 min' },
  { title:'Incident Response Basics', desc:'The detect \u2192 contain \u2192 eradicate \u2192 recover cycle, and how to run your first hour well.', tag:'25 min' },
  { title:'Public Communication Under Pressure', desc:'How to say something true and useful fast, without waiting for every fact to be confirmed.', tag:'18 min' },
];

function renderModules(){
  const mount = document.getElementById('module-grid');
  mount.innerHTML = MODULES.map((m,i)=>`
    <div class="card">
      <div class="flex between center"><h3 style="margin:0; text-transform:none; font-family:var(--font-display); font-size:16px; color:var(--text-primary);">${escapeHtml(m.title)}</h3><span class="pill pill--ok"><span class="dot"></span>${escapeHtml(m.tag)}</span></div>
      <p class="mt-8">${escapeHtml(m.desc)}</p>
      <button class="btn btn-sm" data-mark="${i}" type="button">Mark module complete</button>
    </div>
  `).join('');
  document.querySelectorAll('[data-mark]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const s = getState();
      s.submissions.push({ ts: nowTs(), kind:'Training module completed', text: MODULES[btn.dataset.mark].title, author: s.user.name });
      setState(s);
      btn.textContent = 'Completed ✓';
      btn.disabled = true;
      renderRecord();
    });
  });
}

const QUIZ = [
  { q:'A vendor account, dormant for 11 months, is reactivated the day before an attack. What should happen first?',
    options:['Delete the account immediately without review','Suspend access and preserve logs for forensic review','Ignore it \u2014 dormant accounts are low risk','Wait until the investigation fully concludes'],
    correct:1 },
  { q:'Digital signage, PA, and mobile app were all compromised through what common weakness?',
    options:['Three unrelated separate attacks','A shared service credential across systems','A physical break-in at a station','Weather-related system failure'],
    correct:1 },
  { q:'What is the safest way to bring a compromised system back online?',
    options:['Patch it in place and leave credentials as-is','Restore from any available backup','Revoke exposed keys and rebuild from a trusted green-field image','Just restart the affected servers'],
    correct:2 },
];

function renderQuiz(){
  const mount = document.getElementById('quiz-body');
  mount.innerHTML = QUIZ.map((item,qi)=>`
    <div class="mt-16">
      <p style="font-weight:600; color:var(--text-primary);">${qi+1}. ${escapeHtml(item.q)}</p>
      ${item.options.map((opt,oi)=>`
        <label class="quiz-opt" data-q="${qi}" data-o="${oi}">
          <input type="radio" name="q${qi}" value="${oi}"> ${escapeHtml(opt)}
        </label>
      `).join('')}
    </div>
  `).join('');
}

document.getElementById('quiz-check').addEventListener('click', ()=>{
  let correctCount = 0;
  QUIZ.forEach((item,qi)=>{
    const selected = document.querySelector(`input[name="q${qi}"]:checked`);
    document.querySelectorAll(`.quiz-opt[data-q="${qi}"]`).forEach(label=>{
      const oi = Number(label.dataset.o);
      label.classList.remove('correct','incorrect');
      if(oi === item.correct) label.classList.add('correct');
      else if(selected && Number(selected.value) === oi) label.classList.add('incorrect');
    });
    if(selected && Number(selected.value) === item.correct) correctCount++;
  });
  const result = document.getElementById('quiz-result');
  result.style.display = 'flex';
  result.innerHTML = `<span>📊</span><span>You scored <b>${correctCount} / ${QUIZ.length}</b>. ${correctCount===QUIZ.length ? 'Perfect score \u2014 nice work.' : 'Review the highlighted answers above.'}</span>`;
  const s = getState();
  s.submissions.push({ ts: nowTs(), kind:'Quiz completed', text: `Incident Response Fundamentals — ${correctCount}/${QUIZ.length}`, author: s.user.name });
  setState(s);
  renderRecord();
});

function renderRecord(){
  const s = getState();
  const mount = document.getElementById('training-record');
  const items = s.submissions.filter(x => x.kind==='Training module completed' || x.kind==='Quiz completed');
  if(!items.length){
    mount.innerHTML = `<p class="text-sm">No training activity logged yet — complete a module or the quiz above.</p>`;
    return;
  }
  mount.innerHTML = `<div class="feed">${items.slice().reverse().map(i=>`
    <div class="feed-row" style="grid-template-columns:70px 170px 1fr;">
      <span class="ts">${escapeHtml(i.ts)}</span>
      <span class="tag tag--ok">${escapeHtml(i.kind)}</span>
      <span class="msg">${escapeHtml(i.text)}</span>
    </div>`).join('')}</div>`;
}

renderModules();
renderQuiz();
renderRecord();
renderTicker();

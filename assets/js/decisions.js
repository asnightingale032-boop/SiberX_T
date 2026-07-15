requireAuth();
renderControlBar('decisions.html');

const SCENARIO = [
  {
    title: 'Detection',
    prompt: 'SOC dashboards show conflicting operational data: signage says "suspended," the ops center says normal service. Anomalous PA audio has been reported at two stations. What do you do first?',
    choices: [
      { label:'Open a full incident bridge immediately and start the timeline.', delta:{security:6,trust:2,continuity:3,leadership:8},
        result:'Good instinct — an early bridge gets technical and executive stakeholders on the same page before the situation escalates further.' },
      { label:'Wait for one more confirming signal before raising the alarm.', delta:{security:-4,trust:-2,continuity:-2,leadership:-3},
        result:'The delay costs you: two more stations report the same conflicting data before you formally respond.' },
      { label:'Quietly ask IT to "just fix the signage" without looping in security.', delta:{security:-8,trust:-4,continuity:-2,leadership:-6},
        result:'Treating it as a routine glitch means the shared credential behind the compromise stays active for another 40 minutes.' },
    ]
  },
  {
    title: 'Initial Containment',
    prompt: 'Forensics confirms the digital signage, PA, and mobile app share a common compromised service account. Riders are seeing fake "evacuate" messages. How do you contain it?',
    choices: [
      { label:'Isolate the shared service account and switch affected systems to manual control.', delta:{security:9,trust:4,continuity:2,leadership:5},
        result:'Isolating the account cuts the attacker\u2019s foothold immediately, though manual operations slow things down for staff.' },
      { label:'Take the entire network offline as a precaution, including unaffected systems.', delta:{security:5,trust:-6,continuity:-10,leadership:-2},
        result:'It\u2019s safe, but a full shutdown strands riders network-wide and turns a contained incident into a system-wide outage.' },
      { label:'Leave systems running while you investigate further, to avoid disrupting service.', delta:{security:-9,trust:-5,continuity:1,leadership:-5},
        result:'The attacker keeps access. A third station starts broadcasting the fake evacuation message before you act.' },
    ]
  },
  {
    title: 'Insider Threat Handling',
    prompt: 'The compromised credential belongs to a dormant vendor account reactivated the day before the attack. HR and Legal ask how to proceed with the vendor relationship while the investigation continues.',
    choices: [
      { label:'Suspend the vendor\u2019s access company-wide and preserve logs for forensic and legal review.', delta:{security:8,trust:3,continuity:1,leadership:6},
        result:'Access is cut cleanly and evidence is preserved, giving investigators a clean chain of custody.' },
      { label:'Confront the vendor directly before securing logs or access.', delta:{security:-5,trust:-2,continuity:0,leadership:-4},
        result:'Tipping your hand early risks the vendor covering tracks before logs are secured.' },
      { label:'Take no action against the vendor until the investigation fully concludes.', delta:{security:-6,trust:-3,continuity:-1,leadership:-3},
        result:'The access path stays technically available longer than necessary, an unnecessary residual risk.' },
    ]
  },
  {
    title: 'Public Communication',
    prompt: 'Social media mentions of a "SiberX hack" are climbing fast and a local outlet is asking for comment. Comms wants direction on what to say.',
    choices: [
      { label:'Issue a factual holding statement now: acknowledge the disruption, tell riders to trust only official channels.', delta:{security:1,trust:9,continuity:2,leadership:5},
        result:'A prompt, honest statement gets ahead of speculation and gives riders a clear, trustworthy signal.' },
      { label:'Say nothing publicly until the investigation is fully closed.', delta:{security:0,trust:-9,continuity:-2,leadership:-4},
        result:'Silence lets rumors and screenshots of the fake alerts fill the gap, and trust erodes fast.' },
      { label:'Downplay the incident as "routine maintenance" to avoid alarming riders.', delta:{security:0,trust:-11,continuity:-1,leadership:-7},
        result:'When the truth comes out, the mismatch does more damage to public trust than the incident itself.' },
    ]
  },
  {
    title: 'Eradication & Restoration',
    prompt: 'Compromised systems are isolated. Now you need to bring signage and PA back online without reintroducing the threat.',
    choices: [
      { label:'Revoke and rotate all exposed API keys, then rebuild from a verified green-field image.', delta:{security:10,trust:4,continuity:6,leadership:6},
        result:'A clean rebuild from trusted infrastructure closes the loop \u2014 the attacker has nothing left to walk back into.' },
      { label:'Patch the existing (possibly compromised) environment in place to restore service faster.', delta:{security:-7,trust:1,continuity:5,leadership:-2},
        result:'Service comes back quickly, but without a full rebuild you can\u2019t be certain the environment is clean.' },
      { label:'Restore from a backup taken before rotating credentials.', delta:{security:-4,trust:0,continuity:4,leadership:-1},
        result:'The backup may still contain the same exposed credentials \u2014 a partial fix at best.' },
    ]
  },
  {
    title: 'Leadership & Governance',
    prompt: 'The immediate crisis is contained. The board wants to know what changes going forward.',
    choices: [
      { label:'Commission a full post-incident review covering architecture, comms, and governance \u2014 and publish a summary.', delta:{security:6,trust:6,continuity:4,leadership:10},
        result:'Transparent review work turns a costly incident into an organizational strength, and rebuilds confidence with regulators and riders alike.' },
      { label:'Handle the review internally and keep findings confidential.', delta:{security:2,trust:-3,continuity:1,leadership:1},
        result:'Internal learning happens, but stakeholders are left without assurance that lessons will stick.' },
      { label:'Consider the incident closed once service is restored, without a formal review.', delta:{security:-6,trust:-4,continuity:-2,leadership:-8},
        result:'Without a review, the same shared-credential weakness remains for the next attacker to find.' },
    ]
  },
];

function renderStage(){
  const s = getState();
  const stageIdx = s.decisionStage;
  document.getElementById('stage-progress').textContent = `${Math.min(stageIdx,SCENARIO.length)}/${SCENARIO.length} decisions made`;

  if(stageIdx >= SCENARIO.length){
    document.getElementById('scenario-body').innerHTML = `<p>All decision points complete. See your debrief below.</p>`;
    document.getElementById('stage-label').textContent = 'Scenario complete';
    renderDebrief();
    document.getElementById('debrief-panel').style.display = 'block';
    renderScoreBars();
    return;
  }

  const stage = SCENARIO[stageIdx];
  document.getElementById('stage-label').textContent = `Stage ${stageIdx+1} of ${SCENARIO.length} — ${stage.title}`;
  document.getElementById('debrief-panel').style.display = 'none';

  const body = document.getElementById('scenario-body');
  body.innerHTML = `
    <h2 style="font-size:19px; text-transform:none;">${escapeHtml(stage.title)}</h2>
    <p>${escapeHtml(stage.prompt)}</p>
    <div id="choice-list"></div>
    <div id="result-box" style="display:none;" class="banner mt-16"></div>
    <button class="btn btn-primary mt-16" id="next-btn" type="button" style="display:none;">Continue →</button>
  `;
  const list = document.getElementById('choice-list');
  stage.choices.forEach((c, i)=>{
    const b = document.createElement('button');
    b.className = 'btn btn-block mt-8';
    b.type = 'button';
    b.style.textAlign = 'left';
    b.textContent = c.label;
    b.addEventListener('click', ()=> chooseOption(stageIdx, i));
    list.appendChild(b);
  });
  renderScoreBars();
}

function chooseOption(stageIdx, choiceIdx){
  const s = getState();
  const stage = SCENARIO[stageIdx];
  const choice = stage.choices[choiceIdx];

  Object.keys(choice.delta).forEach(k=>{
    s.score[k] = clamp(s.score[k] + choice.delta[k], 0, 100);
  });
  s.decisionsLog.push({ ts: nowTs(), text: `[${stage.title}] Chose: "${choice.label}"` });
  setState(s);

  document.querySelectorAll('#choice-list .btn').forEach(b=> b.disabled = true);
  const box = document.getElementById('result-box');
  box.style.display = 'flex';
  box.innerHTML = `<span>✓</span><span>${escapeHtml(choice.result)}</span>`;
  document.getElementById('next-btn').style.display = 'inline-flex';
  document.getElementById('next-btn').onclick = null;
  document.getElementById('next-btn').addEventListener('click', ()=>{
    const s2 = getState();
    s2.decisionStage = stageIdx + 1;
    setState(s2);
    renderStage();
  }, { once:true });
  renderScoreBars();
  renderTicker();
}

function renderScoreBars(){
  const s = getState();
  const labels = { security:'Security Architecture', trust:'Public Trust', continuity:'Operational Continuity', leadership:'Leadership & Governance' };
  const colors = { security:'var(--line-c)', trust:'var(--line-a)', continuity:'var(--line-b)', leadership:'var(--line-e)' };
  const mount = document.getElementById('score-bars');
  mount.innerHTML = Object.keys(labels).map(k=>`
    <div class="score-bar-row">
      <div class="lbl"><span>${labels[k]}</span><span>${s.score[k]}</span></div>
      <div class="score-bar-track"><div class="score-bar-fill" style="width:${s.score[k]}%; background:${colors[k]};"></div></div>
    </div>
  `).join('');
}

function renderDebrief(){
  const s = getState();
  const avg = Math.round((s.score.security + s.score.trust + s.score.continuity + s.score.leadership) / 4);
  let verdict, verdictColor;
  if(avg >= 75){ verdict = 'Resilient Response'; verdictColor='var(--status-ok)'; }
  else if(avg >= 50){ verdict = 'Adequate, With Gaps'; verdictColor='var(--status-degraded)'; }
  else { verdict = 'Response Needs Rework'; verdictColor='var(--status-critical)'; }

  const choiceList = s.decisionsLog.filter(d=>d.text.startsWith('[')).map(d=>`<li>${escapeHtml(d.text.replace(/^\[[^\]]+\]\s*/,''))}</li>`).join('');

  document.getElementById('debrief-body').innerHTML = `
    <p style="color:${verdictColor}; font-family:var(--font-display); font-size:20px; font-weight:700;">${escapeHtml(verdict)} — average score ${avg}/100</p>
    <p>Your choices across detection, containment, insider-threat handling, communications, restoration, and governance shaped how SiberX came through this incident.</p>
    <h4 style="margin-top:16px; text-transform:none;">Choices made</h4>
    <ol style="color:var(--text-dim); font-size:13.5px; padding-left:18px;">${choiceList}</ol>
    <div class="banner mt-16">
      <span>📋</span>
      <span><b>Lessons emphasized in this exercise:</b> layered security architecture, integrated public communications, business continuity planning, decisive leadership, cyber resilience, and coordinated governance — all essential to defending interconnected critical infrastructure.</span>
    </div>
  `;
}

document.getElementById('restart-btn').addEventListener('click', ()=>{
  const s = getState();
  s.decisionStage = 0;
  s.score = { security:50, trust:50, continuity:50, leadership:50 };
  s.decisionsLog = s.decisionsLog.filter(d=>!d.text.startsWith('['));
  setState(s);
  renderStage();
});

renderTicker();
renderStage();

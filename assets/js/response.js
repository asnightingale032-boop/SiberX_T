requireAuth();
renderControlBar('response.html');

document.getElementById('card-check-btn').addEventListener('click', ()=>{
  const val = document.getElementById('card-check').value.trim();
  const box = document.getElementById('card-result');
  box.style.display = 'flex';
  if(!isFourDigits(val)){
    box.innerHTML = `<span>\u26a0\ufe0f</span><span>Enter exactly 4 digits to run the simulated check.</span>`;
    return;
  }
  // Deterministic pseudo-result derived from the digits, for demo purposes
  // only — nothing here is transmitted or checked against a real system.
  const sum = val.split('').reduce((a,d)=>a+Number(d),0);
  const affected = sum % 4 === 0;
  if(affected){
    box.style.borderColor = 'var(--status-degraded)';
    box.innerHTML = `<span>\u26a0\ufe0f</span><span>Cards ending in <b>${escapeHtml(val)}</b> were used at a station during the affected window. No payment data exposure has been confirmed, but we recommend monitoring your statement.</span>`;
  } else {
    box.style.borderColor = '';
    box.innerHTML = `<span>\u2705</span><span>Cards ending in <b>${escapeHtml(val)}</b> do not appear in the affected activity window.</span>`;
  }
});

document.getElementById('r-submit').addEventListener('click', ()=>{
  const name = sanitizeText(document.getElementById('r-name').value, 60) || 'Anonymous rider';
  const station = sanitizeText(document.getElementById('r-station').value, 80);
  const detail = sanitizeText(document.getElementById('r-detail').value, 500);
  if(!detail) return;
  const s = getState();
  s.submissions.push({ ts: nowTs(), kind:'Public report', text: `${station ? '['+station+'] ' : ''}${detail}`, author: name });
  setState(s);
  document.getElementById('r-name').value = '';
  document.getElementById('r-station').value = '';
  document.getElementById('r-detail').value = '';
  document.getElementById('r-confirm').style.display = 'flex';
  setTimeout(()=> document.getElementById('r-confirm').style.display = 'none', 4000);
});

renderTicker();

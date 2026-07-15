/* Login flow: two-step credential + MFA simulation.
   No network calls are made anywhere in this file — there is nothing
   to intercept. Input is constrained (maxlength/pattern in HTML,
   sanitizeText here) before it ever touches localStorage, and
   escaped again at render time by app.js's escapeHtml(). */

let selectedRole = 'Incident Commander';

document.getElementById('role-grid').addEventListener('click', (e)=>{
  const opt = e.target.closest('.role-opt');
  if(!opt) return;
  selectRole(opt);
});
document.getElementById('role-grid').addEventListener('keydown', (e)=>{
  if(e.key !== 'Enter' && e.key !== ' ') return;
  const opt = e.target.closest('.role-opt');
  if(!opt) return;
  e.preventDefault();
  selectRole(opt);
});
function selectRole(opt){
  document.querySelectorAll('.role-opt').forEach(o=>o.classList.remove('selected'));
  opt.classList.add('selected');
  selectedRole = opt.dataset.role;
}

document.getElementById('to-mfa-btn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('name');
  const passInput = document.getElementById('pass');
  if(!nameInput.checkValidity() || !passInput.checkValidity()){
    nameInput.reportValidity();
    passInput.reportValidity();
    return;
  }
  document.getElementById('step-credentials').style.display = 'none';
  document.getElementById('step-mfa').style.display = 'block';
  document.getElementById('mfa').focus();
});

document.getElementById('back-btn').addEventListener('click', ()=>{
  document.getElementById('step-mfa').style.display = 'none';
  document.getElementById('step-credentials').style.display = 'block';
});

document.getElementById('login-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const mfaInput = document.getElementById('mfa');
  if(!isSixDigitCode(mfaInput.value)){
    mfaInput.reportValidity();
    return;
  }
  const rawName = document.getElementById('name').value;
  const name = sanitizeText(rawName, 40) || 'Responder';

  setState({ user: { name, role: selectedRole }, lastActivity: Date.now() });
  if(!getState().alerts.length){
    addAlert('info', `Responder ${name} (${selectedRole}) authenticated with second-factor verification and joined Crisis Command.`);
  }
  window.location.href = 'dashboard.html';
});

if(new URLSearchParams(window.location.search).has('expired')){
  document.getElementById('expired-banner').style.display = 'flex';
}

setInterval(()=>{ document.getElementById('clock').textContent = nowTs(); }, 1000);
document.getElementById('clock').textContent = nowTs();

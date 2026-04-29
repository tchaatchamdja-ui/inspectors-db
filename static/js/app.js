// ===== STATE =====
const state = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  theme: localStorage.getItem('theme') || 'blue-dark',
  page: location.hash.slice(1) || 'login'
};

// ===== API =====
async function api(url, options = {}) {
  const headers = { ...options.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// ===== AUTH =====
function logout() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  navigate('login');
}

function navigate(page) {
  state.page = page;
  location.hash = page;
  render();
  window.scrollTo(0, 0);
}

async function reloadKeepScroll(fn) {
  const y = window.scrollY;
  const x = window.scrollX;
  await fn();
  requestAnimationFrame(() => window.scrollTo(x, y));
}

let inactivityTimer;
function resetInactivity() {
  clearTimeout(inactivityTimer);
  if (state.user) {
    inactivityTimer = setTimeout(logout, 20 * 60 * 1000);
  }
}
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(e => window.addEventListener(e, resetInactivity));

// ===== CONSTANTS =====
let ETATS = ['Burkina Faso', 'B\u00e9nin', "C\u00f4te d'Ivoire", 'Guin\u00e9e-Bissau', 'Mali', 'Mauritanie', 'Niger', 'S\u00e9n\u00e9gal', 'Togo', 'UEMOA'];
let DOMAINES = ['PEL', 'AIR', 'OPS', 'AGA', 'AIG', 'PNS', 'AVSEC'];
const DOMAINE_LABELS = { PEL: 'Personnel (PEL)', AIR: 'Navigabilit\u00e9 (AIR)', OPS: 'Exploitation (OPS)', AGA: 'A\u00e9rodromes (AGA)', AIG: 'Enqu\u00eates (AIG)', PNS: 'S\u00e9curit\u00e9 (PNS)', AVSEC: 'Suret\u00e9 (AVSEC)' };
const DOMAINE_COLORS = { PEL: '#3182ce', AIR: '#e53e3e', OPS: '#38a169', AGA: '#d69e2e', AIG: '#805ad5', PNS: '#dd6b20', AVSEC: '#319795' };
let NIVEAUX = ['Inspecteur Stagiaire', 'Inspecteur Titulaire', 'Inspecteur Principal', 'Inspecteur Senior', 'Enqu\u00eateur Technique', 'Enqu\u00eateur de Premi\u00e8re Information', 'Enqu\u00eateur Confirm\u00e9'];
let FORMATEUR_TYPES = ['Instructeur', 'D\u00e9veloppeur de Cours'];
const SPECIALITES_BY_DOMAINE = {
  PEL: ['Licence et formation du Personnel', 'M\u00e9decine a\u00e9ronautique'],
  AIR: ['Navigabilit\u00e9 des A\u00e9ronefs - Cellule et Moteur', 'Navigabilit\u00e9 des A\u00e9ronefs - Avionique'],
  OPS: ['Exploitation technique des A\u00e9ronefs - Sol', 'Exploitation technique des A\u00e9ronefs - Vol', 'Exploitation technique des A\u00e9ronefs - S\u00e9curit\u00e9 Cabine', 'Exploitation technique des A\u00e9ronefs - Marchandises dangereuses', 'Pilotage'],
  AGA: ['G\u00e9nie Civil', 'Exploitation et Gestion du P\u00e9ril Animalier', "Sauvetage et Lutte contre l'incendie", '\u00c9nergie et Balisage', 'Gestion A\u00e9roportuaire'],
  AIG: ['Enqu\u00eates accidents/incidents'],
  PNS: ['Circulation a\u00e9rienne', 'Transport a\u00e9rien'],
  AVSEC: ['S\u00fbret\u00e9 de l\u2019aviation civile']
};
const SPECIALITES = Object.values(SPECIALITES_BY_DOMAINE).flat();
const EXP_FILTERS = [['', 'Toutes'], ['less1', 'Moins de 1 an'], ['1to3', '1 \u00e0 3 ans'], ['3to5', '3 \u00e0 5 ans'], ['5to8', '5 \u00e0 8 ans'], ['8to10', '8 \u00e0 10 ans'], ['10to15', '10 \u00e0 15 ans'], ['15plus', '15 ans et plus']];

// ===== THEME =====
function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.theme === theme));
}

// ===== REFRESH SETTINGS CONSTANTS =====
async function refreshSettingsConstants() {
  try {
    const all = await api('/settings/active');
    const byCategory = {};
    all.forEach(s => { if (!byCategory[s.category]) byCategory[s.category] = []; byCategory[s.category].push(s); });
    if (byCategory.etat) ETATS = byCategory.etat.map(s => s.value);
    if (byCategory.domaine) {
      DOMAINES = byCategory.domaine.map(s => s.value);
      byCategory.domaine.forEach(s => { if (s.label) DOMAINE_LABELS[s.value] = s.label; });
    }
    if (byCategory.niveau) NIVEAUX = byCategory.niveau.map(s => s.value);
    if (byCategory.formateur) FORMATEUR_TYPES = byCategory.formateur.map(s => s.value);
  } catch (e) { /* ignore if not logged in */ }
}

// ===== RENDER =====
function render() {
  const app = document.getElementById('app');
  document.documentElement.setAttribute('data-theme', state.theme);
  if (!state.user) { state.page = 'login'; app.innerHTML = renderLogin(); initLogin(); return; }
  if (state.user.mustChangePassword) { app.innerHTML = renderChangePassword(); initChangePassword(); return; }
  if (state.page === 'login') state.page = 'inspectors';

  let mainContent = '';
  if (state.page === 'access' && state.user.role === 'Administrateur') {
    mainContent = '<div id="access-page"></div>';
  } else if (state.page === 'analytics' && state.user.role !== 'National 2') {
    mainContent = '<div id="analytics-page"></div>';
  } else if (state.page === 'settings' && (state.user.role === 'Administrateur' || state.user.role === 'R\u00e9gional')) {
    mainContent = '<div id="settings-page"></div>';
  } else if (state.page === 'formateurs') {
    mainContent = '<div id="formateurs-page"></div>';
  } else {
    mainContent = '<div id="inspectors-page"></div>';
  }

  app.innerHTML = `${renderHeader()}<main class="main-content">${mainContent}</main>`;
  initHeader();
  if (state.page === 'access' && state.user.role === 'Administrateur') loadAccessPage();
  else if (state.page === 'analytics' && state.user.role !== 'National 2') loadAnalyticsPage();
  else if (state.page === 'settings' && (state.user.role === 'Administrateur' || state.user.role === 'R\u00e9gional')) loadSettingsPage();
  else if (state.page === 'formateurs') loadFormateursPage();
  else loadInspectorsPage();
}

// ===== LOGIN =====
function renderLogin() {
  return `
  <div class="login-page">
    <div class="login-bg">
      <svg class="plane plane-1" viewBox="0 0 100 40" fill="rgba(255,255,255,0.08)"><path d="M95 20L70 8V16H10C6 16 2 18 2 20s4 4 8 4h60v8z"/></svg>
      <svg class="plane plane-2" viewBox="0 0 100 40" fill="rgba(255,255,255,0.05)"><path d="M95 20L70 8V16H10C6 16 2 18 2 20s4 4 8 4h60v8z"/></svg>
      <svg class="plane plane-3" viewBox="0 0 100 40" fill="rgba(255,255,255,0.04)"><path d="M5 20L30 8V16H90C94 16 98 18 98 20s-4 4-8 4H30v8z"/></svg>
      <div class="cloud cloud-1"></div><div class="cloud cloud-2"></div><div class="cloud cloud-3"></div>
    </div>
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="/static/img/logo-uemoa.png" alt="UEMOA" class="login-logo">
          <h1>Base de donn\u00e9es des Inspecteurs et formateurs</h1>
        </div>
        <div id="login-form-container">
          <form id="login-form">
            <div id="login-error"></div>
            <div class="form-group">
              <label>Nom d'utilisateur</label>
              <div class="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="login-username" placeholder="Email ou Admin" required autofocus>
              </div>
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <div class="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type="password" id="login-password" placeholder="Mot de passe" required>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="login-btn">Se connecter</button>
            <button type="button" class="btn btn-text btn-block" id="show-reset-btn">Mot de passe oubli\u00e9 ?</button>
          </form>
        </div>
        <div id="reset-form-container" style="display:none">
          <h3 style="margin-bottom:1rem">R\u00e9initialisation du mot de passe</h3>
          <form id="reset-form">
            <div id="reset-error"></div>
            <div id="reset-success"></div>
            <div class="form-group"><label>Email (nom d'utilisateur)</label><input type="text" id="reset-email" placeholder="Votre nom d'utilisateur ou email" required></div>
            <button type="submit" class="btn btn-primary btn-block">Demander la r\u00e9initialisation</button>
            <button type="button" class="btn btn-text btn-block" id="back-login-btn">Retour \u00e0 la connexion</button>
          </form>
        </div>
      </div>
      <div class="login-footer"><p>&copy; UEMOA / URSAC</p></div>
    </div>
  </div>`;
}

function initLogin() {
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errDiv = document.getElementById('login-error');
    btn.disabled = true; btn.textContent = 'Connexion...'; errDiv.innerHTML = '';
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('login-username').value, password: document.getElementById('login-password').value }) });
      state.token = data.token; state.user = data.user;
      localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
      await refreshSettingsConstants();
      resetInactivity(); navigate(data.user?.role === 'National 2' ? 'inspectors' : 'analytics');
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
    finally { btn.disabled = false; btn.textContent = 'Se connecter'; }
  });
  document.getElementById('show-reset-btn')?.addEventListener('click', () => { document.getElementById('login-form-container').style.display = 'none'; document.getElementById('reset-form-container').style.display = 'block'; });
  document.getElementById('back-login-btn')?.addEventListener('click', () => { document.getElementById('login-form-container').style.display = 'block'; document.getElementById('reset-form-container').style.display = 'none'; });
  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('reset-error'); const successDiv = document.getElementById('reset-success');
    errDiv.innerHTML = ''; successDiv.innerHTML = '';
    try {
      const data = await api('/auth/request-reset', { method: 'POST', body: JSON.stringify({ email: document.getElementById('reset-email').value }) });
      successDiv.innerHTML = `<div class="alert alert-success">${data.message}</div>`;
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}

// ===== CHANGE PASSWORD =====
function renderChangePassword() {
  return `
  <div class="login-page"><div class="login-container"><div class="login-card">
    <div class="login-header">
      <img src="/static/img/logo-uemoa.png" alt="UEMOA" class="login-logo" style="width:60px;height:60px;object-fit:contain">
      <h2>Changement de mot de passe obligatoire</h2>
      <p class="login-subtitle">Veuillez d\u00e9finir un nouveau mot de passe pour continuer</p>
    </div>
    <form id="change-pw-form">
      <div id="change-pw-error"></div>
      <div class="form-group"><label>Nouveau mot de passe</label><input type="password" id="new-pw" placeholder="Minimum 6 caract\u00e8res" required></div>
      <div class="form-group"><label>Confirmer le mot de passe</label><input type="password" id="confirm-pw" placeholder="Confirmer votre mot de passe" required></div>
      <button type="submit" class="btn btn-primary btn-block">Modifier le mot de passe</button>
      <button type="button" class="btn btn-text btn-block" onclick="logout()">Annuler et se d\u00e9connecter</button>
    </form>
  </div></div></div>`;
}

function initChangePassword() {
  document.getElementById('change-pw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('change-pw-error');
    const newPw = document.getElementById('new-pw').value;
    const confirmPw = document.getElementById('confirm-pw').value;
    errDiv.innerHTML = '';
    if (newPw.length < 6) { errDiv.innerHTML = '<div class="alert alert-error">Minimum 6 caract\u00e8res</div>'; return; }
    if (newPw !== confirmPw) { errDiv.innerHTML = '<div class="alert alert-error">Les mots de passe ne correspondent pas</div>'; return; }
    try {
      const data = await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword: newPw }) });
      state.token = data.token; state.user.mustChangePassword = false;
      localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(state.user));
      navigate(state.user?.role === 'National 2' ? 'inspectors' : 'analytics');
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}

// ===== HEADER =====
function renderHeader() {
  const isAdmin = state.user?.role === 'Administrateur';
  const canAnalytics = state.user?.role !== 'National 2';
  return `
  <header class="header">
    <div class="header-left">
      <div class="logo-header">
        <img src="/static/img/logo-uemoa.png" alt="UEMOA" class="logo-icon">
        <span class="app-title">Base de donn\u00e9es des Inspecteurs et formateurs</span>
      </div>
      <nav class="nav">
        ${canAnalytics ? `<button class="nav-btn ${state.page === 'analytics' ? 'active' : ''}" onclick="navigate('analytics')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          Tableau de bord
        </button>` : ''}
        <button class="nav-btn ${state.page === 'inspectors' ? 'active' : ''}" onclick="navigate('inspectors')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Inspecteurs
        </button>
        <button class="nav-btn ${state.page === 'formateurs' ? 'active' : ''}" onclick="navigate('formateurs')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Formateurs
        </button>
        ${isAdmin || state.user?.role === 'R\u00e9gional' ? `<button class="nav-btn ${state.page === 'settings' ? 'active' : ''}" onclick="navigate('settings')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Param\u00e8tres
        </button>` : ''}
        ${isAdmin ? `<button class="nav-btn ${state.page === 'access' ? 'active' : ''}" onclick="navigate('access')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Gestion des acc\u00e8s
        </button>` : ''}
      </nav>
    </div>
    <div class="header-right">
      <div class="user-info">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>${state.user?.username || ''}</span>
        <span class="role-badge">${state.user?.role || ''}</span>
      </div>
      <div class="theme-selector-header">
        <button class="theme-dot theme-blue-dark ${state.theme === 'blue-dark' ? 'active' : ''}" data-theme="blue-dark" onclick="setTheme('blue-dark')" title="Bleu fonc\u00e9"></button>
        <button class="theme-dot theme-blue-sky ${state.theme === 'blue-sky' ? 'active' : ''}" data-theme="blue-sky" onclick="setTheme('blue-sky')" title="Bleu ciel"></button>
        <button class="theme-dot theme-violet ${state.theme === 'violet' ? 'active' : ''}" data-theme="violet" onclick="setTheme('violet')" title="Violet"></button>
        <button class="theme-dot theme-green ${state.theme === 'green' ? 'active' : ''}" data-theme="green" onclick="setTheme('green')" title="Vert"></button>
        <button class="theme-dot theme-grey ${state.theme === 'grey' ? 'active' : ''}" data-theme="grey" onclick="setTheme('grey')" title="Gris"></button>
      </div>
      <button class="btn-icon" onclick="logout()" style="color:white" title="D\u00e9connexion">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </div>
  </header>`;
}

function initHeader() {}

// ===== INSPECTORS PAGE =====
let inspectorsData = { inspectors: [], total: 0 };
let inspectorsStats = { total: 0, byState: [], byDomain: [] };
let inspFilters = { etat: '', domaine: '', niveau: '', experience: '', search: '', status: 'active' };
let inspPage = 1;
let inspPageSize = 50;
let inspSort = { col: '', dir: 'asc' };

async function loadInspectorsPage() {
  const container = document.getElementById('inspectors-page');
  if (!container) return;
  inspFilters = { etat: '', domaine: '', niveau: '', experience: '', search: '', status: 'active' };
  inspPage = 1;
  try {
    const filterStr = buildFilterParams();
    const [stats, data] = await Promise.all([api(`/inspectors/stats?${filterStr}`), api(`/inspectors?${filterStr}`)]);
    inspectorsStats = stats; inspectorsData = data;
  } catch (err) { if (err.message.includes('expir\u00e9e')) { logout(); return; } }
  renderInspectorsContent();
}

function buildFilterParams() {
  const p = new URLSearchParams();
  if (inspFilters.etat) p.append('etat', inspFilters.etat);
  if (inspFilters.domaine) p.append('domaine', inspFilters.domaine);
  if (inspFilters.niveau) p.append('niveau', inspFilters.niveau);
  if (inspFilters.experience) p.append('experience', inspFilters.experience);
  if (inspFilters.search) p.append('search', inspFilters.search);
  p.append('status', inspFilters.status);
  p.append('page', inspPage);
  p.append('limit', inspPageSize);
  return p.toString();
}

function renderInspectorsContent() {
  const container = document.getElementById('inspectors-page');
  if (!container) return;
  const role = state.user?.role;
  const canAdd = ['National 1', 'R\u00e9gional', 'Administrateur'].includes(role);
  const canEmail = ['R\u00e9gional', 'Administrateur'].includes(role);
  const canDeactivate = role === 'Administrateur';

  container.innerHTML = `
    <div id="floating-msg"></div>
    <div class="dashboard-section dashboard-domaine-full">
      <h3 class="dashboard-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Situation par \u00c9tat</h3>
      <div class="dashboard dashboard-flex">
        <div class="stat-card stat-total"><div class="stat-number">${inspectorsStats.total}</div><div class="stat-label">Total Inspecteurs</div></div>
        ${inspectorsStats.byState.map(s => `<div class="stat-card" onclick="filterByState('${s.etat.replace(/'/g, "\\'")}')" style="cursor:pointer${inspFilters.etat === s.etat ? ';border-color:var(--primary)' : ''}"><div class="stat-number">${s.count}</div><div class="stat-label">${s.etat}</div></div>`).join('')}
      </div>
    </div>
    <div class="dashboard-section dashboard-domaine-full">
      <h3 class="dashboard-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Situation par Domaine</h3>
      <div class="dashboard dashboard-flex">
        ${(inspectorsStats.byDomain || []).map(d => `<div class="stat-card stat-domain" onclick="applyFilter('domaine','${d.domaine}')" style="cursor:pointer${inspFilters.domaine === d.domaine ? ';border-color:var(--primary)' : ''}" title="${DOMAINE_LABELS[d.domaine] || d.domaine}"><div class="stat-number" style="color:${DOMAINE_COLORS[d.domaine] || 'var(--primary)'}">${d.count}</div><div class="stat-label">${d.domaine}</div></div>`).join('')}
      </div>
    </div>
    <div class="filters-bar filters-compact">
      <div class="filters-row-inline">
        <select id="f-etat" onchange="applyFilter('etat', this.value)"><option value="">Tous les \u00c9tats</option>${ETATS.map(e => `<option value="${e}" ${inspFilters.etat === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
        <select id="f-domaine" onchange="applyFilter('domaine', this.value)"><option value="">Tous les domaines</option>${DOMAINES.map(d => `<option value="${d}" ${inspFilters.domaine === d ? 'selected' : ''}>${DOMAINE_LABELS[d]}</option>`).join('')}</select>
        <select id="f-niveau" onchange="applyFilter('niveau', this.value)"><option value="">Tous les niveaux</option>${NIVEAUX.map(n => `<option value="${n}" ${inspFilters.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select id="f-experience" onchange="applyFilter('experience', this.value)">${EXP_FILTERS.map(([v, l]) => `<option value="${v}" ${inspFilters.experience === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="f-status" onchange="applyFilter('status', this.value)"><option value="active" ${inspFilters.status === 'active' ? 'selected' : ''}>Actifs</option><option value="inactive" ${inspFilters.status === 'inactive' ? 'selected' : ''}>Inactifs</option><option value="all" ${inspFilters.status === 'all' ? 'selected' : ''}>Tous</option></select>
        <input type="text" id="f-search" placeholder="Rechercher..." value="${inspFilters.search}" oninput="applySearchDebounced(this.value)" class="filter-search-input">
        <button class="btn-icon" onclick="resetFilters()" title="R\u00e9initialiser les filtres"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
        <div class="export-dropdown" style="position:relative;display:inline-block">
          <button class="btn btn-outline btn-sm" onclick="toggleExportMenu()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> T\u00e9l\u00e9charger \u25bc</button>
          <div id="export-menu" class="export-menu">
            <button onclick="exportFile('csv')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38a169" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export CSV</span><small>.csv</small></button>
            <button onclick="exportFile('excel')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export Excel</span><small>.xlsx</small></button>
            <button onclick="exportFile('pdf')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export PDF</span><small>.pdf</small></button>
            ${state.user?.role === 'Administrateur' ? `<div style="border-top:1px solid #e2e8f0;margin:0.25rem 0"></div><button onclick="downloadImportTemplate('inspectors')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Modèle d'import</span><small>.xlsx</small></button>` : ''}
          </div>
        </div>
        ${state.user?.role === 'Administrateur' ? `<button class="btn btn-outline btn-sm" onclick="document.getElementById('import-inspectors-file').click()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importer Excel</button><input type="file" id="import-inspectors-file" accept=".xlsx" style="display:none" onchange="importInspectors(this)">` : ''}
        ${canDeactivate ? `<button class="btn btn-sm" id="insp-delete-btn" style="background:#dc2626;color:white;display:none" onclick="bulkDeleteInspectors()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Supprimer</button>` : ''}
        ${canAdd ? `<button class="btn btn-primary btn-sm" onclick="openInspectorForm()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Inspecteur</button>` : ''}
      </div>
    </div>
    <div class="results-info" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><span>${inspectorsData.total} inspecteur${inspectorsData.total > 1 ? 's' : ''} trouv\u00e9${inspectorsData.total > 1 ? 's' : ''}</span><label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;white-space:nowrap">Afficher <select onchange="changeInspPageSize(this.value)" style="padding:0.25rem 0.5rem">${[10,25,50,100,200].map(n=>`<option value="${n}" ${inspPageSize===n?'selected':''}>${n}</option>`).join('')}</select> par page</label></div>
    <div class="table-container">
      <table class="data-table">
        <thead><tr>${canDeactivate ? '<th style="width:30px"><input type="checkbox" onchange="toggleAllInspectors(this.checked)"></th>' : ''}<th class="sortable" style="display:none" onclick="inspSortBy('reference')">R\u00e9f.${inspSortIcon('reference')}</th><th class="sortable" onclick="inspSortBy('nom')">Nom et Pr\u00e9nom${inspSortIcon('nom')}</th><th class="sortable" onclick="inspSortBy('etat')">\u00c9tat${inspSortIcon('etat')}</th><th class="sortable" onclick="inspSortBy('domaine')">Domaine${inspSortIcon('domaine')}</th><th>Sp\u00e9cialit\u00e9</th><th>Titularisation</th><th class="sortable" onclick="inspSortBy('niveau')">Niveau${inspSortIcon('niveau')}</th><th>Exp.</th><th>Actions</th></tr></thead>
        <tbody>
          ${inspectorsData.inspectors.length === 0 ? `<tr><td colspan="${canDeactivate ? 10 : 9}" class="text-center">Aucun inspecteur trouv\u00e9</td></tr>` :
            inspectorsData.inspectors.map(ins => {
              const domains = [...new Set((ins.qualifications || []).map(q => q.domaine))].join(', ');
              const specs = (ins.qualifications || []).map(q => q.specialite).join('; ');
              const tit0 = ins.qualifications?.[0]?.titularisation || '';
              const titFmt = tit0 ? new Date(tit0 + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '';
              const niveau = ins.qualifications?.[0]?.niveau || '';
              const exp = ins.qualifications?.[0]?.experience || '';
              const canEditThis = role === 'Administrateur' || role === 'R\u00e9gional' || role === 'National 1' || (role === 'National 2' && state.user?.inspectorId === ins.id);
              const inactiveClass = !ins.is_active ? ' row-inactive' : '';
              return `<tr class="${inactiveClass}">
                ${canDeactivate ? `<td><input type="checkbox" class="insp-check" value="${ins.id}" onchange="updateInspDeleteBtn()"></td>` : ''}
                <td class="ref-cell" style="display:none">${ins.reference}</td>
                <td>${esc(ins.nom)} ${esc(ins.prenom)}</td>
                <td><span class="state-badge">${esc(ins.etat)}</span></td>
                <td>${esc(domains)}</td>
                <td class="specialite-cell" title="${esc(specs)}">${esc(specs)}</td>
                <td>${titFmt}</td>
                <td>${esc(niveau)}</td>
                <td>${esc(exp)}</td>
                <td class="actions-cell">
                  <button class="btn-icon" title="Voir" onclick="viewInspector(${ins.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                  ${canEditThis ? `<button class="btn-icon" title="Modifier" onclick="editInspector(${ins.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                  ${canEmail && ins.email ? `<button class="btn-icon" title="Email" onclick="openEmailForm(${ins.id}, '${esc(ins.email)}', '${esc(ins.prenom)} ${esc(ins.nom)}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></button>` : ''}
                  ${ins.cv_path ? `<a class="btn-icon" href="/uploads/${ins.cv_path}" download title="CV"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>` : ''}
                  ${role === 'Administrateur' ? `<button class="btn-icon" title="${ins.has_user ? 'Compte utilisateur d\u00e9j\u00e0 cr\u00e9\u00e9' : 'Cr\u00e9er un compte utilisateur'}" ${ins.has_user ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''} onclick="createUserForInspector(${ins.id}, '${esc(ins.email||'')}', ${ins.has_user?'true':'false'})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></button>` : ''}
                  ${canDeactivate && ins.is_active ? `<button class="btn-icon btn-danger" title="D\u00e9sactiver" onclick="deactivateInspector(${ins.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>` : ''}
                  ${canDeactivate && !ins.is_active ? `<button class="btn-icon btn-success" title="R\u00e9activer" onclick="activateInspector(${ins.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
                </td>
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
    ${inspectorsData.totalPages > 1 ? `<div class="pagination"><button ${inspPage <= 1 ? 'disabled' : ''} onclick="changePage(${inspPage - 1})">Pr\u00e9c\u00e9dent</button><span>Page ${inspPage} / ${inspectorsData.totalPages}</span><button ${inspPage >= inspectorsData.totalPages ? 'disabled' : ''} onclick="changePage(${inspPage + 1})">Suivant</button></div>` : ''}
  `;
}

function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function filterByState(etat) { inspFilters.etat = inspFilters.etat === etat ? '' : etat; inspPage = 1; reloadInspectors(); }
function applyFilter(key, value) { inspFilters[key] = value; inspPage = 1; reloadInspectors(); }
let searchTimeout;
function applySearchDebounced(value) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { inspFilters.search = value; inspPage = 1; reloadInspectors(); }, 300); }
function resetFilters() { inspFilters = { etat: '', domaine: '', niveau: '', experience: '', search: '', status: 'active' }; inspPage = 1; reloadInspectors(); }
function changePage(p) { inspPage = p; reloadInspectors(); }
function changeInspPageSize(n) { inspPageSize = parseInt(n); inspPage = 1; reloadInspectors(); }

function inspSortIcon(col) {
  if (inspSort.col !== col) return ' <span style="opacity:0.3;font-size:0.7em">\u25B2\u25BC</span>';
  return inspSort.dir === 'asc' ? ' <span style="font-size:0.7em">\u25B2</span>' : ' <span style="font-size:0.7em">\u25BC</span>';
}
function inspSortBy(col) {
  if (inspSort.col === col) { inspSort.dir = inspSort.dir === 'asc' ? 'desc' : 'asc'; }
  else { inspSort.col = col; inspSort.dir = 'asc'; }
  sortInspectorsLocal();
  renderInspectorsContent();
}
function sortInspectorsLocal() {
  if (!inspSort.col) return;
  const arr = inspectorsData.inspectors;
  arr.sort((a, b) => {
    let va, vb;
    if (inspSort.col === 'domaine') {
      va = (a.qualifications || []).map(q => q.domaine).join(',');
      vb = (b.qualifications || []).map(q => q.domaine).join(',');
    } else if (inspSort.col === 'niveau') {
      va = a.qualifications?.[0]?.niveau || '';
      vb = b.qualifications?.[0]?.niveau || '';
    } else {
      va = a[inspSort.col] || '';
      vb = b[inspSort.col] || '';
    }
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return inspSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return inspSort.dir === 'asc' ? 1 : -1;
    return 0;
  });
}

async function reloadInspectors() {
  try {
    const filterStr = buildFilterParams();
    const [stats, data] = await Promise.all([api(`/inspectors/stats?${filterStr}`), api(`/inspectors?${filterStr}`)]);
    inspectorsStats = stats; inspectorsData = data;
  } catch (err) { if (err.message.includes('expir\u00e9e')) logout(); }
  renderInspectorsContent();
}

function buildExportParams() {
  const p = new URLSearchParams();
  if (inspFilters.etat) p.append('etat', inspFilters.etat);
  if (inspFilters.domaine) p.append('domaine', inspFilters.domaine);
  if (inspFilters.niveau) p.append('niveau', inspFilters.niveau);
  if (inspFilters.experience) p.append('experience', inspFilters.experience);
  if (inspFilters.search) p.append('search', inspFilters.search);
  if (inspFilters.status) p.append('status', inspFilters.status);
  return p.toString();
}

async function exportFile(format) {
  try {
    const params = buildExportParams();
    const res = await fetch(`/api/inspectors/export/${format}?${params}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors du t\u00e9l\u00e9chargement');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ext = format === 'excel' ? 'xlsx' : (format === 'pdf' ? 'pdf' : 'csv');
    a.href = url;
    a.download = `inspecteurs.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage(`Export ${format.toUpperCase()} t\u00e9l\u00e9charg\u00e9 avec succ\u00e8s`);
  } catch (err) {
    if (err.message.includes('expir\u00e9e')) { logout(); return; }
    showMessage(err.message, 'error');
  }
}

function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.toggle('show');
  // Close on outside click
  setTimeout(() => {
    const handler = (e) => {
      if (!e.target.closest('.export-dropdown')) {
        const m = document.getElementById('export-menu');
        if (m) m.classList.remove('show');
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 10);
}

function showMessage(msg, type = 'success') {
  const el = document.getElementById('floating-msg');
  if (el) { el.innerHTML = `<div class="alert alert-${type} floating-alert">${msg}</div>`; setTimeout(() => { el.innerHTML = ''; }, 4000); }
}

// ===== MODAL SYSTEM =====
function openModal(content, cls = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${cls}">${content}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}
function closeModal() { document.querySelector('.modal-overlay')?.remove(); }

// ===== VIEW INSPECTOR =====
async function viewInspector(id) {
  try {
    const ins = await api(`/inspectors/${id}`);
    openModal(`
      <div class="modal-header"><h3>D\u00e9tails de l'inspecteur</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item"><label>R\u00e9f\u00e9rence</label><span>${ins.reference}</span></div>
          <div class="detail-item"><label>Nom et Pr\u00e9nom</label><span>${esc(ins.nom)} ${esc(ins.prenom)}</span></div>
          <div class="detail-item"><label>\u00c9tat</label><span>${esc(ins.etat)}</span></div>
          <div class="detail-item"><label>Email</label><span>${esc(ins.email || 'Non renseign\u00e9')}</span></div>
          <div class="detail-item"><label>T\u00e9l\u00e9phone</label><span>${esc(ins.telephone || 'Non renseign\u00e9')}</span></div>
          <div class="detail-item"><label>Statut</label><span class="status-badge ${ins.is_active ? 'active' : 'inactive'}">${ins.is_active ? 'Actif' : 'Inactif'}</span></div>
        </div>
        <h4 style="margin-top:1.5rem;margin-bottom:0.5rem">Qualifications</h4>
        ${(ins.qualifications || []).map(q => { const tf = q.titularisation ? new Date(q.titularisation+'-01').toLocaleDateString('fr-FR',{month:'short',year:'numeric'}) : ''; return `<div class="qual-card"><span class="qual-domain">${DOMAINE_LABELS[q.domaine] || q.domaine}</span><div><strong>Sp\u00e9cialit\u00e9:</strong> ${esc(q.specialite)}</div><div><strong>Niveau:</strong> ${esc(q.niveau)}</div>${tf ? `<div><strong>Titularisation:</strong> ${tf}</div>` : ''}<div><strong>Exp\u00e9rience:</strong> ${esc(q.experience || 'Non renseign\u00e9e')}</div></div>`; }).join('')}
      </div>
    `);
  } catch (err) { showMessage(err.message, 'error'); }
}

// ===== INSPECTOR FORM =====
let formQuals = [{ domaine: '', specialite: '', niveau: '', experience: '', titularisation: '' }];
let formIsFormateur = false;
let formMatchedFormateur = null;
let formInsCompetences = [{ type_competence: '', domaine: '' }];
let formInsFormDelivrees = [''];
let formInsFormDeveloppees = [''];
let formInsLinkedFormateur = null;

function openInspectorForm(inspector = null) {
  const isEdit = !!inspector;
  formQuals = inspector?.qualifications?.length > 0 ? inspector.qualifications.map(q => ({ domaine: q.domaine, specialite: q.specialite, niveau: q.niveau, experience: q.experience || '', titularisation: q.titularisation || '' })) : [{ domaine: '', specialite: '', niveau: '', experience: '', titularisation: '' }];
  formInsLinkedFormateur = inspector?.formateur || null;
  formIsFormateur = !!formInsLinkedFormateur;
  formMatchedFormateur = null;
  formInsCompetences = [{ type_competence: '', domaine: '' }];
  formInsFormDelivrees = [''];
  formInsFormDeveloppees = [''];
  const userRole = state.user?.role;
  const isNat1 = userRole === 'National 1';
  const canManageFormateur = userRole === 'Administrateur' || userRole === 'R\u00e9gional' || isNat1;

  openModal(`
    <div class="modal-header"><h3>${isEdit ? "Modifier l'inspecteur" : 'Ajouter un inspecteur'}</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="inspector-form" enctype="multipart/form-data">
      <div class="modal-body">
        <div id="form-error"></div>
        <h4>Identification</h4>
        <div class="form-row">
          <div class="form-group"><label>Nom *</label><input type="text" id="f-nom" value="${esc(inspector?.nom || '')}" required></div>
          <div class="form-group"><label>Pr\u00e9nom *</label><input type="text" id="f-prenom" value="${esc(inspector?.prenom || '')}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>\u00c9tat *</label><select id="f-etat-form" required ${isNat1 ? 'disabled' : ''}><option value="">S\u00e9lectionner</option>${ETATS.map(e => `<option value="${e}" ${inspector?.etat === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
          <div class="form-group"><label>Email</label><input type="email" id="f-email" value="${esc(inspector?.email || '')}" ${isEdit && userRole === 'National 2' ? 'disabled' : ''}></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>T\u00e9l\u00e9phone</label><input type="tel" id="f-tel" value="${esc(inspector?.telephone || '')}"></div>
          <div class="form-group"><label>CV (PDF)</label><input type="file" id="f-cv" accept=".pdf,.doc,.docx"></div>
        </div>
        <h4 style="margin-top:1.5rem">Qualifications <button type="button" class="btn btn-sm btn-outline" style="margin-left:1rem" onclick="addQualRow()">+ Ajouter</button></h4>
        <div id="quals-container">${renderQualsRows()}</div>
        ${canManageFormateur ? `
        <h4 style="margin-top:1.5rem">Formateur</h4>
        <div class="form-group" style="align-self:flex-start"><label style="display:inline-flex;align-items:center;gap:0.35rem;white-space:nowrap;cursor:pointer;margin:0"><input type="checkbox" id="f-is-formateur" ${formIsFormateur ? 'checked' : ''} onchange="toggleInsFormateur(this.checked)" style="margin:0">Cet inspecteur est aussi formateur</label></div>
        <div id="ins-formateur-section" style="${formIsFormateur ? '' : 'display:none'}">${renderInsFormateurSection(inspector?.id)}</div>
        ` : ''}
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary" id="save-btn">${isEdit ? 'Modifier' : 'Ajouter'}</button></div>
    </form>
  `, 'modal-lg');

  if (isNat1 && !isEdit && state.user?.inspectorId) { api(`/inspectors/${state.user.inspectorId}`).then(d => { const sel = document.getElementById('f-etat-form'); if (sel) sel.value = d.etat; }).catch(() => {}); }

  document.getElementById('inspector-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('form-error'); errDiv.innerHTML = '';
    const formData = new FormData();
    formData.append('nom', document.getElementById('f-nom').value);
    formData.append('prenom', document.getElementById('f-prenom').value);
    formData.append('etat', document.getElementById('f-etat-form').value);
    formData.append('email', document.getElementById('f-email').value);
    formData.append('telephone', document.getElementById('f-tel').value);
    formQuals.forEach((q, i) => { const el = document.getElementById(`q-tit-${i}`); if (el) q.titularisation = el.value; });
    formData.append('qualifications', JSON.stringify(formQuals.filter(q => q.domaine)));
    // Lien formateur
    if (document.getElementById('f-is-formateur')) {
      const isFrm = document.getElementById('f-is-formateur').checked;
      formData.append('is_formateur', isFrm ? 'true' : 'false');
      if (isFrm) {
        if (formMatchedFormateur?.id || formInsLinkedFormateur?.id) {
          formData.append('formateur_id', String(formMatchedFormateur?.id || formInsLinkedFormateur?.id));
        } else {
          // Lire les valeurs du DOM (compétences + formations)
          const comps = [];
          document.querySelectorAll('.ins-comp-row').forEach(row => {
            const t = row.querySelector('[data-comp-type]')?.value?.trim() || '';
            const d = row.querySelector('[data-comp-dom]')?.value?.trim() || '';
            if (t) comps.push({ type_competence: t, domaine: d });
          });
          const dels = [...document.querySelectorAll('[data-form-delivree]')].map(i => i.value.trim()).filter(Boolean);
          const devs = [...document.querySelectorAll('[data-form-developpee]')].map(i => i.value.trim()).filter(Boolean);
          formData.append('formateur_competences', JSON.stringify(comps));
          formData.append('formateur_formations_delivrees', JSON.stringify(dels));
          formData.append('formateur_formations_developpees', JSON.stringify(devs));
        }
      }
    }
    const cvFile = document.getElementById('f-cv').files[0];
    if (cvFile) formData.append('cv', cvFile);
    const btn = document.getElementById('save-btn'); btn.disabled = true; btn.textContent = 'Enregistrement...';
    try {
      const url = isEdit ? `/api/inspectors/${inspector.id}` : '/api/inspectors';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Authorization': `Bearer ${state.token}` }, body: formData });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { throw new Error('R\u00e9ponse serveur invalide. V\u00e9rifiez votre session.'); }
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      closeModal(); showMessage('Sauvegard\u00e9 avec succ\u00e8s'); reloadKeepScroll(reloadInspectors);
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; btn.disabled = false; btn.textContent = isEdit ? 'Modifier' : 'Ajouter'; }
  });
}

function renderInsFormateurSection(inspectorId) {
  // 1) Inspecteur déjà lié à un formateur existant
  if (formInsLinkedFormateur) {
    const f = formInsLinkedFormateur;
    return `<div class="alert alert-info" style="background:#ebf8ff;border-left:3px solid #3182ce;padding:0.75rem;border-radius:4px;font-size:0.9rem">
      Déjà formateur — <strong>${esc(f.reference)}</strong> ${esc(f.nom)} ${esc(f.prenom)} (${esc(f.etat)}).
      Modifier les compétences et formations dans le menu <em>Formateurs</em>.
    </div>`;
  }
  // 2) Match trouvé sur la base nom+prénom+état
  if (formMatchedFormateur) {
    const f = formMatchedFormateur;
    return `<div class="alert alert-info" style="background:#fffbeb;border-left:3px solid #d69e2e;padding:0.75rem;border-radius:4px;font-size:0.9rem">
      Un formateur correspondant existe : <strong>${esc(f.reference)}</strong> ${esc(f.nom)} ${esc(f.prenom)} (${esc(f.etat)}).
      Il sera lié à cet inspecteur lors de l'enregistrement.
    </div>`;
  }
  // 3) Pas de correspondance — saisie des champs formateur
  return `
    <div style="background:#f7fafc;border:1px solid #e2e8f0;padding:0.75rem;border-radius:4px;margin-bottom:0.5rem;font-size:0.85rem;color:#4a5568">
      Aucun formateur correspondant trouvé. Renseignez les compétences et formations ci-dessous, un nouveau profil formateur sera créé et lié.
    </div>
    <div style="margin:0.5rem 0">
      <strong style="font-size:0.9rem">Compétences</strong>
      <button type="button" class="btn btn-sm btn-outline" style="margin-left:0.5rem" onclick="addInsComp()">+ Ajouter</button>
    </div>
    <div id="ins-comps-container">${renderInsCompsRows()}</div>
    <div style="margin:0.75rem 0 0.5rem">
      <strong style="font-size:0.9rem">Formations délivrées</strong>
      <button type="button" class="btn btn-sm btn-outline" style="margin-left:0.5rem" onclick="addInsFormDelivree()">+ Ajouter</button>
    </div>
    <div id="ins-form-delivrees-container">${renderInsFormList('delivree')}</div>
    <div style="margin:0.75rem 0 0.5rem">
      <strong style="font-size:0.9rem">Formations développées</strong>
      <button type="button" class="btn btn-sm btn-outline" style="margin-left:0.5rem" onclick="addInsFormDeveloppee()">+ Ajouter</button>
    </div>
    <div id="ins-form-developpees-container">${renderInsFormList('developpee')}</div>
  `;
}

function renderInsCompsRows() {
  const types = (typeof FORMATEUR_TYPES !== 'undefined' && FORMATEUR_TYPES.length) ? FORMATEUR_TYPES : ['Formateur National','Formateur Régional','Formateur International'];
  return formInsCompetences.map((c, i) => `
    <div class="form-row ins-comp-row">
      <div class="form-group"><label>Type</label><select data-comp-type><option value="">Sélectionner</option>${types.map(t => `<option value="${t}" ${c.type_competence === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>Domaine</label><select data-comp-dom><option value="">Tous domaines</option>${DOMAINES.map(d => `<option value="${d}" ${c.domaine === d ? 'selected' : ''}>${DOMAINE_LABELS[d] || d}</option>`).join('')}</select></div>
      ${formInsCompetences.length > 1 ? `<button type="button" class="btn-icon btn-danger" style="align-self:flex-end;margin-bottom:0.5rem" onclick="removeInsComp(${i})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
    </div>
  `).join('');
}

function renderInsFormList(type) {
  const arr = type === 'delivree' ? formInsFormDelivrees : formInsFormDeveloppees;
  const attr = type === 'delivree' ? 'data-form-delivree' : 'data-form-developpee';
  const removeFn = type === 'delivree' ? 'removeInsFormDelivree' : 'removeInsFormDeveloppee';
  return arr.map((v, i) => `
    <div class="form-row" style="align-items:center">
      <div class="form-group" style="flex:1"><input type="text" ${attr} value="${esc(v)}" placeholder="Description de la formation"></div>
      ${arr.length > 1 ? `<button type="button" class="btn-icon btn-danger" style="margin-bottom:0.5rem" onclick="${removeFn}(${i})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
    </div>
  `).join('');
}

function addInsComp() { _captureInsCompState(); formInsCompetences.push({ type_competence: '', domaine: '' }); document.getElementById('ins-comps-container').innerHTML = renderInsCompsRows(); }
function removeInsComp(i) { _captureInsCompState(); formInsCompetences.splice(i, 1); if (formInsCompetences.length === 0) formInsCompetences.push({ type_competence: '', domaine: '' }); document.getElementById('ins-comps-container').innerHTML = renderInsCompsRows(); }
function _captureInsCompState() {
  const rows = document.querySelectorAll('.ins-comp-row');
  formInsCompetences = [...rows].map(r => ({ type_competence: r.querySelector('[data-comp-type]')?.value || '', domaine: r.querySelector('[data-comp-dom]')?.value || '' }));
  if (!formInsCompetences.length) formInsCompetences = [{ type_competence: '', domaine: '' }];
}
function addInsFormDelivree() { formInsFormDelivrees = [...document.querySelectorAll('[data-form-delivree]')].map(i => i.value); formInsFormDelivrees.push(''); document.getElementById('ins-form-delivrees-container').innerHTML = renderInsFormList('delivree'); }
function removeInsFormDelivree(i) { formInsFormDelivrees = [...document.querySelectorAll('[data-form-delivree]')].map(i => i.value); formInsFormDelivrees.splice(i, 1); if (!formInsFormDelivrees.length) formInsFormDelivrees = ['']; document.getElementById('ins-form-delivrees-container').innerHTML = renderInsFormList('delivree'); }
function addInsFormDeveloppee() { formInsFormDeveloppees = [...document.querySelectorAll('[data-form-developpee]')].map(i => i.value); formInsFormDeveloppees.push(''); document.getElementById('ins-form-developpees-container').innerHTML = renderInsFormList('developpee'); }
function removeInsFormDeveloppee(i) { formInsFormDeveloppees = [...document.querySelectorAll('[data-form-developpee]')].map(i => i.value); formInsFormDeveloppees.splice(i, 1); if (!formInsFormDeveloppees.length) formInsFormDeveloppees = ['']; document.getElementById('ins-form-developpees-container').innerHTML = renderInsFormList('developpee'); }

async function toggleInsFormateur(checked) {
  const sec = document.getElementById('ins-formateur-section');
  if (!sec) return;
  if (!checked) {
    formMatchedFormateur = null;
    sec.style.display = 'none';
    return;
  }
  // Si déjà lié (édition d'un inspecteur déjà formateur), pas besoin de match
  if (formInsLinkedFormateur) {
    sec.style.display = '';
    sec.innerHTML = renderInsFormateurSection();
    return;
  }
  // Sinon : appel /api/formateurs/match
  const nom = document.getElementById('f-nom')?.value?.trim() || '';
  const prenom = document.getElementById('f-prenom')?.value?.trim() || '';
  const etat = document.getElementById('f-etat-form')?.value?.trim() || '';
  const email = document.getElementById('f-email')?.value?.trim() || '';
  if (!nom || !prenom || !etat) {
    showMessage('Renseignez Nom, Prénom et État avant de cocher cette option', 'error');
    document.getElementById('f-is-formateur').checked = false;
    return;
  }
  sec.style.display = '';
  sec.innerHTML = '<div style="padding:0.75rem;color:#4a5568;font-size:0.9rem">Recherche d\'un formateur correspondant...</div>';
  try {
    const params = new URLSearchParams({ nom, prenom, etat });
    if (email) params.set('email', email);
    const data = await api(`/formateurs/match?${params.toString()}`);
    formMatchedFormateur = data?.match || null;
  } catch (_e) { formMatchedFormateur = null; }
  sec.innerHTML = renderInsFormateurSection();
}

function renderQualsRows() {
  return formQuals.map((q, i) => {
    const opts = (q.domaine && SPECIALITES_BY_DOMAINE[q.domaine]) ? SPECIALITES_BY_DOMAINE[q.domaine] : SPECIALITES;
    const placeholder = q.domaine ? `Sp\u00e9cialit\u00e9s du domaine ${q.domaine}` : 'S\u00e9lectionnez d\'abord un domaine';
    return `
    <div class="qual-form-row">
      <div class="form-row">
        <div class="form-group"><label>Domaine</label><select onchange="updateQual(${i},'domaine',this.value)"><option value="">S\u00e9lectionner</option>${DOMAINES.map(d => `<option value="${d}" ${q.domaine === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="form-group"><label>Sp\u00e9cialit\u00e9</label><input type="text" list="dl-spec-${i}" value="${esc(q.specialite)}" oninput="updateQual(${i},'specialite',this.value)" placeholder="${placeholder}" ${!q.domaine ? 'disabled' : ''}><datalist id="dl-spec-${i}">${opts.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Niveau</label><select onchange="updateQual(${i},'niveau',this.value)"><option value="">S\u00e9lectionner</option>${NIVEAUX.map(n => `<option value="${n}" ${q.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="form-group"><label>Titularisation</label><input type="month" id="q-tit-${i}" value="${esc(q.titularisation)}" onchange="updateQual(${i},'titularisation',this.value)" ${q.niveau === 'Inspecteur Stagiaire' ? 'disabled title="Non applicable pour Inspecteur Stagiaire"' : ''}></div>
        <div class="form-group"><label>Exp\u00e9rience</label><input type="text" value="${esc(q.experience)}" oninput="updateQual(${i},'experience',this.value)" placeholder="Ex: 5 ans"></div>
        ${formQuals.length > 1 ? `<button type="button" class="btn-icon btn-danger" style="align-self:flex-end;margin-bottom:0.5rem" onclick="removeQualRow(${i})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
      </div>
    </div>
  `;
  }).join('');
}

function updateQual(idx, field, value) {
  formQuals[idx][field] = value;
  if (field === 'domaine') {
    // Reset spécialité si elle n'appartient pas au nouveau domaine
    const allowed = SPECIALITES_BY_DOMAINE[value] || [];
    if (formQuals[idx].specialite && allowed.length && !allowed.includes(formQuals[idx].specialite)) {
      formQuals[idx].specialite = '';
    }
    document.getElementById('quals-container').innerHTML = renderQualsRows();
  } else if (field === 'niveau') {
    if (value === 'Inspecteur Stagiaire') formQuals[idx].titularisation = '';
    document.getElementById('quals-container').innerHTML = renderQualsRows();
  }
}
function addQualRow() { formQuals.push({ domaine: '', specialite: '', niveau: '', experience: '', titularisation: '' }); document.getElementById('quals-container').innerHTML = renderQualsRows(); }
function removeQualRow(idx) { formQuals.splice(idx, 1); document.getElementById('quals-container').innerHTML = renderQualsRows(); }
async function editInspector(id) { try { const ins = await api(`/inspectors/${id}`); openInspectorForm(ins); } catch (err) { showMessage(err.message, 'error'); } }
async function deactivateInspector(id) { if (!confirm('Voulez-vous vraiment d\u00e9sactiver cet inspecteur ?')) return; try { await api(`/inspectors/${id}/deactivate`, { method: 'PUT' }); showMessage('Inspecteur d\u00e9sactiv\u00e9'); reloadKeepScroll(reloadInspectors); } catch (err) { showMessage(err.message, 'error'); } }
async function createUserForInspector(id, email, hasUser) {
  if (hasUser) { showMessage('Un compte utilisateur est d\u00e9j\u00e0 associ\u00e9 \u00e0 cet inspecteur', 'error'); return; }
  if (!email) { showMessage("Veuillez renseigner l'email de l'inspecteur avant de cr\u00e9er son compte utilisateur", 'error'); return; }
  if (!confirm(`Cr\u00e9er un compte utilisateur pour ${email} ?`)) return;
  try {
    const data = await api(`/inspectors/${id}/create-user`, { method: 'POST' });
    showMessage(`Compte cr\u00e9\u00e9. Identifiant: ${data.username} \u2014 Mot de passe: ${data.password}`);
    reloadKeepScroll(reloadInspectors);
  } catch (err) { showMessage(err.message, 'error'); }
}
async function activateInspector(id) { if (!confirm('Voulez-vous vraiment r\u00e9activer cet inspecteur ?')) return; try { await api(`/inspectors/${id}/activate`, { method: 'PUT' }); showMessage('Inspecteur r\u00e9activ\u00e9'); reloadKeepScroll(reloadInspectors); } catch (err) { showMessage(err.message, 'error'); } }
async function importInspectors(input) { if (!input.files[0]) return; await _importPreview('inspectors', input.files[0]); input.value = ''; }
async function _importPreview(kind, file) {
  const formData = new FormData(); formData.append('file', file);
  const previewUrl = kind === 'formateurs' ? '/api/formateurs/import-preview' : '/api/inspectors/import-preview';
  const applyUrl   = kind === 'formateurs' ? '/api/formateurs/import-apply'   : '/api/inspectors/import-apply';
  const onSuccess  = kind === 'formateurs' ? (m)=>{ showFrmMsg(m); reloadKeepScroll(reloadFormateurs); } : (m)=>{ showMessage(m); reloadKeepScroll(reloadInspectors); };
  const onErr      = kind === 'formateurs' ? (m)=>showFrmMsg(m,'error') : (m)=>showMessage(m,'error');
  try {
    const res = await fetch(previewUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${state.token}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    if (!data.rows || data.rows.length === 0) { onErr('Aucune ligne valide trouvée dans le fichier'); return; }
    _showImportPreviewModal(kind, data, applyUrl, onSuccess, onErr);
  } catch (err) { onErr('Erreur de prévisualisation : ' + err.message); }
}
function _showImportPreviewModal(kind, data, applyUrl, onSuccess, onErr) {
  const colorOf = s => s === 'new' ? '#bbf7d0' : (s === 'duplicate' ? '#fecaca' : (s === 'update' ? '#fed7aa' : '#fff'));
  const labelOf = s => s === 'new' ? 'Nouveau' : (s === 'duplicate' ? 'Doublon' : (s === 'update' ? 'Mise à jour' : ''));
  const isInsp = kind !== 'formateurs';
  const headers = isInsp
    ? ['Nom','Prénom','État','Email','Téléphone','Domaine','Spécialité','Niveau']
    : ['Nom','Prénom','État','Email','Téléphone','Insp.','Compétence'];
  const fieldKeys = isInsp
    ? ['nom','prenom','etat','email','telephone','domaine','specialite','niveau']
    : ['nom','prenom','etat','email','telephone','is_inspecteur','type_competence'];
  const rowsHtml = data.rows.map((r, i) => `
    <tr style="background:${colorOf(r.status)}">
      <td><input type="checkbox" class="imp-row-cb" data-i="${i}" ${r.status === 'duplicate' ? '' : 'checked'}></td>
      <td><strong style="font-size:0.75rem">${labelOf(r.status)}</strong></td>
      ${fieldKeys.map(k => `<td><small>${esc(String(r[k] !== undefined && r[k] !== null ? r[k] : ''))}</small></td>`).join('')}
      <td><small style="color:#4a5568;font-style:italic">${esc(r.note || '')}</small></td>
    </tr>
  `).join('');
  openModal(`
    <div class="modal-header"><h3>Prévisualisation de l'importation</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;padding-bottom:0.75rem;margin-bottom:0.75rem;border-bottom:1px solid #e2e8f0">
        <button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Annuler l'importation</button>
        <button type="button" class="btn btn-sm" onclick="_removeUncheckedImpRows()" style="background:#dc2626;color:white">Supprimer les lignes décochées</button>
        <button type="button" class="btn btn-primary btn-sm" id="imp-apply-btn" onclick="_applyImport()">Valider l'importation</button>
      </div>
      <div style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <span style="background:#bbf7d0;padding:4px 10px;border-radius:4px;font-size:0.875rem"><strong>${data.counts.new || 0}</strong> nouveau(x)</span>
        <span style="background:#fed7aa;padding:4px 10px;border-radius:4px;font-size:0.875rem"><strong>${data.counts.update || 0}</strong> mise(s) à jour</span>
        <span style="background:#fecaca;padding:4px 10px;border-radius:4px;font-size:0.875rem"><strong>${data.counts.duplicate || 0}</strong> doublon(s) — ignorés à la validation</span>
        <span style="margin-left:auto;color:#4a5568;font-size:0.875rem">${data.total} ligne(s) au total</span>
      </div>
      <div style="margin-bottom:0.5rem;font-size:0.875rem"><label style="display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer"><input type="checkbox" id="imp-toggle-all" onchange="document.querySelectorAll('.imp-row-cb').forEach(cb=>cb.checked=this.checked)"> Tout cocher / décocher</label> &nbsp;|&nbsp; Identification des doublons : <strong>Nom + Prénom + État</strong></div>
      <div class="table-container" style="max-height:55vh;overflow:auto">
        <table class="data-table">
          <thead><tr><th style="width:30px"></th><th>Statut</th>${headers.map(h => `<th>${h}</th>`).join('')}<th>Note</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div id="imp-error" style="margin-top:0.5rem"></div>
    </div>
  `, 'modal-xl');
  // stocker rows + handlers pour _applyImport
  window._impRows = data.rows;
  window._impApplyUrl = applyUrl;
  window._impOnSuccess = onSuccess;
  window._impOnErr = onErr;
}
function _removeUncheckedImpRows() {
  const keepIdx = new Set([...document.querySelectorAll('.imp-row-cb:checked')].map(cb => parseInt(cb.dataset.i)));
  if (keepIdx.size === window._impRows.length) {
    document.getElementById('imp-error').innerHTML = '<div class="alert alert-info" style="background:#dbeafe;color:#1e40af;padding:0.5rem;border-radius:4px">Aucune ligne décochée à supprimer</div>';
    return;
  }
  document.querySelectorAll('.imp-row-cb').forEach(cb => {
    if (!keepIdx.has(parseInt(cb.dataset.i))) {
      cb.closest('tr').remove();
    }
  });
  document.getElementById('imp-error').innerHTML = `<div class="alert alert-info" style="background:#dbeafe;color:#1e40af;padding:0.5rem;border-radius:4px">${window._impRows.length - keepIdx.size} ligne(s) supprimée(s) de la prévisualisation</div>`;
}
async function _applyImport() {
  const applyUrl = window._impApplyUrl;
  const checked = [...document.querySelectorAll('.imp-row-cb:checked')].map(cb => parseInt(cb.dataset.i));
  if (checked.length === 0) {
    document.getElementById('imp-error').innerHTML = '<div class="alert alert-error">Aucune ligne sélectionnée</div>';
    return;
  }
  const rows = checked.map(i => window._impRows[i]);
  const btn = document.getElementById('imp-apply-btn'); btn.disabled = true; btn.textContent = 'Importation...';
  try {
    const data = await api(applyUrl.replace('/api',''), { method: 'POST', body: JSON.stringify({ rows }) });
    closeModal();
    window._impOnSuccess(data.message);
  } catch (err) {
    document.getElementById('imp-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    btn.disabled = false; btn.textContent = "Valider l'importation";
  }
}

// ===== INSPECTOR MULTI-SELECT =====
function toggleAllInspectors(checked) { document.querySelectorAll('.insp-check').forEach(cb => cb.checked = checked); updateInspDeleteBtn(); }
function updateInspDeleteBtn() { const btn = document.getElementById('insp-delete-btn'); if (!btn) return; const count = document.querySelectorAll('.insp-check:checked').length; btn.style.display = count > 0 ? 'inline-flex' : 'none'; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Supprimer (${count})`; }
async function bulkDeleteInspectors() {
  const ids = [...document.querySelectorAll('.insp-check:checked')].map(cb => parseInt(cb.value));
  if (ids.length === 0) return;
  if (!confirm(`Voulez-vous vraiment supprimer ${ids.length} inspecteur(s) ? Cette action est irr\u00e9versible.`)) return;
  try { const data = await api('/inspectors/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }); showMessage(data.message); reloadKeepScroll(reloadInspectors); } catch (err) { showMessage(err.message, 'error'); }
}

// ===== EMAIL FORM =====
function openEmailForm(id, email, name) {
  openModal(`<div class="modal-header"><h3>Envoyer un email \u00e0 ${esc(name)}</h3><button class="btn-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><p class="text-muted">Destinataire: ${esc(email)}</p><div class="form-group"><label>Objet</label><input type="text" id="email-subject" placeholder="Objet de l'email"></div><div class="form-group"><label>Message</label><textarea id="email-body" rows="6" placeholder="Contenu du message..."></textarea></div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="sendEmail(${id})">Envoyer</button></div></div>`);
}
async function sendEmail(id) { try { const data = await api(`/inspectors/${id}/email`, { method: 'POST', body: JSON.stringify({ subject: document.getElementById('email-subject').value, body: document.getElementById('email-body').value }) }); closeModal(); if (data.mailto) window.open(data.mailto, '_blank'); showMessage(data.message); } catch (err) { showMessage(err.message, 'error'); } }

// ===== ANALYTICS PAGE =====
let analyticsCharts = [];
let analyticsFilters = { etat: '', domaine: '', niveau: '', competence: '' };

async function loadAnalyticsPage(keepFilters = false) {
  if (!keepFilters) analyticsFilters = { etat: '', domaine: '', niveau: '', competence: '' };
  const container = document.getElementById('analytics-page');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:3rem"><p>Chargement des donn\u00e9es d'analyse...</p></div>`;
  try {
    const p = new URLSearchParams();
    if (analyticsFilters.etat)       p.set('etat',       analyticsFilters.etat);
    if (analyticsFilters.domaine)    p.set('domaine',    analyticsFilters.domaine);
    if (analyticsFilters.niveau)     p.set('niveau',     analyticsFilters.niveau);
    if (analyticsFilters.competence) p.set('competence', analyticsFilters.competence);
    const qs = p.toString() ? '?' + p.toString() : '';
    const data = await api('/analytics' + qs);
    renderAnalyticsContent(data);
  }
  catch (err) { if (err.message.includes('expir\u00e9e')) { logout(); return; } container.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
}
function setAnalyticsFilter(k, v) { analyticsFilters[k] = v; loadAnalyticsPage(true); }
function resetAnalyticsFilters() { analyticsFilters = { etat:'', domaine:'', niveau:'', competence:'' }; loadAnalyticsPage(true); }

function _analyticsQs() {
  const p = new URLSearchParams();
  if (analyticsFilters.etat)       p.set('etat', analyticsFilters.etat);
  if (analyticsFilters.domaine)    p.set('domaine', analyticsFilters.domaine);
  if (analyticsFilters.niveau)     p.set('niveau', analyticsFilters.niveau);
  if (analyticsFilters.competence) p.set('competence', analyticsFilters.competence);
  return p.toString();
}

async function downloadImportTemplate(kind) {
  try {
    const url = kind === 'formateurs' ? '/api/formateurs/import-template' : '/api/inspectors/import-template';
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${state.token}` } });
    if (!res.ok) { const t = await res.text(); throw new Error(t || 'Erreur téléchargement'); }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = kind === 'formateurs' ? 'modele_import_formateurs.xlsx' : 'modele_import_inspecteurs.xlsx';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  } catch (err) { showMessage('Erreur: ' + err.message, 'error'); }
}

async function exportAnalyticsStats(fmt) {
  try {
    const qs = _analyticsQs();
    const res = await fetch(`/api/analytics/export/${fmt}${qs ? '?' + qs : ''}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
    if (!res.ok) { const t = await res.text(); throw new Error(t || 'Erreur export'); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `statistiques.${fmt === 'excel' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { showMessage('Erreur export: ' + err.message, 'error'); }
}

async function exportDashboardPDF() {
  if (!window.jspdf || !window.html2canvas) { showMessage('Bibliothèques PDF non chargées', 'error'); return; }
  showMessage('Génération du PDF en cours...');
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageW - margin * 2;
    let y = margin;

    // Titre
    pdf.setFontSize(14); pdf.setTextColor(26, 54, 93);
    pdf.text('UEMOA - Tableau de bord', pageW / 2, y + 6, { align: 'center' });
    y += 10;
    pdf.setFontSize(9); pdf.setTextColor(100, 100, 100); pdf.setFont(undefined, 'italic');
    pdf.text('Exporté le ' + new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR'), pageW / 2, y, { align: 'center' });
    pdf.setFont(undefined, 'normal'); pdf.setTextColor(0, 0, 0);
    y += 8;

    // Capturer KPI grid
    const kpi = document.querySelector('#analytics-page .kpi-grid');
    if (kpi) {
      const c = await html2canvas(kpi, { scale: 2, backgroundColor: '#ffffff' });
      const ratio = c.width / c.height;
      let w = usableW, h = w / ratio;
      if (y + h > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.addImage(c.toDataURL('image/png'), 'PNG', margin, y, w, h);
      y += h + 5;
    }

    // Capturer chaque chart-card individuellement (pour ne pas couper)
    const cards = document.querySelectorAll('#analytics-page .chart-card');
    for (const card of cards) {
      const c = await html2canvas(card, { scale: 2, backgroundColor: '#ffffff' });
      const ratio = c.width / c.height;
      let w = usableW, h = w / ratio;
      if (h > pageH - margin * 2) { h = pageH - margin * 2; w = h * ratio; }
      if (y + h > pageH - margin) { pdf.addPage(); y = margin; }
      const x = margin + (usableW - w) / 2;
      pdf.addImage(c.toDataURL('image/png'), 'PNG', x, y, w, h);
      y += h + 5;
    }

    pdf.save(`tableau_de_bord_${new Date().toISOString().slice(0,10)}.pdf`);
    showMessage('PDF généré');
  } catch (err) { showMessage('Erreur génération PDF: ' + err.message, 'error'); }
}

function renderAnalyticsContent(data) {
  const container = document.getElementById('analytics-page');
  if (!container) return;
  analyticsCharts.forEach(c => c.destroy()); analyticsCharts = [];
  const frm = data.formateurs || {};
  const totalInsp = (data.byState || []).reduce((s, d) => s + d.count, 0);
  const nbEtatsInsp = (data.byState || []).length;
  const nbDomaines = (data.byDomain || []).length;
  const totalFrm = frm.total || 0;
  const frmInsp = frm.inspecteurs || 0;
  const nbEtatsFrm = (frm.byState || []).length;
  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem"><h2 style="margin:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="vertical-align:middle;margin-right:0.5rem"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> Tableau de bord</h2><div style="display:flex;gap:0.5rem;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="exportAnalyticsStats('excel')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Statistiques Excel</button><button class="btn btn-outline btn-sm" onclick="exportAnalyticsStats('pdf')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Statistiques PDF</button><button class="btn btn-primary btn-sm" onclick="exportDashboardPDF()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Exporter PDF</button></div></div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon" style="background:#ebf8ff">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="kpi-body"><div class="kpi-value">${totalInsp}</div><div class="kpi-label">Inspecteurs actifs</div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:#faf5ff">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#805ad5" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>
        <div class="kpi-body"><div class="kpi-value">${nbDomaines}</div><div class="kpi-label">Domaines couverts</div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:#fff5f5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div class="kpi-body"><div class="kpi-value">${totalFrm}</div><div class="kpi-label">Formateurs actifs</div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon" style="background:#f0fff4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="kpi-body"><div class="kpi-value">${frmInsp}</div><div class="kpi-label">Aussi inspecteurs</div></div>
      </div>
    </div>
    <div class="filters-bar filters-compact analytics-filters" style="margin:0.75rem 0 1.25rem">
      <select onchange="setAnalyticsFilter('etat',this.value)"><option value="">Tous les États</option>${ETATS.map(e=>`<option value="${e}" ${analyticsFilters.etat===e?'selected':''}>${e}</option>`).join('')}</select>
      <select onchange="setAnalyticsFilter('domaine',this.value)"><option value="">Tous les Domaines</option>${DOMAINES.map(d=>`<option value="${d}" ${analyticsFilters.domaine===d?'selected':''}>${DOMAINE_LABELS[d]||d}</option>`).join('')}</select>
      <select onchange="setAnalyticsFilter('niveau',this.value)"><option value="">Tous les Niveaux</option>${NIVEAUX.map(n=>`<option value="${n}" ${analyticsFilters.niveau===n?'selected':''}>${n}</option>`).join('')}</select>
      <select onchange="setAnalyticsFilter('competence',this.value)"><option value="">Toutes Compétences</option>${FORMATEUR_TYPES.map(t=>`<option value="${t}" ${analyticsFilters.competence===t?'selected':''}>${t}</option>`).join('')}</select>
      ${(analyticsFilters.etat||analyticsFilters.domaine||analyticsFilters.niveau||analyticsFilters.competence)?'<button class="btn btn-sm btn-outline" onclick="resetAnalyticsFilters()">Réinitialiser</button>':''}
    </div>
    <h3 style="margin:1.5rem 0 0.5rem;color:var(--primary)">Inspecteurs</h3>
    <div class="analytics-grid">
      <div class="chart-card"><h4 class="chart-title">Inspecteurs par \u00c9tat</h4><div class="chart-wrapper"><canvas id="chart-state"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">Inspecteurs par Domaine</h4><div class="chart-wrapper"><canvas id="chart-domain"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">R\u00e9partition par Niveau</h4><div class="chart-wrapper"><canvas id="chart-level"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">R\u00e9partition par Exp\u00e9rience</h4><div class="chart-wrapper"><canvas id="chart-exp"></canvas></div></div>
      <div class="chart-card chart-card-wide"><h4 class="chart-title">Domaines par \u00c9tat</h4><div class="chart-wrapper chart-wrapper-tall"><canvas id="chart-domain-state"></canvas></div></div>
      <div class="chart-card chart-card-wide"><h4 class="chart-title">Niveaux par Domaines</h4><div class="chart-wrapper chart-wrapper-tall"><canvas id="chart-level-domain"></canvas></div></div>
      <div class="chart-card chart-card-wide"><h4 class="chart-title">Top 15 Sp\u00e9cialit\u00e9s</h4><div class="chart-wrapper chart-wrapper-tall"><canvas id="chart-speciality"></canvas></div></div>
    </div>
    <h3 style="margin:2rem 0 0.5rem;color:var(--primary)">Formateurs</h3>
    <div class="analytics-grid">
      <div class="chart-card"><h4 class="chart-title">Formateurs par \u00c9tat (Total: ${frm.total || 0})</h4><div class="chart-wrapper"><canvas id="chart-frm-state"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">Formateurs par Comp\u00e9tence</h4><div class="chart-wrapper"><canvas id="chart-frm-competence"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">Formateurs par Domaine</h4><div class="chart-wrapper"><canvas id="chart-frm-domaine"></canvas></div></div>
      <div class="chart-card"><h4 class="chart-title">Formateurs aussi Inspecteurs</h4><div class="chart-wrapper"><canvas id="chart-frm-inspecteur"></canvas></div></div>
      <div class="chart-card chart-card-wide"><h4 class="chart-title">Comp\u00e9tences par \u00c9tat</h4><div class="chart-wrapper chart-wrapper-tall"><canvas id="chart-frm-comp-state"></canvas></div></div>
    </div>`;
  setTimeout(() => createAnalyticsCharts(data), 100);
}

function createAnalyticsCharts(data) {
  const cc = ['#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#805ad5', '#dd6b20', '#319795', '#d53f8c', '#718096', '#2b6cb0'];
  const c1 = document.getElementById('chart-state');
  if (c1) analyticsCharts.push(new Chart(c1, { type:'bar', data:{ labels:data.byState.map(d=>d.etat), datasets:[{ label:'Inspecteurs', data:data.byState.map(d=>d.count), backgroundColor:cc.slice(0,data.byState.length), borderRadius:6, maxBarThickness:50 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:5}}} } }));
  const c2 = document.getElementById('chart-domain');
  if (c2) analyticsCharts.push(new Chart(c2, { type:'bar', data:{ labels:data.byDomain.map(d=>d.domaine), datasets:[{ label:'Inspecteurs', data:data.byDomain.map(d=>d.count), backgroundColor:data.byDomain.map(d=>DOMAINE_COLORS[d.domaine]||'#718096'), borderRadius:6, maxBarThickness:50 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} } }));
  const c3 = document.getElementById('chart-level');
  if (c3) analyticsCharts.push(new Chart(c3, { type:'bar', data:{ labels:data.byLevel.map(d=>d.niveau.length>25?d.niveau.substring(0,25)+'...':d.niveau), datasets:[{ label:'Nombre', data:data.byLevel.map(d=>d.count), backgroundColor:'#805ad5', borderRadius:6, maxBarThickness:40 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,ticks:{stepSize:5}}} } }));
  const c4 = document.getElementById('chart-exp');
  if (c4) analyticsCharts.push(new Chart(c4, { type:'bar', data:{ labels:data.byExperience.slice(0,10).map(d=>d.experience), datasets:[{ label:'Inspecteurs', data:data.byExperience.slice(0,10).map(d=>d.count), backgroundColor:cc.slice(0,data.byExperience.slice(0,10).length), borderRadius:6, maxBarThickness:40 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,ticks:{stepSize:1}}} } }));
  const c5 = document.getElementById('chart-domain-state');
  if (c5) { const sts=[...new Set(data.domainState.map(d=>d.etat))]; const doms=[...new Set(data.domainState.map(d=>d.domaine))]; const ds=doms.map((dom,i)=>({label:dom,data:sts.map(st=>{const m=data.domainState.find(d=>d.etat===st&&d.domaine===dom);return m?m.count:0;}),backgroundColor:DOMAINE_COLORS[dom]||cc[i],borderRadius:4,maxBarThickness:40})); analyticsCharts.push(new Chart(c5,{type:'bar',data:{labels:sts,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:11}}}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{stepSize:5}}}}})); }
  const cld = document.getElementById('chart-level-domain');
  if (cld) { const ld=data.levelDomain||[]; const ld_doms=[...new Set(ld.map(d=>d.domaine))]; const ld_niv=[...new Set(ld.map(d=>d.niveau))]; const ld_nc=['#3182ce','#e53e3e','#38a169','#d69e2e','#805ad5','#dd6b20','#319795']; const ld_ds=ld_niv.filter(n=>n!=null).map((niv,i)=>({label:niv?(niv.length>22?niv.substring(0,22)+'...':niv):'(Non défini)',data:ld_doms.map(dom=>{const m=ld.find(d=>d.domaine===dom&&d.niveau===niv);return m?m.count:0;}),backgroundColor:ld_nc[i%ld_nc.length],borderRadius:4,maxBarThickness:50})); analyticsCharts.push(new Chart(cld,{type:'bar',data:{labels:ld_doms,datasets:ld_ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:10}}}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{stepSize:1}}}}})); }
  const c6 = document.getElementById('chart-speciality');
  if (c6) analyticsCharts.push(new Chart(c6, { type:'bar', data:{ labels:data.bySpeciality.map(d=>d.specialite.length>35?d.specialite.substring(0,35)+'...':d.specialite), datasets:[{ label:'Nombre', data:data.bySpeciality.map(d=>d.count), backgroundColor:'#38a169', borderRadius:6, maxBarThickness:35 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,ticks:{stepSize:5}}} } }));

  // Formateurs charts
  const frm = data.formateurs || {};
  const cf1 = document.getElementById('chart-frm-state');
  if (cf1 && frm.byState) analyticsCharts.push(new Chart(cf1, { type:'bar', data:{ labels:frm.byState.map(d=>d.etat), datasets:[{ label:'Formateurs', data:frm.byState.map(d=>d.count), backgroundColor:cc.slice(0,frm.byState.length), borderRadius:6, maxBarThickness:50 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} } }));
  const cf2 = document.getElementById('chart-frm-competence');
  if (cf2 && frm.byCompetence) analyticsCharts.push(new Chart(cf2, { type:'doughnut', data:{ labels:frm.byCompetence.map(d=>d.type_competence), datasets:[{ data:frm.byCompetence.map(d=>d.count), backgroundColor:['#3182ce','#e53e3e','#38a169','#d69e2e'], borderWidth:2, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'left',labels:{padding:12,font:{size:11}}}} } }));
  const cf3 = document.getElementById('chart-frm-domaine');
  if (cf3 && frm.byDomaine) analyticsCharts.push(new Chart(cf3, { type:'bar', data:{ labels:frm.byDomaine.map(d=>DOMAINE_LABELS[d.domaine]||d.domaine), datasets:[{ label:'Formateurs', data:frm.byDomaine.map(d=>d.count), backgroundColor:frm.byDomaine.map(d=>DOMAINE_COLORS[d.domaine]||'#718096'), borderRadius:6, maxBarThickness:40 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} } }));
  const cf4 = document.getElementById('chart-frm-inspecteur');
  if (cf4) { const fi = frm.inspecteurs||0; const fni = (frm.total||0)-fi; analyticsCharts.push(new Chart(cf4, { type:'pie', data:{ labels:['Aussi Inspecteur','Non Inspecteur'], datasets:[{ data:[fi,fni], backgroundColor:['#059669','#e2e8f0'], borderWidth:2, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'left',labels:{padding:12,font:{size:11}}}} } })); }
  const cf5 = document.getElementById('chart-frm-comp-state');
  if (cf5 && frm.competenceState) { const fsts=[...new Set(frm.competenceState.map(d=>d.etat))]; const fcomps=[...new Set(frm.competenceState.map(d=>d.type_competence))]; const fds=fcomps.map((comp,i)=>({label:comp,data:fsts.map(st=>{const m=frm.competenceState.find(d=>d.etat===st&&d.type_competence===comp);return m?m.count:0;}),backgroundColor:cc[i],borderRadius:4,maxBarThickness:40})); analyticsCharts.push(new Chart(cf5,{type:'bar',data:{labels:fsts,datasets:fds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{padding:12,font:{size:11}}}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true,ticks:{stepSize:1}}}}})); }
}

// ===== ACCESS MANAGEMENT PAGE =====
let accessUsers = [];
async function loadAccessPage() { const c=document.getElementById('access-page'); if(!c) return; try { accessUsers=await api('/admin/users'); } catch(err) { if(err.message.includes('expir\u00e9e')){logout();return;} } renderAccessContent(); }

function renderAccessContent(search = '') {
  const container = document.getElementById('access-page'); if (!container) return;
  const filtered = search ? accessUsers.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || (u.nom || '').toLowerCase().includes(search.toLowerCase())) : accessUsers;
  container.innerHTML = `
    <div id="access-msg"></div>
    <div class="page-header"><h2>Gestion des acc\u00e8s</h2><div class="header-actions" style="display:flex;gap:0.75rem;align-items:center"><input type="text" placeholder="Rechercher un utilisateur..." class="search-input" oninput="renderAccessContent(this.value)" value="${esc(search)}"><button class="btn btn-primary btn-sm" onclick="openCreateUserForm()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Cr\u00e9er un utilisateur</button></div></div>
    <div class="table-container"><table class="data-table">
      <thead><tr><th>Utilisateur</th><th style="display:none">Pr\u00e9noms</th><th>Nom complet</th><th>\u00c9tat</th><th>R\u00f4le</th><th>Statut</th><th>MdP</th><th>Derni\u00e8re connexion</th><th>Actions</th></tr></thead>
      <tbody>${filtered.map(u => `<tr class="${!u.is_active ? 'row-inactive' : ''}">
        <td><span class="username" onclick="editUserUsername(${u.id}, '${esc(u.username)}')" title="Modifier">${esc(u.username)}</span></td>
        <td style="display:none">${esc(u.prenom || '-')}</td>
        <td>${u.nom ? esc((u.prenom ? u.prenom + ' ' : '') + u.nom) : '-'}</td>
        <td>${esc(u.etat || '-')}</td>
        <td><select class="role-select" onchange="changeUserRole(${u.id}, this.value)" ${u.username === 'Admin' ? 'disabled' : ''}>${['National 2', 'National 1', 'R\u00e9gional', 'Administrateur'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Actif' : 'Inactif'}</span></td>
        <td><span class="password-mask" id="pw-mask-${u.id}">********</span>${u.must_change_password ? '<span class="badge-warning" title="Doit changer son MdP">!</span>' : ''} <button class="btn-icon" title="D\u00e9masquer" onclick="revealUserPw(${u.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
        <td class="date-cell">${u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</td>
        <td class="actions-cell">
          <button class="btn-icon" title="Modifier les informations" onclick="editUserInfo(${u.id}, '${esc(u.nom||'')}', '${esc(u.prenom||'')}', '${esc(u.etat||'')}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-icon" title="R\u00e9initialiser MdP" onclick="resetUserPw(${u.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          <button class="btn-icon" title="Historique" onclick="viewUserLogs(${u.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></button>
          ${u.username !== 'Admin' ? `<button class="btn-icon ${u.is_active ? 'btn-danger' : 'btn-success'}" title="${u.is_active ? 'D\u00e9sactiver' : 'Activer'}" onclick="toggleUserActive(${u.id})">${u.is_active ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'}</button>` : ''}
        </td></tr>`).join('')}</tbody>
    </table></div>`;
}

function showAccessMsg(msg,type='success'){const el=document.getElementById('access-msg');if(el){el.innerHTML=`<div class="alert alert-${type} floating-alert">${msg}</div>`;setTimeout(()=>{el.innerHTML='';},4000);}}
async function changeUserRole(id,role){try{await api(`/admin/users/${id}/role`,{method:'PUT',body:JSON.stringify({role})});showAccessMsg('R\u00f4le mis \u00e0 jour');loadAccessPage();}catch(err){showAccessMsg(err.message,'error');}}
async function resetUserPw(id){if(!confirm('R\u00e9initialiser le mot de passe ?'))return;try{const data=await api(`/admin/users/${id}/reset-password`,{method:'PUT'});showAccessMsg(data.message);if(data.recipientEmail && data.newPassword && data.username){const subject='R\u00e9initialisation de votre mot de passe - UEMOA';const body=`Bonjour,\n\nVotre mot de passe a \u00e9t\u00e9 r\u00e9initialis\u00e9.\n\nNom d'utilisateur : ${data.username}\nNouveau mot de passe : ${data.newPassword}\n\nVous devrez changer ce mot de passe lors de votre prochaine connexion.\n\nCordialement,\nL'\u00e9quipe UEMOA - URSAC`;const mailto=`mailto:${data.recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;window.open(mailto,'_blank');}}catch(err){showAccessMsg(err.message,'error');}}
async function toggleUserActive(id){try{const data=await api(`/admin/users/${id}/toggle-active`,{method:'PUT'});showAccessMsg(data.message);loadAccessPage();}catch(err){showAccessMsg(err.message,'error');}}
function editUserUsername(id,current){const n=prompt("Nouveau nom d'utilisateur:",current);if(!n||n===current)return;api(`/admin/users/${id}/username`,{method:'PUT',body:JSON.stringify({username:n})}).then(()=>{showAccessMsg("Nom d'utilisateur mis \u00e0 jour");loadAccessPage();}).catch(err=>showAccessMsg(err.message,'error'));}

function editUserInfo(id, currentNom, currentPrenom, currentEtat) {
  openModal(`
    <div class="modal-header"><h3>Modifier les informations</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="edit-user-info-form">
      <div class="modal-body">
        <div id="edit-user-info-error"></div>
        <div class="form-group"><label>Pr\u00e9noms</label><input type="text" id="eui-prenom" value="${esc(currentPrenom)}" placeholder="Pr\u00e9noms"></div>
        <div class="form-group"><label>Nom</label><input type="text" id="eui-nom" value="${esc(currentNom)}" placeholder="Nom de famille"></div>
        <div class="form-group"><label>\u00c9tat membre</label><select id="eui-etat"><option value="">-- Aucun --</option>${ETATS.map(e=>`<option value="${e}" ${currentEtat===e?'selected':''}>${e}</option>`).join('')}</select></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>`);
  document.getElementById('edit-user-info-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/users/${id}/info`, { method: 'PUT', body: JSON.stringify({
        prenom: document.getElementById('eui-prenom').value,
        nom: document.getElementById('eui-nom').value,
        etat: document.getElementById('eui-etat').value
      })});
      closeModal(); showAccessMsg('Informations mises \u00e0 jour'); reloadKeepScroll(loadAccessPage);
    } catch(err) { document.getElementById('edit-user-info-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}
async function revealUserPw(id){
  const adminPw = prompt("Entrez votre mot de passe administrateur pour d\u00e9masquer :");
  if (!adminPw) return;
  try {
    const data = await api(`/admin/users/${id}/reveal-password`, { method: 'POST', body: JSON.stringify({ adminPassword: adminPw }) });
    const el = document.getElementById('pw-mask-' + id);
    if (el) {
      if (data.password) {
        el.textContent = data.password;
        el.style.color = '#059669';
        el.style.fontWeight = 'bold';
      } else {
        el.textContent = data.message || 'Mot de passe modifi\u00e9 par l\'utilisateur';
        el.style.color = '#d69e2e';
        el.style.fontSize = '0.8em';
      }
      setTimeout(() => { el.textContent = '********'; el.style.color = ''; el.style.fontWeight = ''; el.style.fontSize = ''; }, 10000);
    }
  } catch (err) { showAccessMsg(err.message, 'error'); }
}
async function viewUserLogs(userId){try{const logs=await api(`/admin/logs?userId=${userId}&limit=50`);openModal(`<div class="modal-header"><h3>Historique d'activit\u00e9</h3><button class="btn-close" onclick="closeModal()">&times;</button></div><div class="modal-body">${logs.length===0?'<p class="text-muted">Aucune activit\u00e9</p>':`<div class="log-list">${logs.map(l=>`<div class="log-item"><span class="log-action">${l.action}</span><span class="log-details">${esc(l.details||'')}</span><span class="log-date">${new Date(l.created_at).toLocaleString('fr-FR')}</span></div>`).join('')}</div>`}</div>`);}catch(err){showAccessMsg(err.message,'error');}}

function openCreateUserForm() {
  const etatOptions = ETATS.map(e => '<option value="' + e + '">' + e + '</option>').join('');
  openModal(`
    <div class="modal-header"><h3>Cr\u00e9er un utilisateur</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="create-user-form">
      <div class="modal-body">
        <div id="create-user-error"></div>
        <div class="form-group"><label>Utilisateur (email) *</label><input type="text" id="cu-username" required placeholder="Email de l'utilisateur"></div>
        <div class="form-group"><label>Nom *</label><input type="text" id="cu-nom" required placeholder="Nom complet"></div>
        <div class="form-group"><label>\u00c9tat *</label><select id="cu-etat" required><option value="">S\u00e9lectionner un \u00c9tat</option>${etatOptions}</select></div>
        <div class="form-group"><label>R\u00f4le</label><select id="cu-role"><option value="National 2">National 2</option><option value="National 1">National 1</option><option value="R\u00e9gional">R\u00e9gional</option><option value="Administrateur">Administrateur</option></select></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Cr\u00e9er</button></div>
    </form>
  `);
  document.getElementById('create-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('create-user-error'); errDiv.innerHTML = '';
    const username = document.getElementById('cu-username').value.trim();
    const nom = document.getElementById('cu-nom').value.trim();
    const etat = document.getElementById('cu-etat').value;
    const role = document.getElementById('cu-role').value;
    if (!username || !nom || !etat) { errDiv.innerHTML = '<div class="alert alert-error">Tous les champs obligatoires doivent \u00eatre remplis</div>'; return; }
    try {
      const data = await api('/admin/users', { method: 'POST', body: JSON.stringify({ username, nom, etat, role }) });
      closeModal();
      showAccessMsg(data.message);
      reloadKeepScroll(loadAccessPage);
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}

// ===== SETTINGS PAGE =====
let settingsData = [];
let settingsCategory = 'etat';

async function loadSettingsPage() {
  const container = document.getElementById('settings-page');
  if (!container) return;
  try { settingsData = await api(`/settings?category=${settingsCategory}`); } catch (err) { if (err.message.includes('expir\u00e9e')) { logout(); return; } }
  renderSettingsContent();
}

function renderSettingsContent() {
  const container = document.getElementById('settings-page');
  if (!container) return;
  const isAdmin = state.user?.role === 'Administrateur';
  const categories = [
    ['etat', '\u00c9tats'], ['domaine', 'Domaines'], ['formateur', 'Formateurs'],
    ['niveau', 'Niveaux de qualification']
  ];
  container.innerHTML = `
    <div id="settings-msg"></div>
    <div class="page-header"><h2><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="vertical-align:middle;margin-right:0.5rem"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Param\u00e8tres</h2></div>
    <div class="settings-tab-bar">
      <div class="settings-tabs">
        ${categories.map(([val, label]) => `<button class="settings-tab ${settingsCategory === val ? 'active' : ''}" onclick="switchSettingsCategory('${val}')">${label}</button>`).join('')}
      </div>
      ${isAdmin ? `<div class="settings-tab-actions">
        <button class="btn btn-primary btn-sm" onclick="openAddSettingForm()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter</button>
        <button class="btn btn-sm" style="background:#dc2626;color:white;display:none" id="settings-bulk-delete-btn" onclick="bulkDeleteSettings()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Supprimer (<span id="settings-sel-count">0</span>)</button>
      </div>` : ''}
    </div>
    <div class="table-container"><table class="data-table">
      <thead><tr>${isAdmin ? '<th style="width:35px"><input type="checkbox" id="settings-select-all" onchange="toggleAllSettings(this.checked)"></th>' : ''}<th>Valeur</th>${settingsCategory === 'domaine' ? '<th>Description</th>' : ''}<th>Statut</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>
        ${settingsData.length === 0 ? `<tr><td colspan="${isAdmin ? 5 : 3}" class="text-center">Aucun param\u00e8tre</td></tr>` :
          settingsData.map(s => `<tr class="${!s.is_active ? 'row-inactive' : ''}">
            ${isAdmin ? `<td><input type="checkbox" class="setting-cb" value="${s.id}" onchange="updateSettingsSelection()"></td>` : ''}
            <td>${esc(s.value)}</td>
            ${settingsCategory === 'domaine' ? `<td>${esc(s.label || '')}</td>` : ''}
            <td><span class="status-badge ${s.is_active ? 'active' : 'inactive'}">${s.is_active ? 'Actif' : 'Inactif'}</span></td>
            ${isAdmin ? `<td class="actions-cell">
              <button class="btn-icon" title="Modifier" onclick="editSetting(${s.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn-icon ${s.is_active ? 'btn-danger' : 'btn-success'}" title="${s.is_active ? 'D\u00e9sactiver' : 'Activer'}" onclick="toggleSetting(${s.id})">${s.is_active ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'}</button>
            </td>` : ''}
          </tr>`).join('')}
      </tbody>
    </table></div>`;
}

function switchSettingsCategory(cat) { settingsCategory = cat; loadSettingsPage(); }
function showSettingsMsg(msg, type = 'success') { const el = document.getElementById('settings-msg'); if (el) { el.innerHTML = `<div class="alert alert-${type} floating-alert">${msg}</div>`; setTimeout(() => { el.innerHTML = ''; }, 4000); } }

function openAddSettingForm() {
  const hasLabel = settingsCategory === 'domaine';
  openModal(`<div class="modal-header"><h3>Ajouter un param\u00e8tre</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="setting-form"><div class="modal-body"><div id="setting-error"></div>
      <div class="form-group"><label>Valeur *</label><input type="text" id="s-value" required></div>
      ${hasLabel ? '<div class="form-group"><label>Description</label><input type="text" id="s-label"></div>' : ''}
    </div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Ajouter</button></div></form>`);
  document.getElementById('setting-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/settings', { method: 'POST', body: JSON.stringify({ category: settingsCategory, value: document.getElementById('s-value').value, label: document.getElementById('s-label')?.value || '' }) });
      closeModal(); showSettingsMsg('Param\u00e8tre ajout\u00e9'); await refreshSettingsConstants(); reloadKeepScroll(loadSettingsPage);
    } catch (err) { document.getElementById('setting-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}

function editSetting(id) {
  const setting = settingsData.find(s => s.id === id);
  if (!setting) return;
  const hasLabel = settingsCategory === 'domaine';
  openModal(`<div class="modal-header"><h3>Modifier le param\u00e8tre</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="edit-setting-form"><div class="modal-body"><div id="edit-setting-error"></div>
      <div class="form-group"><label>Valeur *</label><input type="text" id="es-value" required></div>
      ${hasLabel ? '<div class="form-group"><label>Description</label><input type="text" id="es-label"></div>' : ''}
    </div><div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary">Modifier</button></div></form>`);
  document.getElementById('es-value').value = setting.value || '';
  if (hasLabel && document.getElementById('es-label')) document.getElementById('es-label').value = setting.label || '';
  document.getElementById('edit-setting-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/settings/${id}`, { method: 'PUT', body: JSON.stringify({ value: document.getElementById('es-value').value, label: document.getElementById('es-label')?.value || '' }) });
      closeModal(); showSettingsMsg('Param\u00e8tre modifi\u00e9'); await refreshSettingsConstants(); reloadKeepScroll(loadSettingsPage);
    } catch (err) { document.getElementById('edit-setting-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`; }
  });
}

async function toggleSetting(id) { try { const data = await api(`/settings/${id}/toggle`, { method: 'PUT' }); showSettingsMsg(data.message); await refreshSettingsConstants(); loadSettingsPage(); } catch (err) { showSettingsMsg(err.message, 'error'); } }

function toggleAllSettings(checked) {
  document.querySelectorAll('.setting-cb').forEach(cb => cb.checked = checked);
  updateSettingsSelection();
}
function updateSettingsSelection() {
  const checked = document.querySelectorAll('.setting-cb:checked');
  const btn = document.getElementById('settings-bulk-delete-btn');
  const cnt = document.getElementById('settings-sel-count');
  if (btn) btn.style.display = checked.length > 0 ? 'inline-flex' : 'none';
  if (cnt) cnt.textContent = checked.length;
  const all = document.querySelectorAll('.setting-cb');
  const selectAll = document.getElementById('settings-select-all');
  if (selectAll) selectAll.checked = all.length > 0 && checked.length === all.length;
}
async function bulkDeleteSettings() {
  const ids = [...document.querySelectorAll('.setting-cb:checked')].map(cb => parseInt(cb.value));
  if (ids.length === 0) return;
  if (!confirm(`Supprimer ${ids.length} paramètre(s) ? Cette action est irréversible.`)) return;
  try {
    const data = await api('/settings/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
    showSettingsMsg(data.message);
    await refreshSettingsConstants();
    loadSettingsPage();
  } catch (err) { showSettingsMsg(err.message, 'error'); }
}


// ===== FORMATEURS PAGE =====
let formateursData = { formateurs: [], total: 0, totalPages: 1 };
let formateursStats = { total: 0, byState: [] };
let frmFilters = { etat: '', competence: '', domaine: '', search: '', status: 'active' };
let frmPage = 1;
let frmPageSize = 50;
let frmSort = { col: '', dir: 'asc' };

async function loadFormateursPage() {
  const container = document.getElementById('formateurs-page');
  if (!container) return;
  frmFilters = { etat: '', competence: '', domaine: '', search: '', status: 'active' };
  frmPage = 1;
  try {
    const frmFilterStr = buildFrmFilterParams();
    const [stats, data] = await Promise.all([api(`/formateurs/stats?${frmFilterStr}`), api(`/formateurs?${frmFilterStr}`)]);
    formateursStats = stats; formateursData = data;
  } catch (err) { if (err.message.includes('expir\u00e9e')) { logout(); return; } }
  renderFormateursContent();
}

function buildFrmFilterParams() {
  const p = new URLSearchParams();
  if (frmFilters.etat) p.append('etat', frmFilters.etat);
  if (frmFilters.competence) p.append('competence', frmFilters.competence);
  if (frmFilters.domaine) p.append('domaine', frmFilters.domaine);
  if (frmFilters.search) p.append('search', frmFilters.search);
  p.append('status', frmFilters.status);
  p.append('page', frmPage);
  p.append('limit', frmPageSize);
  return p.toString();
}

function renderFormateursContent() {
  const container = document.getElementById('formateurs-page');
  if (!container) return;
  const role = state.user?.role;
  const canAdd = ['National 1', 'R\u00e9gional', 'Administrateur'].includes(role);
  const canEmail = ['R\u00e9gional', 'Administrateur'].includes(role);
  const canDeactivate = role === 'Administrateur';

  container.innerHTML = `
    <div id="frm-floating-msg"></div>
    <div class="dashboard-section dashboard-domaine-full">
      <h3 class="dashboard-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Formateurs par \u00c9tat</h3>
      <div class="dashboard dashboard-flex">
        <div class="stat-card stat-total"><div class="stat-number">${formateursStats.total}</div><div class="stat-label">Total Formateurs</div></div>
        ${formateursStats.byState.map(s => `<div class="stat-card" onclick="frmFilterByState('${s.etat.replace(/'/g, "\\'")}')" style="cursor:pointer${frmFilters.etat === s.etat ? ';border-color:var(--primary)' : ''}"><div class="stat-number">${s.count}</div><div class="stat-label">${s.etat}</div></div>`).join('')}
      </div>
    </div>
    <div class="dashboard-section dashboard-domaine-full">
      <h3 class="dashboard-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Situation par Comp\u00e9tence</h3>
      <div class="dashboard dashboard-flex">
        ${(formateursStats.byCompetence || []).map(c => `<div class="stat-card" onclick="frmApplyFilter('competence','${c.type_competence.replace(/'/g, "\\'")}')" style="cursor:pointer${frmFilters.competence === c.type_competence ? ';border-color:var(--primary)' : ''}"><div class="stat-number">${c.count}</div><div class="stat-label">${c.type_competence}</div></div>`).join('')}
      </div>
    </div>
    <div class="filters-bar filters-compact">
      <div class="filters-row-inline">
        <select onchange="frmApplyFilter('etat', this.value)"><option value="">Tous les \u00c9tats</option>${ETATS.map(e => `<option value="${e}" ${frmFilters.etat === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
        <select onchange="frmApplyFilter('competence', this.value)"><option value="">Toutes comp\u00e9tences</option>${FORMATEUR_TYPES.map(t => '<option value="' + t + '"' + (frmFilters.competence === t ? ' selected' : '') + '>' + t + '</option>').join('')}</select>
        <select onchange="frmApplyFilter('domaine', this.value)"><option value="">Tous les domaines</option>${DOMAINES.map(d => `<option value="${d}" ${frmFilters.domaine === d ? 'selected' : ''}>${DOMAINE_LABELS[d] || d}</option>`).join('')}</select>
        <select onchange="frmApplyFilter('status', this.value)"><option value="active" ${frmFilters.status === 'active' ? 'selected' : ''}>Actifs</option><option value="inactive" ${frmFilters.status === 'inactive' ? 'selected' : ''}>Inactifs</option><option value="all" ${frmFilters.status === 'all' ? 'selected' : ''}>Tous</option></select>
        <input type="text" placeholder="Rechercher..." value="${frmFilters.search}" oninput="frmSearchDebounced(this.value)" class="filter-search-input">
        <button class="btn-icon" onclick="frmResetFilters()" title="R\u00e9initialiser les filtres"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
        <div class="export-dropdown" style="position:relative;display:inline-block">
          <button class="btn btn-outline btn-sm" onclick="toggleFrmExportMenu()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> T\u00e9l\u00e9charger \u25bc</button>
          <div id="frm-export-menu" class="export-menu">
            <button onclick="exportFormateursFile('csv')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38a169" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export CSV</span><small>.csv</small></button>
            <button onclick="exportFormateursFile('excel')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export Excel</span><small>.xlsx</small></button>
            <button onclick="exportFormateursFile('pdf')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Export PDF</span><small>.pdf</small></button>
            ${state.user?.role === 'Administrateur' ? `<div style="border-top:1px solid #e2e8f0;margin:0.25rem 0"></div><button onclick="downloadImportTemplate('formateurs')" class="export-item"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Modèle d'import</span><small>.xlsx</small></button>` : ''}
          </div>
        </div>
        ${state.user?.role === 'Administrateur' ? `<button class="btn btn-outline btn-sm" title="Identifier les inspecteurs qui sont aussi formateurs" onclick="openLinkInspectorsModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Vérifier liens</button>` : ''}
        ${state.user?.role === 'Administrateur' ? `<button class="btn btn-outline btn-sm" onclick="document.getElementById('import-frm-file').click()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Importer Excel</button><input type="file" id="import-frm-file" accept=".xlsx" style="display:none" onchange="importFormateurs(this)">` : ''}
        ${canDeactivate ? `<button class="btn btn-sm" id="frm-delete-btn" style="background:#dc2626;color:white;display:none" onclick="bulkDeleteFormateurs()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg> Supprimer</button>` : ''}
        ${canAdd ? `<button class="btn btn-primary btn-sm" onclick="openFormateurForm()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Formateur</button>` : ''}
      </div>
    </div>
    <div class="results-info" style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><span>${formateursData.total} formateur${formateursData.total > 1 ? 's' : ''} trouv\u00e9${formateursData.total > 1 ? 's' : ''}</span><label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;white-space:nowrap">Afficher <select onchange="changeFrmPageSize(this.value)" style="padding:0.25rem 0.5rem">${[10,25,50,100,200].map(n=>`<option value="${n}" ${frmPageSize===n?'selected':''}>${n}</option>`).join('')}</select> par page</label></div>
    <div class="table-container"><table class="data-table">
      <thead><tr>${canDeactivate ? '<th style="width:30px"><input type="checkbox" onchange="toggleAllFormateurs(this.checked)"></th>' : ''}<th class="sortable" style="display:none" onclick="frmSortBy('reference')">R\u00e9f.${frmSortIcon('reference')}</th><th class="sortable" onclick="frmSortBy('nom')">Nom et Pr\u00e9nom${frmSortIcon('nom')}</th><th class="sortable" onclick="frmSortBy('etat')">\u00c9tat${frmSortIcon('etat')}</th><th>Comp\u00e9tences</th><th class="sortable" onclick="frmSortBy('is_inspecteur')">Inspecteur${frmSortIcon('is_inspecteur')}</th><th>Actions</th></tr></thead>
      <tbody>
        ${formateursData.formateurs.length === 0 ? `<tr><td colspan="${canDeactivate ? 7 : 6}" class="text-center">Aucun formateur trouv\u00e9</td></tr>` :
          formateursData.formateurs.map(f => {
            const comps = (f.competences || []).map(c => `${c.type_competence}${c.domaine ? ' (' + c.domaine + ')' : ''}`).join(', ');
            const inactiveClass = !f.is_active ? ' row-inactive' : '';
            return `<tr class="${inactiveClass}">
              ${canDeactivate ? `<td><input type="checkbox" class="frm-check" value="${f.id}" onchange="updateFrmDeleteBtn()"></td>` : ''}
              <td class="ref-cell" style="display:none">${f.reference}</td>
              <td>${esc(f.nom)} ${esc(f.prenom)}</td>
              <td><span class="state-badge">${esc(f.etat)}</span></td>
              <td class="specialite-cell" title="${esc(comps)}">${esc(comps)}</td>
              <td>${f.is_inspecteur ? '<span class="status-badge active">Oui</span>' : 'Non'}</td>
              <td class="actions-cell">
                <button class="btn-icon" title="Voir" onclick="viewFormateur(${f.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                ${canAdd ? `<button class="btn-icon" title="Modifier" onclick="editFormateur(${f.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                ${canEmail && f.email ? `<button class="btn-icon" title="Email" onclick="openFrmEmailForm(${f.id}, '${esc(f.email)}', '${esc(f.prenom)} ${esc(f.nom)}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></button>` : ''}
                ${f.cv_path ? `<a class="btn-icon" href="/uploads/${f.cv_path}" download title="CV"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>` : ''}
                ${canDeactivate && f.is_active ? `<button class="btn-icon btn-danger" title="D\u00e9sactiver" onclick="deactivateFormateur(${f.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></button>` : ''}
                ${canDeactivate && !f.is_active ? `<button class="btn-icon btn-success" title="R\u00e9activer" onclick="activateFormateur(${f.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>` : ''}
              </td>
            </tr>`;
          }).join('')}
      </tbody>
    </table></div>
    ${formateursData.totalPages > 1 ? `<div class="pagination"><button ${frmPage <= 1 ? 'disabled' : ''} onclick="frmChangePage(${frmPage - 1})">Pr\u00e9c\u00e9dent</button><span>Page ${frmPage} / ${formateursData.totalPages}</span><button ${frmPage >= formateursData.totalPages ? 'disabled' : ''} onclick="frmChangePage(${frmPage + 1})">Suivant</button></div>` : ''}
  `;
}

function frmFilterByState(etat) { frmFilters.etat = frmFilters.etat === etat ? '' : etat; frmPage = 1; reloadFormateurs(); }
function frmApplyFilter(key, value) { frmFilters[key] = value; frmPage = 1; reloadFormateurs(); }
let frmSearchTimeout;
function frmSearchDebounced(value) { clearTimeout(frmSearchTimeout); frmSearchTimeout = setTimeout(() => { frmFilters.search = value; frmPage = 1; reloadFormateurs(); }, 300); }
function frmResetFilters() { frmFilters = { etat: '', competence: '', domaine: '', search: '', status: 'active' }; frmPage = 1; reloadFormateurs(); }
function frmChangePage(p) { frmPage = p; reloadFormateurs(); }
function changeFrmPageSize(n) { frmPageSize = parseInt(n); frmPage = 1; reloadFormateurs(); }

function frmSortIcon(col) {
  if (frmSort.col !== col) return ' <span style="opacity:0.3;font-size:0.7em">\u25B2\u25BC</span>';
  return frmSort.dir === 'asc' ? ' <span style="font-size:0.7em">\u25B2</span>' : ' <span style="font-size:0.7em">\u25BC</span>';
}
function frmSortBy(col) {
  if (frmSort.col === col) { frmSort.dir = frmSort.dir === 'asc' ? 'desc' : 'asc'; }
  else { frmSort.col = col; frmSort.dir = 'asc'; }
  sortFormateursLocal();
  renderFormateursContent();
}
function sortFormateursLocal() {
  if (!frmSort.col) return;
  const arr = formateursData.formateurs;
  arr.sort((a, b) => {
    let va = a[frmSort.col] ?? '';
    let vb = b[frmSort.col] ?? '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return frmSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return frmSort.dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function showFrmMsg(msg, type = 'success') { const el = document.getElementById('frm-floating-msg'); if (el) { el.innerHTML = `<div class="alert alert-${type} floating-alert">${msg}</div>`; setTimeout(() => { el.innerHTML = ''; }, 4000); } }

async function reloadFormateurs() {
  try { const frmFilterStr = buildFrmFilterParams(); const [stats, data] = await Promise.all([api(`/formateurs/stats?${frmFilterStr}`), api(`/formateurs?${frmFilterStr}`)]); formateursStats = stats; formateursData = data; } catch (err) { if (err.message.includes('expir\u00e9e')) logout(); }
  renderFormateursContent();
}

async function viewFormateur(id) {
  try {
    const f = await api(`/formateurs/${id}`);
    const comps = (f.competences || []).map(c => `<div class="qual-card"><span class="qual-domain">${esc(c.type_competence)}</span><div><strong>Domaine:</strong> ${esc(c.domaine)}</div></div>`).join('');
    const delivrees = (f.formations || []).filter(x => x.type === 'delivree').map(x => `<li>${esc(x.description)}</li>`).join('');
    const developpees = (f.formations || []).filter(x => x.type === 'developpee').map(x => `<li>${esc(x.description)}</li>`).join('');
    openModal(`
      <div class="modal-header"><h3>D\u00e9tails du formateur</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item"><label>R\u00e9f\u00e9rence</label><span>${f.reference}</span></div>
          <div class="detail-item"><label>Nom et Pr\u00e9nom</label><span>${esc(f.nom)} ${esc(f.prenom)}</span></div>
          <div class="detail-item"><label>\u00c9tat</label><span>${esc(f.etat)}</span></div>
          <div class="detail-item"><label>Email</label><span>${esc(f.email || 'Non renseign\u00e9')}</span></div>
          <div class="detail-item"><label>T\u00e9l\u00e9phone</label><span>${esc(f.telephone || 'Non renseign\u00e9')}</span></div>
          <div class="detail-item"><label>Inspecteur</label><span>${f.is_inspecteur ? 'Oui' : 'Non'}</span></div>
          <div class="detail-item"><label>Statut</label><span class="status-badge ${f.is_active ? 'active' : 'inactive'}">${f.is_active ? 'Actif' : 'Inactif'}</span></div>
        </div>
        <h4 style="margin-top:1.5rem;margin-bottom:0.5rem">Comp\u00e9tences</h4>
        ${comps || '<p class="text-muted">Aucune comp\u00e9tence</p>'}
        ${delivrees ? `<h4 style="margin-top:1.5rem;margin-bottom:0.5rem">Formations d\u00e9livr\u00e9es</h4><ul>${delivrees}</ul>` : ''}
        ${developpees ? `<h4 style="margin-top:1.5rem;margin-bottom:0.5rem">Formations d\u00e9velopp\u00e9es</h4><ul>${developpees}</ul>` : ''}
      </div>
    `);
  } catch (err) { showFrmMsg(err.message, 'error'); }
}

// ===== FORMATEUR MULTI-SELECT =====
function toggleAllFormateurs(checked) { document.querySelectorAll('.frm-check').forEach(cb => cb.checked = checked); updateFrmDeleteBtn(); }
function updateFrmDeleteBtn() { const btn = document.getElementById('frm-delete-btn'); if (!btn) return; const count = document.querySelectorAll('.frm-check:checked').length; btn.style.display = count > 0 ? 'inline-flex' : 'none'; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/></svg> Supprimer (${count})`; }
async function bulkDeleteFormateurs() {
  const ids = [...document.querySelectorAll('.frm-check:checked')].map(cb => parseInt(cb.value));
  if (ids.length === 0) return;
  if (!confirm(`Voulez-vous vraiment supprimer ${ids.length} formateur(s) ? Cette action est irr\u00e9versible.`)) return;
  try { const data = await api('/formateurs/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }); showFrmMsg(data.message); reloadKeepScroll(reloadFormateurs); } catch (err) { showFrmMsg(err.message, 'error'); }
}

let frmCompetences = [{ type_competence: '', domaine: '' }];
let frmFormationsDelivrees = [''];
let frmFormationsDeveloppees = [''];

function openFormateurForm(formateur = null) {
  const isEdit = !!formateur;
  frmCompetences = formateur?.competences?.length > 0 ? formateur.competences.map(c => ({ type_competence: c.type_competence, domaine: c.domaine })) : [{ type_competence: '', domaine: '' }];
  frmFormationsDelivrees = (formateur?.formations || []).filter(f => f.type === 'delivree').map(f => f.description);
  if (frmFormationsDelivrees.length === 0) frmFormationsDelivrees = [''];
  frmFormationsDeveloppees = (formateur?.formations || []).filter(f => f.type === 'developpee').map(f => f.description);
  if (frmFormationsDeveloppees.length === 0) frmFormationsDeveloppees = [''];

  openModal(`
    <div class="modal-header"><h3>${isEdit ? 'Modifier le formateur' : 'Ajouter un formateur'}</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
    <form id="formateur-form" enctype="multipart/form-data">
      <div class="modal-body">
        <div id="frm-form-error"></div>
        <h4>Identification</h4>
        <div class="form-row">
          <div class="form-group"><label>Nom *</label><input type="text" id="frm-nom" value="${esc(formateur?.nom || '')}" required></div>
          <div class="form-group"><label>Pr\u00e9nom *</label><input type="text" id="frm-prenom" value="${esc(formateur?.prenom || '')}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>\u00c9tat *</label><select id="frm-etat" required><option value="">S\u00e9lectionner</option>${ETATS.map(e => `<option value="${e}" ${formateur?.etat === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
          <div class="form-group"><label>Email</label><input type="email" id="frm-email" value="${esc(formateur?.email || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>T\u00e9l\u00e9phone</label><input type="tel" id="frm-tel" value="${esc(formateur?.telephone || '')}"></div>
          <div class="form-group"><label>Pi\u00e8ce jointe (CV)</label><input type="file" id="frm-cv" accept=".pdf,.doc,.docx"></div>
        </div>
        <div class="form-row">
          <div class="form-group" style="align-self:flex-start"><label style="display:inline-flex;align-items:center;gap:0.35rem;white-space:nowrap;cursor:pointer;margin:0"><input type="checkbox" id="frm-inspecteur" ${formateur?.is_inspecteur ? 'checked' : ''} style="margin:0">Ce formateur est aussi inspecteur</label></div>
        </div>
        <h4 style="margin-top:1.5rem">Comp\u00e9tences <button type="button" class="btn btn-sm btn-outline" style="margin-left:1rem" onclick="addFrmComp()">+ Ajouter</button></h4>
        <div id="frm-comps-container">${renderFrmComps()}</div>
        <h4 style="margin-top:1.5rem">Formations d\u00e9livr\u00e9es <button type="button" class="btn btn-sm btn-outline" style="margin-left:1rem" onclick="addFrmFormation('delivree')">+ Ajouter</button></h4>
        <div id="frm-delivrees-container">${renderFrmFormations('delivree')}</div>
        <h4 style="margin-top:1.5rem">Formations d\u00e9velopp\u00e9es <button type="button" class="btn btn-sm btn-outline" style="margin-left:1rem" onclick="addFrmFormation('developpee')">+ Ajouter</button></h4>
        <div id="frm-developpees-container">${renderFrmFormations('developpee')}</div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button><button type="submit" class="btn btn-primary" id="frm-save-btn">${isEdit ? 'Modifier' : 'Ajouter'}</button></div>
    </form>
  `, 'modal-lg');

  document.getElementById('formateur-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('frm-form-error'); errDiv.innerHTML = '';
    const formData = new FormData();
    formData.append('nom', document.getElementById('frm-nom').value);
    formData.append('prenom', document.getElementById('frm-prenom').value);
    formData.append('etat', document.getElementById('frm-etat').value);
    formData.append('email', document.getElementById('frm-email').value);
    formData.append('telephone', document.getElementById('frm-tel').value);
    formData.append('is_inspecteur', document.getElementById('frm-inspecteur').checked ? '1' : '0');
    formData.append('competences', JSON.stringify(frmCompetences.filter(c => c.type_competence)));
    const formations = [];
    frmFormationsDelivrees.filter(f => f.trim()).forEach(f => formations.push({ type: 'delivree', description: f }));
    frmFormationsDeveloppees.filter(f => f.trim()).forEach(f => formations.push({ type: 'developpee', description: f }));
    formData.append('formations', JSON.stringify(formations));
    const cvFile = document.getElementById('frm-cv').files[0];
    if (cvFile) formData.append('cv', cvFile);
    const btn = document.getElementById('frm-save-btn'); btn.disabled = true; btn.textContent = 'Enregistrement...';
    try {
      const url = isEdit ? `/api/formateurs/${formateur.id}` : '/api/formateurs';
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Authorization': `Bearer ${state.token}` }, body: formData });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { throw new Error('R\u00e9ponse serveur invalide. V\u00e9rifiez votre session.'); }
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      closeModal(); showFrmMsg('Sauvegard\u00e9 avec succ\u00e8s'); reloadKeepScroll(reloadFormateurs);
    } catch (err) { errDiv.innerHTML = `<div class="alert alert-error">${err.message}</div>`; btn.disabled = false; btn.textContent = isEdit ? 'Modifier' : 'Ajouter'; }
  });
}

function renderFrmComps() {
  return frmCompetences.map((c, i) => `
    <div class="qual-form-row"><div class="form-row">
      <div class="form-group"><label>Type</label><select onchange="frmCompetences[${i}].type_competence=this.value"><option value="">S\u00e9lectionner</option>${FORMATEUR_TYPES.map(t => '<option value="' + t + '"' + (c.type_competence === t ? ' selected' : '') + '>' + t + '</option>').join('')}</select></div>
      <div class="form-group"><label>Domaine</label><select onchange="frmCompetences[${i}].domaine=this.value"><option value="">S\u00e9lectionner</option>${DOMAINES.map(d => `<option value="${d}" ${c.domaine === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      ${frmCompetences.length > 1 ? `<button type="button" class="btn-icon btn-danger" style="align-self:flex-end;margin-bottom:0.5rem" onclick="removeFrmComp(${i})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
    </div></div>
  `).join('');
}

function addFrmComp() { frmCompetences.push({ type_competence: '', domaine: '' }); document.getElementById('frm-comps-container').innerHTML = renderFrmComps(); }
function removeFrmComp(i) { frmCompetences.splice(i, 1); document.getElementById('frm-comps-container').innerHTML = renderFrmComps(); }

function renderFrmFormations(type) {
  const list = type === 'delivree' ? frmFormationsDelivrees : frmFormationsDeveloppees;
  return list.map((f, i) => `
    <div class="form-row" style="margin-bottom:0.5rem">
      <div class="form-group" style="flex:1"><input type="text" value="${esc(f)}" oninput="${type === 'delivree' ? 'frmFormationsDelivrees' : 'frmFormationsDeveloppees'}[${i}]=this.value" placeholder="Description de la formation"></div>
      ${list.length > 1 ? `<button type="button" class="btn-icon btn-danger" style="align-self:flex-end;margin-bottom:0.5rem" onclick="removeFrmFormation('${type}', ${i})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
    </div>
  `).join('');
}

function addFrmFormation(type) {
  if (type === 'delivree') { frmFormationsDelivrees.push(''); document.getElementById('frm-delivrees-container').innerHTML = renderFrmFormations('delivree'); }
  else { frmFormationsDeveloppees.push(''); document.getElementById('frm-developpees-container').innerHTML = renderFrmFormations('developpee'); }
}
function removeFrmFormation(type, i) {
  if (type === 'delivree') { frmFormationsDelivrees.splice(i, 1); document.getElementById('frm-delivrees-container').innerHTML = renderFrmFormations('delivree'); }
  else { frmFormationsDeveloppees.splice(i, 1); document.getElementById('frm-developpees-container').innerHTML = renderFrmFormations('developpee'); }
}

async function editFormateur(id) { try { const f = await api(`/formateurs/${id}`); openFormateurForm(f); } catch (err) { showFrmMsg(err.message, 'error'); } }
async function deactivateFormateur(id) { if (!confirm('Voulez-vous vraiment d\u00e9sactiver ce formateur ?')) return; try { await api(`/formateurs/${id}/deactivate`, { method: 'PUT' }); showFrmMsg('Formateur d\u00e9sactiv\u00e9'); reloadKeepScroll(reloadFormateurs); } catch (err) { showFrmMsg(err.message, 'error'); } }
async function activateFormateur(id) { if (!confirm('Voulez-vous vraiment r\u00e9activer ce formateur ?')) return; try { await api(`/formateurs/${id}/activate`, { method: 'PUT' }); showFrmMsg('Formateur r\u00e9activ\u00e9'); reloadKeepScroll(reloadFormateurs); } catch (err) { showFrmMsg(err.message, 'error'); } }

function openFrmEmailForm(id, email, name) {
  openModal(`<div class="modal-header"><h3>Envoyer un email \u00e0 ${esc(name)}</h3><button class="btn-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><p class="text-muted">Destinataire: ${esc(email)}</p><div class="form-group"><label>Objet</label><input type="text" id="frm-email-subject" placeholder="Objet de l'email"></div><div class="form-group"><label>Message</label><textarea id="frm-email-body" rows="6" placeholder="Contenu du message..."></textarea></div><div class="modal-actions"><button class="btn btn-outline" onclick="closeModal()">Annuler</button><button class="btn btn-primary" onclick="sendFrmEmail(${id})">Envoyer</button></div></div>`);
}
async function sendFrmEmail(id) { try { const data = await api(`/formateurs/${id}/email`, { method: 'POST', body: JSON.stringify({ subject: document.getElementById('frm-email-subject').value, body: document.getElementById('frm-email-body').value }) }); closeModal(); if (data.mailto) window.open(data.mailto, '_blank'); showFrmMsg(data.message); } catch (err) { showFrmMsg(err.message, 'error'); } }

function toggleFrmExportMenu() {
  const menu = document.getElementById('frm-export-menu');
  if (menu) menu.classList.toggle('show');
  setTimeout(() => {
    const handler = (e) => {
      if (!e.target.closest('.export-dropdown')) {
        const m = document.getElementById('frm-export-menu');
        if (m) m.classList.remove('show');
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 10);
}

async function exportFormateursFile(format) {
  try {
    const p = new URLSearchParams();
    if (frmFilters.etat) p.append('etat', frmFilters.etat);
    if (frmFilters.competence) p.append('competence', frmFilters.competence);
    if (frmFilters.domaine) p.append('domaine', frmFilters.domaine);
    if (frmFilters.search) p.append('search', frmFilters.search);
    if (frmFilters.status) p.append('status', frmFilters.status);
    const res = await fetch(`/api/formateurs/export/${format}?${p.toString()}`, { headers: { 'Authorization': `Bearer ${state.token}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors du t\u00e9l\u00e9chargement');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ext = format === 'excel' ? 'xlsx' : (format === 'pdf' ? 'pdf' : 'csv');
    a.href = url; a.download = `formateurs.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showFrmMsg(`Export ${format.toUpperCase()} t\u00e9l\u00e9charg\u00e9 avec succ\u00e8s`);
  } catch (err) {
    if (err.message.includes('expir\u00e9e')) { logout(); return; }
    showFrmMsg(err.message, 'error');
  }
}

async function openLinkInspectorsModal() {
  try {
    const data = await api('/formateurs/unlinked-matches');
    const matches = data.matches || [];
    if (matches.length === 0) {
      showFrmMsg('Aucune correspondance non liée trouvée. Tous les formateurs concernés sont déjà liés à un inspecteur.');
      return;
    }
    const rows = matches.map((m, i) => {
      const emailDiff = m.i_email && m.f_email && m.i_email.toLowerCase().trim() !== m.f_email.toLowerCase().trim();
      const reasonBadge = m.reason === 'flag_missing'
        ? '<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:3px;font-size:0.75rem">Lié – flag manquant</span>'
        : '<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:3px;font-size:0.75rem">À lier</span>';
      return `<tr>
        <td><input type="checkbox" class="link-match-cb" data-i="${m.inspector_id}" data-f="${m.formateur_id}" checked></td>
        <td>${esc(m.nom)} ${esc(m.prenom)}</td>
        <td>${esc(m.etat)}</td>
        <td>${reasonBadge}</td>
        <td><small style="color:#4a5568">${esc(m.inspector_ref)}</small></td>
        <td><small style="color:#4a5568">${esc(m.formateur_ref)}</small></td>
        <td>${emailDiff ? `<small style="color:#dc2626" title="Emails différents">⚠ ${esc(m.i_email||'')} ≠ ${esc(m.f_email||'')}</small>` : `<small style="color:#38a169">✓</small>`}</td>
      </tr>`;
    }).join('');
    openModal(`
      <div class="modal-header"><h3>Vérification des correspondances Inspecteur ↔ Formateur</h3><button class="btn-close" onclick="closeModal()">&times;</button></div>
      <div class="modal-body">
        <p style="color:#4a5568;font-size:0.9rem;margin-bottom:1rem">${matches.length} enregistrement(s) à valider : formateurs sans lien <em>+</em> formateurs liés mais marqués Inspecteur = Non. Décochez ceux à ne pas traiter. Les enregistrements validés auront <strong>Inspecteur = Oui</strong>.</p>
        <div style="margin-bottom:0.5rem"><label style="display:inline-flex;align-items:center;gap:0.35rem;cursor:pointer;font-size:0.875rem"><input type="checkbox" id="link-toggle-all" checked onchange="document.querySelectorAll('.link-match-cb').forEach(cb=>cb.checked=this.checked)"> Tout sélectionner</label></div>
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th style="width:30px"></th><th>Nom et Prénom</th><th>État</th><th>Type</th><th>Inspecteur</th><th>Formateur</th><th>Emails</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div id="link-match-error"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Annuler</button>
        <button type="button" class="btn btn-primary" id="link-match-submit" onclick="submitLinkMatches()">Valider les liens sélectionnés</button>
      </div>
    `, 'modal-lg');
  } catch (err) { showFrmMsg(err.message, 'error'); }
}

async function submitLinkMatches() {
  const pairs = [...document.querySelectorAll('.link-match-cb:checked')].map(cb => ({
    inspector_id: parseInt(cb.dataset.i),
    formateur_id: parseInt(cb.dataset.f)
  }));
  if (pairs.length === 0) {
    document.getElementById('link-match-error').innerHTML = '<div class="alert alert-error">Aucune correspondance sélectionnée</div>';
    return;
  }
  const btn = document.getElementById('link-match-submit'); btn.disabled = true; btn.textContent = 'Liaison en cours...';
  try {
    const data = await api('/formateurs/bulk-link', { method: 'POST', body: JSON.stringify({ pairs }) });
    closeModal();
    showFrmMsg(data.message);
    reloadKeepScroll(reloadFormateurs);
  } catch (err) {
    document.getElementById('link-match-error').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    btn.disabled = false; btn.textContent = 'Valider les liens sélectionnés';
  }
}

async function importFormateurs(input) {
  if (!input.files[0]) return;
  await _importPreview('formateurs', input.files[0]);
  input.value = '';
}


// ===== INIT =====
window.addEventListener('hashchange', () => { state.page = location.hash.slice(1) || (state.user ? 'inspectors' : 'login'); render(); });
if (state.token) { api('/auth/me').then(user => { state.user = { ...state.user, ...user, mustChangePassword: user.must_change_password === 1, inspectorId: user.inspector_id }; localStorage.setItem('user', JSON.stringify(state.user)); resetInactivity(); render(); }).catch(() => { logout(); }); }
else { render(); }

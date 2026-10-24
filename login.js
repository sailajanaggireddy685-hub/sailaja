/* StudentNotes login page: lamp cord theme switch and a simple local login.
   Accounts are kept in this browser's localStorage. There is no server, so this
   keeps casual users apart on a shared device but is not real security. */

const USERS_KEY = 'notenest-users';
const SESSION_KEY = 'notenest-session';
const THEME_KEY = 'notenest-theme';
const PULL_TO_TOGGLE = 40;   // px the cord must be pulled
const MAX_PULL = 90;

const $ = sel => document.querySelector(sel);
const lamp = $('#lamp');
const cord = $('#cord');
const hint = $('#hint');
const form = $('#authForm');
const msg = $('#msg');
let mode = 'login';

/* ---------- storage helpers ---------- */

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// SHA-256 when available, otherwise a simple string hash
async function hashPassword(password, salt) {
  const text = salt + ':' + password;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381;
  for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return 'x' + h.toString(16);
}

function startSession(user, remember) {
  const session = { name: user.name, email: user.email, at: Date.now() };
  try {
    // "Remember me" keeps you logged in after the browser closes
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
    (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
  } catch (e) {}
}

/* ---------- lamp and theme ---------- */

let audioCtx;
function clickSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {}
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  cord.setAttribute('aria-pressed', theme === 'light');
}

function toggleLight() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  clickSound();
  lamp.classList.remove('swing');
  void lamp.offsetWidth;           // restart the swing animation
  lamp.classList.add('swing');
  hint.classList.add('gone');
}

// Drag the cord down and let go; a short tap or Enter also works
let startY = null;
let pulled = 0;

cord.addEventListener('pointerdown', e => {
  startY = e.clientY;
  pulled = 0;
  cord.classList.add('dragging');
  cord.setPointerCapture(e.pointerId);
});
cord.addEventListener('pointermove', e => {
  if (startY === null) return;
  pulled = Math.max(0, Math.min(MAX_PULL, e.clientY - startY));
  cord.style.setProperty('--pull', pulled + 'px');
});
function release() {
  if (startY === null) return;
  startY = null;
  cord.classList.remove('dragging');
  cord.style.setProperty('--pull', '0px');   // springs back via CSS transition
  if (pulled >= PULL_TO_TOGGLE || pulled < 4) toggleLight();
}
cord.addEventListener('pointerup', release);
cord.addEventListener('pointercancel', () => { pulled = 10; release(); });
cord.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    cord.style.setProperty('--pull', '50px');
    setTimeout(() => { cord.style.setProperty('--pull', '0px'); toggleLight(); }, 150);
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'l' || e.key === 'L') && !e.target.closest('input')) toggleLight();
});

/* ---------- login and sign up ---------- */

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  $('.tabs').classList.toggle('signup', signup);
  $('#tabLogin').classList.toggle('active', !signup);
  $('#tabSignup').classList.toggle('active', signup);
  $('#tabLogin').setAttribute('aria-selected', !signup);
  $('#tabSignup').setAttribute('aria-selected', signup);
  $('#nameField').classList.toggle('hidden', !signup);
  $('#formTitle').textContent = signup ? 'Create your account ✨' : 'Welcome back 👋';
  $('#formSub').textContent = signup
    ? 'Start sharing notes, papers and lab records with your class.'
    : 'Log in to open your notes, papers and lab records.';
  $('#submitBtn').textContent = signup ? 'Create account' : 'Log in';
  $('#password').autocomplete = signup ? 'new-password' : 'current-password';
  $('#switchText').firstChild.textContent = signup ? 'Already have an account? ' : 'New here? ';
  $('#switchBtn').textContent = signup ? 'Log in' : 'Create an account';
  $('#forgot').classList.toggle('hidden', signup);
  hideMsg();
  (signup ? $('#name') : $('#email')).focus();
}

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.classList.toggle('ok', ok);
  msg.classList.remove('hidden');
  if (!ok) {
    const card = $('#card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
}
function hideMsg() {
  msg.classList.add('hidden');
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}
function fail(input, text) {
  input.classList.add('invalid');
  input.focus();
  showMsg(text);
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  hideMsg();
  const nameEl = $('#name'), emailEl = $('#email'), pwEl = $('#password');
  const name = nameEl.value.trim();
  const email = emailEl.value.trim().toLowerCase();
  const password = pwEl.value;
  const users = readJson(USERS_KEY, {});

  if (mode === 'signup' && name.length < 2) return fail(nameEl, 'Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(emailEl, 'Please enter a valid email address.');
  if (password.length < 6) return fail(pwEl, 'The password needs at least 6 characters.');

  $('#submitBtn').disabled = true;
  try {
    if (mode === 'signup') {
      if (users[email]) return fail(emailEl, 'An account with this email already exists. Log in instead.');
      const salt = Math.random().toString(36).slice(2, 10);
      users[email] = { name, email, salt, hash: await hashPassword(password, salt), createdAt: Date.now() };
      writeJson(USERS_KEY, users);
      startSession(users[email], $('#remember').checked);
      showMsg(`Account created. Welcome, ${name}!`, true);
    } else {
      const user = users[email];
      if (!user) return fail(emailEl, 'No account found with this email. Sign up first.');
      if (await hashPassword(password, user.salt) !== user.hash) return fail(pwEl, 'Wrong password. Please try again.');
      startSession(user, $('#remember').checked);
      showMsg(`Welcome back, ${user.name}!`, true);
    }
    setTimeout(() => { location.href = 'index.html'; }, 700);
  } finally {
    $('#submitBtn').disabled = false;
  }
});

$('#guestBtn').addEventListener('click', () => {
  startSession({ name: 'Guest', email: '' }, false);
  location.href = 'index.html';
});
$('#tabLogin').addEventListener('click', () => setMode('login'));
$('#tabSignup').addEventListener('click', () => setMode('signup'));
$('#switchBtn').addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
$('#forgot').addEventListener('click', () =>
  showMsg('Accounts are saved only in this browser, so a password cannot be reset by email. Create a new account or continue as a guest.'));
$('#pwToggle').addEventListener('click', () => {
  const pw = $('#password');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  $('#pwToggle').textContent = show ? '🙈' : '👁';
  $('#pwToggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

setTheme(document.documentElement.dataset.theme || 'dark');

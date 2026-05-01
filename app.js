'use strict';

/* ================= STATE ================= /
let db = null;

let state = {
  employee: { name: '', fortnightFrom: '', fortnightTo: '' },
  dailyHours: [],
  expenses: [],
  mileage: [],
  allowances: []
};

let settings = {
  name: '',
  emailTo: '',
  emailCc: ''
};

/ ================= INDEXED DB ================= /
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fieldsheet_db', 1);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id' });
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = reject;
  });
}

function dbPut(store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

/ ================= UTIL ================= /
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d);
}

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function fmtDate(iso) {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString('en-AU');
}

/ ================= TABS ================= /
function switchTab(btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));

  const tabId = btn.getAttribute('data-tab');
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');

  window.scrollTo(0, 0);
}

function gotoStep(tabId) {
  const btn = document.querySelector(.step-btn[data-tab="${tabId}"]);
  if (btn) switchTab(btn);
}

/ ================= FORTNIGHT ================= /
function onFortnightStartChange(input) {
  if (!input.value) return;

  let d = parseLocalDate(input.value);

  const dow = d.getDay();
  if (dow !== 1) {
    d.setDate(d.getDate() + (1 - dow));
  }

  const start = d;
  const end = new Date(start);
  end.setDate(start.getDate() + 13);

  state.employee.fortnightFrom = toISO(start);
  state.employee.fortnightTo = toISO(end);

  document.getElementById('fortnight-from').value = state.employee.fortnightFrom;
  document.getElementById('fortnight-to-display').innerText = fmtDate(state.employee.fortnightTo);

  buildDailyTable();
}

/ ================= DAILY TABLE ================= /
function buildDailyTable() {
  const container = document.getElementById('daily-rows-container');
  container.innerHTML = '';

  const start = parseLocalDate(state.employee.fortnightFrom);
  const end = parseLocalDate(state.employee.fortnightTo);

  let d = new Date(start);

  while (d <= end) {
    const iso = toISO(d);
    const dow = d.getDay();

    const row = document.createElement('div');
    row.className = 'day-row' + (dow === 0 || dow === 6 ? ' weekend' : '');
    row.id = 'row-' + iso;

    row.innerHTML =       <div class="day-row-top">         <div class="day-name">${d.toLocaleDateString('en-AU', { weekday: 'short' })}</div>         <div class="day-date">${fmtDate(iso)}</div>       </div>       <div class="day-row-inputs">         <select id="type-${iso}" onchange="onTypeChange('${iso}', this)">           <option value="work">Work</option>           <option value="annual">Annual</option>           <option value="sick">Sick</option>           <option value="ph">PH</option>           <option value="rdo">RDO</option>           <option value="other">Other</option>         </select>         <input id="hours-${iso}" type="number" oninput="onHoursChange('${iso}')" />         <input id="notes-${iso}" placeholder="Notes" />       </div>    ;

    container.appendChild(row);
    d.setDate(d.getDate() + 1);
  }

  document.getElementById('daily-table-card').classList.remove('hidden');
  updateHoursSummary();
}

function onTypeChange(iso, sel) {
  if (['annual', 'sick', 'ph'].includes(sel.value)) {
    const h = document.getElementById('hours-' + iso);
    if (!h.value) h.value = 7.6;
  }
  if (sel.value === 'rdo') {
    document.getElementById('hours-' + iso).value = '';
  }
  updateHoursSummary();
}

function onHoursChange() {
  updateHoursSummary();
}

/ ================= SUMMARY ================= /
function updateHoursSummary() {
  let total = 0;

  document.querySelectorAll('[id^="hours-"]').forEach(i => {
    total += Number(i.value || 0);
  });

  document.getElementById('hours-summary').innerText = 'Total: ' + total.toFixed(2);
}

/ ================= EXPENSES ================= /
function addExpense() {
  const amount = document.getElementById('exp-amount').value;
  if (!amount) return alert('Enter amount');

  state.expenses.push({
    id: Date.now(),
    amount
  });

  renderExpenses();
}

function renderExpenses() {
  const list = document.getElementById('expense-list');
  list.innerHTML = '';

  state.expenses.forEach((e, i) => {
    const div = document.createElement('div');
    div.innerHTML = Expense $${e.amount} <button onclick="removeExpense(${i})">X</button>;
    list.appendChild(div);
  });
}

function removeExpense(i) {
  state.expenses.splice(i, 1);
  renderExpenses();
}

/ ================= MILEAGE ================= /
function calcMileageTotal() {
  const km = Number(document.getElementById('mil-km').value || 0);
  const rate = Number(document.getElementById('mil-rate').value || 0);
  document.getElementById('mil-total').innerText = (km * rate).toFixed(2);
}

function addMileage() {
  const km = document.getElementById('mil-km').value;
  if (!km) return;

  state.mileage.push({ id: Date.now(), km });

  renderMileage();
}

function renderMileage() {
  const list = document.getElementById('mileage-list');
  list.innerHTML = '';

  state.mileage.forEach((m, i) => {
    const div = document.createElement('div');
    div.innerHTML = ${m.km} km <button onclick="removeMileage(${i})">X</button>;
    list.appendChild(div);
  });
}

function removeMileage(i) {
  state.mileage.splice(i, 1);
  renderMileage();
}

/ ================= ALLOWANCES ================= /
function addAllowance() {
  const amt = document.getElementById('all-amount').value;
  if (!amt) return;

  state.allowances.push({ id: Date.now(), amt });

  renderAllowances();
}

function renderAllowances() {
  const list = document.getElementById('allowance-list');
  list.innerHTML = '';

  state.allowances.forEach((a, i) => {
    const div = document.createElement('div');
    div.innerHTML = $${a.amt} <button onclick="removeAllowance(${i})">X</button>;
    list.appendChild(div);
  });
}

function removeAllowance(i) {
  state.allowances.splice(i, 1);
  renderAllowances();
}

/ ================= SETTINGS ================= /
function saveSettings() {
  settings.name = document.getElementById('settings-name').value;
  settings.emailTo = document.getElementById('settings-email-to').value;
  settings.emailCc = document.getElementById('settings-email-cc').value;

  localStorage.setItem('fs_settings', JSON.stringify(settings));
  closeSettings();
}

function loadSettings() {
  const s = localStorage.getItem('fs_settings');
  if (s) settings = JSON.parse(s);
}

function openSettings() {
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.add('hidden');
}

/ ================= INIT ================= */
function init() {
  loadSettings();

  renderExpenses();
  renderMileage();
  renderAllowances();

  openDB().then(() => {
    console.log('DB ready');
  });
}

document.addEventListener('DOMContentLoaded', init);
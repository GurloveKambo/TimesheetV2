'use strict';

/* ================= GLOBAL ================= /
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
  emailCc: '',
  ejsPublicKey: '',
  ejsServiceId: '',
  ejsTemplateId: '',
  reminders: true,
  lastSubmittedFortnightEnd: ''
};

/ ================= INDEXEDDB ================= /
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fieldsheet_db', 1);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      db.createObjectStore('drafts', { keyPath: 'id' });
      db.createObjectStore('submissions', { keyPath: 'id' });
    };

    req.onsuccess = e => {
      db = e.target.result;
      resolve();
    };

    req.onerror = reject;
  });
}

function dbPut(store, value) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}

function dbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
}

function dbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
    tx.onerror = rej;
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

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

/ ================= SERVICE WORKER ================= /
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.update();

    reg.onupdatefound = () => {
      document.getElementById('update-banner').classList.remove('hidden');
    };
  });
}

function applyUpdate() {
  navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
  location.reload();
}

/ ================= TABS ================= /
function switchTab(btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));

  const id = btn.getAttribute('data-tab');
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function gotoStep(id) {
  const btn = document.querySelector([data-tab="${id}"]);
  if (btn) switchTab(btn);
}

/ ================= FORTNIGHT ================= /
function onFortnightStartChange(input) {
  let d = parseLocalDate(input.value);
  const dow = d.getDay();
  if (dow !== 1) d.setDate(d.getDate() + (1 - dow));

  const end = new Date(d);
  end.setDate(d.getDate() + 13);

  state.employee.fortnightFrom = toISO(d);
  state.employee.fortnightTo = toISO(end);

  document.getElementById('fortnight-from').value = state.employee.fortnightFrom;
  document.getElementById('fortnight-to-display').innerText = fmtDate(state.employee.fortnightTo);

  buildDailyTable();
}

/ ================= DAILY ================= /
function buildDailyTable() {
  const container = document.getElementById('daily-rows-container');
  container.innerHTML = '';

  let d = parseLocalDate(state.employee.fortnightFrom);
  const end = parseLocalDate(state.employee.fortnightTo);

  while (d <= end) {
    const iso = toISO(d);

    const row = document.createElement('div');
    row.className = 'day-row';

    row.innerHTML =       <div class="day-row-top">         ${d.toLocaleDateString('en-AU',{weekday:'short'})} - ${fmtDate(iso)}       </div>       <div class="day-row-inputs">         <select id="type-${iso}">           <option value="work">Work</option>           <option value="annual">Annual</option>           <option value="sick">Sick</option>           <option value="ph">PH</option>           <option value="rdo">RDO</option>           <option value="other">Other</option>         </select>         <input id="hours-${iso}" type="number"/>         <input id="notes-${iso}" placeholder="Notes"/>       </div>    ;

    container.appendChild(row);
    d.setDate(d.getDate() + 1);
  }

  document.getElementById('daily-table-card').classList.remove('hidden');
}

/ ================= EXPENSES ================= /
async function compressImage(file) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/')) {
      const r = new FileReader();
      r.onload = () => resolve({ data: r.result, type: file.type });
      r.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const r = new FileReader();

    r.onload = e => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 1200;
      const scale = max / img.width;

      canvas.width = max;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve({
        data: canvas.toDataURL('image/jpeg', 0.75),
        type: 'image/jpeg'
      });
    };

    r.readAsDataURL(file);
  });
}

async function addExpense() {
  const amount = document.getElementById('exp-amount').value;
  const file = document.getElementById('exp-receipt').files[0];

  let receipt = null;
  if (file) receipt = await compressImage(file);

  state.expenses.push({
    id: Date.now(),
    amount,
    receipt
  });

  renderExpenses();
}

function renderExpenses() {
  const list = document.getElementById('expense-list');
  list.innerHTML = '';

  state.expenses.forEach((e, i) => {
    const div = document.createElement('div');
    div.innerHTML = $${e.amount} <button onclick="removeExpense(${i})">X</button>;
    list.appendChild(div);
  });
}

function removeExpense(i) {
  state.expenses.splice(i, 1);
  renderExpenses();
}

/ ================= PDF ================= /
function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text('VB Built FieldSheet', 10, 10);
  doc.text(state.employee.name || '', 10, 20);

  const blob = doc.output('blob');
  const filename = 'fieldsheet.pdf';

  return { doc, blob, filename };
}

/ ================= SHARE ================= /
async function sharePDF(doc, blob, filename) {
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }

    doc.save(filename);
  } catch {
    doc.save(filename);
  }
}

/ ================= EMAIL ================= /
async function sendViaEmailJS(blob) {
  if (!settings.ejsPublicKey) return;

  const base64 = await blobToBase64(blob);

  emailjs.init(settings.ejsPublicKey);

  return emailjs.send(settings.ejsServiceId, settings.ejsTemplateId, {
    pdf_data: base64,
    to_email: settings.emailTo
  });
}

function blobToBase64(blob) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.readAsDataURL(blob);
  });
}

/ ================= SUBMIT ================= /
async function submitForm() {
  const { doc, blob, filename } = generatePDF();

  await dbPut('submissions', {
    id: 'last',
    state,
    filename
  });

  await sendViaEmailJS(blob);
  await sharePDF(doc, blob, filename);

  showToast('Submitted');
}

/ ================= DRAFT ================= /
async function saveProgress() {
  await dbPut('drafts', { id: 'current', state });
  showToast('Saved');
}

async function loadDraft() {
  const d = await dbGet('drafts', 'current');
  if (!d) return;

  state = d.state;
  buildDailyTable();
}

/ ================= SETTINGS ================= /
function loadSettings() {
  const s = localStorage.getItem('fs_settings');
  if (s) settings = JSON.parse(s);
}

function saveSettings() {
  settings.name = document.getElementById('settings-name').value;
  localStorage.setItem('fs_settings', JSON.stringify(settings));
  closeSettings();
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

  openDB().then(() => {
    loadDraft();
  });
}

document.addEventListener('DOMContentLoaded', init);
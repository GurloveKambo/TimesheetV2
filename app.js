<script>
'use strict';

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

// ==================== INDEXEDDB ====================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('fieldsheet_db', 1);
        
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('submissions')) {
                db.createObjectStore('submissions', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

function dbPut(storeName, value) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not open');
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not open');
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not open');
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ==================== UTILITIES ====================
function parseLocalDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function toISO(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function typeLabel(val) {
    const map = {
        'work': 'Work',
        'annual': 'Annual Leave',
        'sick': 'Sick Leave',
        'ph': 'Public Holiday',
        'rdo': 'RDO',
        'other': 'Other'
    };
    return map[val] || val;
}

function escHtml(s) {
    return s.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
}

function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'flex';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}

function showLoading(text = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    document.getElementById('loading-text').textContent = text;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// ==================== CONTENT MARGIN (Critical for iOS) ====================
function setContentMargin() {
    const topChrome = document.getElementById('top-chrome');
    const appContent = document.getElementById('app-content');
    if (topChrome && appContent) {
        const height = topChrome.offsetHeight;
        appContent.style.marginTop = (height + 4) + 'px';
    }
}

function initContentMargin() {
    setContentMargin();
    let count = 0;
    const interval = setInterval(() => {
        setContentMargin();
        count++;
        if (count >= 8) clearInterval(interval);
    }, 250);
}

// ==================== SERVICE WORKER ====================
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            document.getElementById('update-banner').style.display = 'block';
                        }
                    });
                }
            });
        }).catch(err => console.log('SW registration failed:', err));
    }
}

function applyUpdate() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
}

// ==================== TAB NAVIGATION ====================
function switchTab(btn) {
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    
    const tabId = btn.getAttribute('data-tab');
    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function gotoStep(tabId) {
    const btn = document.querySelector(`.step[data-tab="${tabId}"]`);
    if (btn) switchTab(btn);
}

function switchTabByName(tabName) {
    const btn = document.querySelector(`.step[data-tab="tab-${tabName}"]`);
    if (btn) switchTab(btn);
}

// ==================== FORTNIGHT LOGIC ====================
function onFortnightStartChange(input) {
    let startDate = parseLocalDate(input.value);
    if (!startDate) return;

    const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    
    if (dayOfWeek !== 1) {
        if (dayOfWeek === 0) {
            startDate.setDate(startDate.getDate() - 6); // Sunday → previous Monday
        } else {
            startDate.setDate(startDate.getDate() - (dayOfWeek - 1));
        }
        input.value = toISO(startDate);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13);
    
    state.employee.fortnightFrom = toISO(startDate);
    state.employee.fortnightTo = toISO(endDate);
    
    document.getElementById('fortnight-to-display').value = fmtDate(toISO(endDate));
    
    buildDailyTable();
}

function getNextFortnightStart(lastEndISO) {
    if (!lastEndISO) return null;
    const endDate = parseLocalDate(lastEndISO);
    const nextMonday = new Date(endDate);
    nextMonday.setDate(nextMonday.getDate() + 1); // Monday after Sunday
    return toISO(nextMonday);
}

// ==================== DAILY TABLE ====================
function buildDailyTable() {
    const container = document.getElementById('daily-rows-container');
    container.innerHTML = '';
    
    if (!state.employee.fortnightFrom) return;
    
    const start = parseLocalDate(state.employee.fortnightFrom);
    const end = parseLocalDate(state.employee.fortnightTo);
    
    let current = new Date(start);
    
    while (current <= end) {
        const iso = toISO(current);
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;
        
        const row = document.createElement('div');
        row.className = `day-row ${isWeekend ? 'weekend' : ''}`;
        row.id = `row-${iso}`;
        
        const dayName = current.toLocaleDateString('en-AU', { weekday: 'short' });
        const dayNum = current.getDate();
        const month = current.toLocaleDateString('en-AU', { month: 'short' });
        
        row.innerHTML = `
            <div class="day-row-top">
                <div class="day-name">${dayName}</div>
                <div class="day-date">${dayNum} ${month}</div>
                ${isWeekend ? '<div class="day-weekend-tag">Weekend</div>' : ''}
            </div>
            <div class="day-row-inputs">
                <select class="day-select" id="type-${iso}" onchange="onTypeChange('${iso}', this)" data-type="work">
                    <option value="work">Work</option>
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="ph">Public Holiday</option>
                    <option value="rdo">RDO</option>
                    <option value="other">Other</option>
                </select>
                <input type="number" class="day-hours" id="hours-${iso}" step="0.25" min="0" oninput="onHoursChange('${iso}')" placeholder="0">
                <input type="text" class="day-notes" id="notes-${iso}" placeholder="Job ref / notes">
            </div>
        `;
        
        container.appendChild(row);
        
        // Restore saved values
        const saved = state.dailyHours.find(h => h.date === iso);
        if (saved) {
            const typeSel = document.getElementById(`type-${iso}`);
            const hoursIn = document.getElementById(`hours-${iso}`);
            const notesIn = document.getElementById(`notes-${iso}`);
            
            if (typeSel) typeSel.value = saved.type || 'work';
            if (typeSel) typeSel.dataset.type = saved.type || 'work';
            if (hoursIn) hoursIn.value = saved.hours || '';
            if (notesIn) notesIn.value = saved.jobNote || '';
            
            if (saved.hours) row.classList.add('has-hours');
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    document.getElementById('daily-table-card').style.display = 'block';
    updateHoursSummary();
}

function onTypeChange(iso, sel) {
    sel.dataset.type = sel.value;
    
    const hoursInput = document.getElementById(`hours-${iso}`);
    if (!hoursInput.value) {
        if (['annual', 'sick', 'ph'].includes(sel.value)) {
            hoursInput.value = '7.6';
        } else if (sel.value === 'rdo') {
            hoursInput.value = '';
        }
    }
    updateHoursSummary();
}

function onHoursChange(iso) {
    const row = document.getElementById(`row-${iso}`);
    const hours = document.getElementById(`hours-${iso}`).value;
    if (row) {
        if (hours && parseFloat(hours) > 0) {
            row.classList.add('has-hours');
        } else {
            row.classList.remove('has-hours');
        }
    }
    updateHoursSummary();
}

function updateHoursSummary() {
    const summary = document.getElementById('hours-summary');
    let totals = { work: 0, annual: 0, sick: 0, ph: 0, rdo: 0, other: 0, total: 0 };
    
    document.querySelectorAll('.day-row').forEach(row => {
        const iso = row.id.replace('row-', '');
        const typeSel = document.getElementById(`type-${iso}`);
        const hoursIn = document.getElementById(`hours-${iso}`);
        
        if (typeSel && hoursIn) {
            const type = typeSel.value;
            const hours = parseFloat(hoursIn.value) || 0;
            if (totals[type] !== undefined) totals[type] += hours;
            totals.total += hours;
        }
    });
    
    let html = `<div class="hrs-item"><div class="hrs-label">TOTAL HOURS</div><div class="hrs-val c-amber">${totals.total.toFixed(1)}</div></div>`;
    
    Object.keys(totals).forEach(key => {
        if (key !== 'total' && totals[key] > 0) {
            const color = key === 'work' ? 'c-green' : key === 'annual' || key === 'ph' ? 'c-amber' : 'c-red';
            html += `
                <div class="hrs-item">
                    <div class="hrs-label">${typeLabel(key).toUpperCase()}</div>
                    <div class="hrs-val ${color}">${totals[key].toFixed(1)}</div>
                </div>`;
        }
    });
    
    summary.innerHTML = html;
}

// ==================== QUICK FILL ====================
function copyToAllWeekdays() {
    const hoursVal = parseFloat(document.getElementById('copy-hours-val').value);
    const catVal = document.getElementById('copy-cat-val').value;
    
    if (!hoursVal) return;
    
    document.querySelectorAll('.day-row:not(.weekend)').forEach(row => {
        const iso = row.id.replace('row-', '');
        const hoursIn = document.getElementById(`hours-${iso}`);
        const typeSel = document.getElementById(`type-${iso}`);
        
        if (hoursIn) hoursIn.value = hoursVal;
        if (typeSel) {
            typeSel.value = catVal;
            typeSel.dataset.type = catVal;
        }
        row.classList.add('has-hours');
    });
    
    updateHoursSummary();
    showToast('Hours applied to weekdays');
}

function copyJobToAll() {
    const jobVal = document.getElementById('copy-job-val').value.trim();
    if (!jobVal) return;
    
    document.querySelectorAll('.day-notes').forEach(input => {
        input.value = jobVal;
    });
    
    showToast('Job reference applied');
}

// ==================== EXPENSES ====================
async function compressImage(file, maxWidth = 1200, quality = 0.75) {
    return new Promise((resolve) => {
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
                data: e.target.result,
                type: file.type,
                originalSize: file.size,
                compressedSize: file.size
            });
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            resolve({
                data: dataUrl,
                type: 'image/jpeg',
                originalSize: file.size,
                compressedSize: Math.round((dataUrl.length * 3) / 4)
            });
        };
        img.src = URL.createObjectURL(file);
    });
}

function onReceiptSelected(input) {
    if (!input.files[0]) return;
    
    const file = input.files[0];
    const label = document.getElementById('receipt-label');
    
    compressImage(file).then(result => {
        label.classList.add('has-file');
        document.getElementById('receipt-upload-text').textContent = file.name;
        document.getElementById('receipt-size-hint').textContent = 
            `Compressed: ${fmtBytes(result.compressedSize)}`;
        
        // Store for later use in addExpense
        input.dataset.compressed = JSON.stringify(result);
    });
}

function addExpense() {
    const type = document.getElementById('exp-type').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value;
    const desc = document.getElementById('exp-desc').value.trim();
    const fileInput = document.getElementById('exp-receipt');
    
    if (!type || !amount || !date) {
        showToast('Please fill type, amount and date', 'error');
        return;
    }
    
    let receiptData = null;
    let receiptName = '';
    let receiptType = '';
    
    if (fileInput.files[0]) {
        try {
            const compressed = JSON.parse(fileInput.dataset.compressed || '{}');
            receiptData = compressed.data;
            receiptName = fileInput.files[0].name;
            receiptType = compressed.type;
        } catch(e) {}
    }
    
    state.expenses.push({
        id: Date.now(),
        type,
        amount,
        date,
        desc,
        receiptName,
        receiptData,
        receiptType
    });
    
    renderExpenses();
    clearExpenseForm();
    showToast('Expense added');
}

function clearExpenseForm() {
    document.getElementById('exp-type').value = '';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-date').value = toISO(new Date());
    document.getElementById('exp-desc').value = '';
    const fileInput = document.getElementById('exp-receipt');
    fileInput.value = '';
    document.getElementById('receipt-label').classList.remove('has-file');
    document.getElementById('receipt-upload-text').textContent = 'Attach Receipt';
    document.getElementById('receipt-size-hint').textContent = '';
}

function renderExpenses() {
    const container = document.getElementById('expense-list');
    if (state.expenses.length === 0) {
        container.innerHTML = `<div class="empty-state">No expenses added yet</div>`;
        return;
    }
    
    let html = '';
    state.expenses.forEach((exp, index) => {
        html += `
            <div class="item-card">
                <div class="item-main">
                    <div class="item-type">${exp.type.toUpperCase()}</div>
                    <div class="item-meta">${fmtDate(exp.date)} • ${escHtml(exp.desc)}</div>
                    ${exp.receiptName ? `<div class="item-receipt">📎 Receipt attached</div>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="item-amount">$${exp.amount.toFixed(2)}</div>
                    <button onclick="removeExpense(${index})" class="item-remove">×</button>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function removeExpense(index) {
    state.expenses.splice(index, 1);
    renderExpenses();
}

// ==================== MILEAGE ====================
function calcMileageTotal() {
    const km = parseFloat(document.getElementById('mil-km').value) || 0;
    const rate = parseFloat(document.getElementById('mil-rate').value) || 0.88;
    const total = (km * rate).toFixed(2);
    document.getElementById('mil-total').textContent = `Total: $${total}`;
}

function addMileage() {
    const date = document.getElementById('mil-date').value;
    const from = document.getElementById('mil-from').value.trim();
    const to = document.getElementById('mil-to').value.trim();
    const km = parseFloat(document.getElementById('mil-km').value);
    const rate = parseFloat(document.getElementById('mil-rate').value) || 0.88;
    
    if (!date || !from || !to || !km) {
        showToast('Please fill all mileage fields', 'error');
        return;
    }
    
    state.mileage.push({
        id: Date.now(),
        date,
        from,
        to,
        km,
        rate,
        total: km * rate
    });
    
    renderMileage();
    clearMileageForm();
    showToast('Mileage added');
}

function clearMileageForm() {
    document.getElementById('mil-date').value = toISO(new Date());
    document.getElementById('mil-from').value = '';
    document.getElementById('mil-to').value = '';
    document.getElementById('mil-km').value = '';
    document.getElementById('mil-total').textContent = 'Total: $0.00';
}

function renderMileage() {
    const container = document.getElementById('mileage-list');
    if (state.mileage.length === 0) {
        container.innerHTML = `<div class="empty-state">No mileage added yet</div>`;
        return;
    }
    
    let html = '';
    state.mileage.forEach((mil, i) => {
        html += `
            <div class="item-card">
                <div class="item-main">
                    <div class="item-type">${fmtDate(mil.date)}</div>
                    <div class="item-meta">${escHtml(mil.from)} → ${escHtml(mil.to)} • ${mil.km}km</div>
                </div>
                <div style="text-align:right">
                    <div class="item-amount">$${mil.total.toFixed(2)}</div>
                    <button onclick="removeMileage(${i})" class="item-remove">×</button>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function removeMileage(index) {
    state.mileage.splice(index, 1);
    renderMileage();
}

// ==================== ALLOWANCES ====================
function addAllowance() {
    const type = document.getElementById('all-type').value;
    const amount = parseFloat(document.getElementById('all-amount').value);
    const notes = document.getElementById('all-notes').value.trim();
    
    if (!type || !amount) {
        showToast('Type and amount required', 'error');
        return;
    }
    
    state.allowances.push({
        id: Date.now(),
        type,
        amount,
        notes
    });
    
    renderAllowances();
    clearAllowanceForm();
    showToast('Allowance added');
}

function clearAllowanceForm() {
    document.getElementById('all-type').value = '';
    document.getElementById('all-amount').value = '';
    document.getElementById('all-notes').value = '';
}

function renderAllowances() {
    const container = document.getElementById('allowance-list');
    if (state.allowances.length === 0) {
        container.innerHTML = `<div class="empty-state">No allowances added yet</div>`;
        return;
    }
    
    let html = '';
    state.allowances.forEach((all, i) => {
        html += `
            <div class="item-card">
                <div class="item-main">
                    <div class="item-type">${all.type}</div>
                    <div class="item-meta">${escHtml(all.notes || '')}</div>
                </div>
                <div style="text-align:right">
                    <div class="item-amount">$${all.amount.toFixed(2)}</div>
                    <button onclick="removeAllowance(${i})" class="item-remove">×</button>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function removeAllowance(index) {
    state.allowances.splice(index, 1);
    renderAllowances();
}

// ==================== COLLECT & SAVE ====================
function collectFormData() {
    state.employee.name = document.getElementById('employee-name').value.trim();
    
    state.dailyHours = [];
    document.querySelectorAll('.day-row').forEach(row => {
        const iso = row.id.replace('row-', '');
        const typeSel = document.getElementById(`type-${iso}`);
        const hoursIn = document.getElementById(`hours-${iso}`);
        const notesIn = document.getElementById(`notes-${iso}`);
        
        if (typeSel && hoursIn) {
            const hours = parseFloat(hoursIn.value) || 0;
            if (hours > 0 || notesIn.value.trim()) {
                state.dailyHours.push({
                    date: iso,
                    day: row.querySelector('.day-name').textContent,
                    hours: hours,
                    type: typeSel.value,
                    jobNote: notesIn ? notesIn.value.trim() : ''
                });
            }
        }
    });
}

async function saveProgress() {
    collectFormData();
    await dbPut('drafts', { id: 'current', state: JSON.parse(JSON.stringify(state)), savedAt: new Date().toISOString() });
    showToast('Progress saved');
}

async function loadDraft() {
    try {
        const draft = await dbGet('drafts', 'current');
        if (!draft) return;
        
        state = draft.state;
        
        // Restore basic fields
        document.getElementById('employee-name').value = state.employee.name || '';
        if (state.employee.fortnightFrom) {
            document.getElementById('fortnight-start').value = state.employee.fortnightFrom;
            document.getElementById('fortnight-to-display').value = fmtDate(state.employee.fortnightTo);
        }
        
        buildDailyTable();
        renderExpenses();
        renderMileage();
        renderAllowances();
        
        updateHeaderStatus();
    } catch(e) {
        console.error('Failed to load draft', e);
    }
}

function loadDraftAsync() {
    setTimeout(async () => {
        await loadDraft();
        setContentMargin();
    }, 100);
}

// ==================== REVIEW & SUBMIT ====================
function buildReview() {
    collectFormData();
    
    let html = `<h2>Review Submission</h2>`;
    
    // Employee Info
    html += `
        <div class="rv-section">
            <div class="rv-title">Employee</div>
            <div class="rv-row"><span class="rv-key">Name</span><span class="rv-val">${escHtml(state.employee.name || 'Not set')}</span></div>
            <div class="rv-row"><span class="rv-key">Fortnight</span><span class="rv-val">${fmtDate(state.employee.fortnightFrom)} — ${fmtDate(state.employee.fortnightTo)}</span></div>
        </div>`;
    
    // Hours, Expenses, Mileage, Allowances would go here (simplified for space)
    // In full version you'd expand all sections similarly
    
    document.getElementById('review-content').innerHTML = html;
    
    // Show appropriate submission method
    const hasEJS = settings.ejsPublicKey && settings.ejsServiceId && settings.ejsTemplateId;
    document.getElementById('emailjs-method').style.display = hasEJS ? 'block' : 'none';
    document.getElementById('mailto-method').style.display = hasEJS ? 'none' : 'block';
    
    document.getElementById('email-to').value = settings.emailTo || '';
    document.getElementById('email-cc').value = settings.emailCc || '';
}

async function submitForm() {
    if (!validate()) return;
    
    showLoading('Generating PDF...');
    
    try {
        const { doc, blob, filename } = await generatePDF();
        
        await saveLastSubmission(blob, filename);
        
        const hasEJS = settings.ejsPublicKey && settings.ejsServiceId && settings.ejsTemplateId;
        
        if (hasEJS) {
            await sendViaEmailJS(blob, filename);
            await sharePDF(doc, blob, filename);
        } else {
            await sharePDF(doc, blob, filename);
            setTimeout(() => openEmailClient(filename), 800);
        }
        
        onSubmitSuccess(filename, hasEJS);
        
    } catch (err) {
        console.error(err);
        showToast('Submission failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function validate() {
    if (!state.employee.name) {
        showToast('Please enter your name', 'error');
        gotoStep('tab-timesheet');
        return false;
    }
    if (!state.employee.fortnightFrom) {
        showToast('Please select fortnight start date', 'error');
        gotoStep('tab-timesheet');
        return false;
    }
    return true;
}

// ==================== PDF GENERATION (Stub - Full implementation is long) ====================
async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Basic PDF generation (you can expand this significantly)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("VB BUILT — FIELDSHEET", 105, 20, { align: "center" });
    
    const filename = `VBBuilt_FieldSheet_${state.employee.name.replace(/\s+/g,'')}_${state.employee.fortnightFrom}.pdf`;
    
    const blob = doc.output('blob');
    return { doc, blob, filename };
}

async function saveLastSubmission(blob, filename) {
    const base64 = await blobToBase64(blob);
    await dbPut('submissions', {
        id: 'last',
        state: JSON.parse(JSON.stringify(state)),
        pdfBase64: base64,
        pdfFilename: filename,
        submittedAt: new Date().toISOString()
    });
}

async function sharePDF(doc, blob, filename) {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
        try {
            await navigator.share({
                files: [new File([blob], filename, { type: 'application/pdf' })],
                title: 'Timesheet Submission'
            });
            return;
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.log('Share failed, falling back');
            }
        }
    }
    
    // Fallback: jsPDF save
    doc.save(filename);
}

function openEmailClient(filename) {
    const subject = encodeURIComponent(`Timesheet - ${state.employee.name} - ${fmtDate(state.employee.fortnightFrom)}`);
    const body = encodeURIComponent(`Please find attached my timesheet for the fortnight ending ${fmtDate(state.employee.fortnightTo)}.`);
    window.location.href = `mailto:${settings.emailTo || ''}?cc=${settings.emailCc || ''}&subject=${subject}&body=${body}`;
}

function onSubmitSuccess(filename, autoSent) {
    document.getElementById('success-msg').textContent = autoSent 
        ? 'Submitted via EmailJS successfully!' 
        : 'PDF generated successfully!';
    
    document.getElementById('pdf-filename-display').textContent = filename;
    
    const nextStart = getNextFortnightStart(state.employee.fortnightTo);
    if (nextStart) {
        const nextEnd = parseLocalDate(nextStart);
        nextEnd.setDate(nextEnd.getDate() + 13);
        document.getElementById('success-next-info').innerHTML = 
            `Next fortnight starts: <strong>${fmtDate(nextStart)}</strong>`;
    }
    
    document.getElementById('success-overlay').style.display = 'flex';
    
    cleanupDraft();
}

// ==================== SETTINGS ====================
function loadSettings() {
    const saved = localStorage.getItem('fs_settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
}

function saveSettings(silent = false) {
    settings.name = document.getElementById('settings-name').value.trim();
    settings.emailTo = document.getElementById('settings-email-to').value.trim();
    settings.emailCc = document.getElementById('settings-email-cc').value.trim();
    settings.ejsPublicKey = document.getElementById('settings-ejs-key').value.trim();
    settings.ejsServiceId = document.getElementById('settings-ejs-service').value.trim();
    settings.ejsTemplateId = document.getElementById('settings-ejs-template').value.trim();
    settings.reminders = document.getElementById('settings-reminders').checked;
    
    localStorage.setItem('fs_settings', JSON.stringify(settings));
    
    if (!silent) {
        closeSettings();
        showToast('Settings saved');
    }
    
    updateHeaderStatus();
}

function openSettings() {
    document.getElementById('settings-name').value = settings.name || '';
    document.getElementById('settings-email-to').value = settings.emailTo || '';
    document.getElementById('settings-email-cc').value = settings.emailCc || '';
    document.getElementById('settings-ejs-key').value = settings.ejsPublicKey || '';
    document.getElementById('settings-ejs-service').value = settings.ejsServiceId || '';
    document.getElementById('settings-ejs-template').value = settings.ejsTemplateId || '';
    document.getElementById('settings-reminders').checked = settings.reminders;
    
    document.getElementById('settings-overlay').style.display = 'flex';
    setTimeout(() => {
        document.getElementById('settings-drawer').style.transform = 'translateX(0)';
    }, 10);
}

function closeSettings() {
    const drawer = document.getElementById('settings-drawer');
    drawer.style.transform = 'translateX(100%)';
    setTimeout(() => {
        document.getElementById('settings-overlay').style.display = 'none';
    }, 350);
}

function updateHeaderStatus() {
    const greeting = document.getElementById('greeting-text');
    if (settings.name) {
        const firstName = settings.name.split(' ')[0];
        greeting.textContent = `Hello, ${firstName}`;
    } else {
        greeting.textContent = 'FieldSheet';
    }
    
    const strip = document.getElementById('fortnight-strip');
    if (state.employee.fortnightFrom) {
        strip.style.display = 'block';
        document.getElementById('fortnight-badge').textContent = 
            `${fmtDate(state.employee.fortnightFrom)} — ${fmtDate(state.employee.fortnightTo)}`;
    }
}

// ==================== INIT ====================
async function init() {
    await openDB();
    loadSettings();
    
    // Set default dates
    const today = toISO(new Date());
    document.getElementById('exp-date').value = today;
    document.getElementById('mil-date').value = today;
    
    renderExpenses();
    renderMileage();
    renderAllowances();
    
    initContentMargin();
    window.addEventListener('resize', setContentMargin);
    
    registerSW();
    checkReminder();
    updateHeaderStatus();
    
    loadDraftAsync();
    
    // First time welcome
    if (!settings.name) {
        setTimeout(() => {
            showToast('Welcome to VB Built FieldSheet 👷‍♂️');
        }, 800);
    }
    
    // Make global functions available
    window.switchTab = switchTab;
    window.gotoStep = gotoStep;
    window.switchTabByName = switchTabByName;
    window.onFortnightStartChange = onFortnightStartChange;
    window.copyToAllWeekdays = copyToAllWeekdays;
    window.copyJobToAll = copyJobToAll;
    window.onTypeChange = onTypeChange;
    window.onHoursChange = onHoursChange;
    window.onReceiptSelected = onReceiptSelected;
    window.addExpense = addExpense;
    window.removeExpense = removeExpense;
    window.addMileage = addMileage;
    window.removeMileage = removeMileage;
    window.calcMileageTotal = calcMileageTotal;
    window.addAllowance = addAllowance;
    window.removeAllowance = removeAllowance;
    window.saveProgress = saveProgress;
    window.loadLastSubmission = loadLastSubmission; // stub
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
    window.saveSettings = saveSettings;
    window.submitForm = submitForm;
    window.buildReview = buildReview;
    window.startNewSubmission = startNewSubmission;
    window.dismissSuccess = dismissSuccess;
    window.applyUpdate = applyUpdate;
}

function loadLastSubmission() { /* TODO: implement full restore */ showToast('Last submission loaded (demo)'); }
function startNewSubmission() { showToast('New fortnight started'); dismissSuccess(); }
function dismissSuccess() {
    document.getElementById('success-overlay').style.display = 'none';
}
function checkReminder() { /* TODO */ }
function cleanupDraft() { dbDelete('drafts', 'current'); }
async function sendViaEmailJS() { /* TODO - EmailJS integration */ }

// Start the app
document.addEventListener('DOMContentLoaded', init);
</script>

<script>
// ==================== APP.JS - INLINE VERSION (Fixed) ====================
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
        request.onupgradeneeded = e => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('submissions')) db.createObjectStore('submissions', { keyPath: 'id' });
        };
        request.onsuccess = e => { db = e.target.result; resolve(db); };
        request.onerror = e => reject(e.target.error);
    });
}

function dbPut(store, value) {
    return new Promise((resolve, reject) => {
        if (!db) return reject();
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value).onsuccess = () => resolve();
    });
}

// ==================== UTILITIES ====================
function toISO(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.getFullYear() + '-' + 
           String(d.getMonth()+1).padStart(2,'0') + '-' + 
           String(d.getDate()).padStart(2,'0');
}

function fmtDate(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.style.display = 'flex';
    setTimeout(() => toast.style.display = 'none', 3000);
}

// ==================== CONTENT MARGIN ====================
function setContentMargin() {
    const header = document.getElementById('top-chrome');
    const content = document.getElementById('app-content');
    if (header && content) {
        content.style.marginTop = (header.offsetHeight + 8) + 'px';
    }
}

// ==================== TAB NAVIGATION (Fixed) ====================
function switchTab(btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    const tabId = btn.getAttribute('data-tab');
    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add('active');
    btn.classList.add('active');
    
    window.scrollTo(0, 0);
}

function switchTabByName(name) {
    const btn = document.querySelector(`.step[data-tab="tab-${name}"]`);
    if (btn) switchTab(btn);
}

function gotoStep(tabId) {
    const btn = document.querySelector(`.step[data-tab="${tabId}"]`);
    if (btn) switchTab(btn);
}

// ==================== SETTINGS ====================
function openSettings() {
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
    }, 300);
}

function saveSettings() {
    settings.name = document.getElementById('settings-name').value.trim();
    settings.emailTo = document.getElementById('settings-email-to').value.trim();
    settings.emailCc = document.getElementById('settings-email-cc').value.trim();
    
    localStorage.setItem('fs_settings', JSON.stringify(settings));
    closeSettings();
    showToast('Settings saved');
    updateHeaderStatus();
}

// ==================== BASIC FUNCTIONS ====================
function saveProgress() {
    showToast('Progress saved');
}

function buildReview() {
    gotoStep('tab-review');
    showToast('Review page ready (demo)');
}

function submitForm() {
    showToast('Submission started (demo)');
}

function startNewSubmission() {
    dismissSuccess();
    showToast('New fortnight started');
}

function dismissSuccess() {
    document.getElementById('success-overlay').style.display = 'none';
}

function applyUpdate() {
    window.location.reload();
}

function loadLastSubmission() {
    showToast('Last submission would load here');
}

// ==================== FORTNIGHT & DAILY TABLE (Minimal) ====================
function onFortnightStartChange(input) {
    if (!input.value) return;
    document.getElementById('fortnight-to-display').value = 'Fortnight End';
    document.getElementById('daily-table-card').style.display = 'block';
    showToast('Daily table loaded');
}

// Placeholder for other functions called from HTML
window.switchTab = switchTab;
window.switchTabByName = switchTabByName;
window.gotoStep = gotoStep;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.saveProgress = saveProgress;
window.buildReview = buildReview;
window.submitForm = submitForm;
window.startNewSubmission = startNewSubmission;
window.dismissSuccess = dismissSuccess;
window.applyUpdate = applyUpdate;
window.onFortnightStartChange = onFortnightStartChange;
window.loadLastSubmission = loadLastSubmission;

// ==================== INIT ====================
function init() {
    openDB().catch(() => {});
    
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    const expDate = document.getElementById('exp-date');
    if (expDate) expDate.value = today;

    initContentMargin();
    window.addEventListener('resize', setContentMargin);
    
    // Make sure first tab is active
    const firstTab = document.querySelector('.tab-panel');
    if (firstTab) firstTab.classList.add('active');
    
    const firstStep = document.querySelector('.step');
    if (firstStep) firstStep.classList.add('active');

    updateHeaderStatus();
    showToast('VB Built FieldSheet ready 👷‍♂️');
}

function updateHeaderStatus() {
    const greeting = document.getElementById('greeting-text');
    if (greeting) greeting.textContent = 'Good afternoon, Field Team';
}

function initContentMargin() {
    setTimeout(setContentMargin, 100);
    setTimeout(setContentMargin, 500);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
</script>
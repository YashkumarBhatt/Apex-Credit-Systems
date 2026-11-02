/* ═══════════════════════════════════════════════════════════════
   APEX CREDIT SYSTEMS — Frontend Application Logic v2.1
   Executive Midnight Navy & Royal Blue | Complete Theme Reactivity
═══════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = window.location.origin;

/* ─────────────────────────────────────
   STATE
───────────────────────────────────── */
let authToken          = localStorage.getItem('apex_token');
let currentUsername    = localStorage.getItem('apex_user');
let sessionID          = localStorage.getItem('apex_session');
let isMaster           = localStorage.getItem('apex_is_master') === 'true';
let currentAuthMode    = 'login';
let portfolioDataCache = null;
let activeTab          = 'eligibility';
let lastPredictionData = null;

/* ─────────────────────────────────────
   THEME MANAGEMENT (Entire Page)
───────────────────────────────────── */
function initTheme() {
    const saved = localStorage.getItem('apex_theme') || 'dark';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('apex_theme', theme);

    // Update meta theme-color for browser chromes
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#080d1a' : '#ffffff');

    // Toggle icons
    const sun  = document.getElementById('icon-sun');
    const moon = document.getElementById('icon-moon');
    if (sun && moon) {
        if (theme === 'dark') {
            sun.style.display  = 'block';
            moon.style.display = 'none';
        } else {
            sun.style.display  = 'none';
            moon.style.display = 'block';
        }
    }

    // Refresh charts with updated theme fonts, gridlines, and backgrounds
    if (portfolioDataCache) {
        renderPortfolioCharts();
    }
    calculateAmortization();

    // Re-render prediction output if present
    if (lastPredictionData) {
        renderPredictionResult(lastPredictionData);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ─────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    injectMobileNav();

    if (authToken) {
        showDashboard();
        fetchPortfolioData();
    } else {
        showAuth();
    }
});

/* ─────────────────────────────────────
   MOBILE BOTTOM NAVIGATION
───────────────────────────────────── */
function injectMobileNav() {
    if (document.getElementById('mobile-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'mobile-bottom-nav';
    nav.id = 'mobile-nav';
    nav.innerHTML = `
        <button class="m-nav-btn active" data-tab="eligibility" onclick="switchMainTab('eligibility', this)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Eligibility
        </button>
        <button class="m-nav-btn" data-tab="portfolio" onclick="switchMainTab('portfolio', this)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Portfolio
        </button>
        <button class="m-nav-btn" data-tab="amortization" onclick="switchMainTab('amortization', this)">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Amortization
        </button>
    `;
    document.getElementById('app-root').appendChild(nav);
}

/* ─────────────────────────────────────
   AUTHENTICATION UI
───────────────────────────────────── */
function switchAuthTab(mode) {
    currentAuthMode = mode;

    document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
        if ((mode === 'login' && btn.textContent.trim() === 'Login') ||
            (mode === 'register' && btn.textContent.trim() === 'Register')) {
            btn.classList.add('active');
        }
    });

    const emailGroup  = document.getElementById('email-group');
    const checklist   = document.getElementById('password-checklist');
    const submitBtn   = document.getElementById('auth-btn-label');
    const formTitle   = document.getElementById('auth-form-title');
    const formSub     = document.getElementById('auth-form-sub');
    const errorDiv    = document.getElementById('auth-error');
    if (errorDiv) errorDiv.textContent = '';

    if (mode === 'register') {
        emailGroup?.classList.remove('hidden');
        checklist?.classList.remove('hidden');
        if (submitBtn)  submitBtn.textContent = 'Create Credentials';
        if (formTitle)  formTitle.textContent = 'Create an Account';
        if (formSub)    formSub.textContent   = 'Register to access the underwriting engine.';
    } else {
        emailGroup?.classList.add('hidden');
        checklist?.classList.add('hidden');
        if (submitBtn)  submitBtn.textContent = 'Access System';
        if (formTitle)  formTitle.textContent = 'Analyst Sign In';
        if (formSub)    formSub.textContent   = 'Enter your credentials to access the system.';
    }
}

function validatePassword() {
    if (currentAuthMode !== 'register') return;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;

    const set = (id, valid, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = 'pw-req ' + (valid ? 'valid' : 'invalid');
        el.textContent = (valid ? '✓ ' : '✗ ') + text;
    };
    set('req-length',  password.length >= 8,                         'At least 8 characters');
    set('req-upper',   /[A-Z]/.test(password),                       'At least 1 uppercase letter');
    set('req-lower',   /[a-z]/.test(password),                       'At least 1 lowercase letter');
    set('req-number',  /[0-9]/.test(password),                       'At least 1 number');
    set('req-special', /[^A-Za-z0-9]/.test(password),               'At least 1 special character');
    set('req-diff',    password !== username && password.length > 0, 'Cannot match username');
}

function showAuth() {
    document.getElementById('dashboard-view').classList.add('hidden');
    const authView = document.getElementById('auth-view');
    authView.classList.remove('hidden');
    authView.style.display = 'flex';
    authView.classList.add('active');
    document.getElementById('mobile-nav')?.classList.add('hidden');
}

function showDashboard() {
    const authView = document.getElementById('auth-view');
    authView.classList.remove('active');
    authView.style.display = 'none';

    const dash = document.getElementById('dashboard-view');
    dash.classList.remove('hidden');
    document.getElementById('mobile-nav')?.classList.remove('hidden');

    document.getElementById('user-display').textContent = currentUsername || 'Analyst';

    if (isMaster) {
        document.getElementById('admin-panel')?.classList.remove('hidden');
        fetchAdminUsers();
    } else {
        document.getElementById('admin-panel')?.classList.add('hidden');
    }

    switchMainTab('eligibility');
    calculateAmortization();
}

/* ─────────────────────────────────────
   MAIN TAB NAVIGATION
───────────────────────────────────── */
function switchMainTab(tabName, clickedEl) {
    activeTab = tabName;

    // Header nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedEl && clickedEl.classList.contains('nav-btn')) {
        clickedEl.classList.add('active');
    } else {
        const navBtns = document.querySelectorAll('.nav-btn');
        const map = { eligibility: 0, portfolio: 1, amortization: 2 };
        if (navBtns[map[tabName]]) navBtns[map[tabName]].classList.add('active');
    }

    // Mobile nav buttons
    document.querySelectorAll('.m-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.classList.add('hidden');
    });
    const active = document.getElementById(`tab-${tabName}`);
    if (active) {
        active.classList.remove('hidden');
        active.classList.add('active');
    }

    // Immediate resizing for Plotly charts to eliminate overflow
    if (tabName === 'portfolio') {
        if (!portfolioDataCache) {
            fetchPortfolioData();
        } else {
            requestAnimationFrame(() => {
                renderPortfolioCharts();
                setTimeout(() => {
                    ['chart-credit', 'chart-dti', 'chart-demo'].forEach(id => {
                        try { Plotly.Plots.resize(id); } catch(e) {}
                    });
                }, 80);
            });
        }
    } else if (tabName === 'amortization') {
        requestAnimationFrame(() => {
            calculateAmortization();
            setTimeout(() => {
                ['chart-amort-line', 'chart-amort-pie'].forEach(id => {
                    try { Plotly.Plots.resize(id); } catch(e) {}
                });
            }, 80);
        });
    }
}

/* ─────────────────────────────────────
   LOGOUT
───────────────────────────────────── */
async function logout() {
    if (authToken && sessionID) {
        try {
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ session_id: parseInt(sessionID) })
            });
        } catch(e) {}
    }
    ['apex_token','apex_user','apex_session','apex_is_master'].forEach(k => localStorage.removeItem(k));
    authToken = null; currentUsername = null; sessionID = null; isMaster = false;
    portfolioDataCache = null;
    lastPredictionData = null;

    const rd = document.getElementById('result-display');
    if (rd) {
        rd.innerHTML = `<div class="placeholder-icon">⚡</div><p>Submit an application to view the algorithmic decision.</p>`;
        rd.className = 'result-placeholder';
    }

    showAuth();
}

/* ─────────────────────────────────────
   AUTHENTICATION API
───────────────────────────────────── */
async function handleAuth(e) {
    e.preventDefault();
    const username  = document.getElementById('username').value;
    const password  = document.getElementById('password').value;
    const errorDiv  = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');
    const btnLabel  = document.getElementById('auth-btn-label');

    errorDiv.textContent = '';
    const origText = btnLabel.textContent;
    btnLabel.textContent = 'Processing…';
    submitBtn.disabled = true;

    try {
        if (currentAuthMode === 'register') {
            const email   = document.getElementById('email').value;
            const isValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password)
                         && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) && password !== username;
            if (!isValid) throw new Error('Password does not meet all security requirements.');

            const res = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
            alert('Credentials created! You may now log in.');
            switchAuthTab('login');

        } else {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Authentication failed');

            const data = await res.json();
            authToken       = data.access_token;
            currentUsername = username;
            sessionID       = data.session_id;
            isMaster        = data.is_master;

            localStorage.setItem('apex_token',     authToken);
            localStorage.setItem('apex_user',      currentUsername);
            localStorage.setItem('apex_session',   sessionID);
            localStorage.setItem('apex_is_master', isMaster);

            showDashboard();
            fetchPortfolioData();
        }
    } catch (err) {
        errorDiv.textContent = err.message;
    } finally {
        btnLabel.textContent = origText;
        submitBtn.disabled = false;
    }
}

/* ─────────────────────────────────────
   PREDICTION API & RESULTS RENDERING
───────────────────────────────────── */
async function handlePredict(e) {
    e.preventDefault();
    if (!authToken) return;

    const submitBtn   = e.target.querySelector('button[type="submit"]');
    const origBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Evaluating Pipeline…`;
    submitBtn.disabled = true;

    const resultDiv = document.getElementById('result-display');
    resultDiv.innerHTML = `<div class="placeholder-icon" style="animation:none;opacity:0.6">⚙️</div><p style="color:var(--text-muted);font-size:0.85rem;">Querying ML model…</p>`;
    resultDiv.className = 'result-placeholder';

    const rawLoan     = parseFloat(document.getElementById('loan_amount').value) || 0;
    const literalLoan = rawLoan < 1000 ? rawLoan * 1000 : rawLoan;
    const scaledLoan  = rawLoan >= 1000 ? rawLoan / 1000 : rawLoan;
    const termYears   = parseFloat(document.getElementById('loan_term_years').value) || 30;
    const termMonths  = termYears > 40 ? Math.round(termYears) : Math.round(termYears * 12);

    const payload = {
        ApplicantIncome:  parseFloat(document.getElementById('app_income').value) || 0,
        CoapplicantIncome:parseFloat(document.getElementById('co_income').value)  || 0,
        LoanAmount:       scaledLoan,
        Loan_Amount_Term: termMonths,
        CreditHistory:    parseFloat(document.getElementById('credit_history').value),
        Education:        document.getElementById('education').value,
        EmploymentType:   document.getElementById('employment').value,
        MaritalStatus:    document.getElementById('marital').value,
        Dependents:       document.getElementById('dependents').value,
        PropertyArea:     document.getElementById('property').value
    };

    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(payload)
        });
        if (res.status === 401) { logout(); throw new Error('Security token expired.'); }
        if (!res.ok) throw new Error((await res.json()).detail || 'Prediction failed');

        const data = await res.json();
        data._literalLoan = literalLoan;
        data._termYears = termYears;
        lastPredictionData = data;

        // Auto-fill amortization simulator
        document.getElementById('sim_amount').value     = data.counter_offer_amount || literalLoan;
        document.getElementById('sim_term_years').value = termYears;
        setTenure(Math.round(termYears));
        calculateAmortization();

        renderPredictionResult(data);
        fetchPortfolioData();

    } catch (err) {
        resultDiv.className = 'result-placeholder';
        resultDiv.innerHTML = `<div class="placeholder-icon" style="color:var(--red);">⚠️</div><div style="color:var(--red);font-size:0.9rem;">${err.message}</div>`;
    } finally {
        submitBtn.innerHTML = origBtnText;
        submitBtn.disabled = false;
    }
}

function renderPredictionResult(data) {
    const resultDiv = document.getElementById('result-display');
    if (!resultDiv) return;

    const isApproved  = data.prediction === 1;
    const status      = data.status || (isApproved ? 'Approved' : 'Rejected');
    const track       = data.track  || '';
    const tier        = data.tier   || '';
    const notes       = data.actionable_notes || '';
    const conditions  = data.conditions || [];
    const counterAmt  = data.counter_offer_amount;
    const score       = data.confidence_percentage || 0;
    const literalLoan = data._literalLoan || 150000;

    let accent = 'var(--green)';
    if (status === 'Rejected')                    accent = 'var(--red)';
    else if (status === 'Counter-Offer Proposed')  accent = 'var(--amber)';
    else if (status === 'Conditional Approval')    accent = 'var(--accent-primary)';

    // Counter offer comparison
    let counterHTML = '';
    if (counterAmt) {
        counterHTML = `
        <div class="result-comparison">
            <div class="compare-box compare-requested">
                <div class="compare-label">Requested</div>
                <div class="compare-amount mono">₹${literalLoan.toLocaleString('en-IN')}</div>
                <div class="compare-note denied">✗ Exceeds risk limit</div>
            </div>
            <div class="compare-arrow">→</div>
            <div class="compare-box compare-offered" style="border-color:${accent};">
                <div class="compare-label" style="color:${accent};">Pre-Approved</div>
                <div class="compare-amount mono" style="color:${accent};">₹${counterAmt.toLocaleString('en-IN')}</div>
                <div class="compare-note approved">✓ Within capacity</div>
            </div>
        </div>`;
    }

    // Key factors
    const factors = data.key_factors || [];
    let factorsHTML = '';
    if (factors.length > 0) {
        factorsHTML = `
        <div class="result-section-divider"></div>
        <div class="result-factors-title">
            <span>⚖️</span>
            <span class="section-chip">Key Underwriting Decision Factors</span>
        </div>
        <div class="result-factors-list">
            ${factors.map(f => `
            <div class="factor-row ${f.type}">
                <span class="factor-label">${f.type === 'positive' ? '🟢' : '🔴'} ${f.factor}</span>
                <span class="factor-impact" style="color:${f.type === 'positive' ? 'var(--green)' : 'var(--red)'};">${f.impact}</span>
            </div>`).join('')}
        </div>`;
    }

    // Conditions
    let conditionsHTML = '';
    if (conditions.length > 0) {
        conditionsHTML = `
        <div class="result-section-divider"></div>
        <div class="result-factors-title">
            <span>📋</span>
            <span class="section-chip">Underwriting Conditions</span>
        </div>
        <ul class="conditions-list">
            ${conditions.map(c => `<li><span style="color:${accent};">■</span> ${c}</li>`).join('')}
        </ul>`;
    }

    const displayTier = tier.replace(' - ', ' · ').toUpperCase();

    resultDiv.className = 'result-output';
    resultDiv.style.cssText = `border-left: 3.5px solid ${accent}; animation: popIn 0.35s cubic-bezier(0.34,1.56,0.64,1);`;
    resultDiv.innerHTML = `
        <div class="result-track-badge">${track}</div>
        <div class="result-status" style="color:${accent};">${status}</div>
        <div class="result-tier" style="color:${accent};">${displayTier}</div>

        <div class="result-score-block">
            <div class="score-header">
                <span class="score-title">Financial Capacity Score</span>
                <span class="score-value mono" style="color:${accent};">${score.toFixed(1)}%</span>
            </div>
            <div class="score-bar-wrap">
                <div class="score-bar-fill" style="width:${Math.min(score,100)}%;background:${accent};"></div>
                <div class="score-threshold-line"></div>
            </div>
            <div class="score-notes">${notes}</div>
        </div>

        ${counterHTML}
        ${factorsHTML}
        ${conditionsHTML}
    `;
}

/* ─────────────────────────────────────
   EXPORT API
───────────────────────────────────── */
async function exportData(btnId, endpoint) {
    if (!authToken) return;
    const btn = document.getElementById(btnId);
    const orig = btn.innerText;
    btn.innerText = 'Exporting…';
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
        if (res.status === 404) throw new Error('No data found to export.');
        if (!res.ok) throw new Error('Export failed.');
        const text = await res.text();
        let filename = endpoint.split('/').pop() + '.csv';
        const disp = res.headers.get('Content-Disposition');
        if (disp && disp.includes('filename=')) filename = disp.split('filename=')[1];

        document.getElementById('csv-content').value = text;
        document.getElementById('csv-modal').classList.remove('hidden');

        const blob = new Blob([text], { type: 'text/csv' });
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.style.display = 'none'; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export error: ' + err.message);
    } finally {
        btn.innerText = orig;
    }
}

function copyCSVToClipboard() {
    const text = document.getElementById('csv-content').value;
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Failed to copy. Please select and copy manually.'));
    } else {
        alert('Clipboard API not supported. Please select and copy manually.');
    }
}

/* ─────────────────────────────────────
   PORTFOLIO DATA & CHARTS
───────────────────────────────────── */
async function fetchPortfolioData() {
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE}/portfolio-data`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.status === 401) { logout(); return; }
        portfolioDataCache = await res.json();
        updateKPIStrip(portfolioDataCache);
        if (activeTab === 'portfolio') renderPortfolioCharts();
    } catch(e) { console.error('Portfolio load failed', e); }
}

function updateKPIStrip(data) {
    if (!data || !Array.isArray(data) || data.length === 0) return;
    const total    = data.length;
    const approved = data.filter(d => Number(d.Loan_Status) === 1).length;
    const rate     = ((approved / total) * 100).toFixed(1);
    const avgInc   = data.reduce((s, d) => s + (d.ApplicantIncome || 0), 0) / total;
    const avgLoan  = data.reduce((s, d) => s + (d.LoanAmount || 0), 0) / total;

    setText('kpi-records',  total.toLocaleString());
    setText('kpi-approval', rate + '%');
    setText('kpi-income',   '₹' + avgInc.toLocaleString(undefined, { maximumFractionDigits: 0 }));
    setText('kpi-loan',     '₹' + avgLoan.toLocaleString(undefined, { maximumFractionDigits: 0 }));
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function getPlotlyTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor:  'rgba(0,0,0,0)',
        font: {
            family: 'Outfit, sans-serif',
            color: isDark ? '#94a3b8' : '#475569',
            size: 11
        },
        gridcolor: isDark ? 'rgba(99, 133, 194, 0.12)' : 'rgba(0,0,0,0.06)',
        hoverlabel: {
            bgcolor: isDark ? '#111c35' : '#ffffff',
            bordercolor: isDark ? '#233152' : '#cbd5e1',
            font: { family: 'Outfit, sans-serif', color: isDark ? '#f1f5f9' : '#0f172a', size: 12 }
        }
    };
}

function renderPortfolioCharts() {
    const data = portfolioDataCache;
    if (!data || !Array.isArray(data) || data.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const th = getPlotlyTheme();
    const layoutBase = {
        paper_bgcolor: th.paper_bgcolor,
        plot_bgcolor:  th.plot_bgcolor,
        font:          th.font,
        autosize:      true,
        margin:        { t: 30, b: 45, l: 50, r: 15 },
        legend:        { orientation: 'h', y: 1.15, x: 0, font: { size: 11 } },
        bargap:        0.28,
        hoverlabel:    th.hoverlabel,
        xaxis:         { showgrid: false, color: th.font.color, automargin: true },
        yaxis:         { gridcolor: th.gridcolor, color: th.font.color, automargin: true }
    };

    const plotlyConfig = {
        responsive: true,
        displayModeBar: false // Removes modebar to eliminate horizontal overflow
    };

    // Executive Financial Palettes (Distinct, Rich & Professional)
    const pal = {
        // Chart 1: Institutional Jewel Emerald vs Velveteen Bordeaux Wine
        creditApp: isDark ? '#14b8a6' : '#0d9488',
        creditAppBrd: isDark ? '#0f766e' : '#115e59',
        creditRej: isDark ? '#fb7185' : '#be123c',
        creditRejBrd: isDark ? '#f43f5e' : '#9f1239',

        // Chart 2: Royal Executive Cobalt vs Burnished Amber Bronze
        dtiApp: isDark ? '#3b82f6' : '#1d4ed8',
        dtiAppBrd: isDark ? '#2563eb' : '#1e40af',
        dtiRej: isDark ? '#fbbf24' : '#d97706',
        dtiRejBrd: isDark ? '#f59e0b' : '#b45309',

        // Chart 3: Regal Midnight Iris vs Venetian Terracotta Copper
        areaApp: isDark ? '#818cf8' : '#4338ca',
        areaAppBrd: isDark ? '#6366f1' : '#3730a3',
        areaRej: isDark ? '#fb923c' : '#c2410c',
        areaRejBrd: isDark ? '#f97316' : '#9a3412'
    };

    // CHART 1: Credit Track Outcomes
    const cats = ['Established (1.0)', 'No / Poor History (0.0)'];
    let appCounts = [0, 0], rejCounts = [0, 0];
    data.forEach(row => {
        const isEst = Number(row.CreditHistory) === 1;
        const isApp = Number(row.Loan_Status)   === 1;
        const idx   = isEst ? 0 : 1;
        if (isApp) appCounts[idx]++; else rejCounts[idx]++;
    });
    Plotly.newPlot('chart-credit', [
        {
            name: 'Approved / Conditional',
            x: cats,
            y: appCounts,
            type: 'bar',
            width: 0.32,
            marker: { color: pal.creditApp, line: { color: pal.creditAppBrd, width: 1.2 } },
            hovertemplate: '%{y} Approved<extra></extra>'
        },
        {
            name: 'Rejected',
            x: cats,
            y: rejCounts,
            type: 'bar',
            width: 0.32,
            marker: { color: pal.creditRej, line: { color: pal.creditRejBrd, width: 1.2 } },
            hovertemplate: '%{y} Rejected<extra></extra>'
        }
    ], {
        ...layoutBase,
        barmode: 'group',
        yaxis: { ...layoutBase.yaxis, title: 'Applications', showgrid: true },
        xaxis: { ...layoutBase.xaxis, title: 'Credit History Status' }
    }, plotlyConfig);

    // CHART 2: DTI Risk Tiers
    const dtiLabels = ['Low Risk ≤20%', 'Moderate 20–35%', 'High Risk >35%'];
    let dtiApp = [0,0,0], dtiRej = [0,0,0];
    data.forEach(row => {
        const rawLoan = row.LoanAmount || 0;
        const loanK   = rawLoan < 1000 ? rawLoan : rawLoan / 1000;
        const income  = ((row.ApplicantIncome || 0) + (row.CoapplicantIncome || 0)) || 1;
        const emi     = (loanK * 1000) / 240;
        const dti     = (emi / (income / 12)) * 100;
        const isApp   = Number(row.Loan_Status) === 1;
        const idx     = dti <= 20 ? 0 : dti <= 35 ? 1 : 2;
        if (isApp) dtiApp[idx]++; else dtiRej[idx]++;
    });
    Plotly.newPlot('chart-dti', [
        {
            name: 'Approved / Conditional',
            x: dtiLabels,
            y: dtiApp,
            type: 'bar',
            width: 0.28,
            marker: { color: pal.dtiApp, line: { color: pal.dtiAppBrd, width: 1.2 } },
            hovertemplate: '%{y} Approved<extra></extra>'
        },
        {
            name: 'Rejected',
            x: dtiLabels,
            y: dtiRej,
            type: 'bar',
            width: 0.28,
            marker: { color: pal.dtiRej, line: { color: pal.dtiRejBrd, width: 1.2 } },
            hovertemplate: '%{y} Rejected<extra></extra>'
        }
    ], {
        ...layoutBase,
        barmode: 'group',
        yaxis: { ...layoutBase.yaxis, title: 'Applications', showgrid: true },
        xaxis: { ...layoutBase.xaxis, title: 'DTI Risk Level' }
    }, plotlyConfig);

    // CHART 3: Property Area
    const areas = ['Urban', 'Semiurban', 'Rural'];
    let aApp = [0,0,0], aRej = [0,0,0];
    data.forEach(row => {
        let area = String(row.PropertyArea || '').trim();
        if (area === '0') area = 'Rural';
        else if (area === '1') area = 'Semiurban';
        else if (area === '2') area = 'Urban';
        const isApp = Number(row.Loan_Status) === 1;
        const idx   = area === 'Urban' ? 0 : (area === 'Semiurban' || area === 'Semi-Urban') ? 1 : 2;
        if (isApp) aApp[idx]++; else aRej[idx]++;
    });
    Plotly.newPlot('chart-demo', [
        {
            name: 'Approved / Conditional',
            x: areas,
            y: aApp,
            type: 'bar',
            width: 0.35,
            marker: { color: pal.areaApp, line: { color: pal.areaAppBrd, width: 1.2 } },
            hovertemplate: '%{y} Approved<extra></extra>'
        },
        {
            name: 'Rejected',
            x: areas,
            y: aRej,
            type: 'bar',
            width: 0.35,
            marker: { color: pal.areaRej, line: { color: pal.areaRejBrd, width: 1.2 } },
            hovertemplate: '%{y} Rejected<extra></extra>'
        }
    ], {
        ...layoutBase,
        barmode: 'group',
        yaxis: { ...layoutBase.yaxis, title: 'Applications', showgrid: true },
        xaxis: { ...layoutBase.xaxis, title: 'Property Area' }
    }, plotlyConfig);

    setTimeout(() => {
        ['chart-credit','chart-dti','chart-demo'].forEach(id => {
            try { Plotly.Plots.resize(id); } catch(e) {}
        });
    }, 150);
}

/* ─────────────────────────────────────
   AMORTIZATION SIMULATOR & INTERACTIVE HELPERS
───────────────────────────────────── */
function setTenure(years) {
    const input = document.getElementById('sim_term_years');
    if (input) {
        input.value = years;
        document.querySelectorAll('.tenure-pill').forEach(pill => {
            pill.classList.toggle('active', parseInt(pill.dataset.years) === years);
        });
        calculateAmortization();
    }
}

function adjustPrincipal(delta) {
    const input = document.getElementById('sim_amount');
    if (input) {
        const current = parseFloat(input.value) || 0;
        input.value = Math.max(10000, current + delta);
        calculateAmortization();
    }
}

function calculateAmortization() {
    const principal  = parseFloat(document.getElementById('sim_amount')?.value)     || 0;
    const termInput  = parseFloat(document.getElementById('sim_term_years')?.value) || 30;
    const termMonths = termInput > 40 ? Math.round(termInput) : Math.round(termInput * 12);
    const annualRate = parseFloat(document.getElementById('sim_rate')?.value)        || 0;

    // Sync slider track fill
    const slider = document.getElementById('sim_rate');
    if (slider) {
        const pct = Math.max(0, Math.min(100, ((annualRate - 1) / (18 - 1)) * 100));
        slider.style.background = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${pct}%, var(--border-medium) ${pct}%, var(--border-medium) 100%)`;
    }

    const monthlyRate = (annualRate / 100) / 12;
    let monthlyPmt = 0;
    if (principal <= 0)     monthlyPmt = 0;
    else if (monthlyRate > 0) monthlyPmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    else                    monthlyPmt = principal / termMonths;

    const totalPay = monthlyPmt * termMonths;
    const totalInt = Math.max(0, totalPay - principal);

    setText('out_monthly',   '₹' + monthlyPmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setText('out_principal', '₹' + principal.toLocaleString(undefined,  { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setText('out_interest',  '₹' + totalInt.toLocaleString(undefined,   { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    // Update distribution ratio bar & Donut breakdown telemetry
    if (totalPay > 0) {
        const pPct = ((principal / totalPay) * 100).toFixed(1);
        const iPct = ((totalInt / totalPay) * 100).toFixed(1);
        setText('payoff-ratio-text', `${pPct}% Principal / ${iPct}% Interest`);
        const pBar = document.getElementById('ratio-bar-principal');
        const iBar = document.getElementById('ratio-bar-interest');
        if (pBar) pBar.style.width = pPct + '%';
        if (iBar) iBar.style.width = iPct + '%';

        // Update Tab 3 Donut Breakdown Table
        setText('donut-pct-principal', pPct + '%');
        setText('donut-pct-interest',  iPct + '%');
        setText('donut-amt-principal', '₹' + principal.toLocaleString(undefined, { maximumFractionDigits: 0 }));
        setText('donut-amt-interest',  '₹' + totalInt.toLocaleString(undefined, { maximumFractionDigits: 0 }));
        setText('donut-amt-total',     '₹' + totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 }));
    }

    // Build schedule
    let balances = [], cumInterests = [], months = [], tbodyHtml = '';
    window.amortizationScheduleData = [['Month','Principal Paid','Interest Paid','Remaining Balance']];

    let remaining = principal, cumInt = 0;
    for (let m = 1; m <= termMonths; m++) {
        const intPmt  = remaining * monthlyRate;
        const prinPmt = monthlyPmt - intPmt;
        remaining    -= prinPmt;
        cumInt       += intPmt;
        const bal     = Math.max(0, remaining);
        months.push(m); balances.push(bal); cumInterests.push(cumInt);
        window.amortizationScheduleData.push([m, prinPmt.toFixed(2), intPmt.toFixed(2), bal.toFixed(2)]);
        tbodyHtml += `<tr>
            <td>${m}</td>
            <td>₹${prinPmt.toFixed(2)}</td>
            <td>₹${intPmt.toFixed(2)}</td>
            <td>₹${bal.toFixed(2)}</td>
        </tr>`;
    }

    const tbody = document.getElementById('amortization-table-body');
    if (tbody) tbody.innerHTML = tbodyHtml;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const th = getPlotlyTheme();
    const plotlyConfig = { responsive: true, displayModeBar: false };

    // Line Chart (Expanded, high-density curve)
    if (document.getElementById('chart-amort-line')) {
        Plotly.newPlot('chart-amort-line', [
            {
                x: months,
                y: balances,
                name: 'Remaining Balance',
                fill: 'tozeroy',
                fillcolor: isDark ? 'rgba(37, 99, 235, 0.16)' : 'rgba(29, 78, 216, 0.08)',
                mode: 'lines',
                line: { color: isDark ? '#3b82f6' : '#2563eb', width: 2.5 },
                hovertemplate: 'Month %{x}<br>Balance: ₹%{y:,.0f}<extra></extra>'
            },
            {
                x: months,
                y: cumInterests,
                name: 'Cumulative Interest',
                mode: 'lines',
                line: { color: isDark ? '#fb7185' : '#e11d48', width: 2.2 },
                hovertemplate: 'Month %{x}<br>Interest: ₹%{y:,.0f}<extra></extra>'
            }
        ], {
            paper_bgcolor: th.paper_bgcolor,
            plot_bgcolor:  th.plot_bgcolor,
            font:          th.font,
            autosize:      true,
            margin:        { t: 30, b: 35, l: 55, r: 15 },
            xaxis:         { showgrid: false, color: th.font.color, automargin: true, nticks: 8, title: 'Tenure (Months)' },
            yaxis:         { gridcolor: th.gridcolor, color: th.font.color, automargin: true, title: 'Amount (₹)' },
            legend:        { orientation: 'h', y: 1.15, x: 0, font: { size: 11 } }
        }, plotlyConfig);
    }

    // Donut Chart (Compact, clean ratio display)
    if (document.getElementById('chart-amort-pie')) {
        Plotly.newPlot('chart-amort-pie', [{
            labels:   ['Principal', 'Total Interest'],
            values:   [principal, totalInt],
            type:     'pie',
            hole:     0.60,
            domain:   { x: [0, 1], y: [0, 1] },
            marker:   {
                colors: [isDark ? '#3b82f6' : '#2563eb', isDark ? '#fb7185' : '#e11d48'],
                line: { color: isDark ? '#111c35' : '#ffffff', width: 2 }
            },
            textinfo: 'percent',
            textposition: 'inside',
            insidetextfont: { family: 'Outfit, sans-serif', size: 12, color: '#ffffff', weight: 600 },
            hovertemplate: '<b>%{label}</b><br>₹%{value:,.2f} (%{percent})<extra></extra>',
            showlegend: false
        }], {
            paper_bgcolor: th.paper_bgcolor,
            plot_bgcolor:  th.plot_bgcolor,
            font:          th.font,
            autosize:      true,
            margin:        { t: 10, b: 10, l: 10, r: 10 }
        }, plotlyConfig);
    }

    setTimeout(() => {
        try { Plotly.Plots.resize('chart-amort-line'); } catch(e) {}
        try { Plotly.Plots.resize('chart-amort-pie');  } catch(e) {}
    }, 100);
}

function downloadAmortizationCSV() {
    if (!window.amortizationScheduleData?.length) return;
    const csv  = 'data:text/csv;charset=utf-8,' + window.amortizationScheduleData.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv); link.download = 'apex_amortization_schedule.csv';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

/* ─────────────────────────────────────
   ADMIN USER MANAGEMENT
───────────────────────────────────── */
async function fetchAdminUsers() {
    if (!authToken || !isMaster) return;
    const container = document.getElementById('admin-user-list');
    try {
        const res = await fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();
        container.innerHTML = users.map(u => `
            <div class="user-row">
                <div class="user-info">
                    <span class="user-name">@${u.username}</span>
                    <span class="user-status ${u.is_master ? 'status-master' : (u.is_active ? 'status-active' : 'status-suspended')}">
                        ${u.is_master ? '🛡️ Master Admin' : (u.is_active ? '🟢 Active' : '🟡 Suspended')}
                    </span>
                </div>
                ${u.username !== currentUsername ? `
                <div class="user-actions">
                    <button class="action-btn" onclick="toggleUserStatus(${u.id})">${u.is_active ? 'Suspend' : 'Activate'}</button>
                    <button class="action-btn btn-delete" onclick="deleteUser(${u.id})">Erase</button>
                </div>` : ''}
            </div>`).join('');
    } catch(e) {
        container.innerHTML = `<div class="loading-text" style="color:var(--red);">Failed to load users</div>`;
    }
}

async function toggleUserStatus(userId) {
    if (!confirm("Change this user's access status?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-status`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        fetchAdminUsers();
    } catch(e) { alert(e.message); }
}

async function deleteUser(userId) {
    if (!confirm('WARNING: Permanently erase this user and all their history? This cannot be undone.')) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        fetchAdminUsers();
    } catch(e) { alert(e.message); }
}

/* ─────────────────────────────────────
   DYNAMIC RESULT STYLES
───────────────────────────────────── */
const resultStyles = document.createElement('style');
resultStyles.textContent = `
.result-output {
    padding: 1rem 0 1rem 1.25rem;
    border-radius: 4px;
    text-align: left;
    border-top: none; border-right: none; border-bottom: none;
}
.result-track-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border: 1px solid var(--border-medium);
    color: var(--text-muted);
    background: var(--bg-surface);
    padding: 0.22rem 0.75rem;
    border-radius: 20px;
    margin-bottom: 0.75rem;
    font-family: 'JetBrains Mono', monospace;
}
.result-status {
    font-size: 1.95rem;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: 0.2rem;
}
.result-tier {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 1.1rem;
    font-family: 'JetBrains Mono', monospace;
}
.result-score-block { margin-bottom: 0.75rem; }
.score-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.4rem;
}
.score-title {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
}
.score-value { font-size: 1.05rem; font-weight: 800; }
.score-bar-wrap {
    position: relative;
    height: 7px;
    background: var(--border-medium);
    border-radius: 4px;
    overflow: visible;
}
.score-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
}
.score-threshold-line {
    position: absolute;
    left: 75%;
    top: -4px;
    bottom: -4px;
    width: 2px;
    border-left: 2px dashed var(--red);
    transform: translateX(-50%);
    opacity: 0.6;
}
.score-notes {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 0.5rem;
    line-height: 1.5;
}
.result-section-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 0.85rem 0;
}
.result-factors-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
}
.section-chip {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
}
.result-factors-list { display: flex; flex-direction: column; gap: 0.35rem; }
.factor-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
    font-size: 0.78rem;
    gap: 0.5rem;
}
.factor-row.positive { background: var(--green-bg); border: 1px solid var(--green-brd); }
.factor-row.negative { background: var(--red-bg);   border: 1px solid var(--red-brd);   }
.factor-label { flex: 1; min-width: 0; }
.factor-impact { font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; flex-shrink: 0; }
.conditions-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.83rem;
    color: var(--text-secondary);
    line-height: 1.5;
}
.conditions-list li { display: flex; gap: 0.5rem; align-items: flex-start; }
.result-comparison {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
    margin: 1rem 0;
}
.compare-box {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border-medium);
    border-radius: 9px;
    padding: 0.8rem 0.9rem;
}
.compare-arrow {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    font-size: 1.1rem;
    flex-shrink: 0;
}
.compare-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 0.3rem;
}
.compare-amount { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text-heading); }
.compare-note { font-size: 0.7rem; font-weight: 600; margin-top: 0.3rem; }
.compare-note.denied   { color: var(--red); }
.compare-note.approved { color: var(--green); }

@keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(resultStyles);

/* ─────────────────────────────────────
   PWA SERVICE WORKER
───────────────────────────────────── */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
            .catch(err => console.warn('[PWA] Service Worker failed:', err));
    });
}

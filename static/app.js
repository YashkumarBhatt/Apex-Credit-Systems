// The API is served from the same host
const API_BASE = window.location.origin;

let authToken = localStorage.getItem('apex_token');
let currentUsername = localStorage.getItem('apex_user');
let sessionID = localStorage.getItem('apex_session');
let isMaster = localStorage.getItem('apex_is_master') === 'true';
let currentAuthMode = 'login'; 

// Data cache for Portfolio Dashboard
let portfolioDataCache = null;

document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
    } else {
        showAuth();
    }
});

/* ==============================
   UI NAVIGATION & STATE
============================== */
function switchAuthTab(mode) {
    currentAuthMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('auth-submit-btn').textContent = mode === 'login' ? 'Access System' : 'Create Credentials';
    document.getElementById('auth-error').textContent = '';
    
    const checklist = document.getElementById('password-checklist');
    if (checklist) {
        if (mode === 'register') {
            checklist.classList.remove('hidden');
        } else {
            checklist.classList.add('hidden');
        }
    }
}

function validatePassword() {
    if (currentAuthMode !== 'register') return;
    
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    
    const updateReq = (id, isValid) => {
        const el = document.getElementById(id);
        if (!el) return;
        if(isValid) {
            el.style.color = 'var(--success)';
            el.innerHTML = '✓ ' + el.innerHTML.substring(2);
        } else {
            el.style.color = 'var(--danger)';
            el.innerHTML = '✗ ' + el.innerHTML.substring(2);
        }
    };
    
    updateReq('req-length', password.length >= 8);
    updateReq('req-upper', /[A-Z]/.test(password));
    updateReq('req-lower', /[a-z]/.test(password));
    updateReq('req-number', /[0-9]/.test(password));
    updateReq('req-special', /[^A-Za-z0-9]/.test(password));
    updateReq('req-diff', password !== username && password.length > 0);
}

function showAuth() {
    document.getElementById('dashboard-view').classList.remove('active');
    setTimeout(() => {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('auth-view').classList.remove('hidden');
        setTimeout(() => document.getElementById('auth-view').classList.add('active'), 10);
    }, 300);
}

function showDashboard() {
    document.getElementById('auth-view').classList.remove('active');
    setTimeout(() => {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        setTimeout(() => document.getElementById('dashboard-view').classList.add('active'), 10);
    }, 300);
    
    document.getElementById('user-display').textContent = currentUsername || 'Analyst';
    
    // Toggle Admin Panel
    if (isMaster) {
        document.getElementById('admin-panel').classList.remove('hidden');
        fetchAdminUsers();
    } else {
        document.getElementById('admin-panel').classList.add('hidden');
    }
    
    // Trigger default tab load
    switchMainTab('eligibility');
}

function switchMainTab(tabName) {
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.currentTarget) event.currentTarget.classList.add('active');
    
    // Update active tab container
    document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active', 'hidden'));
    document.querySelectorAll('.main-tab').forEach(tab => {
        if(tab.id !== `tab-${tabName}`) tab.classList.add('hidden');
    });
    
    const activeTab = document.getElementById(`tab-${tabName}`);
    activeTab.classList.remove('hidden');
    setTimeout(() => activeTab.classList.add('active'), 10);
    
    // Trigger Lazy-load content based on tab
    if(tabName === 'portfolio') {
        if (!portfolioDataCache) {
            fetchPortfolioData();
        } else {
            setTimeout(() => {
                renderPortfolioCharts();
                try {
                    Plotly.Plots.resize('chart-credit');
                    Plotly.Plots.resize('chart-dti');
                    Plotly.Plots.resize('chart-demo');
                } catch(e) {}
            }, 60);
        }
    } else if(tabName === 'amortization') {
        calculateAmortization();
    }
}

async function logout() {
    if(authToken && sessionID) {
        try {
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ session_id: parseInt(sessionID) })
            });
        } catch(e) { console.error("Logout ping failed", e); }
    }
    
    localStorage.removeItem('apex_token');
    localStorage.removeItem('apex_user');
    localStorage.removeItem('apex_session');
    localStorage.removeItem('apex_is_master');
    authToken = null;
    currentUsername = null;
    sessionID = null;
    isMaster = false;
    portfolioDataCache = null;
    
    document.getElementById('result-display').innerHTML = `
        <div class="pulse-icon">⚡️</div>
        <p>Submit an application to view the algorithmic decision.</p>
    `;
    document.getElementById('result-display').className = 'result-placeholder';
    showAuth();
}

/* ==============================
   API INTEGRATION: AUTH
============================== */
async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');
    
    errorDiv.textContent = '';
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    try {
        if (currentAuthMode === 'register') {
            const isValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) && password !== username;
            if (!isValid) {
                throw new Error("Password does not meet all security requirements.");
            }
            
            const res = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
            alert('Credentials created securely! You may now login.');
            document.querySelectorAll('.tab-btn')[0].click(); 
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
            
            authToken = data.access_token;
            currentUsername = username;
            sessionID = data.session_id;
            isMaster = data.is_master;
            
            localStorage.setItem('apex_token', authToken);
            localStorage.setItem('apex_user', currentUsername);
            localStorage.setItem('apex_session', sessionID);
            localStorage.setItem('apex_is_master', isMaster);
            
            showDashboard();
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.animation = 'none';
        errorDiv.offsetHeight;
        errorDiv.style.animation = 'pulse 0.3s ease-in-out';
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

/* ==============================
   API INTEGRATION: PREDICTION
============================== */
async function handlePredict(e) {
    e.preventDefault();
    if (!authToken) return;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Evaluating Algorithmic Pipeline...';
    submitBtn.disabled = true;

    const resultDiv = document.getElementById('result-display');
    
    resultDiv.innerHTML = '<div class="pulse-icon">⚙️</div><div class="conf-text" style="color:var(--text-main)">Querying ML Model...</div>';
    resultDiv.className = 'result-placeholder';
    resultDiv.style.cssText = '';
    
    const rawLoanInput = parseFloat(document.getElementById('loan_amount').value) || 0;
    const literalLoanAmount = rawLoanInput < 1000 ? rawLoanInput * 1000 : rawLoanInput;
    const scaledLoanForML = rawLoanInput >= 1000 ? rawLoanInput / 1000 : rawLoanInput;

    const termYearsInput = parseFloat(document.getElementById('loan_term_years').value) || 30;
    const termMonths = termYearsInput > 40 ? Math.round(termYearsInput) : Math.round(termYearsInput * 12);

    const payload = {
        ApplicantIncome: parseFloat(document.getElementById('app_income').value) || 0,
        CoapplicantIncome: parseFloat(document.getElementById('co_income').value) || 0,
        LoanAmount: scaledLoanForML,
        Loan_Amount_Term: termMonths,
        CreditHistory: parseFloat(document.getElementById('credit_history').value),
        Education: document.getElementById('education').value,
        EmploymentType: document.getElementById('employment').value,
        MaritalStatus: document.getElementById('marital').value,
        Dependents: document.getElementById('dependents').value,
        PropertyArea: document.getElementById('property').value
    };

    try {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) { logout(); throw new Error("Security token expired."); }
        if (!res.ok) throw new Error((await res.json()).detail || 'Prediction pipeline failed');

        const data = await res.json();
        const isApproved = data.prediction === 1;
        const status = data.status || (isApproved ? 'APPROVED' : 'REJECTED');
        const track = data.track || (payload.CreditHistory === 1.0 ? 'Established Credit Track' : 'Income-Based Capacity Track');
        const tier = data.tier || (isApproved ? 'Tier 1 - Standard Approval' : 'Standard Rejection');
        const notes = data.actionable_notes || '';
        const conditions = data.conditions || [];
        const counterAmt = data.counter_offer_amount;
        
        // Auto-fill the amortization simulator with literal loan amount & tenure years
        document.getElementById('sim_amount').value = counterAmt ? counterAmt : literalLoanAmount;
        document.getElementById('sim_term_years').value = termYearsInput;
        
        // Auto-run the simulation to show breakdown immediately
        calculateAmortization();

        // ── Accent colour by decision type ──
        let accentColor = '#10b981';   // Approved  → emerald
        if (status === 'Counter-Offer Proposed') accentColor = '#c9922a';  // amber
        else if (status === 'Conditional Approval') accentColor = '#3b82f6'; // blue
        else if (!isApproved) accentColor = '#ef4444';                       // red

        // ── Card style: flat inside outer glass-card, only left accent border ──
        resultDiv.className = 'result-card';
        resultDiv.style.cssText = `
            background:transparent;
            border:none;
            border-left:4px solid ${accentColor};
            border-radius:0;
            text-align:left;
            padding:0.5rem 0 0.5rem 1.25rem;
            box-shadow:none;
            animation:popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
        `;

        // ── Score & threshold bar ──
        const scorePercent = Math.min(data.confidence_percentage, 100);
        const RISK_THRESHOLD = 75; // fixed underwriting threshold

        // ── Loan comparison boxes (only when counter offer exists) ──
        let loanComparisonHTML = '';
        if (counterAmt) {
            loanComparisonHTML = `
                <div style="display:flex;align-items:stretch;gap:0.6rem;margin:1.25rem 0;">
                    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.1rem;">
                        <div style="font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:0.5rem;">Requested</div>
                        <div style="font-size:1.4rem;font-weight:800;color:#64748b;letter-spacing:-0.02em;">₹${literalLoanAmount.toLocaleString('en-IN')}</div>
                        <div style="font-size:0.75rem;color:#ef4444;margin-top:0.35rem;font-weight:600;">✗ Exceeds risk limit</div>
                    </div>
                    <div style="display:flex;align-items:center;padding:0 0.25rem;color:#94a3b8;font-size:1.3rem;flex-shrink:0;">→</div>
                    <div style="flex:1;background:#fef9ee;border:1.5px solid ${accentColor};border-radius:10px;padding:1rem 1.1rem;">
                        <div style="font-size:0.6rem;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:0.5rem;">Pre-Approved Limit</div>
                        <div style="font-size:1.4rem;font-weight:800;color:${accentColor};letter-spacing:-0.02em;">₹${counterAmt.toLocaleString('en-IN')}</div>
                        <div style="font-size:0.75rem;color:#10b981;margin-top:0.35rem;font-weight:600;">✓ Within capacity</div>
                    </div>
                </div>
            `;
        }

        // ── Conditions list ──
        let conditionsHTML = '';
        if (conditions.length > 0) {
            conditionsHTML = `
                <div style="padding-top:1rem;border-top:1px solid #e8ecf2;margin-top:1rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.65rem;">
                        <span style="font-size:1rem;">📋</span>
                        <span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.13em;color:#475569;">Underwriting Conditions</span>
                    </div>
                    <ul style="margin:0;padding:0;list-style:none;">
                        ${conditions.map(c => `
                            <li style="display:flex;align-items:flex-start;gap:0.55rem;margin-bottom:0.45rem;font-size:0.855rem;color:#475569;line-height:1.5;">
                                <span style="color:${accentColor};margin-top:0.25rem;flex-shrink:0;font-size:0.6rem;">■</span>
                                <span>${c}</span>
                            </li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // ── Format status for display (Title Case, not ALL CAPS) ──
        const displayStatus = status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : status;
        const displayTier = tier.replace(' - ', ' · ').toUpperCase();

        resultDiv.innerHTML = `
            <!-- Track Badge -->
            <div style="display:inline-block;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;border:1.5px solid #cbd5e1;color:#475569;background:#f8fafc;padding:0.28rem 0.85rem;border-radius:20px;margin-bottom:1rem;">${track}</div>

            <!-- Status -->
            <div style="font-size:1.85rem;font-weight:800;color:${accentColor};line-height:1.15;margin-bottom:0.35rem;letter-spacing:-0.02em;">${displayStatus}</div>

            <!-- Tier -->
            <div style="font-size:0.65rem;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:1.25rem;">${displayTier}</div>

            <!-- Score Bar -->
            <div style="margin-bottom:1.1rem;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.4rem;">
                    <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;">Financial Capacity Score</span>
                    <div style="text-align:right;">
                        <div style="font-size:0.58rem;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Risk Threshold</div>
                        <div style="font-size:1.05rem;font-weight:800;color:${accentColor};">${data.confidence_percentage.toFixed(1)}%</div>
                    </div>
                </div>
                <div style="position:relative;height:8px;background:#e2e8f0;border-radius:4px;overflow:visible;">
                    <div style="height:100%;width:${scorePercent}%;background:${accentColor};border-radius:4px;"></div>
                    <div style="position:absolute;left:${RISK_THRESHOLD}%;top:-5px;bottom:-5px;width:2px;border-left:2px dashed #ef4444;transform:translateX(-50%);"></div>
                </div>
                <div style="font-size:0.76rem;color:#64748b;font-style:italic;margin-top:0.55rem;line-height:1.5;">${notes}</div>
            </div>

            <!-- Loan Comparison -->
            ${loanComparisonHTML}

            <!-- Conditions -->
            ${conditionsHTML}
        `;

        // Refresh the portfolio charts dynamically
        fetchPortfolioData();

    } catch (err) {
        resultDiv.className = 'result-placeholder';
        resultDiv.innerHTML = `<div class="pulse-icon" style="color:var(--danger)">⚠️</div><div class="error-msg" style="font-size:1rem">${err.message}</div>`;
    } finally {
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
    }
}

/* ==============================
   API INTEGRATION: ADMIN EXPORT
============================== */
function downloadCSV(endpoint) {
    if (!authToken) return;
    
    fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
        if(response.status === 401) { logout(); throw new Error("Unauthorized"); }
        if(response.status === 404) { throw new Error("No data found to export."); }
        if(!response.ok) { throw new Error("Export failed."); }
        
        // Extract filename from Content-Disposition if present
        let filename = endpoint.split('/').pop() + '.csv';
        const disposition = response.headers.get('Content-Disposition');
        if (disposition && disposition.indexOf('filename=') !== -1) {
            filename = disposition.split('filename=')[1];
        }
        return response.blob().then(blob => ({ blob, filename }));
    })
    .then(({blob, filename}) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    })
    .catch(err => alert(err.message));
}

/* ==============================
   PORTFOLIO DASHBOARD (Plotly)
============================== */
async function fetchPortfolioData() {
    if (!authToken) return;
    try {
        const res = await fetch(`${API_BASE}/portfolio-data`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if(res.status === 401) { logout(); return; }
        portfolioDataCache = await res.json();
        renderPortfolioCharts();
    } catch(e) {
        console.error("Failed to load portfolio data", e);
    }
}

function renderPortfolioCharts() {
    const data = portfolioDataCache;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.warn("Portfolio data is empty or invalid. Charts will not render.");
        return;
    }
    
    // KPI Math
    const totalRecords = data.length;
    const approvalRate = (data.filter(d => d.Loan_Status === 1).length / totalRecords) * 100;
    const avgIncome = data.reduce((sum, d) => sum + d.ApplicantIncome, 0) / totalRecords;
    const avgLoan = data.reduce((sum, d) => sum + d.LoanAmount, 0) / totalRecords;
    
    document.getElementById('kpi-records').innerText = totalRecords.toLocaleString();
    document.getElementById('kpi-approval').innerText = approvalRate.toFixed(1) + '%';
    document.getElementById('kpi-income').innerText = '₹' + avgIncome.toLocaleString(undefined, {maximumFractionDigits:0});
    document.getElementById('kpi-loan').innerText = '₹' + avgLoan.toLocaleString(undefined, {maximumFractionDigits:0});
    
    // Common Plotly Layout Rules
    const layoutBase = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Outfit', color: '#1e293b', size: 13 },
        margin: { t: 45, b: 60, l: 80, r: 20 },
        legend: { orientation: 'h', y: 1.18, x: 0, font: { size: 12 } },
        bargap: 0.25,
        hoverlabel: {
            bgcolor: '#ffffff',
            bordercolor: '#e2e8f0',
            font: { family: 'Outfit', color: '#1e293b', size: 13 }
        }
    };

    // -------------------------------------------------------------
    // CHART 1: Credit History Grouped 4-Bar Volume Chart
    // -------------------------------------------------------------
    const categories = ['Established (1.0)', 'No / Poor History (0.0)'];
    let approvedCounts = [0, 0];
    let rejectedCounts = [0, 0];

    data.forEach(row => {
        const isEstablished = Number(row.CreditHistory) === 1;
        const isApproved = Number(row.Loan_Status) === 1;
        
        if (isEstablished) {
            if (isApproved) approvedCounts[0]++;
            else rejectedCounts[0]++;
        } else {
            if (isApproved) approvedCounts[1]++;
            else rejectedCounts[1]++;
        }
    });

    const maxCredit = Math.max(...approvedCounts, ...rejectedCounts);

    const traceApproved = {
        name: 'Approved / Conditional',
        x: categories,
        y: approvedCounts,
        type: 'bar',
        width: 0.3,
        marker: { color: '#10b981' },
        hovertemplate: '%{y} Approved<extra></extra>'
    };

    const traceRejected = {
        name: 'Rejected',
        x: categories,
        y: rejectedCounts,
        type: 'bar',
        width: 0.3,
        marker: { color: '#ef4444' },
        hovertemplate: '%{y} Rejected<extra></extra>'
    };

    Plotly.newPlot('chart-credit', [traceApproved, traceRejected], {
        ...layoutBase,
        barmode: 'group',
        yaxis: { gridcolor: 'rgba(0,0,0,0.06)', title: 'Number of Applications', range: [0, maxCredit * 1.25], showgrid: true },
        xaxis: { title: 'Credit History Status', showgrid: false }
    }, { responsive: true });

    // -------------------------------------------------------------
    // CHART 2: Debt-to-Income (DTI) Risk Tier Distribution
    // -------------------------------------------------------------
    // CHART 2: Debt-to-Income (DTI) Risk Tier Breakdown
    // -------------------------------------------------------------
    const dtiTiers = ['Low Risk  ≤20%', 'Moderate  20–35%', 'High Risk  >35%'];
    let dtiApproved = [0, 0, 0];
    let dtiRejected = [0, 0, 0];

    data.forEach(row => {
        const rawLoan = row.LoanAmount || 0;
        // CSV stores LoanAmount in thousands; values <1000 are already in thousands
        const loanInThousands = rawLoan < 1000 ? rawLoan : rawLoan / 1000;
        const annualIncome = ((row.ApplicantIncome || 0) + (row.CoapplicantIncome || 0)) || 1;
        
        // Monthly debt estimate (EMI proxy) / Monthly Income
        const estimatedMonthlyEmi = (loanInThousands * 1000) / 240; // assume 20-yr term for ratio
        const monthlyIncome = annualIncome / 12;
        const approxDti = monthlyIncome > 0 ? (estimatedMonthlyEmi / monthlyIncome) * 100 : 0;
        
        const isApproved = Number(row.Loan_Status) === 1;
        let idx = 0;
        if (approxDti <= 20) idx = 0;
        else if (approxDti <= 35) idx = 1;
        else idx = 2;

        if (isApproved) dtiApproved[idx]++;
        else dtiRejected[idx]++;
    });

    const maxDti = Math.max(...dtiApproved, ...dtiRejected);

    const traceDtiApp = {
        name: 'Approved / Conditional',
        x: dtiTiers,
        y: dtiApproved,
        type: 'bar',
        width: 0.2,
        marker: { color: '#3b82f6' },
        hovertemplate: '%{y} Approved<extra></extra>'
    };

    const traceDtiRej = {
        name: 'Rejected',
        x: dtiTiers,
        y: dtiRejected,
        type: 'bar',
        width: 0.2,
        marker: { color: '#f97316' },
        hovertemplate: '%{y} Rejected<extra></extra>'
    };

    Plotly.newPlot('chart-dti', [traceDtiApp, traceDtiRej], {
        ...layoutBase,
        barmode: 'group',
        autosize: true,
        yaxis: { gridcolor: 'rgba(0,0,0,0.06)', title: 'Number of Applications', range: [0, maxDti * 1.25], showgrid: true },
        xaxis: { title: 'DTI Risk Level', showgrid: false, automargin: true }
    }, { responsive: true });

    // -------------------------------------------------------------
    // CHART 3: Property Area Collateral Distribution
    // -------------------------------------------------------------
    const areas = ['Urban', 'Semiurban', 'Rural'];
    let areaApproved = [0, 0, 0];
    let areaRejected = [0, 0, 0];

    data.forEach(row => {
        // Normalise PropertyArea — CSV has strings; DB may also store strings from dropdown
        let rawArea = String(row.PropertyArea || '').trim();
        // Handle legacy numeric encoding just in case
        if (rawArea === '0') rawArea = 'Rural';
        else if (rawArea === '1') rawArea = 'Semiurban';
        else if (rawArea === '2') rawArea = 'Urban';

        const isApproved = Number(row.Loan_Status) === 1;
        let idx = 2; // default Rural
        if (rawArea === 'Urban') idx = 0;
        else if (rawArea === 'Semiurban' || rawArea === 'Semi-Urban') idx = 1;

        if (isApproved) areaApproved[idx]++;
        else areaRejected[idx]++;
    });

    const maxArea = Math.max(...areaApproved, ...areaRejected);

    const traceAreaApp = {
        name: 'Approved / Conditional',
        x: areas,
        y: areaApproved,
        type: 'bar',
        width: 0.3,
        marker: { color: '#8b5cf6' },
        hovertemplate: '%{y} Approved<extra></extra>'
    };

    const traceAreaRej = {
        name: 'Rejected',
        x: areas,
        y: areaRejected,
        type: 'bar',
        width: 0.3,
        marker: { color: '#ec4899' },
        hovertemplate: '%{y} Rejected<extra></extra>'
    };

    Plotly.newPlot('chart-demo', [traceAreaApp, traceAreaRej], {
        ...layoutBase,
        barmode: 'group',
        autosize: true,
        yaxis: { gridcolor: 'rgba(0,0,0,0.06)', title: 'Number of Applications', range: [0, maxArea * 1.25], showgrid: true },
        xaxis: { title: 'Property Area', showgrid: false }
    }, { responsive: true });

    setTimeout(() => {
        try {
            Plotly.Plots.resize('chart-credit');
            Plotly.Plots.resize('chart-dti');
            Plotly.Plots.resize('chart-demo');
        } catch(e) {}
    }, 300);

    // Re-resize on any window resize so charts never clip
    window._portfolioResizeHandler && window.removeEventListener('resize', window._portfolioResizeHandler);
    window._portfolioResizeHandler = () => {
        try {
            Plotly.Plots.resize('chart-credit');
            Plotly.Plots.resize('chart-dti');
            Plotly.Plots.resize('chart-demo');
        } catch(e) {}
    };
    window.addEventListener('resize', window._portfolioResizeHandler);
}

/* ==============================
   AMORTIZATION PLANNER
================================ */
function calculateAmortization() {
    const principal = parseFloat(document.getElementById('sim_amount').value) || 0;
    const termInput = parseFloat(document.getElementById('sim_term_years')?.value) || 30;
    const termMonths = termInput > 40 ? Math.round(termInput) : Math.round(termInput * 12);
    const annualRate = parseFloat(document.getElementById('sim_rate').value) || 0;

    // Update slider track fill to match current value
    const sliderEl = document.getElementById('sim_rate');
    if (sliderEl) {
        const min = parseFloat(sliderEl.min) || 1;
        const max = parseFloat(sliderEl.max) || 18;
        const pct = ((annualRate - min) / (max - min)) * 100;
        sliderEl.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${pct}%, #cbd5e1 ${pct}%, #cbd5e1 100%)`;
    }
    
    const monthlyRate = (annualRate / 100) / 12;

    
    let monthlyPmt = 0;
    if (principal <= 0) {
        monthlyPmt = 0;
    } else if (monthlyRate > 0) {
        monthlyPmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    } else {
        monthlyPmt = principal / termMonths;
    }
    
    const totalPayout = monthlyPmt * termMonths;
    const totalInterest = totalPayout - principal;
    
    document.getElementById('out_monthly').innerText = '₹' + monthlyPmt.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    document.getElementById('out_principal').innerText = '₹' + principal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    document.getElementById('out_interest').innerText = '₹' + totalInterest.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
    
    // Generate Schedule arrays for plotting
    let balances = [];
    let cumInterests = [];
    let months = [];
    
    let remaining = principal;
    let cumInt = 0;
    
    let tbodyHtml = '';
    window.amortizationScheduleData = [['Month', 'Principal Paid', 'Interest Paid', 'Remaining Balance']];
    
    for(let m = 1; m <= termMonths; m++) {
        let intPmt = remaining * monthlyRate;
        let prinPmt = monthlyPmt - intPmt;
        remaining -= prinPmt;
        cumInt += intPmt;
        
        months.push(m);
        let currentBalance = Math.max(0, remaining);
        balances.push(currentBalance);
        cumInterests.push(cumInt);
        
        tbodyHtml += `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                <td style="padding: 0.5rem; text-align: left;">${m}</td>
                <td style="padding: 0.5rem;">₹${prinPmt.toFixed(2)}</td>
                <td style="padding: 0.5rem;">₹${intPmt.toFixed(2)}</td>
                <td style="padding: 0.5rem;">₹${currentBalance.toFixed(2)}</td>
            </tr>
        `;
        window.amortizationScheduleData.push([m, prinPmt.toFixed(2), intPmt.toFixed(2), currentBalance.toFixed(2)]);
    }
    
    document.getElementById('amortization-table-body').innerHTML = tbodyHtml;
    
    const isMobile = window.innerWidth <= 600;
    const layoutBase = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Outfit', color: '#0f172a', size: isMobile ? 11 : 12 },
        margin: isMobile ? { t: 40, b: 35, l: 42, r: 15 } : { t: 35, b: 30, l: 45, r: 15 }
    };
    
    // Line Chart
    Plotly.newPlot('chart-amort-line', [
        { x: months, y: balances, name: 'Remaining Principal', fill: 'tozeroy', mode: 'lines', line: {color: '#6366f1'} },
        { x: months, y: cumInterests, name: 'Cumulative Interest', mode: 'lines', line: {color: '#ef4444'} }
    ], {
        ...layoutBase,
        xaxis: { showgrid: false, automargin: true },
        yaxis: { gridcolor: 'rgba(0,0,0,0.1)', automargin: true },
        legend: { orientation: 'h', y: 1.28, x: 0, font: { size: isMobile ? 10 : 11 } }
    }, {responsive: true});
    
    // Pie Chart
    Plotly.newPlot('chart-amort-pie', [{
        labels: ['Principal', 'Total Interest'],
        values: [principal, totalInterest],
        type: 'pie',
        hole: 0.45,
        marker: { colors: ['#6366f1', '#ef4444'] },
        textinfo: 'percent',
        textposition: 'inside',
        insidetextfont: { family: 'Outfit', size: 11, color: '#ffffff' },
        hovertemplate: '<b>%{label}</b><br>₹%{value:,.2f} (%{percent})<extra></extra>'
    }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Outfit', color: '#0f172a', size: isMobile ? 11 : 12 },
        margin: { t: 15, b: 30, l: 15, r: 15 },
        legend: { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', font: { size: isMobile ? 10 : 11 } }
    }, {responsive: true});

    setTimeout(() => {
        try {
            Plotly.Plots.resize('chart-amort-line');
            Plotly.Plots.resize('chart-amort-pie');
        } catch(e) {}
    }, 100);
}

function downloadAmortizationCSV() {
    if(!window.amortizationScheduleData || window.amortizationScheduleData.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8," 
        + window.amortizationScheduleData.map(e => e.join(",")).join("\n");
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "amortization_schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ==============================
   ADMIN USER MANAGEMENT
================================ */
async function fetchAdminUsers() {
    if (!authToken || !isMaster) return;
    const container = document.getElementById('admin-user-list');
    try {
        const res = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error("Failed to load users");
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
                </div>
                ` : ''}
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = `<div class="error-msg">Failed to load users</div>`;
    }
}

async function toggleUserStatus(userId) {
    if (!confirm("Are you sure you want to change this user's access status?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-status`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        fetchAdminUsers();
    } catch(e) { alert(e.message); }
}

async function deleteUser(userId) {
    if (!confirm("WARNING: Are you absolutely sure? This will PERMANENTLY erase the user and all their prediction history. This action cannot be undone.")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error((await res.json()).detail);
        fetchAdminUsers();
    } catch(e) { alert(e.message); }
}

/* ==============================
   PWA SERVICE WORKER REGISTRATION
============================== */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
            .then(reg => console.log('[PWA] Service Worker registered successfully with scope:', reg.scope))
            .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
    });
}

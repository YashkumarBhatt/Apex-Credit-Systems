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
    event.currentTarget.classList.add('active');
    
    // Update active tab container
    document.querySelectorAll('.main-tab').forEach(tab => tab.classList.remove('active', 'hidden'));
    document.querySelectorAll('.main-tab').forEach(tab => {
        if(tab.id !== `tab-${tabName}`) tab.classList.add('hidden');
    });
    
    const activeTab = document.getElementById(`tab-${tabName}`);
    activeTab.classList.remove('hidden');
    setTimeout(() => activeTab.classList.add('active'), 10);
    
    // Trigger Lazy-load content based on tab
    if(tabName === 'portfolio' && !portfolioDataCache) {
        fetchPortfolioData();
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
    const resultDiv = document.getElementById('result-display');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Analyzing Variables...';
    submitBtn.disabled = true;
    
    resultDiv.innerHTML = '<div class="pulse-icon">⚙️</div><div class="conf-text" style="color:var(--text-main)">Querying ML Model...</div>';
    resultDiv.className = 'result-placeholder';
    
    const payload = {
        ApplicantIncome: parseFloat(document.getElementById('app_income').value),
        CoapplicantIncome: parseFloat(document.getElementById('co_income').value),
        LoanAmount: parseFloat(document.getElementById('loan_amount').value),
        Loan_Amount_Term: parseFloat(document.getElementById('loan_term').value),
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
        
        // Auto-fill the amortization simulator with the applicant's loan details
        document.getElementById('sim_amount').value = document.getElementById('loan_amount').value;
        document.getElementById('sim_term').value = document.getElementById('loan_term').value;

        resultDiv.className = `result-card ${isApproved ? 'approved' : 'rejected'}`;
        const explanation = isApproved 
            ? 'The underwriting algorithm has analyzed the provided financial history and demographic factors. Approval is recommended.'
            : 'The underwriting algorithm detected high-risk indicators based on the provided financial parameters. Rejection is recommended.';
            
        resultDiv.innerHTML = `
            <div class="status-text">${isApproved ? 'APPROVED' : 'REJECTED'}</div>
            <div class="conf-text">Model Confidence: <strong style="color:var(--text-main)">${data.confidence_percentage.toFixed(1)}%</strong></div>
            <div class="explanation">${explanation}</div>
        `;
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
    
    // Common Plotly Layout Rules for Dark Mode
    const layoutBase = {
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Outfit', color: '#0f172a' },
        margin: { t: 20, b: 40, l: 40, r: 20 }
    };

    // Chart 1: Credit History Bar
    const chData = data.reduce((acc, row) => {
        const key = row.CreditHistory === 1.0 ? 'Excellent' : 'Poor';
        if(!acc[key]) acc[key] = { total: 0, approved: 0 };
        acc[key].total++;
        if(row.Loan_Status === 1) acc[key].approved++;
        return acc;
    }, {});
    
    Plotly.newPlot('chart-credit', [{
        x: ['Excellent (1.0)', 'Poor (0.0)'],
        y: [
            (chData['Excellent']?.approved / chData['Excellent']?.total) * 100 || 0,
            (chData['Poor']?.approved / chData['Poor']?.total) * 100 || 0
        ],
        type: 'bar',
        width: 0.4,
        hovertemplate: '%{y:.2f}%<extra></extra>',
        marker: { color: ['#3b82f6', '#f43f5e'] }
    }], {
        ...layoutBase,
        yaxis: { gridcolor: 'rgba(0,0,0,0.1)', range: [0, 100], title: 'Approval Rate (%)' },
        xaxis: { showgrid: false }
    }, {responsive: true});
    
    // Removed Chart 2 (Scatter) as requested
    // Chart 3: Demographics Bar
    // Simplified to Property Area vs Approval Rate
    const propData = data.reduce((acc, row) => {
        let areaLabel = row.PropertyArea;
        if (areaLabel === 0 || areaLabel === '0') areaLabel = 'Rural';
        else if (areaLabel === 1 || areaLabel === '1') areaLabel = 'Semi-Urban';
        else if (areaLabel === 2 || areaLabel === '2') areaLabel = 'Urban';
        
        if(!acc[areaLabel]) acc[areaLabel] = { total: 0, approved: 0 };
        acc[areaLabel].total++;
        if(row.Loan_Status === 1) acc[areaLabel].approved++;
        return acc;
    }, {});
    
    const areas = Object.keys(propData);
    Plotly.newPlot('chart-demo', [{
        x: areas,
        y: areas.map(a => (propData[a].approved / propData[a].total) * 100),
        type: 'bar',
        width: 0.6,
        hovertemplate: '%{y:.2f}%<extra></extra>',
        marker: { color: ['#8b5cf6', '#0ea5e9', '#10b981'] }
    }], {
        ...layoutBase,
        yaxis: { gridcolor: 'rgba(0,0,0,0.1)', range: [0, 100], title: 'Approval Rate (%)' },
        xaxis: { showgrid: false }
    }, {responsive: true});
}

/* ==============================
   AMORTIZATION PLANNER
================================ */
function calculateAmortization() {
    const principal = parseFloat(document.getElementById('sim_amount').value) || 0;
    const termMonths = parseInt(document.getElementById('sim_term').value) || 1;
    const annualRate = parseFloat(document.getElementById('sim_rate').value) || 0;
    
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
    
    const layoutBase = {
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Outfit', color: '#0f172a' },
        margin: { t: 10, b: 30, l: 40, r: 10 }
    };
    
    // Line Chart
    Plotly.newPlot('chart-amort-line', [
        { x: months, y: balances, name: 'Remaining Principal', fill: 'tozeroy', mode: 'lines', line: {color: '#6366f1'} },
        { x: months, y: cumInterests, name: 'Cumulative Interest', mode: 'lines', line: {color: '#ef4444'} }
    ], {
        ...layoutBase,
        xaxis: { showgrid: false },
        yaxis: { gridcolor: 'rgba(0,0,0,0.1)' },
        legend: { orientation: 'h', y: 1.1, x: 0 }
    }, {responsive: true});
    
    // Pie Chart
    Plotly.newPlot('chart-amort-pie', [{
        labels: ['Principal', 'Total Interest'],
        values: [principal, totalInterest],
        type: 'pie',
        hole: 0.4,
        marker: { colors: ['#6366f1', '#ef4444'] },
        textinfo: 'none'
    }], {
        ...layoutBase,
        margin: { t: 0, b: 0, l: 0, r: 0 },
        legend: { orientation: 'h', y: 0, x: 0 }
    }, {responsive: true});
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
                ${!u.is_master ? `
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

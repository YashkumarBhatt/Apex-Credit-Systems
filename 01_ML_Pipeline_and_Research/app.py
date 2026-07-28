# -*- coding: utf-8 -*-
import streamlit as st
import pandas as pd
import numpy as np
import joblib
import plotly.express as px
import plotly.graph_objects as go
import os

# ==========================================
# 1. PAGE SETUP & STYLING
# ==========================================
st.set_page_config(
    page_title="Apex Loan Systems | Dual-Track Engine", 
    page_icon="🏦", 
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS injection
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
        color: #334155;
    }
    
    .title-container {
        padding: 2rem;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 249, 255, 0.95) 100%);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.05);
        border-radius: 20px;
        margin-bottom: 2rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }
    .gradient-title {
        background: linear-gradient(90deg, #4f46e5 0%, #9333ea 50%, #db2777 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.8rem;
        font-weight: 700;
        margin: 0;
    }
    .subtitle {
        color: #475569;
        font-size: 1.1rem;
        margin-top: 0.5rem;
        font-weight: 300;
    }
    
    .glass-card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(16px);
        border-radius: 16px;
        padding: 1.8rem;
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
        margin-bottom: 1.5rem;
    }
    
    .track-badge {
        display: inline-block;
        padding: 0.4rem 1rem;
        border-radius: 50px;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }
    .track-prime { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .track-thin { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
    
    .result-card {
        padding: 2rem;
        border-radius: 16px;
        margin-top: 1.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
    }
    .result-approved { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .result-conditional { background: #fefce8; border: 1px solid #fef08a; }
    .result-counter { background: #eff6ff; border: 1px solid #bfdbfe; }
    .result-rejected { background: #fef2f2; border: 1px solid #fecaca; }
    
    .live-metric-box {
        background: rgba(248, 250, 252, 0.8);
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid #e2e8f0;
        text-align: center;
    }
    .live-metric-value { font-size: 1.6rem; font-weight: 700; }
    .live-metric-label { font-size: 0.85rem; color: #64748b; font-weight: 500; }
    </style>
    """,
    unsafe_allow_html=True
)

# ==========================================
# 2. DATA & MODEL CACHING
# ==========================================
@st.cache_resource
def load_ml_pipelines():
    try:
        base_path = os.path.dirname(__file__)
        prep_prime = joblib.load(os.path.join(base_path, 'loan_preprocessor.joblib'))
        model_prime = joblib.load(os.path.join(base_path, 'loan_rf_model.joblib'))
        
        prep_thin = joblib.load(os.path.join(base_path, 'loan_thinfile_preprocessor.joblib'))
        model_thin = joblib.load(os.path.join(base_path, 'loan_thinfile_rf_model.joblib'))
        return prep_prime, model_prime, prep_thin, model_thin
    except Exception as e:
        st.error(f"Failed to load Dual-Track machine learning artifacts: {e}")
        return None, None, None, None

@st.cache_data
def load_historical_data():
    try:
        base_path = os.path.dirname(__file__)
        return pd.read_csv(os.path.join(base_path, 'loan_approval.csv'))
    except Exception as e:
        st.error(f"Failed to load historical dataset: {e}")
        return None

prep_prime, model_prime, prep_thin, model_thin = load_ml_pipelines()
historical_data = load_historical_data()

# ==========================================
# 3. APP HEADER
# ==========================================
st.markdown(
    """
    <div class="title-container">
        <h1 class="gradient-title">APEX CREDIT SYSTEMS (Dual-Track Architecture)</h1>
        <p class="subtitle">🏦 Risk-Segmented Underwriting & Thin-File Alternative Decision Engine</p>
    </div>
    """,
    unsafe_allow_html=True
)

tab_eligibility, tab_dashboard, tab_calculator = st.tabs([
    "🏦 Eligibility Engine", 
    "📊 Portfolio Dashboard", 
    "🧮 Amortization Planner"
])

# ==========================================
# TAB 1: ELIGIBILITY ENGINE
# ==========================================
with tab_eligibility:
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
    st.markdown("### Applicant Underwriting Intake")
    
    col_pers, col_fin, col_req = st.columns(3)
    
    with col_pers:
        st.write("### 👤 Personal Profile")
        education = st.selectbox("Education Status", ["Graduate", "Not Graduate"])
        marital_status = st.selectbox("Marital Status", ["Married", "Single"])
        dependents = st.selectbox("Number of Dependents", ["0", "1", "2", "3+"])
        property_area = st.selectbox("Property Location", ["Urban", "Semiurban", "Rural"])

    with col_fin:
        st.write("### 💼 Financial Standing")
        employment_type = st.selectbox("Employment Class", ["Salaried", "Self Employed"])
        applicant_income = st.number_input("Applicant Income ($)", min_value=0, value=75000, step=2500)
        coapplicant_income = st.number_input("Coapplicant Income ($)", min_value=0, value=0, step=2500)

    with col_req:
        st.write("### 📋 Loan Request & Bureau Data")
        loan_amount = st.number_input("Requested Loan Amount ($)", min_value=1000, value=150000, step=5000)
        loan_amount_term = st.selectbox("Loan Term (Months)", [12, 36, 60, 84, 120, 180, 240, 300, 360, 480], index=8)
        credit_history_mapped = st.selectbox("Credit History Status", ["Good Credit History (1.0)", "No / Poor Credit History (0.0)"])
        credit_history = 1.0 if "1.0" in credit_history_mapped else 0.0

    st.markdown('</div>', unsafe_allow_html=True)
    
    # Pre-Underwriting Real-Time Indicators
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)
    st.write("### ⚡ Live Pre-Underwriting Financial Ratios")
    
    total_annual_income = applicant_income + coapplicant_income
    total_monthly_income = (total_annual_income / 12.0) if total_annual_income > 0 else 1.0
    
    annual_rate = 0.075
    monthly_rate = annual_rate / 12.0
    num_payments = loan_amount_term if loan_amount_term > 0 else 360
    
    monthly_installment = loan_amount * (monthly_rate * (1 + monthly_rate)**num_payments) / (((1 + monthly_rate)**num_payments) - 1)
    dti_ratio = (monthly_installment / total_monthly_income) * 100
    lti_ratio = loan_amount / total_annual_income if total_annual_income > 0 else 99.0
    
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.markdown(f'<div class="live-metric-box"><div class="live-metric-value">${monthly_installment:,.2f}</div><div class="live-metric-label">Monthly Payment (Est. 7.5%)</div></div>', unsafe_allow_html=True)
    with m2:
        st.markdown(f'<div class="live-metric-box"><div class="live-metric-value">${total_annual_income:,.0f}</div><div class="live-metric-label">Total Combined Income</div></div>', unsafe_allow_html=True)
    with m3:
        st.markdown(f'<div class="live-metric-box"><div class="live-metric-value">{dti_ratio:.1f}%</div><div class="live-metric-label">Debt-to-Income (DTI)</div></div>', unsafe_allow_html=True)
    with m4:
        st.markdown(f'<div class="live-metric-box"><div class="live-metric-value">{lti_ratio:.2f}x</div><div class="live-metric-label">Loan-to-Income (LTI)</div></div>', unsafe_allow_html=True)
        
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Evaluate Button
    trigger_predict = st.button("Execute Dual-Track Decision Engine", type="primary", use_container_width=True)
    
    if trigger_predict:
        if prep_prime is None or model_prime is None:
            st.error("Engine failure: Models not loaded.")
        else:
            input_dict = {
                'ApplicantIncome': applicant_income,
                'CoapplicantIncome': coapplicant_income,
                'LoanAmount': loan_amount,
                'Loan_Amount_Term': loan_amount_term,
                'CreditHistory': credit_history,
                'Education': education,
                'EmploymentType': employment_type,
                'MaritalStatus': marital_status,
                'Dependents': dependents,
                'PropertyArea': property_area
            }
            input_df = pd.DataFrame([input_dict])
            
            if credit_history == 1.0:
                # TRACK 1: PRIME ROUTE
                st.markdown('<div class="track-badge track-prime">🔵 TRACK 1: STANDARD PRIME UNDERWRITING ROUTE</div>', unsafe_allow_html=True)
                X_p = prep_prime.transform(input_df)
                pred = model_prime.predict(X_p)[0]
                prob = model_prime.predict_proba(X_p)[0][1] if pred == 1 else model_prime.predict_proba(X_p)[0][0]
                conf = prob * 100
                
                if pred == 1:
                    st.markdown(
                        f"""
                        <div class="result-card result-approved">
                            <h3>✅ TIER 1: STANDARD LOAN APPROVAL</h3>
                            <p>Profile meets standard credit history and income parameters with a confidence score of <strong>{conf:.1f}%</strong>.</p>
                        </div>
                        """, unsafe_allow_html=True
                    )
                else:
                    st.markdown(
                        f"""
                        <div class="result-card result-rejected">
                            <h3>⚠️ STANDARD LOAN REJECTION</h3>
                            <p>Profile rejected based on primary credit history risk metrics with <strong>{conf:.1f}%</strong> confidence.</p>
                        </div>
                        """, unsafe_allow_html=True
                    )
            else:
                # TRACK 2: THIN-FILE ALTERNATIVE ROUTE
                st.markdown('<div class="track-badge track-thin">🟣 TRACK 2: THIN-FILE ALTERNATIVE CAPACITY ROUTE</div>', unsafe_allow_html=True)
                X_t = prep_thin.transform(input_df)
                prob_cap = model_thin.predict_proba(X_t)[0][1] * 100
                
                if prob_cap >= 60.0 and lti_ratio <= 3.5:
                    # Tier 2A: Conditional Approval
                    st.markdown(
                        f"""
                        <div class="result-card result-conditional">
                            <h3>🟡 TIER 2A: CONDITIONAL APPROVAL (THIN-FILE ROUTE)</h3>
                            <p>High repayment capacity detected despite zero credit history (Financial Capacity Score: <strong>{prob_cap:.1f}%</strong>).</p>
                            <hr/>
                            <h4>Mandatory Underwriting Conditions:</h4>
                            <ul>
                                <li><strong>Co-Signer Required:</strong> Application must include a qualified co-signer with credit history >= 1.0.</li>
                                <li><strong>Interest Rate Risk Premium:</strong> +1.50% added to base rate.</li>
                                <li><strong>Income Verification:</strong> 12 months of consecutive pay stubs required.</li>
                            </ul>
                        </div>
                        """, unsafe_allow_html=True
                    )
                elif prob_cap >= 40.0:
                    # Tier 2B: Counter-Offer
                    rec_max_loan = round((total_annual_income * 2.5) / 5000) * 5000
                    if rec_max_loan < 10000: rec_max_loan = 10000
                    st.markdown(
                        f"""
                        <div class="result-card result-counter">
                            <h3>🔵 TIER 2B: COUNTER-OFFER PROPOSED</h3>
                            <p>Requested loan of <strong>${loan_amount:,.0f}</strong> exceeds threshold for un-vetted credit profiles.</p>
                            <hr/>
                            <h4>Pre-Approved Counter-Offer:</h4>
                            <p style="font-size: 1.4rem; font-weight: 700; color: #2563eb;">Pre-Approved Loan Amount: ${rec_max_loan:,.0f}</p>
                            <p>Applicant qualifies for a maximum threshold of $${rec_max_loan:,.0f} based on income capacity score ({prob_cap:.1f}%).</p>
                        </div>
                        """, unsafe_allow_html=True
                    )
                else:
                    # Tier 2C: Rejection
                    st.markdown(
                        f"""
                        <div class="result-card result-rejected">
                            <h3>⚠️ TIER 2C: OUTRIGHT REJECTION (HIGH FINANCIAL RISK)</h3>
                            <p>Zero credit history combined with insufficient financial debt service capacity ({100-prob_cap:.1f}% rejection probability).</p>
                        </div>
                        """, unsafe_allow_html=True
                    )

# ==========================================
# TAB 2 & 3: DASHBOARD & CALCULATOR
# ==========================================
with tab_dashboard:
    st.markdown("### Portfolio Distribution Dashboard")
    if historical_data is not None:
        c1, c2 = st.columns(2)
        with c1:
            fig_hist = px.histogram(historical_data, x="ApplicantIncome", color="Loan_Status", barmode="overlay", title="Income vs Approval Status")
            st.plotly_chart(fig_hist, use_container_width=True)
        with c2:
            fig_cred = px.histogram(historical_data, x="CreditHistory", color="Loan_Status", barmode="group", title="Credit History vs Approval")
            st.plotly_chart(fig_cred, use_container_width=True)

with tab_calculator:
    st.markdown("### Loan Amortization Simulator")
    p_calc = loan_amount
    r_calc = 0.075 / 12
    n_calc = loan_amount_term
    m_pmt = p_calc * (r_calc * (1 + r_calc)**n_calc) / (((1 + r_calc)**n_calc) - 1)
    st.metric("Estimated Monthly Installment", f"${m_pmt:,.2f}")

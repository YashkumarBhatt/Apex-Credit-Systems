# Apex Loan Underwriting & Portfolio Decision Engine

**Apex Loan Underwriting Engine** is a robust, full-stack machine learning web application that predicts loan approval probabilities based on applicant demographics, financial standing, credit history, and requested loan terms. 

It combines a high-performance **Random Forest Classifier (RFC)** decision pipeline with a modern Glassmorphism UI, real-time database portfolio analytics, an interactive amortization simulator, JWT authentication, and an administrative control panel.

---

## 🌟 Key Features

* **AI-Powered Eligibility Engine:** Uses an ensemble **Random Forest Classifier** (`loan_rf_model.joblib`) and a scikit-learn `ColumnTransformer` preprocessor (`loan_preprocessor.joblib`) to provide instant approval recommendations and calibrated confidence scores.
* **Real-Time Database & Portfolio Merging:** Every applicant loan evaluation submitted via `/predict` is automatically persisted in the database (`PredictionHistory`). The portfolio analytics endpoint (`/portfolio-data`) dynamically merges baseline historical data (`loan_approval.csv`) with live database entries in real time.
* **Glassmorphism Web UI:** Built with pure HTML5, CSS3, and Vanilla JavaScript, featuring dark mode glassmorphism styling, responsive controls, live DTI/LTI ratio calculators, and subtle micro-animations.
* **Amortization Repayment Simulator:** Instantly projects complete loan repayment schedules (monthly principal, interest, cumulative balance) with visual trajectories.
* **Portfolio Analytics Dashboards:** Interactive `Plotly.js` charts visualizing credit history impact, income vs. loan amount clusters, property area acceptance rates, and demographic distributions.
* **JWT Authentication & Session Security:** Secure JSON Web Token (JWT) login system with encrypted bcrypt password hashing, IP session tracking (`UserSession`), and user account suspension capabilities.
* **Master Admin Control & CSV Reporting:** Master administrators can monitor live portfolio metrics, suspend/activate user accounts, manage admin privileges, and export comprehensive CSV audit reports (`/export/my-history`, `/admin/export/users`, `/admin/export/predictions`, `/admin/export/sessions`).

---

## 🛠️ Technology Stack

* **Backend:** Python, FastAPI, Uvicorn, SQLAlchemy ORM
* **Database:** SQLite (Local Default) / PostgreSQL (Render Production)
* **Machine Learning:** Scikit-Learn (Random Forest), Pandas, NumPy, Joblib
* **Frontend:** HTML5, Vanilla JavaScript (ES6+), CSS3 (Glassmorphism Design System)
* **Data Visualization:** Plotly.js
* **Security:** JWT (`python-jose`), Passlib (bcrypt), OAuth2 Bearer Tokens

---

## 📂 Project Structure

```text
02_Production_Web_App/
├── main.py                     # FastAPI application routes, ML inference & real-time DB merging
├── models.py                   # SQLAlchemy database models (Users, Predictions, Sessions)
├── database.py                 # DB connection setup (SQLite local fallback / PostgreSQL production)
├── auth.py                     # JWT token generation, password hashing & security helpers
├── create_master.py            # CLI script to create or update Master Admin accounts
├── apex_loan_systems.db        # Local SQLite application database
├── loan_rf_model.joblib        # Pre-trained Random Forest Classifier model
├── loan_preprocessor.joblib    # Serialized scikit-learn ColumnTransformer preprocessor
├── loan_approval.csv           # Baseline historical dataset for portfolio analytics
├── static/
│   ├── index.html              # Single-page web application UI
│   ├── style.css               # Design system & glassmorphism styling
│   └── app.js                  # Frontend logic, Plotly charts & API integrations
├── .env.example                # Sample environment configuration file
├── requirements.txt            # Production Python package dependencies
└── README.md                   # Project documentation
```

---

## 🚀 Local Development Setup

To run the application locally on your machine:

**1. Clone the repository & navigate to the production app folder:**
```bash
git clone https://github.com/YashkumarBhatt/Loan-Approval-App.git
cd Loan-Approval-App
```

**2. Create a virtual environment and install dependencies:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**3. Run the FastAPI development server:**
*(By default, the app uses local SQLite `apex_loan_systems.db` out of the box)*
```bash
uvicorn main:app --reload
```

**4. Access the web application:**
Open your browser and navigate to `http://127.0.0.1:8000`

---

## 🛡️ Master Admin Account Setup

To initialize or manage a Master Admin user:

```bash
python create_master.py
```

This interactive script allows you to create a new Master Admin or upgrade an existing user account to Master Admin privileges. Once logged in as a Master Admin, the **Admin Dashboard** tab will automatically unlock in the web UI.

---

## ☁️ Production Deployment (Render)

This project is configured for seamless deployment on **Render** as a Web Service:

1. Connect this GitHub repository (`https://github.com/YashkumarBhatt/Loan-Approval-App`) to Render.
2. Set the **Build Command**: `pip install -r requirements.txt`
3. Set the **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. *(Optional)* Add a `DATABASE_URL` environment variable under Render's Environment settings if connecting to a hosted PostgreSQL instance.

---
*Developed as an end-to-end intelligent underwriting and portfolio decision platform.*

# Apex Loan Underwriting Engine

Apex Loan Underwriting Engine is a robust, full-stack machine learning web application that predicts loan approval probabilities based on applicant demographics, credit history, and income data. It features a modern Glassmorphism UI, interactive data visualizations, an amortization calculator, and a secure master admin dashboard.

## 🌟 Key Features

* **AI-Powered Eligibility Engine:** Uses a pre-trained Scikit-Learn Decision Tree model to predict whether an applicant will be approved for a loan, along with an algorithm confidence score.
* **Modern & Responsive UI:** Built with pure HTML/CSS/JS, featuring a premium glassmorphism design, dynamic micro-animations, and a sleek dark theme.
* **Amortization Simulator:** Instantly generates a complete repayment schedule (monthly principal, interest, and remaining balance) based on loan details.
* **Portfolio Analytics:** Interactive `Plotly.js` dashboards visualizing credit history impact and demographic acceptance matrices.
* **Secure Authentication System:** JSON Web Token (JWT) based login system with encrypted password hashing.
* **Master Admin Controls:** Administrators can track live metrics, suspend/delete users, and export comprehensive CSV reports (Prediction History, User Accounts, Active Sessions).

## 🛠️ Technology Stack

* **Backend:** Python, FastAPI, Uvicorn
* **Database:** PostgreSQL (hosted on Render), SQLAlchemy ORM
* **Machine Learning:** Scikit-Learn, Pandas, Joblib
* **Frontend:** HTML5, Vanilla JavaScript, CSS3
* **Data Visualization:** Plotly.js

## 📂 Project Structure

```text
├── main.py                     # FastAPI application entry point and API routes
├── models.py                   # SQLAlchemy database schemas and models
├── database.py                 # PostgreSQL connection setup
├── auth.py                     # JWT authentication and password hashing logic
├── loan_tree_model.joblib      # Serialized ML model
├── loan_preprocessor.joblib    # Serialized ML data preprocessor
├── loan_approval.csv           # Historical dataset for Portfolio Analytics
├── static/
│   ├── index.html              # Frontend user interface
│   ├── style.css               # Design system and glassmorphism styling
│   └── app.js                  # Frontend logic and API integration
└── README.md                   # Project documentation
```

## 🚀 Local Development Setup

To run this project locally on your machine:

**1. Clone the repository:**
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

**2. Create a virtual environment and install dependencies:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy pandas scikit-learn joblib python-jose passlib bcrypt
```

**3. Run the development server:**
You must provide a `DATABASE_URL` environment variable for the PostgreSQL connection.
```bash
DATABASE_URL="postgresql://username:password@hostname/dbname" uvicorn main:app --reload
```

**4. Access the application:**
Open your browser and navigate to `http://127.0.0.1:8000`

## ☁️ Deployment (Render)

This application is designed to be easily deployed on **Render** as a Web Service.
1. Connect this GitHub repository to Render.
2. Set the Build Command: `pip install -r requirements.txt` *(Make sure to generate a `requirements.txt` file first)*.
3. Set the Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. In Render's Environment Variables, add your `DATABASE_URL`.

## 🛡️ Admin Access

When creating a new deployment, the default registered users will be standard users. To promote a user to a Master Admin, you must manually update the `is_master` boolean in your PostgreSQL database to `true` for that specific user ID.

Once granted, the Master Admin panel will automatically unlock in the UI.

---
*Built as a state-of-the-art fintech demonstration.*

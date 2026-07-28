# Apex Loan Systems: Analytics & Eligibility Engine

## Overview
This application serves as an intelligent underwriting and portfolio decision engine. It is a comprehensive suite designed to evaluate loan applicants, analyze historical portfolio data, and simulate financial repayment schedules.

## How it Works
The application is divided into three main tabs:
1. **Eligibility Engine (Underwriting Intake):** Evaluates an applicant's personal profile, financial standing, and loan request. It provides live pre-underwriting indicators (like DTI and LTI ratios) and executes a decision pipeline to approve or reject the application with a confidence score. If rejected, it offers actionable risk mitigation recommendations.
2. **Portfolio Dashboard:** Analyzes a historical database of applications (`loan_approval.csv`). It displays key performance indicators (KPIs) and interactive charts highlighting the impact of credit history, income vs. loan amount clusters, and demographic acceptance rates.
3. **Amortization Planner:** A financial repayment simulator that projects monthly installments, total interest, and principal paid over the loan term, complete with visual balance trajectories.

## Potential Use Cases
- **Banking & Credit Institutions:** Automating preliminary loan approvals and providing underwriters with algorithmic recommendations and risk flags.
- **Financial Advisors & Mortgage Brokers:** Helping clients understand their borrowing capacity, visualize amortization schedules, and see how improving their credit score impacts their approval odds.

## Machine Learning Model
- **Algorithm:** Tree-based Classification Model (loaded via `loan_tree_model.joblib`).
- **Pipeline Setup:** The input data passes through a dedicated preprocessor (`loan_preprocessor.joblib`) to encode categorical variables (e.g., Education, Property Area, Employment Type) and scale numerical features before reaching the model.
- **Output:** Provides both a binary decision (Approved/Rejected) and a probabilistic confidence score.

## Libraries Used
- `streamlit` (Web framework)
- `pandas` & `numpy` (Data manipulation)
- `joblib` (Model loading)
- `plotly` (`express` and `graph_objects` for interactive data visualization)
- `scikit-learn` (Machine learning preprocessing and inference)

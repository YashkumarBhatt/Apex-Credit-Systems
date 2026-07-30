from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from pydantic import BaseModel
import joblib
import pandas as pd
import os
import io
import re
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import text

# Import our custom modules
import models
from database import engine, get_db, SessionLocal
import auth

# Create database tables
models.Base.metadata.create_all(bind=engine)

def auto_migrate_db():
    db = SessionLocal()
    try:
        # PostgreSQL / SQLite auto-schema alteration for newly added columns
        migration_sqls = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP WITH TIME ZONE;"
        ]
        for query in migration_sqls:
            try:
                db.execute(text(query))
                db.commit()
            except Exception as err:
                db.rollback()
                # SQLite fallback
                try:
                    alt_query = query.replace("IF NOT EXISTS ", "")
                    db.execute(text(alt_query))
                    db.commit()
                except Exception:
                    db.rollback()
    finally:
        db.close()

auto_migrate_db()

# --- Secure Master Admin Initialization ---
MASTER_USERNAME = os.getenv("MASTER_USERNAME", "")
MASTER_PASSWORD = os.getenv("MASTER_PASSWORD", "")

def init_master_admin():
    if not MASTER_USERNAME or not MASTER_PASSWORD:
        return
    db = SessionLocal()
    try:
        admin_user = db.query(models.User).filter(models.User.username == MASTER_USERNAME).first()
        if not admin_user:
            hashed = auth.get_password_hash(MASTER_PASSWORD)
            new_admin = models.User(username=MASTER_USERNAME, hashed_password=hashed, is_master=True)
            db.add(new_admin)
            db.commit()
        else:
            admin_user.hashed_password = auth.get_password_hash(MASTER_PASSWORD)
            admin_user.is_master = True
            db.commit()
        
        # Erase non-master analyst accounts as requested, clearing foreign key references first
        non_master_users = db.query(models.User).filter(models.User.is_master == False).all()
        if non_master_users:
            non_master_ids = [u.id for u in non_master_users]
            db.query(models.UserSession).filter(models.UserSession.user_id.in_(non_master_ids)).delete(synchronize_session=False)
            db.query(models.PredictionHistory).filter(models.PredictionHistory.user_id.in_(non_master_ids)).delete(synchronize_session=False)
            db.query(models.User).filter(models.User.is_master == False).delete(synchronize_session=False)
            db.commit()
    finally:
        db.close()

init_master_admin()
# -------------------------------------------

app = FastAPI(title="Apex Loan Approval API", version="1.0.0")

@app.middleware("http")
async def add_no_cache_header(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Mount Static Files for frontend
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.api_route("/download-apk", methods=["GET", "HEAD"])
def download_apk(request: Request):
    apk_path = os.path.join(os.path.dirname(__file__), "apex-credit-app.apk")
    if os.path.exists(apk_path):
        return FileResponse(
            apk_path,
            media_type="application/vnd.android.package-archive",
            filename="apex-credit-app.apk"
        )
    return RedirectResponse(
        url="https://github.com/YashkumarBhatt/Apex-Credit-Systems/releases/download/v1.0.0/apex-credit-app.apk",
        status_code=302
    )

@app.api_route("/download-native-apk", methods=["GET", "HEAD"])
def download_native_apk(request: Request):
    return RedirectResponse(
        url="https://github.com/YashkumarBhatt/Apex-Credit-Systems/releases/download/v1.1.0/Apex_Credit_Systems.apk",
        status_code=302
    )




# Security schema
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Disposable Email Domains Filter
DISPOSABLE_DOMAINS = {
    "tempmail.com", "mailinator.com", "guerrillamail.com", "10minutemail.com",
    "trashmail.com", "dispostable.com", "yopmail.com", "getnada.com", "sharklasers.com",
    "throwawaymail.com", "temp-mail.org", "fakeinbox.com", "maildrop.cc", "crazymailing.com",
    "mytemp.email", "mohmal.com", "inboxalias.com", "generator.email", "tempmail.net",
    "byom.de", "mailnesia.com", "dropmail.me"
}

def validate_professional_email(email_str: Optional[str]):
    if not email_str or not email_str.strip():
        raise HTTPException(status_code=400, detail="A professional email address is required for registration.")
    clean_email = email_str.strip().lower()
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", clean_email):
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    domain = clean_email.split("@")[-1]
    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Registration with temporary email domain '@{domain}' is strictly prohibited. Please use a professional email address.")
    return clean_email

# Load Machine Learning Models
base_path = os.path.dirname(__file__)
try:
    preprocessor = joblib.load(os.path.join(base_path, 'loan_preprocessor.joblib'))
    model = joblib.load(os.path.join(base_path, 'loan_rf_model.joblib'))
    
    preprocessor_thin = joblib.load(os.path.join(base_path, 'loan_thinfile_preprocessor.joblib'))
    model_thin = joblib.load(os.path.join(base_path, 'loan_thinfile_rf_model.joblib'))
    print("Dual-Track Models loaded successfully.")
except Exception as e:
    print(f"Error loading models: {e}")
    preprocessor = None
    model = None
    preprocessor_thin = None
    model_thin = None

# Pydantic Schemas
class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str


class LoanApplication(BaseModel):
    ApplicantIncome: float
    CoapplicantIncome: float
    LoanAmount: float
    Loan_Amount_Term: float
    CreditHistory: float
    Education: str
    EmploymentType: str
    MaritalStatus: str
    Dependents: str
    PropertyArea: str

class LogoutRequest(BaseModel):
    session_id: int

# Dependency to verify the user's token (supports both Header and Query Parameter)
def get_token_from_request(request: Request):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    
    query_token = request.query_params.get("token")
    if query_token:
        return query_token
        
    raise HTTPException(status_code=401, detail="Not authenticated")

def get_current_user(token: str = Depends(get_token_from_request), db: Session = Depends(get_db)):
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except auth.jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account has been suspended by Master Admin")
    return user

def generate_csv_response(df, filename):
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response

@app.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    clean_email = validate_professional_email(user.email)
    existing_email = db.query(models.User).filter(models.User.email == clean_email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email address is already registered to another account")
    
    pwd = user.password
    if len(pwd) < 8 or not re.search(r"[A-Z]", pwd) or not re.search(r"[a-z]", pwd) or not re.search(r"[0-9]", pwd) or not re.search(r"[^A-Za-z0-9]", pwd) or pwd == user.username:
        raise HTTPException(status_code=400, detail="Password does not meet security requirements.")
    
    hashed_password = auth.get_password_hash(user.password)
    # New users are NEVER masters by default
    new_user = models.User(username=user.username, email=clean_email, hashed_password=hashed_password, is_master=False)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/login")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if getattr(user, 'is_active', True) is False:
        raise HTTPException(status_code=403, detail="Your account has been suspended by an administrator.")
    
    # Session Tracking
    ip_addr = request.client.host if request.client else "Unknown"
    session_record = models.UserSession(user_id=user.id, ip_address=ip_addr)
    db.add(session_record)
    db.commit()
    db.refresh(session_record)
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "is_master": user.is_master,
        "session_id": session_record.id
    }

@app.post("/logout")
def logout(logout_req: LogoutRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    session_record = db.query(models.UserSession).filter(
        models.UserSession.id == logout_req.session_id, 
        models.UserSession.user_id == current_user.id
    ).first()
    
    if session_record:
        session_record.logout_time = func.now()
        db.commit()
    return {"message": "Logged out securely"}

def compute_key_factors(app_data):
    factors = []
    total_income = app_data.ApplicantIncome + app_data.CoapplicantIncome
    literal_loan = app_data.LoanAmount * 1000 if app_data.LoanAmount < 1000 else app_data.LoanAmount
    monthly_inc = (total_income / 12) if total_income > 0 else 1
    term_months = app_data.Loan_Amount_Term if app_data.Loan_Amount_Term > 0 else 360
    monthly_emi = literal_loan / term_months
    dti_percent = round((monthly_emi / monthly_inc) * 100, 1)

    if app_data.CreditHistory == 1.0:
        factors.append({"factor": "Verified Positive Credit Bureau History", "impact": "+35%", "type": "positive"})
    else:
        factors.append({"factor": "Unestablished / Poor Credit History File", "impact": "-30%", "type": "negative"})

    if total_income >= 10000:
        factors.append({"factor": f"High Household Monthly Income (₹{total_income:,.0f})", "impact": "+25%", "type": "positive"})
    elif total_income >= 5000:
        factors.append({"factor": f"Moderate Household Income (₹{total_income:,.0f})", "impact": "+15%", "type": "positive"})
    else:
        factors.append({"factor": f"Low Total Monthly Income (₹{total_income:,.0f})", "impact": "-20%", "type": "negative"})

    if dti_percent <= 20:
        factors.append({"factor": f"Low Debt Service Ratio ({dti_percent}% DTI)", "impact": "+20%", "type": "positive"})
    elif dti_percent <= 35:
        factors.append({"factor": f"Moderate Debt Burden ({dti_percent}% DTI)", "impact": "-15%", "type": "negative"})
    else:
        factors.append({"factor": f"High Repayment Burden ({dti_percent}% DTI)", "impact": "-30%", "type": "negative"})

    if app_data.PropertyArea in ["Semiurban", "Urban"]:
        factors.append({"factor": f"Prime Property Location ({app_data.PropertyArea} Area)", "impact": "+10%", "type": "positive"})
    else:
        factors.append({"factor": "Rural Property Location Haircut", "impact": "-10%", "type": "negative"})

    return factors

@app.post("/predict")
def predict_loan(application: LoanApplication, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if preprocessor is None or model is None or preprocessor_thin is None or model_thin is None:
        raise HTTPException(status_code=500, detail="Dual-Track Models not loaded on server.")
    
    try:
        input_dict = application.model_dump()
    except AttributeError:
        input_dict = application.dict() 
        
    input_df = pd.DataFrame([input_dict])
    
    try:
        credit_hist = application.CreditHistory
        total_income = application.ApplicantIncome + application.CoapplicantIncome
        lti = application.LoanAmount / (total_income if total_income > 0 else 1)
        
        track = ""
        tier = ""
        status = ""
        confidence_percentage = 0.0
        conditions = []
        counter_offer_amount = None
        actionable_notes = ""
        prediction_val = 0
        
        if credit_hist == 1.0:
            # TRACK 1: ESTABLISHED CREDIT TRACK
            track = "Established Credit Track"
            transformed_data = preprocessor.transform(input_df)
            prediction_val = int(model.predict(transformed_data)[0])
            probabilities = model.predict_proba(transformed_data)[0]
            conf = probabilities[1] if prediction_val == 1 else probabilities[0]
            confidence_percentage = round(float(conf) * 100, 2)
            
            if prediction_val == 1:
                status = "Approved"
                tier = "Tier 1 - Standard Approval"
                actionable_notes = "Meets established credit guidelines."
            else:
                status = "Rejected"
                tier = "Standard Rejection"
                actionable_notes = "Does not meet standard credit history criteria."
        else:
            # TRACK 2: INCOME-BASED CAPACITY TRACK
            track = "Income-Based Capacity Track"
            transformed_thin = preprocessor_thin.transform(input_df)
            prob_cap = float(model_thin.predict_proba(transformed_thin)[0][1])
            
            if prob_cap >= 0.60 and lti <= 3.5:
                prediction_val = 1
                status = "Conditional Approval"
                tier = "Tier 2A - Conditional Approval"
                confidence_percentage = round(prob_cap * 100, 2)
                conditions = [
                    "Mandatory Guarantor / Co-signer required",
                    "Interest Rate Risk Premium: +1.50%",
                    "12-Month consecutive income proof required"
                ]
                actionable_notes = "High repayment capacity detected despite zero credit history."
            elif prob_cap >= 0.40:
                prediction_val = 1
                status = "Counter-Offer Proposed"
                tier = "Tier 2B - Counter-Offer Proposed"
                confidence_percentage = round(prob_cap * 100, 2)
                literal_req_loan = float(application.LoanAmount * 1000 if application.LoanAmount < 1000 else application.LoanAmount)
                
                # Calculate Max Capacity based on Total Income (2.5x total monthly income)
                max_income_capacity = round((total_income * 2.5) / 5000) * 5000
                if max_income_capacity < 10000:
                    max_income_capacity = 10000
                    
                # Enforce strict banking rule: Counter-Offer MUST BE <= Requested Loan
                if literal_req_loan > max_income_capacity:
                    # Case A: Requested loan exceeds income capacity threshold
                    counter_offer_amount = max_income_capacity
                    conditions = [f"Loan request adjusted to income capacity threshold of ₹{counter_offer_amount:,.0f}"]
                    actionable_notes = f"Requested ₹{literal_req_loan:,.0f} exceeds capacity threshold of ₹{max_income_capacity:,.0f}. Pre-approved for ₹{counter_offer_amount:,.0f}."
                else:
                    # Case B: Requested loan is within max capacity, but thin-file risk requires haircut
                    risk_haircut_factor = max(0.50, min(0.80, prob_cap))
                    recommended_reduced = round((literal_req_loan * risk_haircut_factor) / 1000) * 1000
                    if recommended_reduced >= literal_req_loan:
                        recommended_reduced = round((literal_req_loan * 0.75) / 1000) * 1000
                    if recommended_reduced < 5000:
                        recommended_reduced = 5000
                    counter_offer_amount = recommended_reduced
                    conditions = [f"Loan request adjusted for thin-file risk rating ({confidence_percentage}%)"]
                    actionable_notes = f"Requested ₹{literal_req_loan:,.0f} adjusted for risk profile. Pre-approved for ₹{counter_offer_amount:,.0f}."
            else:
                prediction_val = 0
                status = "Rejected"
                tier = "Tier 2C - High Financial Risk"
                confidence_percentage = round((1 - prob_cap) * 100, 2)
                actionable_notes = "Insufficient income and repayment capacity for requested loan amount."
        
        history_entry = models.PredictionHistory(
            user_id=current_user.id,
            applicant_income=application.ApplicantIncome,
            coapplicant_income=application.CoapplicantIncome,
            loan_amount=application.LoanAmount,
            loan_amount_term=application.Loan_Amount_Term,
            credit_history=application.CreditHistory,
            education=application.Education,
            employment_type=application.EmploymentType,
            marital_status=application.MaritalStatus,
            dependents=application.Dependents,
            property_area=application.PropertyArea,
            prediction_result=status,
            confidence_score=confidence_percentage
        )
        db.add(history_entry)
        db.commit()
        
        key_factors = compute_key_factors(application)

        return {
            "prediction": prediction_val,
            "confidence_percentage": confidence_percentage,
            "status": status,
            "track": track,
            "tier": tier,
            "conditions": conditions,
            "counter_offer_amount": counter_offer_amount,
            "actionable_notes": actionable_notes,
            "key_factors": key_factors,
            "logged_to_database": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/portfolio-data")
def get_portfolio_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Load baseline CSV
        df = pd.read_csv("loan_approval.csv")
        
        # Load DB predictions
        history = db.query(models.PredictionHistory).all()
        if history:
            db_data = []
            for h in history:
                db_data.append({
                    "ApplicantIncome": h.applicant_income,
                    "CoapplicantIncome": h.coapplicant_income,
                    "LoanAmount": h.loan_amount,
                    "Loan_Amount_Term": h.loan_amount_term,
                    "CreditHistory": h.credit_history,
                    "Education": h.education,
                    "EmploymentType": h.employment_type,
                    "MaritalStatus": h.marital_status,
                    "Dependents": h.dependents,
                    "PropertyArea": h.property_area,
                    "Loan_Status": 1 if h.prediction_result == "Approved" else 0
                })
            df_db = pd.DataFrame(db_data)
            df = pd.concat([df, df_db], ignore_index=True)
            
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not load portfolio data.")

# ================================
# CSV EXPORT ENDPOINTS
# ================================
@app.get("/export/my-history")
def export_my_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    history = db.query(models.PredictionHistory).filter(models.PredictionHistory.user_id == current_user.id).all()
    data = [{"ID": h.id, "Applicant_Income": h.applicant_income, "Loan_Amount": h.loan_amount, "Prediction": h.prediction_result, "Confidence": h.confidence_score, "Timestamp": h.created_at} for h in history]
    if not data:
        raise HTTPException(status_code=404, detail="No history found.")
    df = pd.DataFrame(data)
    return generate_csv_response(df, f"my_history_{current_user.username}.csv")

@app.get("/admin/export/users")
def admin_export_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    users = db.query(models.User).all()
    data = [{"ID": u.id, "Username": u.username, "Hashed_Password": u.hashed_password, "Is_Master": u.is_master} for u in users]
    return generate_csv_response(pd.DataFrame(data), "master_users_export.csv")

@app.get("/admin/export/history")
def admin_export_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    history = db.query(models.PredictionHistory).all()
    data = [{"ID": h.id, "User_ID": h.user_id, "Applicant_Income": h.applicant_income, "Loan_Amount": h.loan_amount, "Prediction": h.prediction_result, "Confidence": h.confidence_score, "Timestamp": h.created_at} for h in history]
    if not data:
        raise HTTPException(status_code=404, detail="No history found.")
    return generate_csv_response(pd.DataFrame(data), "master_history_export.csv")

@app.get("/admin/export/sessions")
def admin_export_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    sessions = db.query(models.UserSession).all()
    data = [{"ID": s.id, "User_ID": s.user_id, "IP_Address": s.ip_address, "Login_Time": s.login_time, "Logout_Time": s.logout_time} for s in sessions]
    if not data:
        raise HTTPException(status_code=404, detail="No sessions found.")
    return generate_csv_response(pd.DataFrame(data), "master_sessions_export.csv")


# ================================
# USER MANAGEMENT ENDPOINTS (Master Only)
# ================================
@app.get("/admin/users")
def get_all_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    users = db.query(models.User).all()
    return [{
        "id": u.id,
        "username": u.username,
        "is_master": u.is_master,
        "is_active": getattr(u, 'is_active', True),
        "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if getattr(u, 'created_at', None) else None
    } for u in users]

@app.get("/admin/sessions")
def get_all_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    sessions = db.query(models.UserSession).order_by(models.UserSession.id.desc()).all()
    return [{
        "id": s.id,
        "user_id": s.user_id,
        "ip_address": s.ip_address,
        "login_time": s.login_time.strftime("%Y-%m-%d %H:%M:%S") if s.login_time else None,
        "logout_time": s.logout_time.strftime("%Y-%m-%d %H:%M:%S") if s.logout_time else None
    } for s in sessions]

@app.get("/admin/history")
def get_all_history(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    history = db.query(models.PredictionHistory).order_by(models.PredictionHistory.id.desc()).all()
    return [{
        "id": h.id,
        "user_id": h.user_id,
        "applicant_income": h.applicant_income,
        "coapplicant_income": h.coapplicant_income,
        "loan_amount": h.loan_amount,
        "loan_amount_term": h.loan_amount_term,
        "prediction_result": h.prediction_result,
        "confidence_score": h.confidence_score,
        "created_at": h.created_at.strftime("%Y-%m-%d %H:%M:%S") if h.created_at else None
    } for h in history]

@app.post("/admin/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own Master account.")
    
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    target_user.is_active = not getattr(target_user, 'is_active', True)
    db.commit()
    return {"message": "Status updated", "is_active": target_user.is_active}

@app.delete("/admin/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Master User privileges required.")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot erase your own Master account.")
        
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Delete dependent sessions and prediction records to prevent foreign key errors
    db.query(models.UserSession).filter(models.UserSession.user_id == user_id).delete(synchronize_session=False)
    db.query(models.PredictionHistory).filter(models.PredictionHistory.user_id == user_id).delete(synchronize_session=False)
    
    db.delete(target_user)
    db.commit()
    return {"message": "User and all associated data permanently deleted."}

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_frontend():
    return FileResponse("static/index.html")

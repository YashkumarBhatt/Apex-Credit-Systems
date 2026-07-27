from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import joblib
import pandas as pd
import os
import io
import re
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

# Import our custom modules
import models
from database import engine, get_db, SessionLocal
import auth



# Create database tables
models.Base.metadata.create_all(bind=engine)

# --- Temporary Hardwired Admin ---
def init_temp_admin():
    db = SessionLocal()
    try:
        admin_user = db.query(models.User).filter(models.User.username == "Master_User").first()
        if not admin_user:
            hashed_password = auth.get_password_hash("DataVidwan@2026")
            new_admin = models.User(username="Master_User", hashed_password=hashed_password, is_master=True)
            db.add(new_admin)
            db.commit()
        else:
            admin_user.hashed_password = auth.get_password_hash("DataVidwan@2026")
            db.commit()
    finally:
        db.close()

init_temp_admin()
# ---------------------------------

app = FastAPI(title="Apex Loan Systems API")

# Security schema
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

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

# Dependency to verify the user's token
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    
    pwd = user.password
    if len(pwd) < 8 or not re.search(r"[A-Z]", pwd) or not re.search(r"[a-z]", pwd) or not re.search(r"[0-9]", pwd) or not re.search(r"[^A-Za-z0-9]", pwd) or pwd == user.username:
        raise HTTPException(status_code=400, detail="Password does not meet security requirements.")
    
    hashed_password = auth.get_password_hash(user.password)
    # New users are NEVER masters by default
    new_user = models.User(username=user.username, hashed_password=hashed_password, is_master=False)
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
                literal_req_loan = application.LoanAmount * 1000 if application.LoanAmount < 1000 else application.LoanAmount
                recommended_max_loan = round((total_income * 2.5) / 5000) * 5000
                if recommended_max_loan < 10000:
                    recommended_max_loan = 10000
                counter_offer_amount = recommended_max_loan
                conditions = [f"Loan request adjusted to capacity threshold of ₹{recommended_max_loan:,.0f}"]
                actionable_notes = f"Requested ₹{literal_req_loan:,.0f} exceeds risk limit. Pre-approved for ₹{recommended_max_loan:,.0f}."
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
        
        return {
            "prediction": prediction_val,
            "confidence_percentage": confidence_percentage,
            "status": status,
            "track": track,
            "tier": tier,
            "conditions": conditions,
            "counter_offer_amount": counter_offer_amount,
            "actionable_notes": actionable_notes,
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
    return [{"id": u.id, "username": u.username, "is_master": u.is_master, "is_active": getattr(u, 'is_active', True)} for u in users]

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
        
    db.delete(target_user)
    db.commit()
    return {"message": "User and all associated data permanently deleted."}

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_frontend():
    return FileResponse("static/index.html")

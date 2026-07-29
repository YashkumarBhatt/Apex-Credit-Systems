from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)
    is_master = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime(timezone=True), nullable=True)
    
    predictions = relationship("PredictionHistory", back_populates="owner", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String)
    login_time = Column(DateTime(timezone=True), server_default=func.now())
    logout_time = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")

class PredictionHistory(Base):
    __tablename__ = "prediction_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    applicant_income = Column(Float)
    coapplicant_income = Column(Float)
    loan_amount = Column(Float)
    loan_amount_term = Column(Float)
    credit_history = Column(Float)
    
    education = Column(String)
    employment_type = Column(String)
    marital_status = Column(String)
    dependents = Column(String)
    property_area = Column(String)
    
    prediction_result = Column(String) # "Approved" or "Rejected"
    confidence_score = Column(Float)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="predictions")

import models
from database import engine, SessionLocal
import auth
import sys

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def create_master_user(username, password):
    db = SessionLocal()
    
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        print(f"Master user '{username}' already exists. Overwriting password...")
        existing.hashed_password = auth.get_password_hash(password)
        existing.is_master = True
        db.commit()
        db.close()
        print(f"✅ Success! Master user '{username}' has been updated.")
        return

    hashed = auth.get_password_hash(password)
    master = models.User(username=username, hashed_password=hashed, is_master=True)
    db.add(master)
    db.commit()
    db.close()
    print(f"✅ Success! Master user '{username}' has been securely created in the database.")

if __name__ == "__main__":
    print("--- Apex Loan Systems | Master User Provisioning ---")
    if len(sys.argv) == 3:
        create_master_user(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python create_master.py <username> <password>")

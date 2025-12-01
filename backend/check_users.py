from app.models.database import SessionLocal
from app.models.database import User

db = SessionLocal()
users = db.query(User).all()
print(f"Total users: {len(users)}")
for user in users:
    print(f"User: {user.email}, Role: {user.role}")
db.close()

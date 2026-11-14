from functools import cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db_models import User
from app.security import hash_password, verify_password


@cache
def _dummy_hash() -> str:
    return hash_password("dummy-password-for-timing")


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        # Spend the same hashing time as a real check so response timing doesn't reveal valid emails.
        verify_password(_dummy_hash(), password)
        return None
    return user if verify_password(user.password_hash, password) else None

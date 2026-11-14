from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

from app.db_models import User
from app.security import create_access_token
from app.seed import BRAND_LEAD_EMAIL, BRAND_LEAD_PASSWORD, FORECASTER_EMAIL, FORECASTER_PASSWORD


def login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    "email, password, role",
    [
        (FORECASTER_EMAIL, FORECASTER_PASSWORD, "FORECASTER"),
        (BRAND_LEAD_EMAIL, BRAND_LEAD_PASSWORD, "BRAND_LEAD"),
    ],
)
def test_demo_users_can_log_in_and_fetch_profile(client, email, password, role):
    response = login(client, email, password)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"

    me = client.get("/api/auth/me", headers=bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["role"] == role
    assert "password_hash" not in me.json()


def test_login_email_is_case_insensitive(client):
    response = login(client, "  Forecaster@Example.COM ", FORECASTER_PASSWORD)

    assert response.status_code == 200


def test_login_with_wrong_password_is_rejected(client):
    response = login(client, FORECASTER_EMAIL, "wrong-password")

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_with_unknown_email_gives_same_error(client):
    response = login(client, "nobody@example.com", FORECASTER_PASSWORD)

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


@pytest.mark.parametrize("body", [{}, {"email": FORECASTER_EMAIL}, {"email": "", "password": "x"}])
def test_login_with_invalid_body_is_422(client, body):
    assert client.post("/api/auth/login", json=body).status_code == 422


def test_me_without_token_is_401(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_me_with_malformed_token_is_401(client):
    assert client.get("/api/auth/me", headers=bearer("not-a-jwt")).status_code == 401


def test_me_with_expired_token_is_401(client, forecaster_id):
    token = create_access_token(forecaster_id, expires_delta=timedelta(minutes=-1))

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_me_with_token_signed_by_another_key_is_401(client, forecaster_id):
    token = jwt.encode(
        {"sub": str(forecaster_id), "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "an-attacker-controlled-secret-key-of-32+chars",
        algorithm="HS256",
    )

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_me_with_token_for_unknown_user_is_401(client):
    assert client.get("/api/auth/me", headers=bearer(create_access_token(999_999))).status_code == 401


def test_passwords_are_stored_hashed(db):
    for user in db.scalars(select(User)):
        assert user.password_hash.startswith("$argon2id$")
        assert FORECASTER_PASSWORD not in user.password_hash
        assert BRAND_LEAD_PASSWORD not in user.password_hash

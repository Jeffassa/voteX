import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_csrf_token_consistency(client):
    # Perform login (using a known test user – adjust credentials as needed)
    login_data = {
        "username": "testuser",  # replace with a real matricule in test DB
        "password": "testpassword"
    }
    response = client.post("/api/auth/login", data=login_data)
    assert response.status_code == 200

    # The CSRF token should be set as a cookie and also exposed via header
    csrf_cookie = response.cookies.get("sv_csrf")
    csrf_header = response.headers.get("X-CSRF-Token")
    assert csrf_cookie is not None, "CSRF cookie missing after login"
    assert csrf_header is not None, "CSRF header missing after login"
    # Verify that the token values match (no modification during login)
    assert csrf_cookie == csrf_header, "CSRF token was altered between cookie and header"

    # Use the token in a subsequent mutating request (e.g., change password)
    # Include the cookie automatically; add the header manually
    client.headers.update({"X-CSRF-Token": csrf_header})
    change_payload = {
        "token": "oldpassword",
        "new_password": "newsecurepwd"
    }
    # Assuming the test user exists and old password is correct; otherwise expect 401/403
    resp2 = client.post("/api/auth/me/change-password", json=change_payload)
    # The request should be processed (or fail gracefully) but the CSRF token must remain unchanged
    assert resp2.headers.get("X-CSRF-Token") == csrf_header, "CSRF token changed on subsequent request"

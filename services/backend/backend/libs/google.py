import os

from fastapi import HTTPException, status
from google.auth.transport import requests
from google.oauth2 import id_token

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


def verify_google_token(token: str) -> dict:
    try:
        payload = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token",
        ) from None

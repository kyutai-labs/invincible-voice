import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing_extensions import Annotated

from backend.kyutai_constants import ALLOW_PASSWORD, GOOGLE_CLIENT_ID
from backend.libs.google import verify_google_token
from backend.security import create_access_token, hash_password, verify_password
from backend.storage import (
    UserData,
    UserDataNotFoundError,
    get_user_data_from_storage,
    get_user_data_path,
)
from backend.typing import GoogleAuthRequest, UserSettings

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])


@auth_router.post("/login")
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    if not ALLOW_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password-based login is disabled",
        )
    user = get_user_data_from_storage(form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@auth_router.post("/register")
def register(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    if not ALLOW_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password-based registration is disabled",
        )
    user_data_path = get_user_data_path(form_data.username)
    if user_data_path.exists():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    hashed_password = hash_password(form_data.password)
    user = UserData(
        user_id=uuid.uuid4(),
        email=form_data.username,
        google_sub=None,
        hashed_password=hashed_password,
        user_settings=UserSettings(
            name="New name",
            prompt="",
            additional_keywords=[
                "manger",
                "dormir",
                "sortir",
                "discuter",
                "reflechir",
                "cinema",
                "theatre",
            ],
            friends=[],
        ),
        conversations=[],
    )
    user.save()

    token = create_access_token({"sub": form_data.username})
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@auth_router.post("/google")
def google_login(data: GoogleAuthRequest):
    google_user = verify_google_token(data.token)

    email = google_user["email"]

    try:
        user = get_user_data_from_storage(email)
        if user.google_sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account exists, login with password",
            )
    except UserDataNotFoundError:
        user = UserData(
            user_id=uuid.uuid4(),
            email=email,
            google_sub=google_user["sub"],
            hashed_password="",
            user_settings=UserSettings(
                name="New name",
                prompt="",
                additional_keywords=[
                    "manger",
                    "dormir",
                    "sortir",
                    "discuter",
                    "reflechir",
                    "cinema",
                    "theatre",
                ],
                friends=[],
            ),
            conversations=[],
        )
        user.save()

    jwt_token = create_access_token({"sub": user.email})

    return {
        "access_token": jwt_token,
        "token_type": "bearer",
    }


@auth_router.get("/allow-password")
def allow_password() -> dict[str, bool]:
    return {"allow_password": ALLOW_PASSWORD}


@auth_router.get("/google-client-id")
def google_client_id() -> dict[str, str]:
    print(GOOGLE_CLIENT_ID)
    return {"google_client_id": GOOGLE_CLIENT_ID}

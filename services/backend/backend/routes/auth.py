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


def get_new_user(
    email: str,
    language: str,
    hashed_password: str = "",
    google_sub: str | None = None,
) -> UserData:
    # Default name and keywords based on language
    default_names = {
        "en": "New user",
        "fr": "Nouvel utilisateur",
        "de": "Neuer Benutzer",
        "es": "Nuevo usuario",
        "pt": "Novo usuário",
    }

    default_keywords = {
        "en": [
            "eat",
            "sleep",
            "go out",
            "discuss",
            "think",
            "cinema",
            "theater",
            "yes",
            "no",
            "hello",
            "goodbye",
        ],
        "fr": [
            "manger",
            "dormir",
            "sortir",
            "discuter",
            "réfléchir",
            "cinéma",
            "théâtre",
            "oui",
            "non",
            "bonjour",
            "au revoir",
        ],
        "de": [
            "essen",
            "schlafen",
            "ausgehen",
            "diskutieren",
            "nachdenken",
            "kino",
            "theater",
            "ja",
            "nein",
            "hallo",
            "auf wiedersehen",
        ],
        "es": [
            "comer",
            "dormir",
            "salir",
            "discutir",
            "pensar",
            "cine",
            "teatro",
            "sí",
            "no",
            "hola",
            "adiós",
        ],
        "pt": [
            "comer",
            "dormir",
            "sair",
            "discutir",
            "pensar",
            "cinema",
            "teatro",
            "sim",
            "não",
            "olá",
            "tchau",
        ],
    }

    return UserData(
        user_id=uuid.uuid4(),
        email=email,
        google_sub=google_sub,
        hashed_password=hashed_password,
        user_settings=UserSettings(
            name=default_names[language],
            prompt="",
            additional_keywords=default_keywords[language],
            friends=[],
        ),
        conversations=[],
    )


@auth_router.post("/register")
def register(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    language: str,
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
    user = get_new_user(form_data.username, language, hashed_password=hashed_password)
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
        user = get_new_user(email, data.language, google_sub=google_user["sub"])
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
    return {"google_client_id": GOOGLE_CLIENT_ID}

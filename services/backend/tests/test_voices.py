import uuid
from unittest.mock import AsyncMock, MagicMock

import aiohttp
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.routes import voices
from backend.routes.user import get_current_user
from backend.storage import UserData
from backend.typing import UserSettings

AUDIO = {"audio_file": ("sample.wav", b"RIFF....WAVE", "audio/wav")}


def _fake_user() -> UserData:
    return UserData(
        user_id=uuid.uuid4(),
        email="user@example.com",
        hashed_password="hashed-password",
        google_sub=None,
        user_settings=UserSettings(
            name="Ada",
            prompt="",
            additional_keywords=[],
            friends=[],
            documents=[],
        ),
        conversations=[],
    )


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(voices, "TTS_IS_GRADIUM", True)
    app.dependency_overrides[get_current_user] = _fake_user
    # No context manager: we don't want the lifespan (redis metrics) to start.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def gradium_create(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock = AsyncMock(
        return_value={"uid": "voice-uid", "name": "user@example.com/My voice"}
    )
    monkeypatch.setattr(voices.gradium.voices, "create", mock)
    return mock


def test_create_voice_forwards_language_to_gradium(
    client: TestClient, gradium_create: AsyncMock
) -> None:
    response = client.post(
        "/v1/voices/create",
        data={"name": "My voice", "language": "fr"},
        files=AUDIO,
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"uid": "voice-uid", "name": "user@example.com/My voice"}
    gradium_create.assert_awaited_once()
    kwargs = gradium_create.await_args.kwargs
    assert kwargs["language"] == "fr"
    assert kwargs["name"] == "user@example.com/My voice"
    assert kwargs["audio_file"].suffix == ".wav"


def test_create_voice_requires_language(
    client: TestClient, gradium_create: AsyncMock
) -> None:
    response = client.post("/v1/voices/create", data={"name": "My voice"}, files=AUDIO)

    assert response.status_code == 422
    gradium_create.assert_not_awaited()


def test_create_voice_rejects_unsupported_language(
    client: TestClient, gradium_create: AsyncMock
) -> None:
    response = client.post(
        "/v1/voices/create",
        data={"name": "My voice", "language": "xx"},
        files=AUDIO,
    )

    assert response.status_code == 400
    assert "Unsupported voice language 'xx'" in response.json()["detail"]
    gradium_create.assert_not_awaited()


def test_create_voice_reports_gradium_errors(
    client: TestClient, gradium_create: AsyncMock
) -> None:
    gradium_create.side_effect = aiohttp.ClientResponseError(
        request_info=MagicMock(), history=(), status=422, message="Field required"
    )

    response = client.post(
        "/v1/voices/create",
        data={"name": "My voice", "language": "en"},
        files=AUDIO,
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "Voice creation failed: 422 Field required"

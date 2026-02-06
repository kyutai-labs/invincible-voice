import pathlib
import tempfile
from logging import getLogger
from typing import Annotated

import gradium
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.kyutai_constants import TTS_IS_GRADIUM, TTS_VOICE_ID
from backend.routes.user import get_current_user
from backend.storage import UserData

logger = getLogger(__name__)


async def _get_voice_uid(voice_name: str, user_email: str) -> str:
    """Get the UID for a voice name."""
    if not TTS_IS_GRADIUM:
        return voice_name

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    voices = await client.voice_get(include_catalog=True)
    for voice in voices:
        if not voice["name"].startswith(f"{user_email}/"):
            continue
        if voice["name"] == voice_name:
            return voice["uid"]
    raise HTTPException(status_code=404, detail="Voice not found")


voices_router = APIRouter(prefix="/v1", tags=["Voices"])


@voices_router.delete("/voices")
async def delete_voice(
    voice_name: str,
    user: Annotated[UserData, Depends(get_current_user)],
) -> dict:
    """Delete a custom voice.

    Only works for custom voices (ones starting with the user's email).
    Catalog voices cannot be deleted.

    Query parameter: voice_name - The full voice name to delete
    """
    if not TTS_IS_GRADIUM:
        raise HTTPException(
            status_code=400, detail="Voice deletion is only supported with Gradium TTS"
        )

    if not voice_name.startswith(f"{user.email}/"):
        raise HTTPException(status_code=400, detail="Only custom voices can be deleted")

    # Get the UID for the voice
    voice_uid = await _get_voice_uid(voice_name, user.email)

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    result = await gradium.voices.delete(client, voice_uid=voice_uid)
    logger.info(f"{result}")
    return {"message": "Voice deleted successfully", "name": voice_name}


async def _get_available_voices(user_name: str) -> dict[str, tuple[str, str]]:
    """Get available voices based on the TTS provider."""
    if not TTS_IS_GRADIUM:
        # For Kyutai TTS, return the configured voice with unknown language
        return {TTS_VOICE_ID: (TTS_VOICE_ID, "unknown")}

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )
    if "/" in user_name:
        # Just as a safety precaution. I don't know if that can happen, but I don't
        # want security issues and having custom voices leaking.
        raise HTTPException(
            status_code=400, detail="Username cannot contain '/' character"
        )

    voices = await client.voice_get(include_catalog=True)
    # Return only catalog voices (built-in), format as {name: language}
    result = {}
    for voice in voices:
        if voice.get("is_catalog", False):
            result[voice["name"]] = (voice["uid"], voice.get("language") or "unknown")
        else:
            # For custome voices, it's username/voice_name
            if voice["name"].startswith(f"{user_name}/"):
                result[voice["name"]] = (voice["uid"], "Custom voice")
    return result


@voices_router.post("/voices/create")
async def create_voice(
    audio_file: Annotated[UploadFile, File(description="Audio file for voice cloning")],
    name: Annotated[str, Form(description="Name for the new voice")],
    user: Annotated[UserData, Depends(get_current_user)],
) -> dict:
    """Create a new custom voice by uploading an audio file.

    Only works when using Gradium TTS. Returns a 400 error for Kyutai TTS.
    """
    if not TTS_IS_GRADIUM:
        raise HTTPException(
            status_code=400, detail="Voice creation is only supported with Gradium TTS"
        )

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    # Save uploaded file to a temporary file since gradium.voices.create requires a file path
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        content = await audio_file.read()
        tmp.write(content)
        tmp_path = pathlib.Path(tmp.name)

        result = await gradium.voices.create(
            client=client,
            audio_file=tmp_path,
            name=user.email + "/" + name,
        )
        return result


@voices_router.get("/voices")
async def list_voices(
    user: Annotated[UserData, Depends(get_current_user)],
) -> dict[str, str]:
    """List available voices from Gradium TTS.

    Returns a dictionary where the key is the voice name and the value is the language.
    For Kyutai TTS, returns {TTS_VOICE_ID: "unknown"}.
    """
    list_of_voices = await _get_available_voices(user.email)
    return {name: lang for name, (_, lang) in list_of_voices.items()}

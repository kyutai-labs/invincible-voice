from typing import Annotated

import gradium
from fastapi import APIRouter, Depends, HTTPException

from backend.kyutai_constants import TTS_IS_GRADIUM, TTS_VOICE_ID
from backend.routes.user import get_current_user
from backend.storage import UserData
from backend.typing import VoiceSelectionRequest

voices_router = APIRouter(prefix="/v1", tags=["Voices"])


async def _get_available_voices() -> dict[str, str]:
    """Get available voices based on the TTS provider."""
    if not TTS_IS_GRADIUM:
        # For Kyutai TTS, return the configured voice with unknown language
        return {TTS_VOICE_ID: "unknown"}

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    voices = await client.voice_get(include_catalog=True)

    # Return only catalog voices (built-in), format as {name: language}
    return {
        voice["name"]: voice["language"]
        for voice in voices
        if voice.get("is_catalog") and voice.get("language")
    }


@voices_router.get("/voices")
async def list_voices() -> dict[str, str]:
    """List available voices from Gradium TTS.

    Returns a dictionary where the key is the voice name and the value is the language.
    For Kyutai TTS, returns {TTS_VOICE_ID: "unknown"}.
    """
    return await _get_available_voices()


@voices_router.post("/voices/select")
async def select_voice(
    request: VoiceSelectionRequest,
    user: Annotated[UserData, Depends(get_current_user)],
) -> dict[str, str]:
    """Select a voice for the user.

    The selected voice will be stored in the user settings.
    """
    available_voices = await _get_available_voices()

    if request.voice not in available_voices:
        raise HTTPException(
            status_code=400,
            detail=f"Voice '{request.voice}' is not available. Available voices: {', '.join(available_voices.keys())}",
        )

    user.user_settings.voice = request.voice
    user.save()
    return {"voice": request.voice}

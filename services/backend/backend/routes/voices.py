import gradium
from fastapi import APIRouter

from backend.kyutai_constants import TTS_IS_GRADIUM, TTS_VOICE_ID

voices_router = APIRouter(prefix="/v1", tags=["Voices"])


async def _get_available_voices() -> dict[str, tuple[str, str]]:
    """Get available voices based on the TTS provider."""
    if not TTS_IS_GRADIUM:
        # For Kyutai TTS, return the configured voice with unknown language
        return {TTS_VOICE_ID: (TTS_VOICE_ID, "unknown")}

    client = gradium.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    voices = await client.voice_get(include_catalog=True)
    # Return only catalog voices (built-in), format as {name: language}
    return {
        voice["name"]: (voice["uid"], voice["language"])
        for voice in voices
        if voice.get("is_catalog") and voice.get("language")
    }


@voices_router.get("/voices")
async def list_voices() -> dict[str, str]:
    """List available voices from Gradium TTS.

    Returns a dictionary where the key is the voice name and the value is the language.
    For Kyutai TTS, returns {TTS_VOICE_ID: "unknown"}.
    """
    list_of_voices = await _get_available_voices()
    return {name: lang for name, (_, lang) in list_of_voices.items()}

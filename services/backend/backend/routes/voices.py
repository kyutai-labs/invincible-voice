import pathlib
import tempfile

import gradium
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing_extensions import Annotated

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
        voice["name"]: (voice["uid"], voice.get("language") or "Custom voice")
        for voice in voices
    }


@voices_router.post("/voices/create")
async def create_voice(
    audio_file: Annotated[UploadFile, File(description="Audio file for voice cloning")],
    name: Annotated[str, Form(description="Name for the new voice")],
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
            name=name,
        )
        return result


@voices_router.get("/voices")
async def list_voices() -> dict[str, str]:
    """List available voices from Gradium TTS.

    Returns a dictionary where the key is the voice name and the value is the language.
    For Kyutai TTS, returns {TTS_VOICE_ID: "unknown"}.
    """
    list_of_voices = await _get_available_voices()
    return {name: lang for name, (_, lang) in list_of_voices.items()}

from typing import Annotated, AsyncIterator

import gradium
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer
from starlette.responses import Response

from backend.kyutai_constants import (
    KYUTAI_API_KEY,
    TTS_IS_GRADIUM,
    TTS_SERVER,
    get_tts_setup,
)
from backend.routes.user import get_current_user
from backend.storage import UserData
from backend.typing import TTSRequest

bearer_scheme = HTTPBearer()
tts_router = APIRouter(prefix="/v1/tts", tags=["TTS"])


@tts_router.post("/")
async def text_to_speech(
    request: TTSRequest, _: Annotated[UserData, Depends(get_current_user)]
) -> Response:
    if TTS_IS_GRADIUM:
        client = gradium.client.GradiumClient(
            base_url="https://eu.api.gradium.ai/api/",
        )

        # Get TTS setup configuration from constants
        setup = get_tts_setup()

        # Gradium streaming response
        stream = await client.tts_stream(setup, text=request.text)

        async def pcm_audio_generator():
            async for chunk in stream.iter_bytes():
                yield chunk

        return StreamingResponse(
            pcm_audio_generator(),
            media_type="application/octet-stream",
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache",
            },
        )

    # Use Kyutai TTS
    query = {
        "text": request.text,
        "voice": "unmute-prod-website/developer-1.mp3",
        "temperature": 0.8,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            TTS_SERVER,
            json=query,
            headers={"kyutai-api-key": KYUTAI_API_KEY},
        )

    response.raise_for_status()

    data = response.content

    async def audio_generator() -> AsyncIterator[bytes]:
        yield data  # Maybe data.bytes ?

    return StreamingResponse(
        audio_generator(),
        media_type="audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )


@tts_router.get("/sample_rate")
async def get_tts_sample_rate() -> Response:
    if TTS_IS_GRADIUM:
        return {"sample_rate": 48000} # Could be obtained from gradium client ?
    else:
        return {"sample_rate": 24000} # Kyutai TTS sample rate
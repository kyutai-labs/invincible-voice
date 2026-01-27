from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPBearer
from starlette.responses import Response

from backend.kyutai_constants import (
    TTS_PROVIDER
)
from backend.routes.user import get_current_user
from backend.storage import UserData
from backend.typing import TTSRequest

from backend.tts.tts_utils import tts_pocket, tts_gradium, tts_dsm

bearer_scheme = HTTPBearer()
tts_router = APIRouter(prefix="/v1/tts", tags=["TTS"])

@tts_router.post("/")
async def text_to_speech(
    request: TTSRequest, _: Annotated[UserData, Depends(get_current_user)]
) -> Response:
    if TTS_PROVIDER == "dsm":
        return await tts_dsm(request.text)

    if TTS_PROVIDER == "gradium":
        return await tts_gradium(request.text)

    # Default to Pocket TTS
    return await tts_pocket(request.text)

@tts_router.get("/sample_rate")
async def get_tts_sample_rate() -> Response:
    if TTS_PROVIDER == "gradium":
        return {"sample_rate": 48000} # Could be obtained from gradium client ?
    else: # DSM and Pocket TTS
        return {"sample_rate": 24000} # Kyutai TTS sample rate
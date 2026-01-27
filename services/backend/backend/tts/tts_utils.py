import logging
import gradium
import httpx
from fastapi.responses import StreamingResponse
from typing import AsyncIterator
from backend.kyutai_constants import (
    KYUTAI_API_KEY,
    TTS_PROVIDER,
    TTS_SERVER,
    get_tts_setup,
    TTS_VOICE_ID
)
from pocket_tts import TTSModel
from pocket_tts.data.audio import stream_audio_chunks
import io
import threading
from queue import Queue

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

def write_to_queue(tts_model: TTSModel, queue: Queue, text_to_generate: str, model_state: dict):
        """Allows writing to the StreamingResponse as if it were a file."""

        class FileLikeToQueue(io.IOBase):
            def __init__(self, queue):
                self.queue = queue

            def write(self, data):
                self.queue.put(data)

            def flush(self):
                pass

            def close(self):
                self.queue.put(None)

        audio_chunks = tts_model.generate_audio_stream(
            model_state=model_state, text_to_generate=text_to_generate
        )
        stream_audio_chunks(FileLikeToQueue(queue), audio_chunks, tts_model.config.mimi.sample_rate)


def generate_data_with_state(tts_model: TTSModel, text_to_generate: str, model_state: dict):
    queue = Queue()

    # Run your function in a thread
    thread = threading.Thread(target=write_to_queue, args=(tts_model, queue, text_to_generate, model_state))
    thread.start()

    # Yield data as it becomes available
    while True:
        data = queue.get()
        if data is None:
            break
        yield data

    thread.join()

tts_model = None
voice_state = None
if TTS_PROVIDER == "pocket" and TTS_SERVER == "": # Initialize Pocket TTS only if using Pocket TTS locally
    logger.info("Initializing Pocket TTS model...")
    tts_model = TTSModel.load_model()
    voice_state = tts_model.get_state_for_audio_prompt(TTS_VOICE_ID)

async def stream_kyutai_response(response: httpx.Response) -> AsyncIterator[bytes]:
    """Stream Kyutai TTS response as an async generator."""
    response.raise_for_status()
    async def audio_generator() -> AsyncIterator[bytes]:
        yield response.content

    return StreamingResponse(
        audio_generator(),
        media_type="audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
        },
    )


async def tts_pocket(request_text: str) -> StreamingResponse:
    """Generate TTS audio using Pocket TTS, either locally or via remote server."""    
    
    if TTS_SERVER == "": # Local Pocket TTS    
        return StreamingResponse(
                generate_data_with_state(tts_model, request_text, voice_state),
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "attachment; filename=generated_speech.wav",
                    "Transfer-Encoding": "chunked",
                },
            )
    else: # Remote Pocket TTS server
        query = {
            "text": request_text,
            "voice_url": TTS_VOICE_ID,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                TTS_SERVER,
                data=query,
                headers={"kyutai-api-key": KYUTAI_API_KEY},
            )
        return await stream_kyutai_response(response)


async def tts_dsm(request_text: str) -> StreamingResponse:
    """Generate TTS audio using Kyutai DSM TTS."""
    query = {
        "text": request_text,
        "voice": TTS_VOICE_ID,
        "temperature": 0.8,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            TTS_SERVER,
            json=query,
            headers={"kyutai-api-key": KYUTAI_API_KEY},
        )

    return await stream_kyutai_response(response)



async def tts_gradium(request_text: str) -> StreamingResponse:
    """Generate TTS audio using Gradium TTS."""
    client = gradium.client.GradiumClient(
        base_url="https://eu.api.gradium.ai/api/",
    )

    # Get TTS setup configuration from constants
    setup = get_tts_setup()

    # Gradium streaming response
    stream = await client.tts_stream(setup, text=request_text)

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
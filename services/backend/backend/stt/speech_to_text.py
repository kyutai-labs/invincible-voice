import asyncio
import base64
import json
import os
import random
import traceback
from logging import getLogger
from typing import AsyncIterator, Literal, Union

import msgpack
import numpy as np
import websockets
from fastrtc import audio_to_float32
from pydantic import BaseModel, TypeAdapter

from backend import metrics as mt
from backend.exceptions import MissingServiceAtCapacity
from backend.kyutai_constants import (
    FRAME_TIME_SEC,
    KYUTAI_STT_URL,
    SAMPLE_RATE,
    STT_DELAY_SEC,
    STT_IS_GRADIUM,
)
from backend.stt.exponential_moving_average import ExponentialMovingAverage
from backend.timer import Stopwatch
from backend.websocket_utils import WebsocketState

logger = getLogger(__name__)


# Gradium STT Message Models


class GradiumSetupMessage(BaseModel):
    language: str | None
    type: Literal["setup"] = "setup"
    model_name: str
    input_format: str
    close_ws_on_eos: bool = False


class GradiumVADPrediction(BaseModel):
    horizon_s: float
    inactivity_prob: float


class GradiumReadyMessage(BaseModel):
    type: Literal["ready"] = "ready"
    request_id: str
    model_name: str
    sample_rate: int
    frame_size: float
    # delay_in_tokens: int
    text_stream_names: list[str]


class GradiumAudioMessage(BaseModel):
    type: Literal["audio"] = "audio"
    audio: str


class GradiumTextMessage(BaseModel):
    type: Literal["text"] = "text"
    text: str
    start_s: float
    stream_id: int | None = None


class GradiumStepMessage(BaseModel):
    type: Literal["step"] = "step"
    vad: list[GradiumVADPrediction]
    step_idx: int
    step_duration_s: float
    total_duration_s: float


class GradiumEndTextMessage(BaseModel):
    type: Literal["end_text"] = "end_text"
    stop_s: float
    stream_id: int | None = None


class GradiumEndOfStreamMessage(BaseModel):
    type: Literal["end_of_stream"] = "end_of_stream"


class GradiumErrorMessage(BaseModel):
    # type: Literal["error"] = "error"
    message: str
    code: int


# Union of all Gradium STT message types
GradiumSTTMessage = Union[
    GradiumSetupMessage,
    GradiumAudioMessage,
    GradiumReadyMessage,
    GradiumTextMessage,
    GradiumStepMessage,
    GradiumEndTextMessage,
    GradiumEndOfStreamMessage,
    GradiumErrorMessage,
]


# Legacy compatibility models for existing InvincibleVoice code
class STTWordMessage(BaseModel):
    type: Literal["Word"]
    text: str
    start_time: float


class STTEndWordMessage(BaseModel):
    type: Literal["EndWord"]
    stop_time: float


class STTMarkerMessage(BaseModel):
    type: Literal["Marker"]
    id: int


class STTStepMessage(BaseModel):
    type: Literal["Step"]
    step_idx: int
    prs: list[float]


class STTErrorMessage(BaseModel):
    type: Literal["Error"]
    message: str


class STTReadyMessage(BaseModel):
    type: Literal["Ready"] = "ready"


STTMessage = Union[
    STTWordMessage,
    STTEndWordMessage,
    STTMarkerMessage,
    STTStepMessage,
    STTErrorMessage,
    STTReadyMessage,
]
STTMessageAdapter = TypeAdapter(STTMessage)

# Type adapter for Gradium messages
GradiumSTTMessageAdapter = TypeAdapter(GradiumSTTMessage)


class SpeechToText:
    def __init__(self, expected_language: str | None):
        self.stt_instance = KYUTAI_STT_URL
        self.delay_sec = STT_DELAY_SEC
        self.websocket: websockets.ClientConnection | None = None
        self.sent_samples = 0
        self.received_words = 0
        self.current_time = -STT_DELAY_SEC
        self.time_since_first_audio_sent = Stopwatch(autostart=False)
        self.waiting_first_step: bool = True
        self.expected_language = expected_language

        # In our case, attack  = from speaking to not speaking
        #              release = from not speaking to speaking
        self.pause_prediction = ExponentialMovingAverage(
            attack_time=0.01, release_time=0.01, initial_value=1.0
        )

        self.shutdown_complete = asyncio.Event()

    def state(self) -> WebsocketState:
        if not self.websocket:
            return "not_created"
        else:
            d: dict[websockets.protocol.State, WebsocketState] = {
                websockets.protocol.State.CONNECTING: "connecting",
                websockets.protocol.State.OPEN: "connected",
                websockets.protocol.State.CLOSING: "closing",
                websockets.protocol.State.CLOSED: "closed",
            }
            return d[self.websocket.state]

    async def send_audio(self, audio: np.ndarray) -> None:
        if audio.ndim != 1:
            raise ValueError(f"Expected 1D array, got {audio.shape=}")

        if audio.dtype != np.float32:
            audio = audio_to_float32(audio)

        self.sent_samples += len(audio)
        self.time_since_first_audio_sent.start_if_not_started()
        mt.STT_SENT_FRAMES.inc()

        if STT_IS_GRADIUM:
            # Send audio in chunks for Gradium (recommended 1920 samples per chunk = 80ms at 24kHz)
            chunk_size = 1920
            for i in range(0, len(audio), chunk_size):
                chunk = audio[i : i + chunk_size]
                chunk_base64 = self.audio_to_base64_pcm(chunk)
                audio_msg = GradiumAudioMessage(audio=chunk_base64)
                await self._send(audio_msg)
                # Small delay to avoid overwhelming the service
                await asyncio.sleep(0.005)
        else:
            # Kyutai protocol - send full audio array as MessagePack
            await self._send({"type": "Audio", "pcm": audio.tolist()})

    async def send_marker(self, id: int) -> None:
        if STT_IS_GRADIUM:
            # Gradium doesn't have marker support, but we can ignore for compatibility
            logger.debug(f"Gradium STT does not support markers, ignoring marker {id}")
        else:
            # Kyutai protocol supports markers
            await self._send({"type": "Marker", "id": id})

    async def _send(self, data: Union[GradiumSTTMessage, dict]) -> None:
        """Send a message to the STT server using the appropriate protocol."""
        if not self.websocket:
            raise RuntimeError(
                "STT websocket not connected, you cannot send the message {data}"
            )

        if STT_IS_GRADIUM:
            # Gradium protocol - send JSON
            if isinstance(data, GradiumSTTMessage):
                await self.websocket.send(data.model_dump_json())
            else:
                raise ValueError(
                    f"Expected GradiumSTTMessage for Gradium, got {type(data)}"
                )
        else:
            # Kyutai protocol - send MessagePack
            if isinstance(data, dict):
                to_send = msgpack.packb(data, use_bin_type=True, use_single_float=True)
                await self.websocket.send(to_send)
            else:
                raise ValueError(f"Expected dict for Kyutai, got {type(data)}")

    async def start_up(self):
        if STT_IS_GRADIUM:
            logger.info(f"Connecting to Gradium STT {self.stt_instance}...")

            # Gradium STT connection
            api_key = os.environ.get("GRADIUM_API_KEY")
            if not api_key:
                raise ValueError(
                    "GRADIUM_API_KEY environment variable is required for Gradium STT"
                )

            headers = {"x-api-key": api_key}
            self.websocket = await websockets.connect(
                self.stt_instance,
                additional_headers=headers,
            )
            logger.info("Connected to Gradium STT")

            try:
                # Send setup message
                setup_msg = GradiumSetupMessage(
                    language=self.expected_language,
                    model_name="default",
                    input_format="pcm",
                )
                logger.info(f"{setup_msg}")
                await self._send(setup_msg)
                logger.info("Sent setup message to Gradium STT")

                # Wait for ready message
                response = await self.websocket.recv()
                message_dict = json.loads(response)
                logger.info(f"Received from Gradium STT: {message_dict}")

                message = GradiumSTTMessageAdapter.validate_python(message_dict)

                if isinstance(message, GradiumReadyMessage):
                    logger.info("Gradium STT service is ready")
                    mt.STT_ACTIVE_SESSIONS.inc()
                    return
                elif isinstance(message, GradiumErrorMessage):
                    logger.error(f"Error from Gradium STT service: {message.message}")
                    raise ValueError(f"Gradium STT error: {message.message}")
                else:
                    raise RuntimeError(
                        f"Expected ready or error message, got {message.type}"
                    )
            except Exception as e:
                logger.error("Error during Gradium STT startup:")
                traceback.print_exc()
                logger.error(f"{e}")
                # Make sure we don't leave a dangling websocket connection
                if self.websocket:
                    await self.websocket.close()
                    self.websocket = None
                raise
        else:
            logger.info(f"Connecting to Kyutai STT {self.stt_instance}...")
            self.websocket = await websockets.connect(
                self.stt_instance,
                additional_headers={
                    "kyutai-api-key": "public_token"
                },  # TODO: make this configurable
            )
            logger.info("Connected to Kyutai STT")

            try:
                message_bytes = await self.websocket.recv()
                if not isinstance(message_bytes, (bytes, bytearray)):
                    raise ValueError(
                        f"Expected bytes from Kyutai STT, got {type(message_bytes)}, data={message_bytes}"
                    )
                message_dict = msgpack.unpackb(message_bytes)  # type: ignore
                message = STTMessageAdapter.validate_python(message_dict)
                if isinstance(message, STTReadyMessage):
                    mt.STT_ACTIVE_SESSIONS.inc()
                    return
                elif isinstance(message, STTErrorMessage):
                    raise MissingServiceAtCapacity("stt")
                else:
                    raise RuntimeError(
                        f"Expected ready or error message, got {message.type}"
                    )
            except Exception as e:
                logger.error(f"Error during Kyutai STT startup: {repr(e)}")
                # Make sure we don't leave a dangling websocket connection
                if self.websocket:
                    await self.websocket.close()
                    self.websocket = None
                raise

    async def shutdown(self):
        logger.info("Shutting down STT, receiving last messages")
        if self.shutdown_complete.is_set():
            return

        mt.STT_ACTIVE_SESSIONS.dec()
        if self.time_since_first_audio_sent.started:
            mt.STT_SESSION_DURATION.observe(self.time_since_first_audio_sent.time())
            mt.STT_AUDIO_DURATION.observe(self.sent_samples / SAMPLE_RATE)
            mt.STT_NUM_WORDS.observe(self.received_words)

        if self.websocket:
            if STT_IS_GRADIUM:
                # Send end of stream message for Gradium
                try:
                    end_msg = GradiumEndOfStreamMessage()
                    await self._send(end_msg)
                    await self.websocket.close()
                except Exception as e:
                    logger.warning(f"Error closing Gradium STT websocket: {e}")
            else:
                # Kyutai STT - just close the connection
                try:
                    await self.websocket.close()
                except Exception as e:
                    logger.warning(f"Error closing Kyutai STT websocket: {e}")

        await self.shutdown_complete.wait()
        logger.info("STT shutdown() finished")

    async def __aiter__(
        self,
    ) -> AsyncIterator[STTWordMessage | STTMarkerMessage]:
        if not self.websocket:
            raise RuntimeError("STT websocket not connected")

        my_id = random.randint(1, int(1e9))

        # The pause prediction is all over the place in the first few steps, so ignore.
        n_steps_to_wait = 12

        try:
            if STT_IS_GRADIUM:
                # Gradium STT message handling
                async for response in self.websocket:
                    message_dict = json.loads(response)
                    logger.debug(
                        f"{my_id} {self.pause_prediction.value} got {message_dict}"
                    )

                    try:
                        message = GradiumSTTMessageAdapter.validate_python(message_dict)
                    except Exception as e:
                        logger.warning(f"Failed to validate Gradium STT message: {e}")
                        continue

                    if isinstance(message, GradiumTextMessage):
                        logger.debug(
                            f"📝 Transcription: '{message.text}' (start: {message.start_s:.2f}s)"
                        )

                        # Convert to compatible format
                        word_msg = STTWordMessage(
                            type="Word", text=message.text, start_time=message.start_s
                        )
                        num_words = len(message.text.split())
                        mt.STT_RECV_WORDS.inc(num_words)
                        self.received_words += 1
                        yield word_msg

                    elif isinstance(message, GradiumEndTextMessage):
                        logger.debug(f"⏹️  Text segment ended at: {message.stop_s:.2f}s")

                    elif isinstance(message, GradiumStepMessage):
                        self.current_time += FRAME_TIME_SEC
                        mt.STT_RECV_FRAMES.inc()

                        if (
                            self.waiting_first_step
                            and self.time_since_first_audio_sent.started
                        ):
                            self.waiting_first_step = False
                            mt.STT_TTFT.observe(self.time_since_first_audio_sent.time())

                        if n_steps_to_wait > 0:
                            n_steps_to_wait -= 1
                        else:
                            # Use VAD inactivity probability for pause prediction
                            if len(message.vad) >= 3:
                                inactivity_prob = message.vad[-1].inactivity_prob
                                self.pause_prediction.update(
                                    dt=FRAME_TIME_SEC, new_value=1.0 - inactivity_prob
                                )

                        logger.debug(
                            f"⏱️  Step {message.step_idx}: duration={message.total_duration_s:.2f}s, vad={message.vad}"
                        )

                    elif isinstance(message, GradiumEndOfStreamMessage):
                        logger.info("✓ Received end_of_stream - transcription complete")
                        break

                    elif isinstance(message, GradiumErrorMessage):
                        logger.error(
                            f"✗ Error from Gradium STT: {message.message} (code: {message.code})"
                        )
                        break

                    else:
                        logger.warning(
                            f"Unknown Gradium STT message type: {type(message)}"
                        )
            else:
                # Kyutai STT message handling
                async for message_bytes in self.websocket:
                    data = msgpack.unpackb(message_bytes)  # type: ignore
                    logger.debug(f"{my_id} {self.pause_prediction.value} got {data}")
                    message: STTMessage = STTMessageAdapter.validate_python(data)

                    match message:
                        case STTWordMessage():
                            num_words = len(message.text.split())
                            mt.STT_RECV_WORDS.inc(num_words)
                            self.received_words += 1
                            yield message
                        case STTEndWordMessage():
                            continue
                        case STTStepMessage():
                            self.current_time += FRAME_TIME_SEC
                            mt.STT_RECV_FRAMES.inc()
                            if (
                                self.waiting_first_step
                                and self.time_since_first_audio_sent.started
                            ):
                                self.waiting_first_step = False
                                mt.STT_TTFT.observe(
                                    self.time_since_first_audio_sent.time()
                                )
                            if n_steps_to_wait > 0:
                                n_steps_to_wait -= 1
                            else:
                                self.pause_prediction.update(
                                    dt=FRAME_TIME_SEC, new_value=message.prs[2]
                                )
                        case STTMarkerMessage():
                            yield message
                        case STTReadyMessage():
                            continue
                        case _:
                            # Not sure why Pyright complains about non-exhaustive match
                            raise ValueError(f"Unknown message: {message}")

        except websockets.ConnectionClosedOK:
            if STT_IS_GRADIUM:
                logger.info("Gradium STT connection closed normally")
            else:
                # The server closes the connection once we send \0, and this actually shows
                # up as a websockets.ConnectionClosedError.
                pass
        except websockets.ConnectionClosedError as e:
            if STT_IS_GRADIUM:
                logger.error(f"Gradium STT connection closed with error: {e}")
            else:
                logger.error(f"Kyutai STT connection closed with error: {e}")
        finally:
            self.shutdown_complete.set()

    def audio_to_base64_pcm(self, audio: np.ndarray) -> str:
        """Convert numpy audio array to base64-encoded PCM data for Gradium."""
        audio_int16 = (audio * 32767).astype(np.int16)
        audio_bytes = audio_int16.tobytes()
        return base64.b64encode(audio_bytes).decode("utf-8")

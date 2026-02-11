import asyncio
import datetime as dt
import math
import uuid
from logging import getLogger
from typing import Any, Literal, cast

import numpy as np
import pydantic_core
import websockets
from fastrtc import (
    AdditionalOutputs,
    AsyncStreamHandler,
    CloseStream,
    audio_to_float32,
    wait_for_item,
)
from pydantic import BaseModel

import backend.openai_realtime_api_events as ora
from backend import metrics as mt
from backend.kyutai_constants import (
    FRAME_TIME_SEC,
    SAMPLE_RATE,
    SAMPLES_PER_FRAME,
)
from backend.llm.chatbot import Chatbot
from backend.llm.llm_utils import (
    VLLMStream,
    get_openai_client,
)
from backend.quest_manager import Quest, QuestManager
from backend.service_discovery import find_instance
from backend.storage import UserData, get_user_data_from_storage
from backend.stt.speech_to_text import (
    SpeechToText,
    STTMarkerMessage,
)
from backend.timer import Stopwatch

TTS_DEBUGGING_TEXT = None
DEBUG_PLOT_HISTORY_SEC = 10.0

USER_SILENCE_TIMEOUT = 7.0
FIRST_MESSAGE_TEMPERATURE = 0.7
FURTHER_MESSAGES_TEMPERATURE = 0.3
# For this much time, the VAD does not interrupt the bot. This is needed because at
# least on Mac, the echo cancellation takes a while to kick in, at the start, so the ASR
# sometimes hears a bit of the TTS audio and interrupts the bot. Only happens on the
# first message.
# A word from the ASR can still interrupt the bot.
UNINTERRUPTIBLE_BY_VAD_TIME_SEC = 3

logger = getLogger(__name__)

HandlerOutput = (
    tuple[int, uuid.UUID, np.ndarray]
    | AdditionalOutputs
    | ora.ServerEvent
    | CloseStream
)


class ErrorFromTTS(Exception):
    pass


class GradioUpdate(BaseModel):
    chat_history: list[dict[str, str]]
    debug_dict: dict[str, Any]
    debug_plot_data: list[dict]


class UnmuteHandler(AsyncStreamHandler):
    def __init__(
        self, user_email_or_data: str | UserData, local_time: dt.datetime
    ) -> None:
        super().__init__(
            input_sample_rate=SAMPLE_RATE,
            # IMPORTANT! If set to a higher value, will lead to choppy audio. 🤷‍♂️
            output_frame_size=480,
            output_sample_rate=SAMPLE_RATE,
        )
        self.n_samples_received = 0  # Used for measuring time
        self.output_queue: asyncio.Queue[HandlerOutput] = asyncio.Queue()

        self.quest_manager = QuestManager()

        self.stt_last_message_time: float = 0
        self.stt_end_of_flush_time: float | None = None
        self.stt_flush_timer = Stopwatch()

        self.tts_voice: str | None = None  # Stored separately because TTS is restarted
        if isinstance(user_email_or_data, str):
            user_data = get_user_data_from_storage(user_email_or_data)
        else:
            user_data = user_email_or_data

        self.chatbot = Chatbot(user_data, start_time=local_time)
        self.openai_client = get_openai_client()

        self.turn_transition_lock = asyncio.Lock()

        self.debug_dict: dict[str, Any] = {
            "timing": {},
            "connection": {},
            "chatbot": {},
        }
        self.debug_plot_data: list[dict] = []
        self.last_additional_output_update = self.audio_received_sec()

    async def cleanup(self):
        self.chatbot.user_data.save()

    @property
    def stt(self) -> SpeechToText | None:
        try:
            quest = self.quest_manager.quests["stt"]
        except KeyError:
            return None
        return cast(Quest[SpeechToText], quest).get_nowait()

    def get_gradio_update(self):
        self.debug_dict["conversation_state"] = self.chatbot.conversation_state()
        self.debug_dict["connection"]["stt"] = self.stt.state() if self.stt else "none"
        self.debug_dict["connection"]["tts"] = "none"
        self.debug_dict["tts_voice"] = self.tts_voice or "none"
        self.debug_dict["stt_pause_prediction"] = (
            self.stt.pause_prediction.value if self.stt else -1
        )

        return AdditionalOutputs(
            GradioUpdate(
                chat_history=[
                    # Not trying to hide the system prompt, just making it less verbose
                    m.model_dump(mode="json")
                    for m in self.chatbot.current_conversation
                ],
                debug_dict=self.debug_dict,
                debug_plot_data=[],
            )
        )

    def add_chat_message_delta(
        self,
        delta: str,
        role: Literal["user", "assistant"],
        generating_message_i: int | None = None,  # Avoid race conditions
    ):
        logger.info("Adding chat message delta: %s, %s", delta, role)
        is_new_message = self.chatbot.add_chat_message_delta(
            delta, role, generating_message_i=generating_message_i
        )

        return is_new_message

    async def add_keywords(self, message: ora.CurrentKeywords) -> None:
        self.chatbot.current_keywords = message.keywords
        if self.chatbot.current_keywords is not None:
            # If there was a generated response before, it likely didn't have the keywords
            await self._generate_response()

    async def set_desired_responses_length(
        self, message: ora.DesiredResponsesLenght
    ) -> None:
        must_generate_response = self.chatbot.desired_responses_length != message.length
        self.chatbot.desired_responses_length = message.length
        logger.info("Desired responses length set to %s", message.length)
        if must_generate_response:
            # If there was a generated response before, it likely didn't have the keywords
            await self._generate_response()

    async def select_response(self, message_content: str, id_: uuid.UUID):
        self.chatbot.select_response(message_content, id_)
        await self._generate_response()

    async def _generate_response(self):
        # Empty message to signal we've started responding.
        # Do it here in the lock to avoid race conditions
        quest = Quest.from_run_step(
            "llm" + str(dt.datetime.now()), self._generate_response_task
        )
        await self.quest_manager.add(quest)

    async def _generate_response_task(self):
        # Create timestamp at the start of response generation
        response_generation_timestamp = dt.datetime.now()

        self.chatbot.conversation_state_override = "bot_speaking"
        generating_message_i = len(self.chatbot.current_conversation)

        await self.output_queue.put(
            ora.ResponseCreated(
                response=ora.Response(
                    status="in_progress",
                    voice=self.tts_voice or "missing",
                )
            )
        )

        llm_stopwatch = Stopwatch()

        llm = VLLMStream(
            # if generating_message_i is 2, then we have a system prompt + an empty
            # assistant message signalling that we are generating a response.
            self.openai_client,
            thinking_mode=self.chatbot.user_data.user_settings.thinking_mode,
            temperature=(
                FIRST_MESSAGE_TEMPERATURE
                if generating_message_i == 2
                else FURTHER_MESSAGES_TEMPERATURE
            ),
        )

        messages = self.chatbot.preprocessed_messages()

        all_words = []
        error_from_tts = False

        num_words_sent = sum(
            len(message.get("content", "").split()) for message in messages
        )
        mt.VLLM_SENT_WORDS.inc(num_words_sent)
        mt.VLLM_REQUEST_LENGTH.observe(num_words_sent)
        mt.VLLM_ACTIVE_SESSIONS.inc()

        nb_keywords_sent = 0
        number_of_responses_sent = 0
        logger.info("starting VLLM")
        try:
            async for delta in llm.chat_completion(messages):
                if not all_words:
                    # Logging time to first word
                    logger.info(
                        "Got the first word after %.2f sec", llm_stopwatch.time()
                    )

                # Logging and monitoring
                mt.VLLM_RECV_WORDS.inc()
                all_words.append(delta)
                all_text = "".join(all_words)
                if all_text == "":
                    continue
                json_decoded = pydantic_core.from_json(all_text, allow_partial=True)
                if "suggested_keywords" in json_decoded:
                    for i, keyword in enumerate(json_decoded["suggested_keywords"]):
                        if i < nb_keywords_sent:
                            continue
                        await self.output_queue.put(
                            ora.OneKeyword(
                                content=keyword.strip(),
                                timestamp=response_generation_timestamp,
                                index=nb_keywords_sent,
                            )
                        )
                        nb_keywords_sent += 1

                if "suggested_answers" in json_decoded:
                    for i, answer in enumerate(json_decoded["suggested_answers"]):
                        if i < number_of_responses_sent:
                            continue
                        await self.output_queue.put(
                            ora.OneResponse(
                                content=answer.strip(),
                                timestamp=response_generation_timestamp,
                                index=number_of_responses_sent,
                            )
                        )
                        number_of_responses_sent += 1

            logger.info("loop done")

        except asyncio.CancelledError:
            mt.VLLM_INTERRUPTS.inc()
            raise
        except Exception as e:
            if not error_from_tts:
                mt.VLLM_HARD_ERRORS.inc()
            logger.error(e, exc_info=True)
            raise
        finally:
            self.chatbot.conversation_state_override = "waiting_for_user"
            logger.info("End of VLLM, after %d words.", len(all_words))
            logger.info("All output: " + "".join(all_words))
            mt.VLLM_ACTIVE_SESSIONS.dec()
            mt.VLLM_REPLY_LENGTH.observe(len(all_words))
            mt.VLLM_GEN_DURATION.observe(llm_stopwatch.time())
            logger.info(
                f"Generated {len(all_words)} words in {llm_stopwatch.time():.2f} sec"
            )

    def audio_received_sec(self) -> float:
        """How much audio has been received in seconds. Used instead of time.time().

        This is so that we aren't tied to real-time streaming.
        """
        return self.n_samples_received / self.input_sample_rate

    async def receive(self, frame: tuple[int, np.ndarray]) -> None:
        stt = self.stt
        assert stt is not None
        sr = frame[0]
        assert sr == self.input_sample_rate

        assert frame[1].shape[0] == 1  # Mono
        array = frame[1][0]

        self.n_samples_received += array.shape[0]

        # If this doesn't update, it means the receive loop isn't running because
        # the process is busy with something else, which is bad.
        self.debug_dict["last_receive_time"] = self.audio_received_sec()
        float_audio = audio_to_float32(array)
        self.debug_dict["chatbot"]["state_override"] = (
            self.chatbot.conversation_state_override
        )
        self.debug_plot_data.append(
            {
                "t": self.audio_received_sec(),
                "amplitude": float(np.sqrt((float_audio**2).mean())),
                "pause_prediction": stt.pause_prediction.value,
            }
        )

        if self.chatbot.conversation_state() == "bot_speaking":
            # Periodically update this not to trigger the "long silence" accidentally.
            self.waiting_for_user_start_time = self.audio_received_sec()

        if self.chatbot.conversation_state() == "user_speaking":
            self.debug_dict["timing"] = {}

        await stt.send_audio(array)
        if self.stt_end_of_flush_time is None:
            if self.determine_pause():
                logger.info("Pause detected")
                await self.output_queue.put(ora.InputAudioBufferSpeechStopped())

                self.stt_end_of_flush_time = stt.current_time + stt.delay_sec
                self.stt_flush_timer = Stopwatch()
                num_frames = (
                    int(math.ceil(stt.delay_sec / FRAME_TIME_SEC)) + 1
                )  # some safety margin.
                zero = np.zeros(SAMPLES_PER_FRAME, dtype=np.float32)
                for _ in range(num_frames):
                    await stt.send_audio(zero)
        else:
            # We do not try to detect interruption here, the STT would be processing
            # a chunk full of 0, so there is little chance the pause score would indicate an interruption.
            if stt.current_time > self.stt_end_of_flush_time:
                logger.info(
                    f"After the flush time, of {stt.current_time - self.stt_end_of_flush_time:.2f} sec"
                )
                self.stt_end_of_flush_time = None
                elapsed = self.stt_flush_timer.time()
                rtf = stt.delay_sec / elapsed
                logger.info(
                    "Flushing finished, took %.1f ms, RTF: %.1f", elapsed * 1000, rtf
                )
                await self._generate_response()

    def determine_pause(self) -> bool:
        stt = self.stt
        if stt is None:
            logger.info("No STT instance, not determining pause.")
            return False
        if self.chatbot.conversation_state() != "user_speaking":
            return False

        # This is how much wall clock time has passed since we received the last ASR
        # message. Assumes the ASR connection is healthy, so that stt.sent_samples is up
        # to date.
        time_since_last_message = (
            stt.sent_samples / self.input_sample_rate
        ) - self.stt_last_message_time
        self.debug_dict["time_since_last_message"] = time_since_last_message

        if stt.pause_prediction.value > 0.6:
            self.debug_dict["timing"]["pause_detection"] = time_since_last_message
            logger.info(
                f"Pause detected, pause_prediction: {stt.pause_prediction.value:.2f} time since last message: {time_since_last_message:.2f} sec"
            )
            return True
        else:
            logger.info(
                "No pause here, pause_prediction: %.2f", stt.pause_prediction.value
            )
            return False

    async def emit(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
    ) -> HandlerOutput | None:
        output_queue_item = await wait_for_item(self.output_queue)

        if output_queue_item is not None:
            return output_queue_item
        else:
            if self.last_additional_output_update < self.audio_received_sec() - 1:
                # If we have nothing to emit, at least update the debug dict.
                # Don't update too often for performance reasons
                self.last_additional_output_update = self.audio_received_sec()
                return self.get_gradio_update()
            else:
                return None

    def copy(self):
        return UnmuteHandler(
            self.chatbot.user_data, self.chatbot.user_data.conversations[-1].start_time
        )

    async def __aenter__(self) -> None:
        await self.quest_manager.__aenter__()

    async def start_up(self):
        await self.start_up_stt()
        self.waiting_for_user_start_time = self.audio_received_sec()

    async def __aexit__(self, *exc: Any) -> None:
        return await self.quest_manager.__aexit__(*exc)

    async def start_up_stt(self):
        async def _init() -> SpeechToText:
            return await find_instance("stt", SpeechToText)

        async def _run(stt: SpeechToText):
            await self._stt_loop(stt)

        async def _close(stt: SpeechToText):
            await stt.shutdown()

        quest = await self.quest_manager.add(Quest("stt", _init, _run, _close))
        # We want to be sure to have the STT before starting anything.
        await quest.get()

    async def _stt_loop(self, stt: SpeechToText):
        try:
            async for data in stt:
                if isinstance(data, STTMarkerMessage):
                    # Ignore the marker messages
                    continue

                await self.output_queue.put(
                    ora.ConversationItemInputAudioTranscriptionDelta(
                        delta=data.text,
                        start_time=data.start_time,
                    )
                )

                # The STT sends an empty string as the first message, but we
                # don't want to add that because it can trigger a pause even
                # if the user hasn't started speaking yet.
                if data.text == "":
                    continue

                logger.info("Will add stt message to chat")

                self.stt_last_message_time = data.start_time
                is_new_message = self.add_chat_message_delta(data.text, "user")
                if self.chatbot.conversation_state_override == "waiting_for_user":
                    self.chatbot.conversation_state_override = None
                if is_new_message:
                    # Ensure we don't stop after the first word if the VAD didn't have
                    # time to react.
                    stt.pause_prediction.value = 0.0
                    await self.output_queue.put(ora.InputAudioBufferSpeechStarted())
        except websockets.ConnectionClosed:
            logger.info("STT connection closed while receiving messages.")

    async def interrupt_bot(self):
        if self.chatbot.conversation_state() != "bot_speaking":
            raise RuntimeError(
                "Can't interrupt bot when conversation state is "
                f"{self.chatbot.conversation_state()}"
            )

        if self._clear_queue is not None:
            # Clear any audio queued up by FastRTC's emit().
            # Not sure under what circumstatnces this is None.
            self._clear_queue()
        self.output_queue = asyncio.Queue()  # Clear our own queue too

        await self.output_queue.put(ora.UnmuteInterruptedByVAD())

        await self.quest_manager.remove("llm")

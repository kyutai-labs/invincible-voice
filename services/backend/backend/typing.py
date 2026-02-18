import datetime as dt
import uuid
from typing import Literal

import pydantic
from pydantic import computed_field


class LLMMessage(pydantic.BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class SpeakerMessage(pydantic.BaseModel):
    speaker: str
    content: str


class WriterMessage(pydantic.BaseModel):
    content: str
    message_id: uuid.UUID  # useful to find the audio file for this message


class Conversation(pydantic.BaseModel):
    messages: list[SpeakerMessage | WriterMessage]
    start_time: dt.datetime


class Document(pydantic.BaseModel):
    title: str
    content: str


class UserSettings(pydantic.BaseModel):
    name: str
    prompt: str
    additional_keywords: list[str]
    friends: list[str]
    documents: list[Document] = pydantic.Field(default_factory=list)
    voice: str | None = None
    expected_transcription_language: str | None = None


class GoogleAuthRequest(pydantic.BaseModel):
    token: str
    language: str


class HealthStatus(pydantic.BaseModel):
    stt_up: bool
    llm_up: bool

    @computed_field
    @property
    def ok(self) -> bool:
        # Note that voice cloning is not required for the server to be healthy.
        return self.stt_up and self.llm_up


class TTSRequest(pydantic.BaseModel):
    text: str
    message_id: uuid.UUID
    voice_name: str | None = None


class VoiceSelectionRequest(pydantic.BaseModel):
    voice: str

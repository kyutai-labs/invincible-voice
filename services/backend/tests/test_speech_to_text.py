"""Checks on the messages sent to the Gradium STT.

Gradium only reads transcription settings (language, keywords, ...) from the
`json_config` field of the setup message, serialized as a JSON string. A
top-level `language` key is silently ignored, which made the STT always run in
auto-detect mode. See https://docs.gradium.ai/guides/transcription-settings
"""

import json
from unittest.mock import AsyncMock

import pytest

from backend.stt import speech_to_text
from backend.stt.speech_to_text import (
    GradiumSetupMessage,
    SpeechToText,
    gradium_stt_json_config,
)


def test_json_config_contains_the_language():
    config = gradium_stt_json_config("fr")
    assert config is not None
    assert json.loads(config) == {"language": "fr"}


@pytest.mark.parametrize("expected_language", [None, ""])
def test_no_json_config_when_no_language(expected_language):
    assert gradium_stt_json_config(expected_language) is None


def test_setup_message_has_no_top_level_language():
    assert "language" not in GradiumSetupMessage.model_fields


@pytest.mark.asyncio
async def test_setup_message_sent_to_gradium(monkeypatch):
    monkeypatch.setattr(speech_to_text, "STT_IS_GRADIUM", True)
    stt = SpeechToText(expected_language="de")
    stt.websocket = AsyncMock()

    await stt._send(
        GradiumSetupMessage(
            model_name="default",
            input_format="pcm",
            json_config=gradium_stt_json_config(stt.expected_language),
        )
    )

    stt.websocket.send.assert_awaited_once()
    sent = json.loads(stt.websocket.send.call_args.args[0])
    assert sent["type"] == "setup"
    assert sent["model_name"] == "default"
    assert sent["input_format"] == "pcm"
    assert "language" not in sent
    # json_config is a JSON string inside the JSON message, as in the SDK.
    assert isinstance(sent["json_config"], str)
    assert json.loads(sent["json_config"]) == {"language": "de"}


@pytest.mark.asyncio
async def test_setup_message_without_language_omits_json_config(monkeypatch):
    monkeypatch.setattr(speech_to_text, "STT_IS_GRADIUM", True)
    stt = SpeechToText(expected_language=None)
    stt.websocket = AsyncMock()

    await stt._send(
        GradiumSetupMessage(
            model_name="default",
            input_format="pcm",
            json_config=gradium_stt_json_config(stt.expected_language),
        )
    )

    sent = json.loads(stt.websocket.send.call_args.args[0])
    assert "language" not in sent
    assert "json_config" not in sent

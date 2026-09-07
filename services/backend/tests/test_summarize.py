import datetime as dt
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from backend.llm import summarize
from backend.llm.prompt_budget import (
    CONVERSATION_SUMMARY_MIN_WORDS,
    CONVERSATION_SUMMARY_TARGET_WORDS,
    TEXT_SUMMARY_TARGET_WORDS,
)
from backend.main import app
from backend.routes.user import get_current_user
from backend.storage import UserData
from backend.typing import Conversation, SpeakerMessage, UserSettings, WriterMessage

NOW = dt.datetime(2025, 7, 9, 14, 56)


def fake_llm(summary: str = "A short summary.") -> AsyncMock:
    """An AsyncOpenAI look-alike whose chat completion returns `summary`."""
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=summary))]
    )
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(return_value=response)
    return client


def make_user_data(conversations: list[Conversation]) -> UserData:
    return UserData(
        user_id=uuid.uuid4(),
        email="user@example.com",
        hashed_password="hashed-password",
        google_sub=None,
        user_settings=UserSettings(
            name="Ada", prompt="", additional_keywords=[], friends=[], documents=[]
        ),
        conversations=conversations,
    )


def long_conversation(days_ago: int) -> Conversation:
    content = " ".join("word" for _ in range(CONVERSATION_SUMMARY_MIN_WORDS + 1))
    return Conversation(
        messages=[SpeakerMessage(speaker="Unknown speaker", content=content)],
        start_time=NOW - dt.timedelta(days=days_ago),
    )


@pytest.mark.asyncio
async def test_summarize_text_sends_the_target_length_and_the_text() -> None:
    client = fake_llm("  Résumé.  ")

    summary = await summarize.summarize_text("Un long texte.", 200, client)

    assert summary == "Résumé."
    kwargs = client.chat.completions.create.await_args.kwargs
    system, user = kwargs["messages"]
    assert system["role"] == "system"
    assert "about 200 words" in system["content"]
    assert user == {"role": "user", "content": "Un long texte."}


@pytest.mark.asyncio
async def test_summarize_text_rejects_an_empty_answer() -> None:
    with pytest.raises(RuntimeError):
        await summarize.summarize_text("text", 200, fake_llm("   "))


def test_conversation_transcript_names_both_sides() -> None:
    conversation = Conversation(
        messages=[
            SpeakerMessage(speaker="Unknown speaker", content=" How are you? "),
            WriterMessage(message_id=uuid.uuid4(), content="Tired."),
        ],
        start_time=NOW,
    )

    assert (
        summarize.conversation_transcript(conversation, "Ada")
        == "Speaker: How are you?\nAda: Tired."
    )


@pytest.mark.asyncio
async def test_summarize_long_conversations_only_touches_past_long_ones(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    short = Conversation(
        messages=[SpeakerMessage(speaker="Unknown speaker", content="Hi")],
        start_time=NOW - dt.timedelta(days=3),
    )
    already = long_conversation(days_ago=2)
    already.summary = "Existing summary."
    to_summarize = long_conversation(days_ago=1)
    current = long_conversation(days_ago=0)
    user_data = make_user_data([short, already, to_summarize, current])
    saves: list[bool] = []
    monkeypatch.setattr(UserData, "save", lambda self: saves.append(True))
    client = fake_llm("New summary.")

    written = await summarize.summarize_long_conversations(user_data, client)

    assert written == 1
    assert to_summarize.summary == "New summary."
    assert short.summary is None
    assert already.summary == "Existing summary."
    assert current.summary is None, "the current conversation is never summarized"
    assert saves == [True]
    kwargs = client.chat.completions.create.await_args.kwargs
    assert (
        f"about {CONVERSATION_SUMMARY_TARGET_WORDS} words"
        in kwargs["messages"][0]["content"]
    )


@pytest.mark.asyncio
async def test_summarize_long_conversations_survives_llm_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_data = make_user_data([long_conversation(1), long_conversation(0)])
    monkeypatch.setattr(UserData, "save", lambda self: None)
    client = fake_llm()
    client.chat.completions.create.side_effect = RuntimeError("LLM down")

    written = await summarize.summarize_long_conversations(user_data, client)

    assert written == 0
    assert user_data.conversations[0].summary is None


@pytest.mark.asyncio
async def test_nothing_is_saved_when_no_summary_is_needed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_data = make_user_data([long_conversation(0)])
    saves: list[bool] = []
    monkeypatch.setattr(UserData, "save", lambda self: saves.append(True))

    assert await summarize.summarize_long_conversations(user_data, fake_llm()) == 0
    assert saves == []


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: make_user_data([])
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_summarize_endpoint_returns_summary_and_word_count(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from backend.routes import user as user_routes

    fake = AsyncMock(return_value="Three words here.")
    monkeypatch.setattr(user_routes, "summarize_text", fake)

    response = client.post("/v1/user/summarize", json={"text": "A very long prompt."})

    assert response.status_code == 200, response.text
    assert response.json() == {"summary": "Three words here.", "word_count": 3}
    fake.assert_awaited_once_with("A very long prompt.", TEXT_SUMMARY_TARGET_WORDS)

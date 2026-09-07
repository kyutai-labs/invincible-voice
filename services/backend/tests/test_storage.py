import os
import tempfile
import uuid

os.environ.setdefault("STT_IS_GRADIUM", "false")
os.environ.setdefault("KYUTAI_STT_URL", "ws://stt.example.test")
os.environ.setdefault("TTS_IS_GRADIUM", "false")
os.environ.setdefault("TTS_SERVER", "https://tts.example.test")
os.environ.setdefault("KYUTAI_LLM_API_KEY", "test-key")
os.environ.setdefault("KYUTAI_LLM_URL", "https://llm.example.test")
os.environ.setdefault("KYUTAI_LLM_MODEL", "test-model")
os.environ.setdefault(
    "KYUTAI_USERS_DATA_PATH",
    os.path.join(tempfile.gettempdir(), "invincible-voice-test-users"),
)


def test_llm_ready_conversation_includes_document_content() -> None:
    from backend.storage import UserData
    from backend.typing import Document, UserSettings

    document_content = "The user prefers brief answers and confirms with eye gaze."
    user_data = UserData(
        user_id=uuid.uuid4(),
        email="user@example.com",
        hashed_password="hashed-password",
        google_sub=None,
        user_settings=UserSettings(
            name="Ada",
            prompt="Speak naturally.",
            additional_keywords=[],
            friends=[],
            documents=[
                Document(
                    title="Communication preferences",
                    content=document_content,
                )
            ],
        ),
        conversations=[],
    )

    prompt = user_data.to_llm_ready_conversation(
        user_text_hint=None, desired_responses_length="M"
    )[0].content

    assert '### Document 1 "Communication preferences"' in prompt
    assert document_content in prompt
    assert "{document.content}" not in prompt


def _make_user_data(conversations):
    from backend.storage import UserData
    from backend.typing import UserSettings

    return UserData(
        user_id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        hashed_password="hashed-password",
        google_sub=None,
        user_settings=UserSettings(
            name="Ada", prompt="Speak naturally.", additional_keywords=[], friends=[]
        ),
        conversations=conversations,
    )


def test_save_leaves_out_empty_conversations() -> None:
    import datetime as dt

    from backend.storage import get_user_data_from_storage
    from backend.typing import Conversation, SpeakerMessage

    start = dt.datetime(2026, 9, 7, 10, 0, tzinfo=dt.timezone.utc)
    kept = Conversation(
        messages=[SpeakerMessage(speaker="speaker", content="Hello there")],
        start_time=start,
    )
    user_data = _make_user_data(
        [
            Conversation(messages=[], start_time=start - dt.timedelta(days=2)),
            kept,
            # The current conversation of a session that just started.
            Conversation(messages=[], start_time=start + dt.timedelta(hours=1)),
        ]
    )

    user_data.save()

    reloaded = get_user_data_from_storage(user_data.email)
    assert reloaded.conversations == [kept]
    # The live object is not modified, the session keeps its current conversation.
    assert len(user_data.conversations) == 3
    assert user_data.conversations[-1].messages == []

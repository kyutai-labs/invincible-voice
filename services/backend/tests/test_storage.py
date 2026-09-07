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

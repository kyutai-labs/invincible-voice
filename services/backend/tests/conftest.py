import os
import tempfile

# Minimal environment so that backend modules can be imported in tests.
os.environ.setdefault("STT_IS_GRADIUM", "false")
os.environ.setdefault("KYUTAI_STT_URL", "ws://stt.example.test")
os.environ.setdefault("TTS_IS_GRADIUM", "false")
os.environ.setdefault("TTS_SERVER", "https://tts.example.test")
os.environ.setdefault("KYUTAI_LLM_API_KEY", "test-key")
os.environ.setdefault("KYUTAI_LLM_URL", "https://llm.example.test")
os.environ.setdefault("KYUTAI_LLM_MODEL", "test-model")
os.environ.setdefault("GRADIUM_API_KEY", "test-gradium-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault(
    "KYUTAI_USERS_DATA_PATH",
    os.path.join(tempfile.gettempdir(), "invincible-voice-test-users"),
)

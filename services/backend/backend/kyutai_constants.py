import os
from pathlib import Path


def is_env_true(env_var_name: str) -> bool:
    env_var_value = os.environ[env_var_name]

    env_var_lower = env_var_value.lower()
    if env_var_lower not in ("true", "false", "1", "0"):
        raise ValueError(f"Invalid boolean value: {env_var_value}")
    return env_var_lower in ("true", "1")


# The defaults are already ws://, but make the env vars support http:// and https://
STT_IS_GRADIUM = is_env_true("STT_IS_GRADIUM")
KYUTAI_STT_URL = os.environ["KYUTAI_STT_URL"]
TTS_IS_GRADIUM = is_env_true("TTS_IS_GRADIUM")
TTS_SERVER = os.environ["TTS_SERVER"]

KYUTAI_API_KEY = os.environ.get("KYUTAI_API_KEY")

LLM_API_KEY = os.environ["KYUTAI_LLM_API_KEY"]
LLM_URL = os.environ["KYUTAI_LLM_URL"]
LLM_MODEL = os.environ["KYUTAI_LLM_MODEL"]
# If None, a dict-based cache will be used instead of Redis

# Redis Configuration for Locking
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
TTS_LOCK_TTL_SECONDS = int(os.getenv("TTS_LOCK_TTL_SECONDS", "300"))
STT_LOCK_TTL_SECONDS = int(os.getenv("STT_LOCK_TTL_SECONDS", "600"))

# Also checked on the frontend, see constant of the same name
MAX_VOICE_FILE_SIZE_MB = 4


SAMPLE_RATE = 24000
SAMPLES_PER_FRAME = 1920
FRAME_TIME_SEC = SAMPLES_PER_FRAME / SAMPLE_RATE  # 0.08
# TODO: make it so that we can read this from the ASR server?
STT_DELAY_SEC = 2

USERS_DATA_DIR = Path(os.environ["KYUTAI_USERS_DATA_PATH"])

USERS_AUDIO_DIR = USERS_DATA_DIR / "user_audio"
USERS_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

USERS_SETTINGS_AND_HISTORY_DIR = USERS_DATA_DIR / "user_settings_and_history"
USERS_SETTINGS_AND_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
TTS_VOICE_ID = os.environ.get("TTS_VOICE_ID", "kelly")

import os

from cloudpathlib import AnyPath


def is_value_true(value: str, env_var_name: str) -> bool:
    env_var_lower = value.lower()
    if env_var_lower not in ("true", "false", "1", "0"):
        raise ValueError(
            f"Invalid boolean value: {value} for environment variable {env_var_name}"
        )
    return env_var_lower in ("true", "1")


def is_env_true(env_var_name: str) -> bool:
    if env_var_name not in os.environ:
        return False
    env_var_value = os.environ[env_var_name]
    return is_value_true(env_var_value, env_var_name)


# The defaults are already ws://, but make the env vars support http:// and https://
# STT Configuration
STT_PROVIDER = os.environ.get("KYUTAI_STT_PROVIDER").lower()
if STT_PROVIDER not in ("gradium", "dsm"):
    raise ValueError(
        f"Invalid KYUTAI_STT_PROVIDER: {STT_PROVIDER}, must be 'gradium' or 'dsm'"
    )
KYUTAI_STT_URL = os.environ["KYUTAI_STT_SERVER"]

# TTS Configuration
TTS_SERVER = os.environ["KYUTAI_TTS_SERVER"]
TTS_PROVIDER = os.environ.get("KYUTAI_TTS_PROVIDER").lower()
if not TTS_PROVIDER:
    # Default to Pocket TTS
    TTS_PROVIDER = "pocket"
if TTS_PROVIDER not in ("pocket", "gradium", "dsm"):
    raise ValueError(
        f"Invalid KYUTAI_TTS_PROVIDER: {TTS_PROVIDER}, must be 'pocket', 'gradium', or 'dsm'"
    )
if TTS_SERVER == "":  # If empty we force local Pocket TTS
    TTS_PROVIDER = "pocket"

KYUTAI_API_KEY = os.environ.get("KYUTAI_API_KEY")

LLM_API_KEY = os.environ["KYUTAI_LLM_API_KEY"]
LLM_URL = os.environ["KYUTAI_LLM_URL"]
LLM_MODEL = os.environ["KYUTAI_LLM_MODEL"]
# If None, a dict-based cache will be used instead of Redis

# Redis Configuration for Locking
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
TTS_LOCK_TTL_SECONDS = int(os.getenv("TTS_LOCK_TTL_SECONDS", "30"))
STT_LOCK_TTL_SECONDS = int(os.getenv("STT_LOCK_TTL_SECONDS", "600"))

# Also checked on the frontend, see constant of the same name
MAX_VOICE_FILE_SIZE_MB = 4


SAMPLE_RATE = 24000
SAMPLES_PER_FRAME = 1920
FRAME_TIME_SEC = SAMPLES_PER_FRAME / SAMPLE_RATE  # 0.08
# TODO: make it so that we can read this from the ASR server?
STT_DELAY_SEC = 2

USERS_DATA_DIR = AnyPath(os.environ["KYUTAI_USERS_DATA_PATH"])

USERS_AUDIO_DIR = USERS_DATA_DIR / "user_audio"
USERS_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

USERS_SETTINGS_AND_HISTORY_DIR = USERS_DATA_DIR / "user_settings_and_history"
USERS_SETTINGS_AND_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
TTS_VOICE_ID = os.environ.get("KYUTAI_TTS_VOICE_ID")
if not TTS_VOICE_ID:
    if TTS_PROVIDER == "gradium":
        TTS_VOICE_ID = "kelly"
    elif TTS_PROVIDER == "dsm":
        TTS_VOICE_ID = "unmute-prod-website/developer-1.mp3"
    else:  # TTS_PROVIDER == "pocket"
        TTS_VOICE_ID = "alba"

ALLOW_PASSWORD = is_value_true(
    os.environ.get("ALLOW_PASSWORD", "true") or "true", "ALLOW_PASSWORD"
)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "REPLACE_ME")

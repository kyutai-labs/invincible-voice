from backend.typing import HealthStatus


async def get_health():  # dummy param _none because caching function expects a single param as cache key.
    return HealthStatus(
        stt_up=True,
        llm_up=True,
    )

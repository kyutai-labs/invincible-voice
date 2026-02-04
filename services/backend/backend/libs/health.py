from functools import partial

from backend.service_discovery import async_ttl_cached
from backend.typing import HealthStatus


@partial(async_ttl_cached, ttl_sec=0.5)
async def get_health(
    _none: None,
):  # dummy param _none because caching function expects a single param as cache key.
    return HealthStatus(
        stt_up=True,
        llm_up=True,
    )

import asyncio
import logging

import redis.asyncio as aioredis

from backend import metrics as mt

logger = logging.getLogger(__name__)

LOCK_METRIC_POLL_INTERVAL_SECONDS = 10


async def _count_locks_by_pattern(redis_client: aioredis.Redis, pattern: str) -> int:
    """Count keys matching a specific pattern in Redis."""
    count = 0
    async for _ in redis_client.scan_iter(match=pattern):
        count += 1
    return count


async def update_redis_lock_metrics(redis_host: str, redis_port: str):
    """Background task that periodically queries Redis and updates lock count metrics."""
    redis_client: aioredis.Redis | None = None

    try:
        redis_client = await aioredis.from_url(f"redis://{redis_host}:{redis_port}")
        logger.info(
            f"Connected to Redis at {redis_host}:{redis_port} for metrics collection"
        )

        while True:
            try:
                stt_locks = await _count_locks_by_pattern(redis_client, "stt:lock:*")
                tts_locks = await _count_locks_by_pattern(redis_client, "tts:lock:*")

                mt.REDIS_STT_LOCKS.set(stt_locks)
                mt.REDIS_TTS_LOCKS.set(tts_locks)

                logger.debug(
                    f"Updated Redis lock metrics - STT: {stt_locks}, TTS: {tts_locks}"
                )
            except Exception as e:
                logger.error(f"Failed to update Redis lock metrics: {e}", exc_info=True)

            await asyncio.sleep(LOCK_METRIC_POLL_INTERVAL_SECONDS)
    except Exception as e:
        logger.error(
            f"Fatal error in Redis metrics background task: {e}", exc_info=True
        )
    finally:
        if redis_client:
            await redis_client.close()
            logger.info("Redis_metrics client closed")


class RedisMetricsBackgroundTask:
    """Manages the lifecycle of the Redis metrics background task."""

    def __init__(self, redis_host: str, redis_port: str):
        self.redis_host = redis_host
        self.redis_port = redis_port
        self._task: asyncio.Task | None = None

    async def start(self):
        """Start the background task."""
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(
                update_redis_lock_metrics(self.redis_host, self.redis_port)
            )
            logger.info("Redis metrics background task started")

    async def stop(self):
        """Stop the background task."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                logger.info("Redis metrics background task cancelled")
            logger.info("Redis metrics background task stopped")

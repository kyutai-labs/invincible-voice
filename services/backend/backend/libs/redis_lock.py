import asyncio
import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

class RedisLockManager:
    """Manages Redis locks for TTS calls on a per-user basis."""

    def __init__(self, host: str, port: int, lock_ttl_seconds: int = 300):
        self.host = host
        self.port = port
        self.lock_ttl_seconds = lock_ttl_seconds
        self._client: aioredis.Redis | None = None

    async def get_client(self) -> aioredis.Redis:
        """Get or create the Redis client."""
        if self._client is None:
            self._client = await aioredis.from_url(f"redis://{self.host}:{self.port}")
        return self._client

    async def close(self):
        """Close the Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

    @asynccontextmanager
    async def acquire_lock(self, user_id: str, lock_name: str):
        """Acquire a lock for a given user and operation.

        The lock is released when the context manager exits.
        """
        lock_key = f"{lock_name}:lock:{user_id}"
        client = await self.get_client()

        # Try to acquire the lock with exponential backoff
        max_retries = 7
        base_delay = 0.1  # 100ms
        max_delay = 4.0  # 4 seconds

        for attempt in range(max_retries):
            acquired = await client.set(lock_key, "1", nx=True, ex=self.lock_ttl_seconds)

            if acquired:
                try:
                    logger.info(f"Acquired {lock_name} lock for user {user_id}")
                    yield
                    return
                finally:
                    # Release the lock
                    await client.delete(lock_key)
                    logger.info(f"Released {lock_name} lock for user {user_id}")

            # Lock not acquired, wait and retry with exponential backoff
            delay = min(base_delay * (2**attempt), max_delay)
            logger.debug(
                f"Failed to acquire {lock_name} lock for user {user_id}, "
                f"attempt {attempt + 1}/{max_retries}, retrying in {delay:.2f}s"
            )
            await asyncio.sleep(delay)

        # Max retries reached - lock is still held
        logger.warning(
            f"Could not acquire {lock_name} lock for user {user_id} after {max_retries} attempts"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Another {lock_name.upper()} operation is currently in progress. Please wait.",
        )

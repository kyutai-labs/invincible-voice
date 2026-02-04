import asyncio
import logging
import os
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from backend.security import decode_access_token

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
            self._client = await aioredis.from_url(
                f"redis://{self.host}:{self.port}", decode_responses=False
            )
        return self._client

    async def close(self):
        """Close the Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None

    @asynccontextmanager
    async def acquire_lock(self, user_id: str, lock_name: str = "tts"):
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


class TTSLockMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure only one TTS operation per user at a time."""

    def __init__(
        self,
        app,
        redis_host: str = "localhost",
        redis_port: int = 6379,
        lock_ttl_seconds: int = 300,
    ):
        super().__init__(app)
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.lock_ttl_seconds = lock_ttl_seconds
        self._lock_manager = RedisLockManager(redis_host, redis_port, lock_ttl_seconds)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Apply lock to TTS POST endpoint
        if request.method == "POST" and request.url.path == "/v1/tts/":
            user_id = self._extract_user_id(request)
            if user_id:
                try:
                    async with self._lock_manager.acquire_lock(user_id, "tts"):
                        return await call_next(request)
                except HTTPException:
                    # Re-raise HTTP exceptions (like the 429 from lock timeout)
                    raise

        # Apply lock to STT WebSocket endpoint
        if request.url.path == "/v1/user/new-conversation":
            user_id = self._extract_user_id_from_websocket(request)
            if user_id:
                try:
                    async with self._lock_manager.acquire_lock(user_id, "stt"):
                        return await call_next(request)
                except HTTPException:
                    raise

        return await call_next(request)

    def _extract_user_id(self, request: Request) -> str | None:
        """Extract user ID from the Authorization header JWT token."""
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]  # Remove "Bearer " prefix
        try:
            payload = decode_access_token(token)
            return payload.get("sub")
        except Exception:
            logger.warning("Failed to decode JWT token in TTS lock middleware")
            return None

    def _extract_user_id_from_websocket(self, request: Request) -> str | None:
        """Extract user ID from WebSocket subprotocol (Bearer.<token>)."""
        subprotocols = request.scope.get("subprotocols", [])
        for protocol in subprotocols:
            if protocol.startswith("Bearer."):
                token = protocol.replace("Bearer.", "")
                try:
                    payload = decode_access_token(token)
                    return payload.get("sub")
                except Exception:
                    logger.warning("Failed to decode JWT token from WebSocket subprotocol")
                    return None
        return None

    async def close(self):
        """Clean up resources."""
        await self._lock_manager.close()
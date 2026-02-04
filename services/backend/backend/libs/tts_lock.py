import asyncio
import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from backend.security import decode_access_token

logger = logging.getLogger(__name__)


def _decode_user_id_from_token(token: str, log_context: str) -> str:
    """Decode and extract user ID from a JWT token."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return user_id
    except HTTPException:
        raise
    except Exception:
        logger.warning(f"Failed to decode JWT token in {log_context}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None


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
        self._lock_manager = RedisLockManager(redis_host, redis_port, lock_ttl_seconds)

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method == "POST" and request.url.path == "/v1/tts/":
            async with self._lock_manager.acquire_lock(self._extract_user_id(request), "tts"):
                return await call_next(request)

        if request.url.path == "/v1/user/new-conversation":
            async with self._lock_manager.acquire_lock(
                self._extract_user_id_from_websocket(request), "stt"
            ):
                return await call_next(request)

        return await call_next(request)

    def _extract_user_id(self, request: Request) -> str:
        """Extract user ID from the Authorization header JWT token."""
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required")
        return _decode_user_id_from_token(auth_header[7:], "TTS lock middleware")

    def _extract_user_id_from_websocket(self, request: Request) -> str:
        """Extract user ID from WebSocket subprotocol (Bearer.<token>)."""
        for protocol in request.scope.get("subprotocols", []):
            if protocol.startswith("Bearer."):
                return _decode_user_id_from_token(protocol[7:], "WebSocket subprotocol")
        raise HTTPException(status_code=401, detail="Authentication required")

    async def close(self):
        """Clean up resources."""
        await self._lock_manager.close()

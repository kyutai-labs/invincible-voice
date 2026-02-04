import logging

from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from backend.libs.redis_lock import RedisLockManager
from backend.security import decode_access_token

logger = logging.getLogger(__name__)


def _decode_user_id_from_token(token: str, log_context: str) -> str:
    """Decode and extract user ID from a JWT token."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload",
            )
        return user_id
    except HTTPException:
        raise
    except Exception:
        logger.warning(f"Failed to decode JWT token in {log_context}")
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        ) from None


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
            async with self._lock_manager.acquire_lock(
                self._extract_user_id(request), "tts"
            ):
                return await call_next(request)

        return await call_next(request)

    def _extract_user_id(self, request: Request) -> str:
        """Extract user ID from the Authorization header JWT token."""
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required")
        return _decode_user_id_from_token(auth_header[7:], "TTS lock middleware")

    async def close(self):
        """Clean up resources."""
        await self._lock_manager.close()

from fastapi import status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class LimitUploadSizeForPath(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, max_upload_size: int, path: str) -> None:
        super().__init__(app)
        self.max_upload_size = max_upload_size
        self.path = path

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method == "POST" and request.url.path == self.path:
            if "content-length" not in request.headers:
                return Response(status_code=status.HTTP_411_LENGTH_REQUIRED)

            content_length = int(request.headers["content-length"])
            if content_length > self.max_upload_size:
                return Response(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

        return await call_next(request)

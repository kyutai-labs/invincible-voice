import logging
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import Field, TypeAdapter
from starlette.requests import Request

import backend.openai_realtime_api_events as ora
from backend import metrics as mt
from backend.kyutai_constants import (
    MAX_VOICE_FILE_SIZE_MB,
)
from backend.libs.files import LimitUploadSizeForPath
from backend.libs.health import get_health
from backend.routes import auth_router, tts_router, user_router, voices_router

app = FastAPI(openapi_prefix="/api")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)

Instrumentator().instrument(app).expose(app)
PROFILE_ACTIVE = False

ClientEventAdapter = TypeAdapter(
    Annotated[ora.ClientEvent, Field(discriminator="type")]
)

# Allow CORS for local development
CORS_ALLOW_ORIGINS = ["http://localhost", "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(tts_router)
app.include_router(voices_router)

app.add_middleware(
    LimitUploadSizeForPath,
    max_upload_size=MAX_VOICE_FILE_SIZE_MB * 1024 * 1024,
    path="/v1/voices",
)


@app.get("/")
def root():
    return {"message": "You've reached the Unmute backend server."}


@app.get("/v1/health")
async def health():
    health = await get_health()
    mt.HEALTH_OK.observe(health.ok)
    return health


def _cors_headers_for_error(request: Request):
    origin = request.headers.get("origin")
    allow_origin = origin if origin in CORS_ALLOW_ORIGINS else None
    headers = {"Access-Control-Allow-Credentials": "true"}
    if allow_origin:
        headers["Access-Control-Allow-Origin"] = allow_origin

    return headers


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # We need this so that CORS header are added even when the route raises an
    # exception. Otherwise you get a confusing CORS error even if the issue is totally
    # unrelated.
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers_for_error(request),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # We need this so that CORS header are added even when the route raises an
    # exception. Otherwise you get a confusing CORS error even if the issue is totally
    # unrelated.
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers_for_error(request),
    )


if __name__ == "__main__":
    import sys

    print(f"Run this via:\nfastapi dev {sys.argv[0]}")
    exit(1)

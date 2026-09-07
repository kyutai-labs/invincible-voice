# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**LLM (Language Model):**
- OpenAI-compatible API (configurable endpoint) - Streaming chat completions for conversation responses
  - SDK/Client: `openai>=1.70.0` (`AsyncOpenAI` with custom `base_url`)
  - Auth: `KYUTAI_LLM_API_KEY` env var
  - URL: `KYUTAI_LLM_URL` env var
  - Model: `KYUTAI_LLM_MODEL` env var
  - Implementation: `services/backend/backend/llm/llm_utils.py`
  - Structured JSON output enforced via `response_format` with Pydantic schema

**Speech-to-Text (STT):**
- Two supported providers, selected via `KYUTAI_STT_PROVIDER` env var:
  1. **Gradium STT** (`gradium`) - Streaming WebSocket STT
     - SDK: `gradium==0.5.4`
     - Auth: `GRADIUM_API_KEY` env var (sent as `x-api-key` WebSocket header)
     - URL: `KYUTAI_STT_SERVER` env var
     - Protocol: JSON over WebSocket
     - Implementation: `services/backend/backend/stt/speech_to_text.py`
  2. **Kyutai DSM STT** (`dsm`) - Streaming WebSocket STT
     - Auth: hardcoded `public_token` (TODO: make configurable per `services/backend/backend/stt/speech_to_text.py` line 302)
     - URL: `KYUTAI_STT_SERVER` env var
     - Protocol: MessagePack binary over WebSocket

**Text-to-Speech (TTS):**
- Three supported providers, selected via `KYUTAI_TTS_PROVIDER` env var:
  1. **Pocket TTS** (`pocket`) - Local model or remote server
     - SDK: `pocket-tts`
     - Local mode: Model loaded from HuggingFace Hub at startup (`TTSModel.load_model()`)
     - Remote mode: HTTP POST to `KYUTAI_TTS_SERVER` with `KYUTAI_API_KEY` header
     - Voice: `KYUTAI_TTS_VOICE_ID` (defaults to `"alba"`)
     - Implementation: `services/backend/backend/tts/tts_utils.py`
  2. **Gradium TTS** (`gradium`) - Cloud streaming TTS
     - SDK: `gradium==0.5.4`
     - Base URL: `https://eu.api.gradium.ai/api/`
     - Auth: `GRADIUM_API_KEY` env var
     - Voice: `KYUTAI_TTS_VOICE_ID` (defaults to `"Lxc7YlPC8ckLJA8H"` / Kelly)
     - Output format: PCM audio stream
  3. **Kyutai DSM TTS** (`dsm`) - Remote HTTP TTS
     - Auth: `KYUTAI_API_KEY` as `kyutai-api-key` header
     - URL: `KYUTAI_TTS_SERVER` env var
     - Voice: `KYUTAI_TTS_VOICE_ID` (defaults to `"unmute-prod-website/developer-1.mp3"`)

**HuggingFace Hub:**
- Used to download Pocket TTS voice models at startup
- SDK: `huggingface_hub[hf_xet]` + `hf_xet`
- Auth: Standard HuggingFace token (implicit via hub config)

## Data Storage

**Databases:**
- No relational database. All user data stored as JSON files on the filesystem.
  - Path: `KYUTAI_USERS_DATA_PATH` env var (mapped to `/users_data` in Docker)
  - User settings + conversation history: `{USERS_DATA_DIR}/user_settings_and_history/{email}.json`
  - User audio files (voice samples): `{USERS_DATA_DIR}/user_audio/`
  - Storage implementation: `services/backend/backend/storage.py`

**Redis:**
- Listed as dependency (`redis>=6.0.0`) but NOT currently used at runtime
- `services/backend/backend/service_discovery.py` docstring references Redis but implementation uses DNS resolution
- May be planned for future service discovery

**File Storage:**
- Local filesystem only (Docker volume `./volumes/users_data` mounted at `/users_data`)
- Audio voice files uploaded by users stored under `USERS_AUDIO_DIR`
- Max voice file upload size: 4 MB (enforced by `LimitUploadSizeForPath` middleware in `services/backend/backend/main.py`)

**Caching:**
- In-memory TTL cache for DNS resolution in `services/backend/backend/service_discovery.py` (0.5s TTL)
- Frontend TTS audio cache in `services/frontend/src/utils/ttsCache.ts` (in-memory, `temporary` or persistent type)

## Authentication & Identity

**Custom JWT Auth:**
- HS256 JWT tokens, 60-minute expiry
- Secret: `SECRET_KEY` env var
- Implementation: `services/backend/backend/security.py`
- Password hashing: Argon2 via `pwdlib`
- Routes: `services/backend/backend/routes/auth.py` (`/auth/login`, `/auth/register`)

**Google OAuth:**
- Google OAuth2 implicit flow (redirect to Google, extract `id_token` from URL hash)
- Backend: Verifies Google ID token using `google-auth` library
  - Client ID: `GOOGLE_CLIENT_ID` env var
  - Implementation: `services/backend/backend/libs/google.py`
- Frontend: OAuth redirect to `accounts.google.com/o/oauth2/v2/auth`
  - Client ID: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var
  - Implementation: `services/frontend/src/auth/Google.tsx`
- Route: `services/backend/backend/routes/auth.py` (`/auth/google`)

**Frontend Auth Storage:**
- JWT token stored in cookies via `universal-cookie`
- Auth headers added via `services/frontend/src/auth/authUtils.ts`

## Monitoring & Observability

**Metrics:**
- Prometheus via `prometheus-client==0.21.0` + `prometheus-fastapi-instrumentator==7.1.0`
- Exposed at `/metrics` on the backend service
- Metrics defined in `services/backend/backend/metrics.py`
- Tracked: session counts/duration, STT frame counts/TTFT/words, LLM TTFT/request length, health checks
- Docker Compose label: `prometheus-port=80`

**Error Tracking:**
- None (no Sentry or equivalent detected)

**Logs:**
- Standard Python `logging` module, INFO level, format: `%(asctime)s - %(name)s - %(levelname)s - %(message)s`
- Configured in `services/backend/backend/main.py` and individual modules

## CI/CD & Deployment

**Hosting:**
- Docker Compose on Linux/amd64 (`docker-compose.yml`)
- Traefik v3.6.6 as reverse proxy

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, etc. configuration found)

## Environment Configuration

**Required backend env vars:**
- `KYUTAI_STT_PROVIDER` - `"gradium"` or `"dsm"`
- `KYUTAI_STT_SERVER` - WebSocket URL for STT service
- `KYUTAI_TTS_SERVER` - HTTP URL for TTS service (empty string = local Pocket TTS)
- `KYUTAI_TTS_PROVIDER` - `"pocket"`, `"gradium"`, or `"dsm"` (defaults to `"pocket"`)
- `KYUTAI_LLM_API_KEY` - API key for LLM service
- `KYUTAI_LLM_URL` - Base URL for OpenAI-compatible LLM
- `KYUTAI_LLM_MODEL` - Model name to use
- `KYUTAI_USERS_DATA_PATH` - Filesystem path for user data
- `SECRET_KEY` - JWT signing secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID

**Optional backend env vars:**
- `KYUTAI_API_KEY` - API key for Kyutai DSM STT/TTS services
- `KYUTAI_TTS_VOICE_ID` - Override default TTS voice
- `GRADIUM_API_KEY` - Required when using Gradium STT or TTS provider

**Required frontend env vars:**
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID for frontend
- `NEXT_PUBLIC_BACKEND_URL` - Backend URL (optional, defaults to `http://localhost:8000`)

**Secrets location:**
- Environment variables injected at runtime via Docker Compose from host `.env` file (not committed)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Real-time Communication

**WebSocket (Frontend ↔ Backend):**
- Frontend connects to `/api/...` WebSocket endpoint via `react-use-websocket`
- Protocol based on OpenAI Realtime API event format (`services/backend/backend/openai_realtime_api_events.py`)
- Audio streamed from browser microphone (Opus-encoded via `opus-recorder`) to backend

**WebSocket (Backend ↔ STT Service):**
- Backend maintains persistent WebSocket connection to STT provider per user session
- Gradium: JSON protocol; Kyutai: MessagePack binary protocol
- Implementation: `services/backend/backend/stt/speech_to_text.py`

---

*Integration audit: 2026-03-19*

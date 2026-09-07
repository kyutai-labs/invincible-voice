# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- Python 3.12 - Backend service (`services/backend/`)
- TypeScript 5 - Frontend service (`services/frontend/src/`)

**Secondary:**
- CSS (Tailwind) - Frontend styling

## Runtime

**Environment:**
- Node.js (frontend) - managed via pnpm
- Python 3.12 (backend) - pinned via `pyproject.toml` `requires-python = ">=3.12,<3.13"`

**Package Manager:**
- Frontend: pnpm 10.7.1 (`services/frontend/package.json`)
  - Lockfile: `services/frontend/pnpm-lock.yaml` (present)
- Backend: uv (`services/backend/uv.lock`)
  - Lockfile: `services/backend/uv.lock` (present)

## Frameworks

**Core (Backend):**
- FastAPI 0.115+ - HTTP API server (`services/backend/backend/main.py`)
- fastrtc 0.0.23 - Real-time audio streaming handler (`services/backend/backend/unmute_handler.py`)

**Core (Frontend):**
- Next.js 15.5.9 - React framework, standalone Docker output (`services/frontend/next.config.ts`)
- React 19 - UI component library

**Styling:**
- Tailwind CSS 4 - Utility-first CSS (`services/frontend/src/app/globals.css`)
- tailwind-merge 3.4 - Conditional class merging (`services/frontend/src/utils/cn.ts`)
- clsx 2.1 - Class name utility

**Testing (Frontend):**
- Jest 30 with jest-environment-jsdom - Test runner (`services/frontend/jest.config.js`)
- @testing-library/react 16 - Component testing
- @testing-library/user-event 14 - User interaction simulation

**Testing (Backend):**
- pytest 8.3+ with pytest-asyncio 0.26+ (`services/backend/pyproject.toml` dev group)

**Build/Dev:**
- ESLint 9 with Airbnb config - Frontend linting (`services/frontend/eslint.config.js`)
- Prettier 3.7 - Frontend formatting
- Ruff - Backend linting and formatting (`services/backend/pyproject.toml` `[tool.ruff.lint]`)
- Pyright - Backend type checking (dev dependency)

## Key Dependencies

**Critical (Backend):**
- `fastapi[standard]>=0.115.12` - API framework with Pydantic, Uvicorn
- `fastrtc==0.0.23` - Real-time audio WebRTC-style stream handler (`services/backend/backend/unmute_handler.py`)
- `openai>=1.70.0` - OpenAI-compatible client for LLM (used with custom base URL, `services/backend/backend/llm/llm_utils.py`)
- `gradium==0.5.4` - Gradium AI SDK for STT/TTS (`services/backend/backend/tts/tts_utils.py`, `services/backend/backend/stt/speech_to_text.py`)
- `pocket-tts` - Local/remote TTS model (`services/backend/backend/tts/tts_utils.py`)
- `sphn>=0.2.0` - Audio codec library
- `mistralai>=1.5.1` - Mistral AI client (imported but LLM routing uses openai client)
- `msgpack>=1.1.0` - Binary serialization for Kyutai STT protocol
- `pyjwt==2.10.1` - JWT token creation/verification (`services/backend/backend/security.py`)
- `pwdlib[argon2]` - Argon2 password hashing (`services/backend/backend/security.py`)
- `google-auth` - Google OAuth token verification (`services/backend/backend/libs/google.py`)
- `av==14.0.1` - Audio/video processing (PyAV)
- `huggingface_hub[hf_xet]` + `hf_xet` - HuggingFace model download for Pocket TTS
- `aiohttp>=3.12.13` - Async HTTP client
- `httpx` (transitive) - Used directly for TTS HTTP calls (`services/backend/backend/tts/tts_utils.py`)

**Critical (Frontend):**
- `react-use-websocket 4.13` - WebSocket hook for real-time audio connection
- `opus-recorder 8.0.5` - Browser microphone recording with Opus codec
- `universal-cookie 8.0.1` - Cookie management for auth token storage
- `lucide-react 0.503` - Icon library

**Infrastructure (Backend):**
- `prometheus-fastapi-instrumentator==7.1.0` - Auto-instrumentation for FastAPI (`services/backend/backend/main.py`)
- `prometheus-client==0.21.0` - Prometheus metrics (`services/backend/backend/metrics.py`)
- `redis>=6.0.0` - Listed as dependency; referenced in service_discovery docstring but current implementation uses DNS-based discovery without Redis
- `ruamel-yaml>=0.18.10` - YAML parsing (used for `voices.yaml`)
- `humanize>=4.12.3` - Human-readable time deltas for conversation history

## Configuration

**Environment:**
- All runtime configuration via environment variables loaded in `services/backend/backend/kyutai_constants.py`
- Required backend vars: `KYUTAI_STT_PROVIDER`, `KYUTAI_STT_SERVER`, `KYUTAI_TTS_SERVER`, `KYUTAI_TTS_PROVIDER`, `KYUTAI_LLM_API_KEY`, `KYUTAI_LLM_URL`, `KYUTAI_LLM_MODEL`, `KYUTAI_USERS_DATA_PATH`, `SECRET_KEY`, `GOOGLE_CLIENT_ID`
- Optional: `KYUTAI_API_KEY`, `KYUTAI_TTS_VOICE_ID`, `GRADIUM_API_KEY`
- Frontend: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:8000`)

**Build:**
- Frontend: `services/frontend/next.config.ts` (standalone output for Docker, API proxy rewrites)
- Frontend: `services/frontend/tsconfig.json`
- Frontend: `services/frontend/postcss.config.mjs` (Tailwind CSS PostCSS)
- Backend: `services/backend/pyproject.toml`

## Platform Requirements

**Development:**
- Docker + Docker Compose (primary dev workflow via `docker-compose.yml`)
- Hot-reloading Dockerfiles: `services/frontend/hot-reloading.Dockerfile`, `services/backend/Dockerfile` target `hot-reloading`
- Traefik v3.6.6 as reverse proxy (routes `/api/*` to backend, `/` to frontend)

**Production:**
- Docker Compose deployment (`docker-compose.yml`)
- Backend platform pinned to `linux/amd64`
- User data persisted to `./volumes/users_data` host volume
- Traefik handles routing; backend exposes Prometheus metrics on port 80

---

*Stack analysis: 2026-03-19*

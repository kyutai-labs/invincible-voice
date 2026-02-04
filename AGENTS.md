# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InvincibleVoice is a real-time voice communication system designed to help people who cannot speak communicate naturally. The core innovation: instead of having TTS read out whatever the LLM answers, the LLM provides multiple possible responses and the user selects which one to speak.

**Architecture**: Microservices with Traefik reverse proxy, Docker containerization
- Frontend: Next.js 15 + React 19 + TypeScript + WebSocket communication
- Backend: FastAPI + Python 3.12 + fastrtc for real-time audio streaming
- Key data flow: STT → LLM (generates 4 response options) → User selection → TTS

## Common Commands

### Docker (Recommended for Development)
```bash
# Start all services
docker compose up

# Rebuild and start
docker compose up --build

# Start specific services
docker compose up frontend
docker compose up backend
```

### Frontend (cd services/frontend)
```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Lint with ESLint (max-warnings 0)
pnpm test             # Run Jest tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

### Backend (cd services/backend)
```bash
uv sync               # Install dependencies
uv run fastapi dev backend/main.py  # Dev server
uv run pytest         # Run tests
uv run ruff check     # Lint
uv run ruff format    # Format
uv run pyright        # Type checking
```

### Pre-commit Hooks (Root Directory)
```bash
uvx pre-commit install                # Install hooks
uvx pre-commit run --all-files        # Run all hooks manually
```

## Architecture

### WebSocket Protocol
The application uses a custom protocol inspired by the OpenAI Realtime API, defined in `services/backend/backend/openai_realtime_api_events.py`:
- Client events: `input_audio_buffer.append`, `session.update`
- Server events: `response.text.delta`, `input_audio_buffer.speech_started`

### Key Components

#### Frontend
- `src/components/InvincibleVoice.tsx`: Main component (~59KB), core WebSocket handler
- `src/hooks/useAudioProcessor.ts`: Audio streaming logic
- `src/utils/ttsCache.ts`: TTS response caching
- `src/auth/`: JWT-based authentication with Google OAuth

#### Backend
- `backend/unmute_handler.py`: Core WebSocket stream handler (~18KB)
- `backend/llm/`: LLM integration (OpenAI-compatible clients)
- `backend/stt/speech_to_text.py`: Speech-to-text (supports Gradium or Kyutai)
- `backend/routes/user.py`: User endpoints + WebSocket connection
- `backend/storage.py`: User data persistence
- `backend/metrics.py`: Prometheus metrics (session duration, STT/LLM latency)

### Audio Processing
- Frontend records audio using Opus codec (`opus-recorder` library)
- Audio streamed via WebSocket to backend
- STT: Either Gradium API or Kyutai Delayed Stream Modelling server
- TTS: Either Gradium API or Kyutai server
- Sample rates: Note that Gradium and Kyutai TTS may have different sample rate requirements

### Service Configuration
Environment variables control which audio service provider to use:
- `STT_IS_GRADIUM`: Use Gradium STT (true) or Kyutai STT (false)
- `TTS_IS_GRADIUM`: Use Gradium TTS (true) or Kyutai TTS (false)
- `KYUTAI_LLM_URL`/`KYUTAI_LLM_MODEL`/`KYUTAI_LLM_API_KEY`: LLM configuration (OpenAI-compatible)

### Testing
- Frontend: 18 Jest test files in `services/frontend/src/app/__tests__/`
- Backend: Tests in `services/backend/test_data/`, run with `uv run pytest`
- Pre-commit runs: Ruff lint/format (Python), Prettier, ESLint, Pyright

## Contribution Guidelines

- No issue assignment: Anyone can work on any issue at any time
- PRs are squashed when merged
- Keep PRs small and focused for easier review
- Use `uv` for Python dependency management (faster and more reliable than pip)

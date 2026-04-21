# Architecture

**Analysis Date:** 2026-03-19

## Pattern Overview

**Overall:** Multi-service monorepo with a real-time voice AI pipeline

**Key Characteristics:**
- Two main services: a Next.js frontend and a Python/FastAPI backend, orchestrated via Docker Compose with Traefik as a reverse proxy
- Backend acts as a hub: it receives audio from the browser over WebSocket, streams it to an external STT service, passes transcriptions to an LLM, and returns AI-suggested responses plus synthesized TTS audio back to the frontend
- Frontend is a single-page React app that captures microphone input, manages a WebSocket session, and renders chat history and response suggestions
- All communication between frontend and backend WebSocket uses the OpenAI Realtime API event format (message types are modeled in `services/backend/backend/openai_realtime_api_events.py`)
- User data (settings, conversation history) is stored as JSON files on disk, not in a database

## Layers

**Frontend - Auth Layer:**
- Purpose: Gate access to the app; handle credential/Google login
- Location: `services/frontend/src/auth/`
- Contains: `AuthWrapper.tsx` (UI guard), `authContext.tsx` (React context + JWT cookie management), `authUtils.ts` (injects `Authorization` header), `Google.tsx` (Google OAuth button)
- Depends on: Backend `/auth/*` REST endpoints
- Used by: `services/frontend/src/app/page.tsx` wraps the whole app in `<AuthWrapper>`

**Frontend - Application Shell:**
- Purpose: Main orchestrator of the voice session
- Location: `services/frontend/src/components/InvincibleVoice.tsx`
- Contains: WebSocket connection lifecycle, audio capture startup, message routing, state for chat history and pending responses
- Depends on: All hooks, utils, and sub-components
- Used by: `services/frontend/src/app/page.tsx`

**Frontend - Hooks Layer:**
- Purpose: Encapsulate browser API concerns
- Location: `services/frontend/src/hooks/`
- Contains:
  - `useAudioProcessor.ts` — sets up `AudioContext`, Opus encoder, decoder worker, audio worklets
  - `useBackendServerUrl.ts` — resolves the WebSocket URL (supports dev vs. production)
  - `useMicrophoneAccess.ts` — requests `getUserMedia`
  - `useKeyboardShortcuts.ts` — dev-mode toggle
  - `useMobileDetection.ts` — viewport breakpoint detection
  - `useWakeLock.ts` — prevents screen sleep during session
- Depends on: Browser APIs, `constants.ts`
- Used by: `InvincibleVoice.tsx`

**Frontend - Utils Layer:**
- Purpose: Stateless helper functions
- Location: `services/frontend/src/utils/`
- Contains:
  - `ttsUtil.ts` — streams TTS audio from backend REST endpoint, plays via `AudioContext`
  - `ttsCache.ts` — in-memory LRU cache for TTS audio by text string
  - `userData.ts` — fetch/update user data against backend REST API
  - `tokenUtils.ts` — LLM token counting estimates
  - `conversationUtils.ts` — conversation format conversions
  - `audioUtil.ts` — Opus base64 encoding helper
- Depends on: `authUtils.ts`, `constants.ts`
- Used by: `InvincibleVoice.tsx` and sub-components

**Frontend - Components Layer:**
- Purpose: UI rendering
- Location: `services/frontend/src/components/`
- Key files:
  - `InvincibleVoice.tsx` — root component (large, 59k bytes, see CONCERNS)
  - `chat/ChatInterface.tsx`, `chat/SpeakerMessage.tsx`, `chat/WriterMessage.tsx` — conversation display
  - `ResponseOptions.tsx` — renders LLM-suggested response choices
  - `KeywordsSuggestion.tsx` — keyword chips UI
  - `settings/SettingsPopup.tsx`, `settings/DocumentEditorPopup.tsx` — user settings
  - `conversations/ConversationHistory.tsx`, `conversations/ConfirmationDialog.tsx` — history panel
  - `mobile/MobileConversationLayout.tsx` — responsive layout
  - `CouldNotConnect.tsx` — health/connection error state
- Depends on: hooks, utils, types
- Used by: `page.tsx` via `InvincibleVoice`

**Backend - API Entry Point:**
- Purpose: FastAPI app setup, middleware, router registration
- Location: `services/backend/backend/main.py`
- Contains: CORS configuration, Prometheus instrumentation, router mounting, error handlers
- Depends on: All route modules, `kyutai_constants.py`
- Used by: `fastapi dev` / Docker via uvicorn

**Backend - Routes Layer:**
- Purpose: HTTP/WebSocket endpoint definitions
- Location: `services/backend/backend/routes/`
- Contains:
  - `auth.py` — `/auth/login`, `/auth/register`, `/auth/google` (JWT issuance)
  - `user.py` — `/v1/user/` (GET profile, POST settings, DELETE conversation, WebSocket `/v1/user/new-conversation`)
  - `tts.py` — `/v1/tts/` (POST text, GET sample_rate)
- Depends on: `storage.py`, `security.py`, `unmute_handler.py`, `tts/tts_utils.py`
- Used by: `main.py`

**Backend - WebSocket Session Handler:**
- Purpose: Manages the full lifecycle of a voice conversation per connected user
- Location: `services/backend/backend/unmute_handler.py` (class `UnmuteHandler`)
- Contains: Coordinates STT, LLM, TTS sub-systems; maintains `Chatbot` state; implements `AsyncStreamHandler` from `fastrtc`
- Depends on: `stt/speech_to_text.py`, `llm/chatbot.py`, `llm/llm_utils.py`, `tts/tts_utils.py`, `quest_manager.py`, `service_discovery.py`
- Used by: `routes/user.py` websocket route → `libs/websockets.py` → `run_route()`

**Backend - WebSocket Infrastructure:**
- Purpose: Async receive/emit loop logic, error reporting
- Location: `services/backend/backend/libs/websockets.py`
- Contains: `run_route()`, `receive_loop()`, `emit_loop()` — concurrently running tasks inside a `TaskGroup`
- Depends on: `unmute_handler.py`, `openai_realtime_api_events.py`
- Used by: `routes/user.py`

**Backend - STT Sub-system:**
- Purpose: Convert streaming PCM audio to text via external service
- Location: `services/backend/backend/stt/speech_to_text.py`
- Contains: WebSocket client to Gradium or DSM STT server, streaming word emission, VAD integration, exponential moving average noise filter
- Depends on: `service_discovery.py`, `kyutai_constants.py`
- Used by: `unmute_handler.py`

**Backend - LLM Sub-system:**
- Purpose: Generate suggested responses for the user from conversation history
- Location: `services/backend/backend/llm/`
- Contains:
  - `chatbot.py` — `Chatbot` class: manages in-memory conversation state, tracks current turn
  - `llm_utils.py` — `VLLMStream`: async OpenAI-compatible chat completion client with JSON schema structured output
  - `system_prompt.py` — base system prompt constant
- Depends on: `storage.py`, `kyutai_constants.py`, `openai` SDK
- Used by: `unmute_handler.py`

**Backend - TTS Sub-system:**
- Purpose: Convert text to audio; supports three providers
- Location: `services/backend/backend/tts/tts_utils.py`
- Contains: `tts_pocket()`, `tts_gradium()`, `tts_dsm()` — each returns a `StreamingResponse`
- Depends on: `kyutai_constants.py`, `gradium`, `pocket_tts`, `httpx`
- Used by: `routes/tts.py` (REST) and `unmute_handler.py` (in-session)

**Backend - Storage Layer:**
- Purpose: Persist and load user data from disk as JSON
- Location: `services/backend/backend/storage.py`
- Contains: `UserData` Pydantic model with `.save()` method, `get_user_data_from_storage()`, `get_user_data_path()`
- Depends on: `kyutai_constants.py` (for `USERS_SETTINGS_AND_HISTORY_DIR`), `typing.py`
- Used by: `routes/auth.py`, `routes/user.py`, `unmute_handler.py`

**Backend - Service Discovery:**
- Purpose: Resolve STT/LLM service instances; supports multiple replicas via DNS
- Location: `services/backend/backend/service_discovery.py`
- Contains: `find_instance()`, `get_instances()`, async TTL-cached DNS resolver
- Depends on: `kyutai_constants.py`
- Used by: `stt/speech_to_text.py`, `unmute_handler.py`

## Data Flow

**Voice Conversation Turn:**

1. Browser captures microphone audio via `useAudioProcessor` → Opus-encodes chunks
2. Frontend sends `input_audio_buffer.append` WebSocket event (base64 Opus audio) to backend
3. Backend `receive_loop()` decodes Opus → PCM → forwards to `UnmuteHandler.receive()`
4. `UnmuteHandler` passes PCM to `SpeechToText`, which streams it over WebSocket to STT server
5. STT server returns word-by-word transcription; `UnmuteHandler` appends to `Chatbot` conversation
6. When VAD detects user silence (or timeout), `UnmuteHandler` calls `VLLMStream.chat_completion()` with full conversation history
7. LLM returns structured JSON: `{suggested_keywords: [...], suggested_answers: [...]}`
8. Backend sends `UnmuteAdditionalOutputs` WebSocket event to frontend with suggestions
9. User selects a response option on the frontend (clicks a suggestion)
10. Frontend sends `response.selected_by_writer` event; backend records it in `Chatbot`
11. Frontend calls `POST /api/v1/tts/` with the selected text
12. TTS sub-system streams PCM audio back; frontend plays it via `AudioContext`

**Authentication Flow:**

1. User submits credentials or Google token on frontend
2. Frontend calls `POST /auth/login` (or `/auth/google`)
3. Backend validates, creates JWT, returns `access_token`
4. Frontend stores JWT in cookie (via `universal-cookie`)
5. Subsequent requests inject `Authorization: Bearer <token>` via `authUtils.ts`
6. WebSocket auth is passed via WebSocket subprotocol `Bearer.<token>` (browser WS API limitation)

**State Management:**

- Frontend: All session state is React `useState` in `InvincibleVoice.tsx`; auth state lives in `authContext.tsx` React context
- Backend: Per-session state lives in `UnmuteHandler` instance (in-memory for the duration of the WebSocket connection); `UserData` is reloaded from disk on each request and saved back after mutations

## Key Abstractions

**OpenAI Realtime API Events:**
- Purpose: Typed message envelope for WebSocket communication
- Location: `services/backend/backend/openai_realtime_api_events.py`
- Pattern: Pydantic `BaseEvent[Literal["type.name"]]` with discriminated union; used both for client events (audio, keywords, response selection) and server events (transcriptions, suggestions, audio delta)

**UnmuteHandler:**
- Purpose: Stateful async stream processor per WebSocket session
- Location: `services/backend/backend/unmute_handler.py`
- Pattern: Extends `fastrtc.AsyncStreamHandler`; acts as coordinator between STT, LLM, TTS sub-systems; `receive()` and `emit()` are the main interface called by the WebSocket loops

**Quest / QuestManager:**
- Purpose: RAII-like lifecycle management for async tasks with init/run/close phases
- Location: `services/backend/backend/quest_manager.py`
- Pattern: Each `Quest[T]` wraps an async init, run, and optional close coroutine; `QuestManager` monitors all quests and propagates cancellation

**UserData (Pydantic model):**
- Purpose: Single source of truth for a user's profile, settings, and conversation history
- Location: `services/backend/backend/storage.py`
- Pattern: Pydantic BaseModel; serialized to/from JSON on disk at `USERS_SETTINGS_AND_HISTORY_DIR/{email}.json`; `.save()` writes immediately (no transaction)

**TTS Provider Strategy:**
- Purpose: Abstract over three TTS backends (Pocket, Gradium, DSM) behind a uniform interface
- Location: `services/backend/backend/tts/tts_utils.py`
- Pattern: Three independent async functions (`tts_pocket`, `tts_gradium`, `tts_dsm`) selected at runtime by `TTS_PROVIDER` env var in `routes/tts.py`

## Entry Points

**Backend HTTP/WebSocket Server:**
- Location: `services/backend/backend/main.py`
- Triggers: `fastapi dev backend/main.py` or Docker uvicorn
- Responsibilities: Mounts routers, adds CORS/metrics middleware, handles global exceptions

**Frontend Next.js App:**
- Location: `services/frontend/src/app/page.tsx`
- Triggers: `pnpm dev` or Docker Next.js server
- Responsibilities: Renders `<AuthWrapper>` around `<InvincibleVoice>`

**Docker Compose Entrypoint:**
- Location: `docker-compose.yml`
- Triggers: `docker compose up`
- Responsibilities: Starts Traefik (port 80), frontend (port 3000 internal), backend (port 80 internal); Traefik routes `/api/*` to backend and `/` to frontend

## Error Handling

**Strategy:** Errors are caught at the WebSocket boundary and reported back to the client as `ora.Error` events; HTTP errors use FastAPI `HTTPException`

**Patterns:**
- `libs/websockets.py:report_websocket_exception()` — converts `MissingServiceAtCapacity`, `MissingServiceTimeout`, `WebSocketClosedError`, and unknown exceptions to appropriate ORA error events or WS close codes
- `main.py` global exception handlers add CORS headers to all error responses so the browser gets a legible error rather than a CORS error
- `service_discovery.py:find_instance()` retries up to `max_trials` times with exponential back-off before raising
- LLM rate limit errors in `llm_utils.py` retry up to 4 times (1s, 2s, 4s, 8s)

## Cross-Cutting Concerns

**Logging:** Python `logging` with `%(asctime)s - %(name)s - %(levelname)s - %(message)s` format; each module creates its own `logger = logging.getLogger(__name__)`

**Validation:** Pydantic throughout the backend; WebSocket messages use a `TypeAdapter` with discriminated union for client events

**Authentication:** JWT (HS256) issued by backend, stored in browser cookie, sent as `Authorization: Bearer` header on REST calls and as WebSocket subprotocol on WS connection

**Metrics:** Prometheus via `prometheus_fastapi_instrumentator`; custom metrics defined in `services/backend/backend/metrics.py` (sessions, active sessions, STT ping times, hard errors, etc.)

**Concurrency limit:** `asyncio.Semaphore(MAX_CLIENTS=4)` in `kyutai_constants.py` limits concurrent WebSocket sessions per backend instance

---

*Architecture analysis: 2026-03-19*

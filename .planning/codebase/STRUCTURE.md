# Codebase Structure

**Analysis Date:** 2026-03-19

## Directory Layout

```
invincible-voice/
├── docker-compose.yml          # Traefik + frontend + backend service definitions
├── .dockerignore
├── .gitignore
├── .pre-commit-config.yaml
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── images/                     # Static project images
├── volumes/                    # Docker volume mounts (users_data, grafana-data, prometheus-data)
│   └── users_data/             # Runtime-only; user JSON files and voice audio
└── services/
    ├── backend/                # Python FastAPI service
    │   ├── Dockerfile
    │   ├── pyproject.toml
    │   ├── uv.lock
    │   ├── voices.yaml
    │   ├── tests/              # Backend unit tests
    │   └── backend/            # Python package (same name as service dir)
    │       ├── main.py             # FastAPI app definition
    │       ├── kyutai_constants.py # All env-var-driven constants
    │       ├── openai_realtime_api_events.py  # Pydantic WS message types
    │       ├── typing.py           # Domain Pydantic types
    │       ├── storage.py          # UserData model + disk persistence
    │       ├── unmute_handler.py   # Per-session WebSocket handler (main logic)
    │       ├── quest_manager.py    # Async task lifecycle manager
    │       ├── service_discovery.py # STT/LLM instance resolver
    │       ├── security.py         # JWT creation/verification, password hashing
    │       ├── exceptions.py       # Custom exception classes
    │       ├── metrics.py          # Prometheus metric definitions
    │       ├── timer.py            # Stopwatch utility
    │       ├── websocket_utils.py  # WebsocketState helper
    │       ├── routes/             # APIRouter modules
    │       │   ├── __init__.py         # Exports auth_router, user_router, tts_router
    │       │   ├── auth.py             # /auth/* endpoints
    │       │   ├── user.py             # /v1/user/* endpoints + WebSocket
    │       │   └── tts.py              # /v1/tts/* endpoints
    │       ├── llm/                # LLM integration
    │       │   ├── chatbot.py          # Chatbot state machine
    │       │   ├── llm_utils.py        # VLLMStream OpenAI client wrapper
    │       │   └── system_prompt.py    # BASE_SYSTEM_PROMPT constant
    │       ├── stt/                # Speech-to-text integration
    │       │   ├── speech_to_text.py   # SpeechToText WebSocket client
    │       │   └── exponential_moving_average.py  # Audio noise filter
    │       ├── tts/                # Text-to-speech integration
    │       │   └── tts_utils.py        # tts_pocket / tts_gradium / tts_dsm
    │       └── libs/               # Internal shared utilities
    │           ├── websockets.py       # run_route / receive_loop / emit_loop
    │           ├── files.py            # LimitUploadSizeForPath middleware
    │           ├── google.py           # Google OAuth token verification
    │           └── health.py           # get_health() checks STT + LLM reachability
    └── frontend/               # Next.js 14 App Router service
        ├── Dockerfile
        ├── hot-reloading.Dockerfile
        ├── next.config.ts
        ├── tsconfig.json
        ├── package.json
        ├── pnpm-lock.yaml
        ├── eslint.config.js
        ├── jest.config.js
        ├── jest.setup.js
        ├── postcss.config.mjs
        ├── public/             # Static assets (logos, worklet JS, decoder worker)
        ├── __mocks__/          # Top-level Jest mocks
        └── src/
            ├── constants.ts        # Shared UI constants (response sizes, static messages)
            ├── app/                # Next.js App Router
            │   ├── layout.tsx          # Root HTML shell, font, ContextProvider
            │   ├── page.tsx            # Single route: AuthWrapper > InvincibleVoice
            │   ├── globals.css
            │   ├── __mocks__/          # App-level Jest mocks
            │   └── __tests__/          # Integration and unit tests
            ├── auth/               # Authentication layer
            │   ├── authContext.tsx      # React context + JWT cookie logic
            │   ├── authUtils.ts         # addAuthHeaders() helper
            │   ├── AuthWrapper.tsx      # Login/register gate component
            │   └── Google.tsx           # Google sign-in button
            ├── components/         # React UI components
            │   ├── InvincibleVoice.tsx  # Root app component (session orchestrator)
            │   ├── ContextProvider.tsx  # Wraps children in authContext
            │   ├── ResponseOptions.tsx  # LLM response suggestions UI
            │   ├── KeywordsSuggestion.tsx  # Keyword chips
            │   ├── CouldNotConnect.tsx  # Error/health state UI
            │   ├── chat/               # Chat display
            │   │   ├── ChatInterface.tsx
            │   │   ├── SpeakerMessage.tsx
            │   │   └── WriterMessage.tsx
            │   ├── conversations/      # History panel
            │   │   ├── ConversationHistory.tsx
            │   │   └── ConfirmationDialog.tsx
            │   ├── settings/           # Settings modal
            │   │   ├── SettingsPopup.tsx
            │   │   └── DocumentEditorPopup.tsx
            │   ├── mobile/             # Responsive layout variants
            │   │   └── MobileConversationLayout.tsx
            │   ├── icons/              # SVG icon components
            │   └── ui/                 # Generic UI primitives
            ├── hooks/              # Custom React hooks
            │   ├── useAudioProcessor.ts
            │   ├── useBackendServerUrl.ts
            │   ├── useKeyboardShortcuts.ts
            │   ├── useMicrophoneAccess.ts
            │   ├── useMobileDetection.ts
            │   └── useWakeLock.ts
            ├── types/              # TypeScript type definitions
            │   ├── chatHistory.ts
            │   └── opus-recorder.d.ts
            ├── utils/              # Stateless helper functions
            │   ├── ttsUtil.ts
            │   ├── ttsCache.ts
            │   ├── userData.ts
            │   ├── tokenUtils.ts
            │   ├── conversationUtils.ts
            │   ├── audioUtil.ts
            │   └── cn.ts
            ├── assets/             # Static font files
            │   └── fonts/
            └── i18n/ / messages/   # Internationalisation (if present)
```

## Directory Purposes

**`services/backend/backend/routes/`:**
- Purpose: HTTP and WebSocket route handlers; thin layer that delegates to domain logic
- Contains: One file per logical resource (`auth`, `user`, `tts`); each file creates a FastAPI `APIRouter`
- Key files: `user.py` contains the main WebSocket endpoint

**`services/backend/backend/llm/`:**
- Purpose: All LLM-related logic: conversation state, prompt building, streaming client
- Contains: `Chatbot` (state), `VLLMStream` (client), `system_prompt.py`

**`services/backend/backend/stt/`:**
- Purpose: Speech-to-text stream processing; WebSocket client to external ASR service
- Contains: `SpeechToText` class, EMA noise filter

**`services/backend/backend/tts/`:**
- Purpose: Text-to-speech; three provider implementations
- Contains: `tts_utils.py` only

**`services/backend/backend/libs/`:**
- Purpose: Shared utilities that are not domain logic but too large for single files
- Contains: WS loop infrastructure, file upload middleware, Google OAuth, health checks

**`services/frontend/src/components/`:**
- Purpose: All React UI components; organized by feature area
- Key files: `InvincibleVoice.tsx` is the central component that owns all session state

**`services/frontend/src/hooks/`:**
- Purpose: Browser API encapsulation; each hook is a single responsibility
- Contains: Audio, microphone, wake lock, URL resolution, keyboard shortcuts, mobile detection

**`services/frontend/src/utils/`:**
- Purpose: Pure/stateless helper functions; no React state
- Contains: Audio playback, TTS caching, token counting, conversation formatting

**`services/frontend/src/auth/`:**
- Purpose: Authentication state and UI; isolated from app logic
- Contains: Context, utilities, login/register forms

**`services/frontend/src/app/__tests__/`:**
- Purpose: All frontend tests (integration + unit); co-located under app rather than alongside source files

## Key File Locations

**Entry Points:**
- `services/backend/backend/main.py`: FastAPI app object; import target for uvicorn
- `services/frontend/src/app/page.tsx`: Single Next.js route, renders everything
- `docker-compose.yml`: Full stack startup

**Configuration:**
- `services/backend/backend/kyutai_constants.py`: All env-var-driven config constants for the backend
- `services/frontend/src/constants.ts`: Frontend UI constants (response sizes, static strings)
- `services/frontend/next.config.ts`: Next.js build config
- `services/backend/pyproject.toml`: Python dependencies and packaging

**Core Logic:**
- `services/backend/backend/unmute_handler.py`: Voice session orchestrator (~550 lines)
- `services/backend/backend/libs/websockets.py`: WebSocket receive/emit loops
- `services/frontend/src/components/InvincibleVoice.tsx`: Frontend session root (~large, see CONCERNS)

**Data Model:**
- `services/backend/backend/storage.py`: `UserData` Pydantic model + disk I/O
- `services/backend/backend/typing.py`: Core domain types (`UserSettings`, `Conversation`, `SpeakerMessage`, `WriterMessage`, `LLMMessage`)
- `services/backend/backend/openai_realtime_api_events.py`: All WebSocket message types

**Testing:**
- `services/frontend/src/app/__tests__/`: Frontend Jest tests
- `services/backend/tests/`: Backend pytest tests

## Naming Conventions

**Backend Files:**
- Snake case for all Python files: `speech_to_text.py`, `unmute_handler.py`, `tts_utils.py`
- Module directories named by domain: `llm/`, `stt/`, `tts/`, `routes/`, `libs/`

**Frontend Files:**
- PascalCase for React components: `InvincibleVoice.tsx`, `AuthWrapper.tsx`, `ChatInterface.tsx`
- camelCase for hooks: `useAudioProcessor.ts`, `useMicrophoneAccess.ts`
- camelCase for utils: `ttsUtil.ts`, `tokenUtils.ts`, `ttsCache.ts`
- camelCase for type files: `chatHistory.ts`

**Directories:**
- Frontend feature directories are lowercase: `chat/`, `conversations/`, `settings/`, `mobile/`, `icons/`, `ui/`
- Backend sub-packages lowercase: `llm/`, `stt/`, `tts/`, `libs/`

## Where to Add New Code

**New backend API endpoint:**
- Add route handler to relevant file in `services/backend/backend/routes/` or create a new `<name>.py` there
- Export the new router from `services/backend/backend/routes/__init__.py`
- Mount the router in `services/backend/backend/main.py`

**New domain type:**
- Add Pydantic model to `services/backend/backend/typing.py`

**New TTS provider:**
- Add function `tts_<provider>(text: str) -> StreamingResponse` to `services/backend/backend/tts/tts_utils.py`
- Add provider string to validation in `kyutai_constants.py`
- Add branch in `services/backend/backend/routes/tts.py`

**New frontend feature component:**
- Create `services/frontend/src/components/<feature>/ComponentName.tsx`
- Import into `InvincibleVoice.tsx` or relevant parent

**New custom hook:**
- Create `services/frontend/src/hooks/use<Name>.ts`

**New utility function:**
- Add to existing file in `services/frontend/src/utils/` if it fits an existing category
- Or create `services/frontend/src/utils/<name>Utils.ts`

**New frontend test:**
- Add to `services/frontend/src/app/__tests__/`

**New backend test:**
- Add to `services/backend/tests/`

## Special Directories

**`volumes/users_data/`:**
- Purpose: Runtime disk storage for user JSON files and uploaded voice audio
- Generated: Yes (at runtime by Docker)
- Committed: No (excluded by `.gitignore`, mounted as Docker volume)

**`volumes/grafana-data/` and `volumes/prometheus-data/`:**
- Purpose: Monitoring data persistence for Grafana and Prometheus
- Generated: Yes
- Committed: No

**`services/frontend/public/`:**
- Purpose: Static files served directly by Next.js; includes audio worklet JS and Opus decoder worker JS used at runtime
- Generated: No
- Committed: Yes

**`services/frontend/__mocks__/`:**
- Purpose: Top-level Jest module mocks (e.g., for `opus-recorder`)
- Generated: No
- Committed: Yes

**`services/backend/backend.egg-info/`:**
- Purpose: Python package metadata generated by `pip install -e .`
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-19*

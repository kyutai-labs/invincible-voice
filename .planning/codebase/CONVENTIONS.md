# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` files (e.g., `InvincibleVoice.tsx`, `ChatInterface.tsx`)
- Hooks: camelCase prefixed with `use` (e.g., `useAudioProcessor.ts`, `useMicrophoneAccess.ts`)
- Utilities: camelCase (e.g., `ttsUtil.ts`, `ttsCache.ts`, `conversationUtils.ts`)
- Type/interface files: camelCase (e.g., `chatHistory.ts`)
- Python modules: snake_case (e.g., `speech_to_text.py`, `llm_utils.py`, `quest_manager.py`)

**Functions (TypeScript/React):**
- Event handlers: `handle` prefix for callbacks passed as props (e.g., `handleSettingsSave`, `handleDeleteConversation`)
- Internal handlers: `on` prefix for component-internal events (e.g., `onConnectButtonPress`, `onResponseEdit`)
- Hooks: `use` prefix (e.g., `useAudioProcessor`, `useMicrophoneAccess`)
- All functions: camelCase

**Variables:**
- TypeScript: camelCase for variables, SCREAMING_SNAKE_CASE for module-level constants (e.g., `STATIC_MESSAGES`, `DEFAULT_UNMUTE_CONFIG`, `CORS_ALLOW_ORIGINS`)
- Python: snake_case for variables and functions, SCREAMING_SNAKE_CASE for constants (e.g., `LENGHT_TO_NB_WORDS`, `MAX_VOICE_FILE_SIZE_MB`)

**Types/Interfaces (TypeScript):**
- Interfaces: PascalCase prefixed with `I` is NOT used — plain PascalCase (e.g., `AudioProcessor`, `TTSOptions`, `PendingKeyword`)
- Type aliases: PascalCase (e.g., `CacheType`, `ResponseSize`, `LanguageCode`)
- Exported types are colocated with their usage files

**Python Classes:**
- PascalCase (e.g., `UserData`, `TTSRequest`, `MissingServiceAtCapacity`)
- Pydantic models used for all data shapes (never plain dicts for structured data)

## Code Style

**Frontend Formatting (Prettier):**
- Tool: Prettier 3.7.4
- Config: `services/frontend/.prettierrc.json`
- Single quotes: `true` (both JS and JSX)
- Semicolons: `true`
- Trailing commas: `all`
- Tab width: 2 spaces
- JSX single quotes: `true`
- Single attribute per line in JSX: `true`

**Frontend Linting (ESLint):**
- Config: `services/frontend/eslint.config.js`
- Extends: `airbnb`, `next/core-web-vitals`, `@typescript-eslint/recommended`, `react-hooks/recommended`
- Max line length: 100 characters (ignores comments, strings, template literals, URLs)
- No more than 1 consecutive blank line

**Backend Linting (Ruff):**
- Config: `services/backend/pyproject.toml` under `[tool.ruff.lint]`
- Enabled: bugbear (B), pep8 (E/W), pyflakes (F), isort (I001), docstring args (D417)
- E501 (line too long) ignored
- Docstring convention: Google style
- Imports sorted by isort rules (enforced via pre-commit)

## Import Organization

**TypeScript — enforced order:**
1. Builtin (Node modules)
2. External packages (e.g., `react`, `next`, `react-use-websocket`)
3. Parent directory imports
4. Internal (alias-based, e.g., `@/components/...`, `@/hooks/...`, `@/utils/...`)
5. Sibling imports
6. Index imports

Alphabetized within each group (case-sensitive, enforced by ESLint `import/order`).

**Path Aliases:**
- `@/` maps to `services/frontend/src/` (configured in `jest.config.js` and `tsconfig.json`)
- Always use `@/` for cross-directory imports within `src/`

**Python:**
- Standard library first, then third-party, then local (`backend.*`) — enforced by ruff/isort
- Explicit imports preferred (e.g., `from backend.routes import user_router` not `import backend.routes`)

## Error Handling

**TypeScript:**
- Async errors caught with `try/catch` in event handlers and effects
- API call errors surfaced via `ErrorItem` state pattern (see `makeErrorItem` in `src/components/ui/ErrorMessages.tsx`)
- Promise rejections in fire-and-forget calls handled via `.catch(console.error)` (e.g., `playTTSStream({...}).catch(console.error)`)
- `result.error` pattern used for functions that return `{ data, error }` objects rather than throwing (e.g., `getUserData()`, `deleteConversation()`)

**Python:**
- FastAPI `HTTPException` raised for user-visible errors (e.g., 401 unauthorized in `storage.py`)
- Custom exception classes in `backend/exceptions.py` for domain-specific failures: `MissingServiceAtCapacity`, `MissingServiceTimeout`, `WebSocketClosedError`
- Global exception handlers in `main.py` ensure CORS headers are preserved on errors (both `HTTPException` and general `Exception`)
- Structured error responses use `make_ora_error()` from `backend/exceptions.py` to produce typed error messages sent over WebSocket

## Logging

**Frontend:** `console.warn` and `console.error` only (no `console.log` — enforced by ESLint `no-console: warn` rule allowing only `warn`/`error`)

**Python:**
- `logging.getLogger(__name__)` per module
- Global basicConfig in `main.py`: `"%(asctime)s - %(name)s - %(levelname)s - %(message)s"`, level INFO
- Logger configured in `storage.py`, `main.py` — not found in every module (inconsistent)

## Comments

**When to Comment:**
- Block comments for non-obvious logic (e.g., audio buffer math, LRU eviction logic)
- Inline comments explaining constants or magic numbers (e.g., `# opus actually always works at 48khz`)
- Section comments in large components/JSX to orient readers (e.g., `// Mobile layout`, `// Keyboard shortcuts for response selection`)

**Docstrings (Python):**
- Google style enforced by ruff D417 — all function arguments must be documented if docstring exists
- Short docstrings for exception classes (e.g., `"""A service is operating at capacity, but no serious error."""`)

**JSDoc/TSDoc (TypeScript):**
- Used selectively for exported functions/classes (e.g., `ttsUtil.ts`, `ttsCache.ts`)
- Format: standard `/** ... */` block above function

## Function Design

**React Components:**
- Arrow function components only — enforced by ESLint `react/function-component-definition`
- Default props via default arguments, not `defaultProps` — enforced by ESLint `react/require-default-props`
- Components export default at bottom of file

**React Hooks:**
- All callbacks wrapped in `useCallback` — standard pattern throughout `InvincibleVoice.tsx`
- `useEffect` cleanup always returned when registering listeners (e.g., `window.removeEventListener`)
- Hooks extracted into `src/hooks/` for reusable stateful logic

**Python Functions:**
- FastAPI endpoints are `async` functions
- Short utility functions kept in `libs/` or domain-specific modules
- Heavy use of Pydantic models for request/response typing rather than raw dicts

## Module Design

**TypeScript Exports:**
- Named exports preferred for utilities and hooks (e.g., `export const useAudioProcessor`, `export function fetchTTSAudio`)
- Default exports for React components (e.g., `export default InvincibleVoice`)
- `import/prefer-default-export` is OFF — named and default exports coexist freely
- No barrel `index.ts` files in `src/` (direct imports used)

**Python Exports:**
- `backend/routes/__init__.py` exports routers (`user_router`, `auth_router`, `tts_router`)
- Submodules accessed directly (e.g., `from backend.tts.tts_utils import tts_pocket`)

---

*Convention analysis: 2026-03-19*

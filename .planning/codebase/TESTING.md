# Testing Patterns

**Analysis Date:** 2026-03-19

## Test Frameworks

### Frontend (TypeScript/React)

**Runner:**
- Jest 30.x
- Config: `services/frontend/jest.config.js`
- Environment: jsdom (via `jest-environment-jsdom`)
- Next.js integration: `next/jest` wraps the config

**Assertion Library:**
- Jest built-in matchers
- `@testing-library/jest-dom` (DOM-specific matchers like `toBeInTheDocument`)

**Interaction Library:**
- `@testing-library/react` — `render`, `screen`, `waitFor`
- `@testing-library/user-event` — `userEvent.setup()` for realistic user interactions

**Run Commands:**
```bash
cd services/frontend
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

### Backend (Python)

**Runner:**
- pytest 8.x
- Config: `services/backend/pyproject.toml` under `[tool.pytest.ini_options]`
- `pytest-asyncio` for async test support
- `asyncio_default_fixture_loop_scope = "function"` (each test gets its own event loop)

**Run Commands:**
```bash
cd services/backend
uv run pytest          # Run all tests
```

## Test File Organization

**Frontend:**
- Co-located `__tests__/` directory under `services/frontend/src/app/__tests__/`
- Naming: `{feature}.test.tsx` or `{feature}.test.ts` or `{feature}.simple.test.tsx`
- Mocks directory: `services/frontend/src/app/__mocks__/` (hook mocks)
- Global mocks directory: `services/frontend/__mocks__/` (component-level mocks like `BubbleTrail.tsx`)

**Backend:**
- `services/backend/tests/test_{module_name}.py`
- Only one test file currently: `tests/test_exponential_moving_average.py`

**Structure:**
```
services/frontend/
├── __mocks__/
│   ├── BubbleTrail.tsx              # Component mock
│   └── react-use-websocket.js       # Package mock
├── jest.config.js
├── jest.setup.js                    # Global mocks and setup
└── src/app/
    ├── __mocks__/
    │   ├── useAudioProcessor.ts     # Hook mock
    │   └── useMicrophoneAccess.ts   # Hook mock
    └── __tests__/
        ├── InvincibleVoice.test.tsx
        ├── integration.test.tsx
        ├── ttsCache.test.ts
        ├── ttsUtil.test.ts
        ├── tokenUtils.test.ts
        └── ...

services/backend/
└── tests/
    └── test_exponential_moving_average.py
```

## Test Structure

**Frontend Suite Organization:**
```typescript
describe('Feature Name', () => {
  const mockFn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Per-test mock setup
  });

  afterEach(() => {
    // Cleanup (e.g., ttsCache.clear())
  });

  test('should do specific thing', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await waitFor(() => {
      expect(screen.getByTitle('...')).toBeInTheDocument();
    });
    await user.click(button);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
```

**Backend Test Structure (pytest):**
```python
import pytest
from backend.module import SomeClass

def test_behavior():
    instance = SomeClass(param=value)
    instance.method(args)
    assert instance.property == pytest.approx(expected)
```

**Nested describe blocks** used for grouping related tests within the same module (e.g., `describe('fetchTTSAudio', ...)` inside `describe('TTS Utility', ...)`).

Both `test(...)` and `it(...)` naming styles appear in the frontend tests — no enforced standard.

## Mocking

**Framework:** Jest (`jest.fn()`, `jest.mock()`, `jest.clearAllMocks()`)

**Global Mock Setup (`jest.setup.js`):**
Global setup mocks browser APIs not available in jsdom:
- `IntersectionObserver`, `ResizeObserver`
- `MediaDevices.getUserMedia`
- `AudioContext`
- `WebSocket`
- `URL.createObjectURL` / `URL.revokeObjectURL`
- `Audio` constructor
- `MediaStream`
- `requestAnimationFrame` / `cancelAnimationFrame`
- `global.fetch` — URL-dispatched mock returning appropriate fixtures

**Module-Level Mocks:**
```typescript
// Automock via __mocks__ directory (co-located)
jest.mock('../useMicrophoneAccess');  // resolves to src/app/__mocks__/useMicrophoneAccess.ts
jest.mock('../useAudioProcessor');   // resolves to src/app/__mocks__/useAudioProcessor.ts

// Factory mock with explicit implementation
jest.mock('react-use-websocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sendMessage: mockSendMessage,
    lastMessage: null,
    readyState: 1,
  })),
  ReadyState: { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
}));

// Inline function mock
jest.mock('../useKeyboardShortcuts', () => ({
  __esModule: true,
  default: () => ({ isDevMode: false }),
}));
```

**Per-Test Mock Override:**
```typescript
beforeEach(() => {
  const { useMicrophoneAccess } = require('../useMicrophoneAccess');
  useMicrophoneAccess.mockReturnValue({
    microphoneAccess: 'unknown',
    askMicrophoneAccess: jest.fn().mockResolvedValue(mockMediaStream),
  });
});
```

**What to Mock:**
- All custom hooks (`useMicrophoneAccess`, `useAudioProcessor`, `useKeyboardShortcuts`, `useWakeLock`, `useBackendServerUrl`)
- Third-party packages (`react-use-websocket`, `pretty-print-json`)
- Browser APIs not in jsdom (`AudioContext`, `MediaDevices`, `WebSocket`)
- `global.fetch` with URL-dispatch pattern for different endpoints

**What NOT to Mock:**
- Pure utility functions (e.g., `tokenUtils`, `ttsCache`) — tested directly with real implementations
- Pydantic models and pure Python logic

## Fixtures and Test Data

**Frontend:**
```typescript
// Inline fixture for user data shape
const mockUserData = {
  user_id: 'test-user-id',
  user_settings: {
    name: 'Test User',
    prompt: 'Test prompt',
    additional_keywords: ['test', 'keyword'],
    friends: ['friend1', 'friend2'],
    documents: [],
  },
  conversations: [],
};

// Standard UUID used across tests
const VALID_TEST_UUID = '12345678-1234-4234-8234-123456789012';

// Mock media stream shape (repeated pattern)
const mockMediaStream = {
  getTracks: () => [],
  getAudioTracks: () => [],
  getVideoTracks: () => [],
};
```

**Location:** Inline within test files — no shared fixtures directory.

**Backend:** No fixtures directory. Tests instantiate objects directly.

## Coverage

**Requirements:** No minimum threshold enforced in config.

**Collection scope** (from `jest.config.js`):
- `src/**/*.{js,jsx,ts,tsx}`
- Excludes: `*.d.ts`, `globals.css`

**View Coverage:**
```bash
cd services/frontend && pnpm test:coverage
```

## Test Types

**Unit Tests:**
- Pure utility functions tested in isolation: `tokenUtils.test.ts`, `ttsCache.test.ts`, `ttsUtil.test.ts`
- Python: `test_exponential_moving_average.py` tests a single math class

**Component Tests:**
- React components rendered with mocked hooks and providers
- Verifies DOM output and interaction (click, keyboard)
- Files: `InvincibleVoice.test.tsx`, `page.test.tsx`, `delete-conversation.test.tsx`, `friends-section.test.tsx`, etc.

**Integration Tests:**
- `integration.test.tsx` — full component render with all hooks mocked, tests multi-step user flows
- No true end-to-end tests (no Cypress/Playwright configured)

## Common Patterns

**Async Component Testing:**
```typescript
test('loads and renders', async () => {
  const user = userEvent.setup();
  render(<Component />);

  // Wait for async initialization (health check, data fetch)
  await waitFor(() => {
    expect(screen.getByTitle('Start Conversation')).toBeInTheDocument();
  });

  // Interact
  await user.click(screen.getByTitle('Start Conversation'));

  // Assert async outcome
  await waitFor(() => {
    expect(screen.getByTitle('Stop Conversation')).toBeInTheDocument();
  });
});
```

**Error Scenario Testing:**
```typescript
test('shows error when microphone refused', async () => {
  const { useMicrophoneAccess } = require('../useMicrophoneAccess');
  useMicrophoneAccess.mockReturnValue({
    microphoneAccess: 'refused',
    askMicrophoneAccess: jest.fn().mockResolvedValue(null),
  });

  render(<InvincibleVoice userId='12345678-1234-4234-8234-123456789012' />);

  await waitFor(() => {
    expect(
      screen.getByText('Please allow microphone access to use InvincibleVoice.'),
    ).toBeInTheDocument();
  });
});
```

**Fetch Mock with URL Dispatch:**
```typescript
global.fetch = jest.fn().mockImplementation((url) => {
  if (url.includes('/v1/health')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  }
  if (url.includes('/v1/tts')) {
    return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['mock-audio'])) });
  }
  return Promise.reject(new Error('Unknown URL'));
});
```

**Python — Numeric Precision:**
```python
def test_ema():
    ema = ExponentialMovingAverage(attack_time=0.1, release_time=0.5)
    ema.update(dt=0.1, new_value=1.0)
    assert ema.value == pytest.approx(0.5)  # Use pytest.approx for floats
```

---

*Testing analysis: 2026-03-19*

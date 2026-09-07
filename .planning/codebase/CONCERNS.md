# Codebase Concerns

**Analysis Date:** 2026-03-19

## Tech Debt

**Document content interpolation bug in system prompt builder:**
- Issue: `storage.py` line 60 uses a plain Python string literal `"{document.content}\n\n"` instead of an f-string. The document content is never actually inserted into the LLM prompt.
- Files: `services/backend/backend/storage.py:60`
- Impact: User-uploaded documents are silently omitted from every LLM context window, making the "documents" feature non-functional.
- Fix approach: Change line 60 from `prompt += "{document.content}\n\n"` to `prompt += f"{document.content}\n\n"`.

**Bare `except:` clause in Google auth route:**
- Issue: `auth.py` lines 82–104 catch all exceptions including `KeyboardInterrupt` and `SystemExit` to detect a missing user and create a new account. Any storage I/O error would silently create a duplicate/blank account instead of surfacing the real error.
- Files: `services/backend/backend/routes/auth.py:82`
- Impact: Corrupted user state on storage errors; impossible to distinguish missing user from I/O failure.
- Fix approach: Replace bare `except:` with `except HTTPException:`, re-raise other exceptions.

**`useBackendServerUrl` URL detection heuristic:**
- Issue: Backend URL is detected by checking whether `window.location.port === '3000'`. This breaks in non-standard deployments (e.g. `localhost:8080`, custom ports) and is flagged with a `FIXME` comment.
- Files: `services/frontend/src/hooks/useBackendServerUrl.ts:3`
- Impact: Wrong backend URL in non-standard dev or staging environments; silent misdirected requests.
- Fix approach: Replace the heuristic with a single `NEXT_PUBLIC_BACKEND_URL` environment variable. The comment acknowledges this.

**Hardcoded Kyutai STT auth token:**
- Issue: The Kyutai (DSM) STT websocket connection always sends `"kyutai-api-key": "public_token"` as the auth header; this is not configurable.
- Files: `services/backend/backend/stt/speech_to_text.py:301`
- Impact: Cannot authenticate against a production/private Kyutai STT instance.
- Fix approach: Add a `KYUTAI_STT_API_KEY` env var (distinct from `KYUTAI_API_KEY` used for TTS) and pass it here. The `# TODO: make this configurable` comment already flags this.

**Hardcoded STT delay constant:**
- Issue: `STT_DELAY_SEC = 2` is a fixed value that cannot be read from the ASR server at runtime.
- Files: `services/backend/backend/kyutai_constants.py:49`
- Impact: Incorrect flush timing if the ASR server's actual delay differs. A `# TODO` comment acknowledges the desired fix.
- Fix approach: Query the ASR server for its delay during the STT startup handshake.

**`InvincibleVoice.tsx` god component:**
- Issue: `InvincibleVoice.tsx` is 1557 lines with ~30 `useState` hooks, all event handlers, all layout branching (mobile/desktop/vertical-split), keyboard shortcut logic, WebSocket lifecycle, and TTS orchestration in a single component.
- Files: `services/frontend/src/components/InvincibleVoice.tsx`
- Impact: Very high cognitive load; risk of introducing regressions when touching any feature; difficult to test in isolation.
- Fix approach: Extract sub-hooks (WebSocket lifecycle, keyboard shortcut handler, response/keyword state) and split mobile/desktop rendering into separate top-level components.

**Artificial `asyncio.sleep` in audio send loop:**
- Issue: `speech_to_text.py` inserts a 5 ms `asyncio.sleep(0.005)` between every 1920-sample audio chunk sent to Gradium to "avoid overwhelming the service". This is a workaround, not a proper backpressure mechanism.
- Files: `services/backend/backend/stt/speech_to_text.py:207`
- Impact: Adds latency proportional to audio length; may cause timing drift under load.
- Fix approach: Use Gradium's proper backpressure/flow-control mechanism if available; otherwise document the constraint.

**`ttsUtil.ts` fetches sample rate on every TTS call:**
- Issue: `playTTSStream` makes a `GET /api/v1/tts/sample_rate` HTTP call every time a response is played, even though the sample rate is a static server constant.
- Files: `services/frontend/src/utils/ttsUtil.ts:18`
- Impact: One extra round-trip per TTS playback; race conditions possible if the request is slow.
- Fix approach: Fetch sample rate once at app startup and store it in context, or expose it as a build-time constant.

## Known Bugs

**`VLLMStream.thinking_mode` parameter is accepted but unused:**
- Symptoms: `VLLMStream.__init__` accepts `thinking_mode` but never stores or uses it.
- Files: `services/backend/backend/llm/llm_utils.py:32-40`
- Trigger: Always; `UserSettings.thinking_mode` has no effect on LLM requests.
- Workaround: None.

**`conversation_state_override` is never reset after bot stops speaking in `_generate_response_task`:**
- Symptoms: `conversation_state_override` is set to `"bot_speaking"` at the start of LLM generation and to `"waiting_for_user"` in the `finally` block, but if the response LLM task is cancelled via `interrupt_bot`, the `finally` block in `_generate_response_task` still runs and resets to `"waiting_for_user"`. The override can also be set redundantly in `_stt_loop`.
- Files: `services/backend/backend/unmute_handler.py:185`, `services/backend/backend/llm/llm_utils.py`, `services/backend/backend/unmute_handler.py:454`
- Trigger: Race between interrupt and LLM completion.
- Workaround: Functional in normal usage; edge case on rapid interrupt.

## Security Considerations

**No HTTPS in docker-compose.yml:**
- Risk: HTTP/HTTPS redirect and TLS termination are commented out. All traffic including JWT bearer tokens and audio streams is sent in cleartext over port 80.
- Files: `docker-compose.yml:13-15`, `docker-compose.yml:22-24`
- Current mitigation: None in the provided compose file.
- Recommendations: Uncomment and configure the HTTPS redirect and a TLS certificate resolver (e.g. Let's Encrypt via Traefik).

**JWT token stored in a cookie without `httpOnly` or `secure` flags:**
- Risk: The bearer token is stored with `new Cookies().set('bearerToken', data.access_token, { path: '/' })` without `httpOnly: true` or `secure: true`. It is accessible to any JavaScript on the page and transmitted over HTTP.
- Files: `services/frontend/src/auth/authContext.tsx:66`
- Current mitigation: None.
- Recommendations: Set `{ httpOnly: true, secure: true, sameSite: 'strict', path: '/' }` on the cookie. Use `httpOnly` to prevent XSS token theft.

**JWT token passed as WebSocket subprotocol:**
- Risk: Bearer tokens are passed in `protocols: ['realtime', 'Bearer.${bearerToken}']` because the WebSocket API does not support custom headers. The token is visible in the HTTP upgrade request.
- Files: `services/frontend/src/components/InvincibleVoice.tsx:280-282`, `services/backend/backend/routes/user.py:98-101`
- Current mitigation: Accepted industry workaround, but the cleartext HTTP issue above makes this worse.
- Recommendations: Accept this pattern but ensure HTTPS is enforced end-to-end.

**`dangerouslySetInnerHTML` for debug output:**
- Risk: The debug panel uses `dangerouslySetInnerHTML` to render `prettyPrintJson.toHtml(debugDict)` where `debugDict` comes from the server. If the server sends a malicious response (e.g. XSS payload in a transcription), it could execute in the user's browser.
- Files: `services/frontend/src/components/InvincibleVoice.tsx:1523`
- Current mitigation: Debug panel is only visible in dev mode (`isDevMode`).
- Recommendations: Sanitize output with DOMPurify before injection, or use a plain-text JSON renderer.

**Path traversal risk in email-based file storage:**
- Risk: User data is stored at `USERS_SETTINGS_AND_HISTORY_DIR / f"{email}.json"`. An email containing `../` or other path components (e.g. `../../etc/passwd`) could write to arbitrary paths.
- Files: `services/backend/backend/storage.py:116`
- Current mitigation: Google OAuth validation ensures `email` comes from a verified provider for Google auth users. Password-based registration has no email format validation beyond what the form accepts.
- Recommendations: Sanitize or hash the email before using it as a filename; use `uuid` as the filename key.

**No rate limiting on `/auth/register` or `/auth/login`:**
- Risk: Registration and login endpoints have no brute-force or spam protection.
- Files: `services/backend/backend/routes/auth.py`
- Current mitigation: `MAX_CLIENTS = 4` semaphore on WebSocket sessions only; HTTP endpoints are unrestricted.
- Recommendations: Add per-IP rate limiting at the Traefik layer or in FastAPI middleware.

**CORS hardcoded to localhost only:**
- Risk: `CORS_ALLOW_ORIGINS` is hardcoded to `["http://localhost", "http://localhost:3000"]`. In production, this will silently block legitimate cross-origin requests or must be changed manually.
- Files: `services/backend/backend/main.py:36`
- Current mitigation: None.
- Recommendations: Read allowed origins from an environment variable.

## Performance Bottlenecks

**Global mutable `tts_model` / `voice_state` in `tts_utils.py`:**
- Problem: Pocket TTS model is loaded as module-level globals and shared across all concurrent requests. The `generate_data_with_state` function spawns a new `threading.Thread` per TTS call (mixing threads and asyncio).
- Files: `services/backend/backend/tts/tts_utils.py:64-69`, `services/backend/backend/tts/tts_utils.py:48-62`
- Cause: The Pocket TTS model is not re-entrant; concurrent requests share one model instance and one voice state.
- Improvement path: Implement a pool of TTS models or enforce serial access via an asyncio lock. Assess whether `voice_state` is mutated per call.

**All user data loaded from disk on every authenticated request:**
- Problem: `get_current_user` calls `get_user_data_from_storage` which reads and parses the full user JSON file (all conversations, documents, settings) on every API call, including the high-frequency WebSocket connect.
- Files: `services/backend/backend/routes/user.py:39-62`, `services/backend/backend/storage.py:119-127`
- Cause: No in-memory caching layer; filesystem I/O per request.
- Improvement path: Add a short-lived in-memory user data cache keyed by email with an LRU eviction policy.

## Fragile Areas

**Flat-file JSON storage with no concurrency control:**
- Files: `services/backend/backend/storage.py:36-41`
- Why fragile: `UserData.save()` overwrites the file without any locking. If two WebSocket sessions for the same user run concurrently (possible if the user opens two tabs), the last write wins and one session's data is silently lost.
- Safe modification: Add a file lock (e.g. `filelock`) or migrate to a proper database. Until then, the `MAX_CLIENTS = 4` semaphore does not prevent concurrent sessions for different users.
- Test coverage: No tests for concurrent write scenarios.

**`NoneType` error on `os.environ.get(...).lower()` when env var is absent:**
- Files: `services/backend/backend/kyutai_constants.py:18`, `services/backend/backend/kyutai_constants.py:25`
- Why fragile: `os.environ.get("KYUTAI_STT_PROVIDER")` returns `None` if unset; calling `.lower()` on `None` raises `AttributeError` at import time with no descriptive error message.
- Safe modification: Use `os.environ.get("KYUTAI_STT_PROVIDER", "")` or check for `None` before calling `.lower()`, and provide a clear error message.
- Test coverage: No test for missing env vars.

**`interrupt_bot` asserts `_clear_queue` is not None:**
- Files: `services/backend/backend/unmute_handler.py:471-474`
- Why fragile: The code comment says "Not sure under what circumstances this is None" but proceeds with `if self._clear_queue is not None`. If it is `None`, the interrupt silently skips clearing FastRTC's internal queue, potentially causing stale audio playback.
- Safe modification: Investigate when `_clear_queue` is `None` and add a log warning or assertion.
- Test coverage: No tests for the interrupt path.

**Conversation delete uses mutable index (not UUID):**
- Files: `services/backend/backend/routes/user.py:84-89`
- Why fragile: `DELETE /v1/user/conversations/{conversation_id}` deletes by list index. If the frontend and backend have a race (e.g. another session adds a conversation between the user clicking delete and the request arriving), the wrong conversation could be deleted.
- Safe modification: Use a stable UUID per conversation as the delete key instead of a list index.
- Test coverage: A frontend test exists for the UI flow but not for the race condition.

## Scaling Limits

**`MAX_CLIENTS = 4` global concurrency cap:**
- Current capacity: 4 simultaneous WebSocket sessions per backend instance.
- Limit: The comment explains this is intentional to avoid Python GIL contention; scaling is intended via running more backend instances.
- Scaling path: Horizontal scaling of backend containers behind the Traefik load balancer. No session affinity is required since each connection is stateless from the load balancer's perspective.

## Dependencies at Risk

**`fastrtc==0.0.23` pinned at pre-release version:**
- Risk: Very early version (0.0.x) of a core audio streaming library. Breaking API changes are likely.
- Impact: `UnmuteHandler`, `AsyncStreamHandler`, `wait_for_item`, `audio_to_float32`, `AdditionalOutputs`, `CloseStream` all depend on this library.
- Migration plan: Track upstream releases; write an integration test that exercises the audio pipeline to catch breaking changes early.

**`gradium==0.5.4` and `pocket-tts` with no upper version bounds:**
- Risk: `gradium` and `pocket-tts` are commercial/proprietary packages with no documented stable API guarantee; no upper version pin means a breaking update could silently pull in incompatible changes on next install.
- Impact: STT (`gradium` provider) and local TTS would break.
- Migration plan: Add upper bounds (e.g. `gradium>=0.5.4,<0.6`) until the API is verified stable.

## Test Coverage Gaps

**Backend has only one test file:**
- What's not tested: Authentication flows, storage reads/writes, `UnmuteHandler` audio pipeline, `QuestManager` cancellation, TTS routing, service discovery, all WebSocket routes.
- Files: `services/backend/tests/test_exponential_moving_average.py` (only test file)
- Risk: Regressions in any backend logic go undetected until runtime.
- Priority: High

**Frontend has no E2E tests:**
- What's not tested: Full connect → speak → select response → disconnect flow; audio recording; WebSocket message handling end-to-end with a real backend.
- Files: `services/frontend/src/app/__tests__/` (unit and component tests only)
- Risk: Integration regressions between frontend WebSocket handling and backend message format changes.
- Priority: Medium

**No tests for document content injection (the known f-string bug):**
- What's not tested: `UserData.to_llm_ready_conversation` output for users with documents.
- Files: `services/backend/backend/storage.py:43-101`
- Risk: The existing f-string bug (`"{document.content}"`) would be caught immediately by a test asserting document content appears in the prompt.
- Priority: High

---

*Concerns audit: 2026-03-19*

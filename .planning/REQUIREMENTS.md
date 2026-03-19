# Requirements: Invincible Voice — Mobile Interface Overhaul

**Defined:** 2026-03-19
**Core Value:** A non-verbal person holding their phone must be able to see the conversation, pick a response, and speak — without any functionality being hidden or cut off.

## v1 Requirements

### Chat Display

- [x] **CHAT-01**: User can see the live conversation (ChatInterface) during an active mobile session
- [x] **CHAT-02**: Current speaker transcription (STT) is visible in real-time during active session
- [x] **CHAT-03**: User can view past conversations on mobile (isViewingPastConversation flow works)

### Navigation

- [x] **NAV-01**: Mobile active session has tab/panel navigation to switch between the conversation view and the response/input view
- [x] **NAV-02**: Conversation history is accessible from mobile (in a dedicated tab or page, not during active chat to conserve space)
- [ ] **NAV-03**: Settings are accessible from mobile (in a dedicated tab or page, not during active chat to conserve space)

### Layout — Portrait Phone

- [x] **LAYOUT-01**: All UI content is visible and usable on portrait phone screens from 360px width
- [x] **LAYOUT-02**: iOS Safari viewport height bug fixed (replace `h-screen`/100vh with `dvh` or measured fallback)
- [x] **LAYOUT-03**: Virtual keyboard does not permanently obscure the chat or response controls when text input is focused

### Layout — Landscape & Tablet

- [x] **LAYOUT-04**: Layout adapts correctly when phone is rotated to landscape (no overflow, no broken/cut-off controls)
- [x] **LAYOUT-05**: Tablet breakpoint (768px–1024px) renders a usable intermediate layout — not the narrow phone layout, not the full desktop layout

### Touch Accessibility

- [x] **TOUCH-01**: All interactive elements (response cards, buttons, edit icon, freeze toggle) have a minimum 44px tap target area

## v2 Requirements

### Navigation

- **NAV-04**: Swipe gestures to switch between chat and response panels
- **NAV-05**: Auto-switch to chat panel when STT transcription begins

### Polish

- **POLISH-01**: Haptic feedback on response card selection (where supported)
- **POLISH-02**: Orientation lock toggle in settings (user can lock to portrait)
- **POLISH-03**: Responsive typography that scales with viewport width

### Accessibility

- **A11Y-01**: Screen reader (VoiceOver/TalkBack) navigation order is logical on mobile
- **A11Y-02**: No 300ms touch delay on all interactive elements (touch-action: manipulation globally)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend changes | Mobile UX is entirely frontend |
| Desktop layout modifications | Desktop works well — leave it alone |
| New features not on desktop | Parity first; new features are v2+ |
| Native iOS/Android app | Web browser only for this milestone |
| Push notifications | Out of scope for communication session flow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAT-01 | Phase 1 | Complete |
| CHAT-02 | Phase 1 | Complete |
| CHAT-03 | Phase 3 | Complete |
| NAV-01 | Phase 1 | Complete |
| NAV-02 | Phase 3 | Complete |
| NAV-03 | Phase 3 | Pending |
| LAYOUT-01 | Phase 1 | Complete |
| LAYOUT-02 | Phase 1 | Complete |
| LAYOUT-03 | Phase 1 | Complete |
| LAYOUT-04 | Phase 2 | Complete |
| LAYOUT-05 | Phase 2 | Complete |
| TOUCH-01 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---

*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*

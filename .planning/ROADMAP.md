# Roadmap: Invincible Voice — Mobile Interface Overhaul

**Project:** Invincible Voice — Mobile AAC Interface Overhaul
**Defined:** 2026-03-19
**Granularity:** Coarse (3 phases combining related requirements)

## Overview

This roadmap maps 12 v1 requirements into 3 delivery phases. Each phase completes a coherent mobile capability, validated by observable user behaviors.

**Core Value:** A non-verbal person holding their phone must be able to see the conversation, pick a response, and speak — without any functionality being hidden or cut off.

---

## Phases

- [ ] **Phase 1: Mobile Foundation with Chat Integration** - Chat display, tab navigation, iOS fixes, keyboard handling, touch targets
- [x] **Phase 2: Landscape & Tablet Responsiveness** - Orientation handling, landscape layout, intermediate tablet breakpoint (completed 2026-03-19)
- [ ] **Phase 3: Mobile Settings, History, and Polish** - Settings access during session, conversation history access, visual affordances

---

## Phase Details

### Phase 1: Mobile Foundation with Chat Integration

**Goal:** Non-verbal users can see live conversations, provide responses, and use text input on portrait phones (360px+) with accessible touch targets and stable layout despite iOS quirks.

**Depends on:** Nothing (foundation phase)

**Requirements:** CHAT-01, CHAT-02, NAV-01, LAYOUT-01, LAYOUT-02, LAYOUT-03, TOUCH-01

**Success Criteria** (what must be TRUE when complete):
1. User sees live conversation (ChatInterface) in a dedicated chat tab during active mobile session
2. User can see real-time STT transcription displayed in chat alongside bot responses
3. User can switch between chat tab and response/input tab without page reload (local state-driven panel visibility)
4. All UI content is visible and usable on 360px-wide portrait phone screens without horizontal scroll
5. iOS Safari 100vh bug fixed — layout uses measured viewport height or `dvh` fallback, not `h-screen`
6. Virtual keyboard opening does not permanently hide chat or input controls; scroll compensation active
7. All interactive elements (response cards, buttons, edit icon, freeze toggle, tabs) have minimum 44px × 44px tap targets
8. Safe area insets applied for notch/safe zones (iOS); no content obscured by hardware

**Plans:** 2/3 plans executed

Plans:
- [ ] 01-01-PLAN.md — Viewport foundations: useViewportHeight hook, touch-action globals, safe area CSS, dvh utilities
- [ ] 01-02-PLAN.md — Chat integration + tab bar: ChatPanel, ResponsePanel, MobileConversationLayout refactor with activePanel state
- [ ] 01-03-PLAN.md — Touch target audit + safe area application: enforce 44px minimums, apply insets, human verify

**Technical Scope:**
- Integrate ChatInterface component as ChatPanel in MobileConversationLayout
- Implement tab bar UI (Chat | Responses) with local state (`activePanel`)
- Fix viewport height calculations (measure window.innerHeight, use `dvh` in Tailwind)
- Implement scroll compensation for virtual keyboard (visualViewport.height)
- Audit and enforce 44px minimum tap targets on all interactive elements
- Apply `env(safe-area-inset-*)` CSS to handle notches and safe zones
- Add `touch-action: manipulation` to suppress iOS 300ms touch delay

---

### Phase 2: Landscape & Tablet Responsiveness

**Goal:** Users can rotate phones to landscape and tablet devices (768px–1024px) have a usable intermediate layout, with state and scroll preserved across orientation changes.

**Depends on:** Phase 1 (foundation established)

**Requirements:** LAYOUT-04, LAYOUT-05

**Success Criteria** (what must be TRUE when complete):
1. Phone rotates to landscape without layout breaking — all controls and chat visible without vertical overflow
2. Content reflows for landscape orientation with reduced header, tighter spacing, appropriate font sizes
3. Tablet viewport (768px–1024px) renders a usable intermediate layout — not the narrow mobile layout, not full desktop
4. Scroll position and editing state preserved when user rotates device (no state loss, no reset to top)
5. Orientation change does not flicker or momentarily show incorrect layout (debounced resize handler)

**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md — Landscape CSS + debounced orientation handler: landscape: Tailwind variants on header/grid/footer, 400ms debounce on orientationchange, overscroll-x-contain on carousels
- [ ] 02-02-PLAN.md — Tablet two-column layout + human verify: md:grid-cols-2 always-visible panels, useMobileDetection breakpoint audit, DevTools verification checkpoint

**Technical Scope:**
- Add `@media (orientation: landscape)` styling for reduced headers, tighter spacing, alternative layouts
- Implement debounced resize/orientationchange listener (300–500ms debounce)
- Preserve scroll position via ref before orientation change, restore after
- Design tablet breakpoint layout (768px–1024px) — possibly two-column or optimized mobile layout
- Test on real devices (iPhone, iPad, Android tablet)
- Add `overscroll-behavior: contain` to prevent scroll hijacking on keyword/response carousels

---

### Phase 3: Mobile Settings, History, and Polish

**Goal:** Users can access settings and conversation history during active mobile sessions, with visual affordances guiding navigation and content discoverability.

**Depends on:** Phase 1 (tab bar structure), Phase 2 (orientation stability)

**Requirements:** CHAT-03, NAV-02, NAV-03

**Success Criteria** (what must be TRUE when complete):
1. User can view past conversations in a dedicated history tab during active session (no page reload, instant switching)
2. User can select a past conversation from history and view it inline with full chat visible
3. Settings modal is accessible via a button in the mobile layout — user can change settings without leaving conversation
4. Visual affordances (scroll hints, gradient overlays, pagination dots) indicate scrollable content in chat/response/history panels
5. No flicker or state loss when opening/closing settings modal during active conversation
6. Haptic feedback on response card selection (Android; visual fallback for iOS)

**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — HistoryPanel component + MobileConversationLayout history tab (NAV-02, CHAT-03)
- [ ] 03-02-PLAN.md — Wire InvincibleVoice mobile branch + human verify (NAV-02, NAV-03, CHAT-03)

**Technical Scope:**
- Create HistoryPanel component wrapping ConversationHistory
- Wire history selection to load conversation data (isViewingPastConversation flow)
- Add Settings modal button to mobile layout
- Implement modal state management (modal open/close without parent disruption)
- Add visual scroll hints (gradient overlays, arrows) to panels with overflow content
- Integrate haptic feedback via Vibration API (with visual fallback)
- Test settings changes mid-conversation for state isolation

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Mobile Foundation with Chat Integration | 2/3 | In Progress|  |
| 2. Landscape & Tablet Responsiveness | 2/2 | Complete   | 2026-03-19 |
| 3. Mobile Settings, History, and Polish | 0/2 | Not started | - |

---

## Coverage Summary

**v1 Requirements:** 12 total
**Mapped to phases:** 12
**Unmapped (orphaned):** 0 ✓

| Requirement | Phase | Category |
|-------------|-------|----------|
| CHAT-01 | 1 | Chat Display |
| CHAT-02 | 1 | Chat Display |
| CHAT-03 | 3 | Chat Display |
| NAV-01 | 1 | Navigation |
| NAV-02 | 3 | Navigation |
| NAV-03 | 3 | Navigation |
| LAYOUT-01 | 1 | Portrait Phone |
| LAYOUT-02 | 1 | Portrait Phone |
| LAYOUT-03 | 1 | Portrait Phone |
| LAYOUT-04 | 2 | Landscape & Tablet |
| LAYOUT-05 | 2 | Landscape & Tablet |
| TOUCH-01 | 1 | Touch Accessibility |

---

*Roadmap created: 2026-03-19*
*Derived from: PROJECT.md, REQUIREMENTS.md, research/SUMMARY.md*
*Phase 1 plans added: 2026-03-19*

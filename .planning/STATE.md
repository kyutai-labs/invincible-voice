---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 03
current_plan: 2
status: executing
last_updated: "2026-03-19T16:52:00Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 7
  completed_plans: 6
---

# Project State: Invincible Voice — Mobile Interface Overhaul

**Last updated:** 2026-03-19
**Current phase:** 03
**Current plan:** 2

---

## Project Reference

**Core Value:** A non-verbal person holding their phone must be able to see the conversation, pick a response, and speak — without any functionality being hidden or cut off.

**Scope:** Mobile-first AAC interface with feature parity to desktop. Three phases: Foundation → Landscape/Tablet → Settings/History.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4 (no new dependencies)

**Status:** Executing Phase 03

---

## Current Position

Phase: 03 (mobile-settings,-history,-and-polish) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:** (TBD after Phase 1 planning)

**Requirements Coverage:**

- Phase 1: 7/12 v1 requirements (CHAT-01, CHAT-02, NAV-01, LAYOUT-01, LAYOUT-02, LAYOUT-03, TOUCH-01)
- Phase 2: 2/12 v1 requirements (LAYOUT-04, LAYOUT-05)
- Phase 3: 3/12 v1 requirements (CHAT-03, NAV-02, NAV-03)
- **Total mapped:** 12/12 ✓

**Risk Profile:**

- **Phase 1 (HIGH risk):** iOS Safari viewport/keyboard bugs, ChatInterface mobile compatibility (unvalidated), touch target enforcement
- **Phase 2 (LOW risk):** CSS-only responsive patterns, standard orientation handling
- **Phase 3 (MEDIUM risk):** Modal state management, history data flow, haptic fallbacks

---

## Accumulated Context

### Architecture Decisions

1. **Tab-based panel visibility (Phase 1):** Layered panels (Chat, Responses, History) controlled by local `useState(activePanel)` in MobileConversationLayout. Avoids page reloads, preserves scroll/edit state.

2. **CSS-first responsive design:** Use Tailwind breakpoints (`md:` = 768px) for all structural layouts. Never use JS detection for styling (prevents hydration mismatches). JS detection (`useMobileDetection`) only for conditional rendering between mobile and desktop routes.

3. **No new dependencies:** Existing stack (Next.js 15, React 19, Tailwind CSS 4, lucide-react, react-use-websocket) is sufficient. No gesture libraries or viewport calculation libraries needed.

4. **Next.js 15 viewport export (01-01):** Used `export const viewport = { viewportFit: 'cover' }` in layout.tsx instead of raw `<meta>` tag — Next.js 15 manages all viewport configuration via this export.

5. **touch-action: manipulation global, .scrollable override kept (01-01):** Touch delay suppressed globally on interactive elements. Existing `.scrollable { touch-action: auto !important }` rule kept intact for scroll containers.

6. **Tab panel height pattern (01-02):** Panel area uses `flex-1 min-h-0 flex flex-col` — the `min-h-0` prevents flex children from overflowing. Always-visible text input footer is outside the panel area at bottom of layout. Virtual keyboard compensated via `paddingBottom` on root container.

7. **onFreezeToggle threading (01-02):** MobileConversationLayout now receives onFreezeToggle as a prop and passes it to ResponsePanel. handleFreezeToggle exists in InvincibleVoice and was previously only wired to desktop layout.

8. **Safe area via shrink-0 spacer divs (01-03):** Used `<div style={{ height: 'var(--safe-area-inset-top/bottom)' }} className='shrink-0' />` as first/last children of flex-col containers rather than padding on root — avoids conflicts with keyboard height paddingBottom calculation.

9. **44px tap target patterns (01-03):** Use `min-h-[44px]` for stretch buttons, `w-11 h-11` for fixed square targets. Edit button uses `absolute w-11 h-11 flex items-center justify-center` container with small icon inside — large hit area, icon stays visually small.

10. **Debounced orientation change handler (02-01):** `useViewportHeight` debounces window `resize` + `orientationchange` at 400ms to prevent layout flicker. `visualViewport` resize stays immediate for keyboard compensation. Both listeners registered for cross-browser coverage (iOS fires both; Android fires only resize).

11. **Tailwind landscape: variant for orientation CSS (02-01):** All landscape-specific overrides use `landscape:` prefix (header h-[44px], tab bar py-1, footer pt-1, suggestions strip hidden, response grid 2x2). No JS media queries — consistent with CSS-first design decision #2.

12. **overscroll-x-contain on horizontal carousels (02-01):** Quick response carousel uses `overscroll-x-contain` to prevent vertical page scroll when user swipes horizontally past the end of the carousel row.

13. **Mobile threshold extended to include tablets (02-02):** `useMobileDetection` threshold changed from `< 768` to `< 1025` so tablets (768px–1024px) render `MobileConversationLayout` with two-column CSS rather than the desktop layout. All tablet layout logic lives in one component.

14. **md:grid-cols-2 tablet panel layout (02-02):** Panel area uses `md:grid-cols-2 md:gap-4 md:px-2` to show ChatPanel and ResponsePanel side-by-side on tablet. Tab bar hidden with `md:hidden` since both panels are always visible — no tab switching needed on tablet.

15. **HistoryPanel purpose-built mobile component (03-01):** Built as a standalone mobile list rather than wrapping desktop ConversationHistory — the desktop component has a fixed `w-80` width and logo images that break on mobile. Mobile panel uses `flex flex-col flex-1 min-h-0 overflow-hidden` + `overflow-y-auto` scroll container.

16. **History tab hidden on tablet with md:hidden (03-01):** The HistoryPanel slot uses `md:hidden` because tablet layout already shows ConversationHistory in the desktop-style sidebar column. History is a mobile-only navigation concern.

### Research Highlights

- **iOS 100vh bug:** `h-screen` doesn't account for browser toolbar. Use measured `window.innerHeight - headerHeight - footerHeight` or `dvh` (dynamic viewport height).
- **Virtual keyboard:** Opens 50% of viewport. Must implement scroll compensation via `window.visualViewport.height` and `overflow-y-auto` on chat container.
- **Touch delay:** iOS delays 300ms after touch for double-tap zoom detection. Fix with `touch-action: manipulation` on all buttons.
- **Tap target sizing:** WCAG 44×44px minimum. Critical for motor-impaired AAC users.

### Known Gaps / Open Questions

1. **ChatInterface mobile compatibility:** ChatInterface works on desktop (fixed height, side-by-side layout). Does it work in a mobile-constrained container (flex-1, overflow-y-auto, max 360px width)? **Test during Phase 1 planning.**

2. **Tablet layout:** Current plan assumes tablet uses desktop layout (768px+). Should it have an intermediate two-column layout? **Validate during Phase 2 if tablets are priority use case.**

3. **Voice input during keyboard open:** STT transcription display + virtual keyboard may conflict (limited vertical space). **Test with real speech input in Phase 1.**

4. **Android vs. iOS:** Research emphasizes iOS Safari bugs. Android Chrome has fewer viewport issues but different keyboard behavior. **Phase 1 testing must cover both.**

### Decisions Pending

- Tablet layout specifics (defer to Phase 2 if time-constrained)
- Haptic feedback implementation (Vibration API support matrix)
- Visual scroll hint design (gradient vs. arrow vs. pagination dots)

---

## Session Continuity

**Previous sessions:** 2026-03-19 — completed 01-01 (iOS viewport foundation), 01-02 (tab bar + chat integration), 01-03 (44px tap targets + safe area insets), 02-01 (landscape orientation: debounced resize, landscape: CSS classes), 02-02 (tablet two-column layout, extended mobile threshold to 1025), 03-01 (HistoryPanel component + MobileConversationLayout three-tab layout)

**When resuming:**

1. Check current phase in ROADMAP.md progress table
2. Review accumulated context and risk profile above
3. Verify all Phase 1 plans exist before starting Phase 2
4. Use .planning/REQUIREMENTS.md for requirement traceability

**Files to consult:**

- `.planning/ROADMAP.md` — phase structure, success criteria
- `.planning/REQUIREMENTS.md` — requirement-to-phase mapping
- `.planning/research/SUMMARY.md` — technical deep-dives and pitfall analysis
- `.planning/PROJECT.md` — core value, constraints, key decisions

---

*State initialized: 2026-03-19*

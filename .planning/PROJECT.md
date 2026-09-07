# Invincible Voice — Mobile Interface Overhaul

## What This Is

Invincible Voice is an AAC (Augmentative and Alternative Communication) app that helps people who cannot speak to communicate. It combines STT/TTS and LLM to let users write messages that are spoken aloud, while the LLM proposes contextual responses they can select and speak.

The desktop interface is functional and complete. This project delivers a fully ergonomic mobile interface with feature parity: every interaction available on desktop must be accessible on mobile across all screen sizes and orientations.

## Core Value

A non-verbal person holding their phone during a real conversation must be able to see the chat, pick or type a response, and speak — without any functionality being hidden or inaccessible.

## Requirements

### Validated

- ✓ Desktop layout with conversation view, response suggestions, keywords, and settings — existing
- ✓ Mobile detection (width < 768px) routing to dedicated mobile components — existing
- ✓ `MobileNoConversation` screen with hamburger menu → conversation history drawer — existing
- ✓ `MobileConversationLayout` with keywords, text input, response cards, freeze/size controls — existing (but incomplete)
- ✓ Settings modal accessible before starting a conversation on mobile — existing

### Active

- [ ] Chat conversation visible during active mobile session (ChatInterface integrated into MobileConversationLayout)
- [ ] Past conversation viewing accessible from mobile active session
- [ ] Settings accessible during active mobile session
- [ ] Portrait phone layout — all functionality reachable with one thumb
- [ ] Landscape phone layout — layout adapts without content overflow
- [ ] Tablet layout — intermediate breakpoint between phone and desktop
- [ ] Touch targets are finger-friendly (min 44px tap areas)
- [ ] No content cut off or overflowing on any supported screen size

### Out of Scope

- Backend changes — mobile UX is entirely frontend
- Desktop layout changes — desktop is working well, leave it alone
- New features not already on desktop — parity first, new features later
- Native mobile app (iOS/Android) — web browser only

## Context

**Existing mobile components:**
- `services/frontend/src/components/mobile/MobileLayout.tsx` — `MobileNoConversation` (pre-session screen)
- `services/frontend/src/components/mobile/MobileConversationLayout.tsx` — active session (missing ChatInterface)
- `services/frontend/src/hooks/useMobileDetection.ts` — width < 768px breakpoint

**Critical gap:** `MobileConversationLayout` never renders `ChatInterface`. Users in an active conversation on mobile have no way to see what's being said. The component exists and works on desktop — it just needs to be integrated into the mobile layout.

**Secondary gaps:** No settings button, no conversation history access, and no past-conversation viewing in `MobileConversationLayout`.

**Desktop layout for reference:** `InvincibleVoice.tsx` lines ~1125–end — three-column layout with ConversationHistory sidebar, ChatInterface + ResponseOptions center, keywords/input right panel.

## Constraints

- **Tech stack**: Next.js 15 + React 19 + Tailwind CSS 4 — no new dependencies
- **No regressions**: Desktop layout must not be touched
- **Screen sizes**: Portrait phone (360px+), landscape phone (568px+), tablet (768px–1024px)
- **Accessibility**: App is used by people with motor difficulties — tap targets matter

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Work on a dedicated git branch | Isolate mobile work from main, reviewable via PR | — Pending |
| Reuse existing `ChatInterface` component | Already works on desktop, no need to rewrite | — Pending |
| Tab/panel navigation for mobile | Screen too small for side-by-side; swipe or tabs to switch between chat and responses | — Pending |

---
*Last updated: 2026-03-19 after initialization*

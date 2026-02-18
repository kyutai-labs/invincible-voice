# InvincibleVoice Frontend

This is the main frontend application for InvincibleVoice, built with Next.js 15 and React 19. It provides a real-time voice communication interface that helps people who cannot speak communicate with others.

## Features

- **Real-time WebSocket communication** for voice streaming
- **Speech-to-text transcription** display
- **Multiple LLM response options** (4 choices generated per conversation turn)
- **Text-to-speech audio playback** with voice selection
- **Conversation history** tracking
- **Keyboard shortcuts** for quick response selection
- **Voice configuration** and personalization
- **Responsive design** for various screen sizes

## Development

Use `pnpm` to install dependencies:

```bash
pnpm install
# if you don't have Node.js:
pnpm env use --global lts
```

### Available Scripts

```bash
# Development server
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Architecture

The frontend is built with:

- **Next.js 15** - React framework with App Router
- **React 19** - UI library with modern hooks
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **WebSocket** - Real-time communication with backend
- **Opus Codec** - Audio compression for streaming

### Key Components

- `InvincibleVoice.tsx` - Main application component with WebSocket logic
- `ChatInterface.tsx` - Chat interface with conversation display
- `ResponseOptions.tsx` - Component for displaying and selecting LLM responses
- `ConversationHistory.tsx` - Conversation history component
- `VoiceRecorder.tsx` - Audio recording and streaming
- `use*.ts` - Custom React hooks for various functionality

### Custom Hooks

- `useAudioProcessor.ts` - Audio processing and streaming
- `useWakeLock.ts` - Prevent screen sleep during conversations
- `useKeyboardShortcuts.ts` - Keyboard shortcuts for response selection
- `useMicrophoneAccess.ts` - Microphone permission handling

## Communication Protocol

The frontend communicates with the backend via WebSocket using a protocol inspired by the OpenAI Realtime API. Key message types include:

- **Audio streaming**: Real-time audio input/output
- **Transcription**: Speech-to-text results
- **Response generation**: LLM-generated response options
- **Session management**: Configuration and state management

See `docs/browser_backend_communication.md` for detailed protocol specification.

## Testing

The project uses Jest for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage report
npm test -- --coverage
```

Test files are located alongside components with `.test.tsx` or `.test.ts` extensions.

## Docker Development

The frontend can be run in Docker with hot reloading:

```bash
# From project root
docker-compose up frontend

# With rebuild
docker-compose up --build frontend
```

## Environment Variables

The frontend uses these environment variables:

- `NEXT_PUBLIC_BACKEND_URL` - Backend WebSocket URL
- `NEXT_PUBLIC_API_URL` - Backend API URL

## Browser Requirements

- Modern browsers with WebSocket support
- Microphone permissions for audio input
- Speaker/headphone output for audio playback

## Contributing

When making changes:

1. Run tests: `npm test`
2. Run linting: `pnpm lint`
3. Test the WebSocket connection manually
4. Verify audio input/output functionality
5. Check responsive design on different screen sizes

## Related

- Main project documentation: `../../README.md`
- Backend service: `../backend/`
- TTS testing app: `../web-tts-frontend-olivier/`
- Communication protocol: `../../docs/browser_backend_communication.md`

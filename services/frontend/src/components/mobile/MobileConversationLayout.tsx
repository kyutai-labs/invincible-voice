'use client';

import { Pause, Settings } from 'lucide-react';
import { useState, useCallback, useEffect, useRef, ChangeEvent, KeyboardEvent, FC } from 'react';
import { PendingResponse } from '@/components/chat/ChatInterface';
import ChatPanel from '@/components/mobile/ChatPanel';
import ResponsePanel from '@/components/mobile/ResponsePanel';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { useTranslations } from '@/i18n';
import { ResponseSize, RESPONSES_SIZES } from '@/constants';
import { ChatMessage } from '@/types/chatHistory';

type ActivePanel = 'chat' | 'responses';

interface MobileConversationLayoutProps {
  textInput: string;
  onTextInputChange: (value: string) => void;
  onSendMessage: () => void;
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  onResponseSizeChange?: (size: ResponseSize) => void;
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
  chatHistory: ChatMessage[];
  isConnected: boolean;
  currentSpeakerMessage?: string;
}

// Size sent to the backend per tab:
// Chat tab shows compact chips → request short responses from the LLM
// Responses tab shows full cards → request medium responses
const SIZE_BY_PANEL: Record<ActivePanel, ResponseSize> = {
  chat: RESPONSES_SIZES.XS,
  responses: RESPONSES_SIZES.M,
};

const MobileConversationLayout: FC<MobileConversationLayoutProps> = ({
  textInput,
  onTextInputChange,
  onSendMessage,
  frozenResponses,
  onFreezeToggle,
  pendingResponses,
  onResponseEdit = undefined,
  onResponseSelect,
  onResponseSizeChange,
  onConnectButtonPress,
  onSettingsPress,
  chatHistory,
  isConnected,
  currentSpeakerMessage = '',
}) => {
  const t = useTranslations();
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { vh, visualVh } = useViewportHeight();
  const keyboardHeight = Math.max(0, vh - visualVh);

  // Notify backend of size whenever active tab changes (and on mount)
  useEffect(() => {
    onResponseSizeChange?.(SIZE_BY_PANEL[activePanel]);
  }, [activePanel, onResponseSizeChange]);

  const onMessageChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onTextInputChange(event.target.value);
    },
    [onTextInputChange],
  );
  const onMessageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSendMessage();
      }
    },
    [onSendMessage],
  );

  // When user taps Edit on a response card: fill the text input and switch to chat tab
  const handleEditResponse = useCallback(
    (text: string) => {
      onTextInputChange(text);
      setActivePanel('chat');
      // Focus the textarea and place cursor at end to open the keyboard
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 0);
    },
    [onTextInputChange],
  );

  // Top 2 complete LLM suggestions to show above the text input
  const responsesToShow = frozenResponses ?? pendingResponses;
  const topSuggestions = responsesToShow
    .filter((r) => r.text.trim() && r.isComplete)
    .slice(0, 2);

  return (
    <div
      className='w-full flex flex-col bg-[#121212] text-white overflow-hidden'
      style={{
        height: `${vh}px`,
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : undefined,
      }}
    >
      {/* Safe area spacer for notch/status bar */}
      <div style={{ height: 'var(--safe-area-inset-top)' }} className='shrink-0' />

      {/* Header with stop button - fixed height, reduced in landscape */}
      <div className='flex items-center justify-between px-4 py-3 landscape:py-1 shrink-0 h-[60px] landscape:h-[44px]'>
        <button
          aria-label='Stop conversation'
          className='shrink-0 h-11 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl'
          onClick={onConnectButtonPress}
          title={t('conversation.stopConversation')}
        >
          <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-5'>
            {t('conversation.stopConversation')}
            <Pause
              width={24}
              height={24}
              className='shrink-0 text-white'
            />
          </div>
        </button>
        <button
          className='shrink-0 h-11 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl'
          onClick={onSettingsPress}
          title={t('settings.changeSettings')}
        >
          <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center rounded-2xl px-3'>
            <Settings size={20} />
          </div>
        </button>
      </div>

      {/* Tab bar — hidden on tablet (md:) since both panels are always visible */}
      <div className='flex border-b border-gray-700 shrink-0 md:hidden'>
        <button
          className={`flex-1 py-3 landscape:py-1 min-h-[44px] text-sm font-medium transition-colors ${
            activePanel === 'chat'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActivePanel('chat')}
        >
          Chat
        </button>
        <button
          className={`flex-1 py-3 landscape:py-1 min-h-[44px] text-sm font-medium transition-colors ${
            activePanel === 'responses'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActivePanel('responses')}
        >
          Responses
        </button>
      </div>

      {/* Main panel — flex-1 min-h-0 ensures it fills remaining space without overflow */}
      {/* On tablet (md:): two-column grid with both panels always visible side-by-side */}
      <div className='flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 md:gap-4 md:px-2'>
        {/* On mobile: only show active panel. On tablet (md:): both always visible */}
        <div className={activePanel === 'chat' ? 'flex flex-col flex-1 min-h-0 md:flex' : 'hidden md:flex md:flex-col md:flex-1 md:min-h-0'}>
          <ChatPanel
            chatHistory={chatHistory}
            isConnected={isConnected}
            currentSpeakerMessage={currentSpeakerMessage}
          />
        </div>
        <div className={activePanel === 'responses' ? 'flex flex-col flex-1 min-h-0 md:flex' : 'hidden md:flex md:flex-col md:flex-1 md:min-h-0'}>
          <ResponsePanel
            frozenResponses={frozenResponses}
            onFreezeToggle={onFreezeToggle}
            pendingResponses={pendingResponses}
            onResponseEdit={onResponseEdit}
            onResponseSelect={onResponseSelect}
            onEditResponseInChat={handleEditResponse}
          />
        </div>
      </div>

      {/* Always-visible text input footer */}
      <div className='px-4 pt-2 pb-1 landscape:pt-1 landscape:pb-0 border-t border-gray-700 shrink-0'>
        {/* Top LLM suggestions (up to 2, S size) — tap to select without switching tabs */}
        {/* Hidden in landscape to reclaim vertical space (response cards remain accessible) */}
        {topSuggestions.length > 0 && (
          <div className='flex gap-2 mb-2 overflow-x-auto no-scrollbar landscape:hidden'>
            {topSuggestions.map((r) => (
              <button
                key={r.id}
                className='shrink-0 px-3 min-h-[28px] bg-gray-800 border border-gray-600 rounded-full text-xs text-gray-300 hover:bg-gray-700 transition-colors max-w-[48vw] truncate'
                onClick={() => onResponseSelect(r.id)}
                title={r.text}
              >
                {r.text}
              </button>
            ))}
          </div>
        )}
        <div className='flex gap-2 pb-1'>
          <textarea
            ref={textareaRef}
            className='flex-1 p-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm landscape:max-h-[38px] landscape:overflow-y-auto'
            placeholder={t('conversation.typeMessagePlaceholder')}
            rows={2}
            value={textInput}
            onChange={onMessageChange}
            onKeyDown={onMessageKeyDown}
          />
          <button
            className='px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm min-w-[56px] min-h-[44px]'
            onClick={onSendMessage}
            disabled={!textInput.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* Safe area spacer for home indicator */}
      <div style={{ height: 'var(--safe-area-inset-bottom)' }} className='shrink-0' />
    </div>
  );
};

export default MobileConversationLayout;

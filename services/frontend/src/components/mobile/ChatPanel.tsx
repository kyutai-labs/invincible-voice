'use client';

import { FC } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';
import { ChatMessage } from '@/types/chatHistory';
import { Conversation } from '@/utils/userData';

interface ChatPanelProps {
  chatHistory: ChatMessage[];
  isConnected: boolean;
  currentSpeakerMessage?: string;
  pastConversation?: Conversation;
  isViewingPastConversation?: boolean;
}

/**
 * Mobile-safe wrapper around ChatInterface.
 * Must be inside a flex container with flex-1 min-h-0 to constrain height correctly.
 * ChatInterface manages its own scroll via overflow-y-auto internally.
 */
const ChatPanel: FC<ChatPanelProps> = ({
  chatHistory,
  isConnected,
  currentSpeakerMessage = '',
  pastConversation = undefined,
  isViewingPastConversation = false,
}) => (
  <div className='flex flex-col flex-1 min-h-0 overflow-hidden px-2'>
    <ChatInterface
      chatHistory={chatHistory}
      isConnected={isConnected}
      currentSpeakerMessage={currentSpeakerMessage}
      pastConversation={pastConversation}
      isViewingPastConversation={isViewingPastConversation}
    />
  </div>
);

export default ChatPanel;

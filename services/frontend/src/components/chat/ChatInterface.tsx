'use client';

import { useRef, useEffect, Fragment, useCallback, useMemo, FC } from 'react';
import { useTranslations } from '@/i18n';
import type { ChatMessage } from '@/types/chatHistory';
import { playTTSStream } from '@/utils/ttsUtil';
import {
  Conversation,
  isSpeakerMessage,
  isWriterMessage,
} from '@/utils/userData';
import SpeakerMessage from './SpeakerMessage';
import WriterMessage from './WriterMessage';

export interface PendingResponse {
  id: string;
  text: string;
  isComplete: boolean;
  messageId: string;
}

interface FormattedMessage {
  key: string;
  role: 'speaker' | 'writer';
  content: string;
  messageId?: string;
  timestamp: number;
}

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  isConnected: boolean;
  currentSpeakerMessage?: string;
  pastConversation?: Conversation;
  isViewingPastConversation?: boolean;
}

const ChatInterface: FC<ChatInterfaceProps> = ({
  chatHistory,
  isConnected,
  currentSpeakerMessage = '',
  pastConversation = undefined,
  isViewingPastConversation = false,
}) => {
  const t = useTranslations();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const onClickProcessedMessages = useCallback(
    async (messageId: string, messageContent: string) => {
      playTTSStream({
        messageId,
        text: messageContent,
      });
    },
    [],
  );

  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 100;

      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [chatHistory, currentSpeakerMessage]);

  // Process messages differently based on whether viewing past conversation or current chat
  const processedMessages: FormattedMessage[] = useMemo(() => {
    if (isViewingPastConversation && pastConversation) {
      // For past conversations, use the original conversation data to preserve messageId
      return pastConversation.messages.map((message, index) => ({
        key: `past-${index}`,
        role: isSpeakerMessage(message)
          ? 'speaker'
          : ('writer' as 'speaker' | 'writer'),
        content: message.content,
        messageId: isWriterMessage(message) ? message.messageId : undefined,
        timestamp: index, // Use index as timestamp for ordering
      }));
    }
    // For current chat, use the regular chatHistory
    const processed: Array<{
      key: string;
      role: 'speaker' | 'writer';
      content: string;
      messageId?: string;
      timestamp: number;
    }> = [];

    chatHistory.forEach((message, index) => {
      if (message.role === 'user') {
        processed.push({
          key: `current-speaker-${index}`,
          role: 'speaker',
          content: message.content,
          timestamp: message.timestamp,
        });
      } else if (message.role === 'assistant') {
        processed.push({
          key: `current-writer-${index}`,
          role: 'writer',
          content: message.content,
          messageId: message.messageId,
          timestamp: message.timestamp,
        });
      }
    });

    return processed.sort((a, b) => a.timestamp - b.timestamp);
  }, [chatHistory, isViewingPastConversation, pastConversation]);

  if (!isConnected && !isViewingPastConversation) {
    return null;
  }

  return (
    <div
      className='flex flex-col grow gap-2 overflow-y-auto'
      ref={chatContainerRef}
    >
      {processedMessages.length === 0 && !isViewingPastConversation && (
        <div className='py-4 text-center text-gray-400'>
          <p className='mb-2 text-base font-medium'>
            {t('conversation.readyToChat')}
          </p>
          <p className='text-xs'>{t('conversation.startSpeaking')}</p>
        </div>
      )}
      {processedMessages.length === 0 && isViewingPastConversation && (
        <div className='py-4 text-center text-gray-400'>
          <p className='mb-2 text-base font-medium'>
            {t('conversation.emptyConversation')}
          </p>
          <p className='text-xs'>{t('conversation.noMessages')}</p>
        </div>
      )}
      {processedMessages.map((message) => (
        <ProcessedMessage
          key={message.key}
          message={message}
          playWriterMessageAudio={onClickProcessedMessages}
        />
      ))}
      {/* Show current speaker message if speaking */}
      {currentSpeakerMessage.trim() && (
        <div>
          <SpeakerMessage
            content={currentSpeakerMessage}
            showTypingIndicator
          />
        </div>
      )}
    </div>
  );
};

export default ChatInterface;

interface ProcessedMessageProps {
  message: FormattedMessage;
  playWriterMessageAudio: (messageId: string, text: string) => Promise<void>;
}

const ProcessedMessage = ({
  message,
  playWriterMessageAudio,
}: ProcessedMessageProps) => {
  const onClickMessage = useCallback(() => {
    playWriterMessageAudio(
      message.messageId ? message.messageId : crypto.randomUUID(),
      message.content!,
    );
  }, [message.messageId, message.content, playWriterMessageAudio]);

  return (
    <Fragment>
      {message.role === 'speaker' && (
        <SpeakerMessage content={message.content} />
      )}
      {message.role === 'writer' && (
        <WriterMessage
          content={message.content}
          onClick={onClickMessage}
          isClickable={!!message.content}
        />
      )}
    </Fragment>
  );
};

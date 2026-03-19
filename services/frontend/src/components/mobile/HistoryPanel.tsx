'use client';

import { FC, useCallback, useMemo } from 'react';
import { MessageSquare, X, Plus } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { Conversation, isSpeakerMessage, isWriterMessage } from '@/utils/userData';
import { cn } from '@/utils/cn';

export interface HistoryPanelProps {
  conversations: Conversation[];
  selectedConversationIndex: number | null;
  onConversationSelect: (index: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (index: number) => void;
}

const formatConversationPreview = (
  conversation: Conversation,
  t: (key: string) => string,
): string => {
  if (conversation.messages.length === 0) {
    return t('conversation.emptyConversation');
  }

  const firstMessage = conversation.messages[0];
  if (
    (isSpeakerMessage(firstMessage) || isWriterMessage(firstMessage)) &&
    firstMessage.content
  ) {
    return firstMessage.content;
  }

  return t('conversation.newChat');
};

const formatConversationDate = (
  conversation: Conversation,
  t: (key: string) => string,
): string => {
  if (!conversation.start_time) {
    return '';
  }

  try {
    const date = new Date(conversation.start_time);

    if (Number.isNaN(date.getTime())) {
      console.warn(
        'Failed to parse conversation start_time:',
        conversation.start_time,
      );
      return '';
    }

    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (diffInDays === 1) {
      return t('conversation.yesterday');
    }
    if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    if (diffInDays < 365) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    console.warn(
      'Failed to parse conversation start_time:',
      conversation.start_time,
    );
    return '';
  }
};

interface ConversationRowProps {
  conversation: Conversation;
  conversations: Conversation[];
  selectedConversationIndex: number | null;
  onConversationSelect: (index: number) => void;
  onDeleteConversation: (index: number) => void;
  t: (key: string) => string;
}

const ConversationRow: FC<ConversationRowProps> = ({
  conversation,
  conversations,
  selectedConversationIndex,
  onConversationSelect,
  onDeleteConversation,
  t,
}) => {
  const originalIndex = useMemo(() => {
    return conversations.findIndex(
      (c) => JSON.stringify(c) === JSON.stringify(conversation),
    );
  }, [conversation, conversations]);

  const isSelected = selectedConversationIndex === originalIndex;

  const handleSelect = useCallback(() => {
    onConversationSelect(originalIndex);
  }, [onConversationSelect, originalIndex]);

  const handleDelete = useCallback(() => {
    onDeleteConversation(originalIndex);
  }, [onDeleteConversation, originalIndex]);

  const preview = formatConversationPreview(conversation, t);
  const date = formatConversationDate(conversation, t);

  return (
    <div className='relative shrink-0'>
      <button
        className={cn(
          'w-full min-h-[44px] text-left px-4 py-3 rounded-xl border transition-colors',
          isSelected
            ? 'bg-gray-800 border-blue-500'
            : 'bg-[#101010] border-transparent hover:bg-gray-900',
        )}
        onClick={handleSelect}
      >
        <div className='flex items-center justify-between gap-2 pr-8'>
          <p className='line-clamp-1 text-sm text-white'>{preview}</p>
          {date && (
            <span className='shrink-0 text-xs text-gray-400'>{date}</span>
          )}
        </div>
      </button>
      {isSelected && (
        <button
          className='absolute right-2 top-2 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-colors'
          onClick={handleDelete}
          title={t('conversation.deleteConversation')}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

const HistoryPanel: FC<HistoryPanelProps> = ({
  conversations,
  selectedConversationIndex,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
}) => {
  const t = useTranslations();

  const sortedConversations = useMemo(() => {
    return structuredClone(conversations).sort((a, b) => {
      const dateA = a.start_time ? new Date(a.start_time).getTime() : 0;
      const dateB = b.start_time ? new Date(b.start_time).getTime() : 0;
      return dateB - dateA;
    });
  }, [conversations]);

  return (
    <div className='flex flex-col flex-1 min-h-0 overflow-hidden'>
      {/* "New conversation" button — always shown at top, 44px minimum height */}
      <div className='px-4 pt-3 pb-2 shrink-0'>
        <button
          className='w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-xl text-sm text-gray-200 hover:bg-gray-700 transition-colors'
          onClick={onNewConversation}
        >
          <Plus size={16} />
          {t('conversation.newChat')}
        </button>
      </div>

      {/* Scrollable conversation list */}
      <div className='flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-2'>
        {/* Empty state */}
        {sortedConversations.length === 0 && (
          <div className='flex flex-col items-center justify-center flex-1 text-gray-500 py-12'>
            <MessageSquare size={40} className='mb-3 opacity-50' />
            <p className='text-sm'>{t('conversation.noConversationsYet')}</p>
          </div>
        )}

        {/* Conversation rows */}
        {sortedConversations.map((conversation, sortedIndex) => (
          <ConversationRow
            // eslint-disable-next-line react/no-array-index-key
            key={sortedIndex}
            conversation={conversation}
            conversations={conversations}
            selectedConversationIndex={selectedConversationIndex}
            onConversationSelect={onConversationSelect}
            onDeleteConversation={onDeleteConversation}
            t={t}
          />
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;

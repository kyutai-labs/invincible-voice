import { MessageSquare, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useMemo } from 'react';
import ChatBubble from '@/components/icons/ChatBubble';
import NewConversation from '@/components/icons/NewConversation';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';
import {
  Conversation,
  isSpeakerMessage,
  isWriterMessage,
} from '@/utils/userData';

interface ConversationHistoryProps {
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

const getConversationMessageCount = (conversation: Conversation): string => {
  return conversation.messages.length > 99
    ? '99+'
    : conversation.messages.length.toString();
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

const ConversationHistory = ({
  conversations,
  selectedConversationIndex,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
}: ConversationHistoryProps) => {
  const t = useTranslations();
  const sortedConversations = useMemo(() => {
    const newConversationArray = structuredClone(conversations);
    newConversationArray.sort((a, b) => {
      const dateA = a.start_time ? new Date(a.start_time).getTime() : 0;
      const dateB = b.start_time ? new Date(b.start_time).getTime() : 0;
      return dateB - dateA;
    });
    return newConversationArray;
  }, [conversations]);

  return (
    <div className='relative flex flex-col shrink-0 h-full pt-4 w-80'>
      <div className='flex flex-row items-center justify-center shrink-0 gap-2 pb-2'>
        <Image
          src='/logo_invincible.png'
          alt='Invincible Logo'
          width={150}
          height={150}
          className='-mt-1'
        />
        <Image
          src='/logo_kyutai.svg'
          alt='Kyutai Logo'
          width={155}
          height={64}
          className='-ml-8'
        />
      </div>
      <div className='flex flex-col flex-1 gap-2 px-6 pt-2 pb-10 overflow-y-auto scrollbar-hidden'>
        {sortedConversations.length === 0 ? (
          <div className='p-4 text-center text-gray-500'>
            <MessageSquare
              size={48}
              className='mx-auto mb-2 opacity-50'
            />
            <p className='text-sm'>{t('conversation.noConversationsYet')}</p>
            <p className='mt-1 text-xs text-gray-600'>
              {t('conversation.startFirstConversation')}
            </p>
          </div>
        ) : (
          sortedConversations.map((conversation, index) => (
            <ConversationCard
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              conversation={conversation}
              conversations={conversations}
              onDeleteConversation={onDeleteConversation}
              onSelectConversation={onConversationSelect}
              selectedConversationIndex={selectedConversationIndex}
              t={t}
            />
          ))
        )}
      </div>
      {selectedConversationIndex !== null && (
        <button
          onClick={onNewConversation}
          className='sticky shrink-0 p-px bottom-6 w-[calc(100%-3rem)] left-6 green-to-purple-via-blue-gradient rounded-2xl h-14 cursor-pointer'
        >
          <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-1 rounded-2xl text-sm'>
            {t('conversation.newChat')}
            <NewConversation
              width={24}
              height={24}
              className='shrink-0 text-white'
            />
          </div>
        </button>
      )}
    </div>
  );
};

export default ConversationHistory;

interface ConversationCardProps {
  conversation: Conversation;
  conversations: Conversation[];
  onDeleteConversation: (index: number) => void;
  onSelectConversation: (index: number) => void;
  selectedConversationIndex: number | null;
  t: (key: string) => string;
}

const ConversationCard = ({
  conversation,
  conversations,
  onDeleteConversation,
  onSelectConversation,
  selectedConversationIndex,
  t,
}: ConversationCardProps) => {
  const originalIndex = useMemo(() => {
    return conversations.findIndex(
      (c) => JSON.stringify(c) === JSON.stringify(conversation),
    );
  }, [conversation, conversations]);
  const isSelected = selectedConversationIndex === originalIndex;
  const onClickConversationCard = useCallback(() => {
    onSelectConversation(originalIndex);
  }, [onSelectConversation, originalIndex]);
  const onClickDeleteConversation = useCallback(() => {
    onDeleteConversation(originalIndex);
  }, [onDeleteConversation, originalIndex]);

  return (
    <div className='relative'>
      <button
        className={cn(
          'relative shrink-0 w-full h-28 cursor-pointer p-px group',
          {
            'white-to-green-gradient rounded-tr-sm rounded-b-2xl rounded-tl-2xl':
              isSelected,
            'bg-[#101010] rounded-2xl': !isSelected,
          },
        )}
        onClick={onClickConversationCard}
      >
        <div
          className={cn(
            'hover:bg-[#181818] bg-[#101010] w-full h-full flex flex-col gap-4 relative rounded-b-2xl rounded-tl-2xl',
            {
              'bg-[#181818] rounded-tr-sm': isSelected,
              'rounded-tr-2xl': !isSelected,
            },
          )}
        >
          <div className='flex flex-row gap-2 px-5 pt-3'>
            <div className='relative'>
              <ChatBubble
                width={24}
                height={24}
                className='shrink-0 text-white/55'
              />
              <span className='absolute inset-0 text-[10px] flex flex-col items-center justify-center font-semibold pb-0.5'>
                {getConversationMessageCount(conversation)}
              </span>
            </div>
            <div className='text-sm text-white/55'>
              {formatConversationDate(conversation, t)}
            </div>
          </div>
          <div className='px-5 text-sm font-medium line-clamp-2'>
            {formatConversationPreview(conversation, t)}
          </div>
        </div>
      </button>
      <button
        onClick={onClickDeleteConversation}
        className={cn('absolute right-2 top-2 group-hover:visible', {
          invisible: !isSelected,
        })}
        title={t('conversation.deleteConversation')}
      >
        <X size={16} />
      </button>
    </div>
  );
};

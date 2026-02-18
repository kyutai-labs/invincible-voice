'use client';

import { Settings, Menu } from 'lucide-react';
import { FC, useCallback, useState } from 'react';
import ConversationHistory from '@/components/conversations/ConversationHistory';
import SquareButton from '@/components/ui/SquareButton';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';
import { Conversation } from '@/utils/userData';

interface MobileNoConversationProps {
  conversations: Conversation[];
  selectedConversationIndex: number | null;
  onConversationSelect: (index: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (index: number) => void;
  onConnectButtonPress: () => void;
  onSettingsOpen: () => void;
}

export const MobileNoConversation: FC<MobileNoConversationProps> = ({
  conversations,
  selectedConversationIndex,
  onConversationSelect,
  onNewConversation,
  onDeleteConversation,
  onConnectButtonPress,
  onSettingsOpen,
}) => {
  const t = useTranslations();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const onToggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);
  const onSelectConversation = useCallback(
    (index: number) => {
      onConversationSelect(index);
      setIsMenuOpen(false);
    },
    [onConversationSelect],
  );
  const onClickNewConversation = useCallback(() => {
    onNewConversation();
    setIsMenuOpen(false);
  }, [onNewConversation]);

  return (
    <div className='w-full h-screen flex flex-col bg-background text-white relative'>
      <div className='absolute top-4 right-4 z-20'>
        <SquareButton
          onClick={onSettingsOpen}
          kind='secondary'
          extraClasses='p-2'
        >
          <Settings size={20} />
        </SquareButton>
      </div>
      <div className='absolute top-4 left-4 z-20'>
        <SquareButton
          onClick={onToggleMenu}
          kind='secondary'
          extraClasses='p-2'
        >
          <Menu size={20} />
        </SquareButton>
      </div>
      <div
        className={cn(
          'fixed inset-0 z-30 transform transition-transform duration-300 ease-in-out',
          {
            'translate-x-0': isMenuOpen,
            '-translate-x-full': !isMenuOpen,
          },
        )}
      >
        <button
          aria-label='toggle menu'
          className='absolute inset-0 bg-black bg-opacity-50'
          onClick={onToggleMenu}
        />
        <div className='relative w-80 max-w-[80vw] h-full bg-gray-900'>
          <ConversationHistory
            conversations={conversations}
            selectedConversationIndex={selectedConversationIndex}
            onConversationSelect={onSelectConversation}
            onNewConversation={onClickNewConversation}
            onDeleteConversation={onDeleteConversation}
          />
        </div>
      </div>
      <div className='flex-1 flex items-center justify-center'>
        <button
          aria-label='Start conversation'
          className='w-24 h-24 bg-blue-500 border-blue-400 hover:bg-blue-600 rounded-full border-2 transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105'
          onClick={onConnectButtonPress}
          title={t('conversation.startChatting')}
        >
          <svg
            className='text-white w-12 h-12'
            fill='currentColor'
            viewBox='0 0 24 24'
          >
            <path d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.5 6.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-2.08c3.02-.43 5.42-2.78 5.91-5.78.09-.6-.39-1.14-1-1.14-.49 0-.9.36-.98.85C16.52 14.21 14.47 16 12 16s-4.52-1.79-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78v2.08z' />
          </svg>
        </button>
      </div>
    </div>
  );
};

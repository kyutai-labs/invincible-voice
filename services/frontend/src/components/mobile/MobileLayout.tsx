'use client';

import { Settings, Menu } from 'lucide-react';
import { FC, useCallback, useState } from 'react';
import ConversationHistory from '@/components/conversations/ConversationHistory';
import SquareButton from '@/components/ui/SquareButton';
import StartConversationButton from '@/components/ui/StartConversationButton';
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
        <StartConversationButton
          onClick={onConnectButtonPress}
          label={t('conversation.startChatting')}
        />
      </div>
    </div>
  );
};

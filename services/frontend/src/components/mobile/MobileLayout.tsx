'use client';

import { FC } from 'react';
import StartConversationButton from '@/components/ui/StartConversationButton';
import { useTranslations } from '@/i18n';

interface MobileNoConversationProps {
  onConnectButtonPress: () => void;
}

export const MobileNoConversation: FC<MobileNoConversationProps> = ({
  onConnectButtonPress,
}) => {
  const t = useTranslations();

  return (
    <div className='w-full h-screen flex flex-col text-white relative'>
      <div className='flex-1 flex items-center justify-center'>
        <StartConversationButton
          onClick={onConnectButtonPress}
          label={t('conversation.startChatting')}
        />
      </div>
      <div className='absolute bottom-0 right-0 p-6 pointer-events-none'>
        <div className='flex flex-col items-end pointer-events-auto'>
          <p className='w-full text-xs text-gray-500 text-right'>
            {t('common.textToSpeechProvider')}
          </p>
          <img
            src='/gradium.svg'
            alt='Gradium'
            className='h-6 mt-1'
          />
        </div>
      </div>
    </div>
  );
};

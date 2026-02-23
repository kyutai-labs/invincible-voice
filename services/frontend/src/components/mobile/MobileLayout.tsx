'use client';

import { Settings } from 'lucide-react';
import { FC } from 'react';
import StartConversationButton from '@/components/ui/StartConversationButton';
import { useTranslations } from '@/i18n';

interface MobileNoConversationProps {
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
}

export const MobileNoConversation: FC<MobileNoConversationProps> = ({
  onConnectButtonPress,
  onSettingsPress,
}) => {
  const t = useTranslations();

  return (
    <div className='w-full h-screen flex flex-col text-white relative'>
      <div className='absolute top-4 right-4 z-10'>
        <button
          className='shrink-0 h-10 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl'
          onClick={onSettingsPress}
          title={t('settings.changeSettings')}
        >
          <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center rounded-2xl px-3'>
            <Settings size={20} />
          </div>
        </button>
      </div>
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

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
    <div className='w-full h-dvh flex flex-col text-white relative'>
      {/* Safe area spacer for notch/status bar */}
      <div style={{ height: 'var(--safe-area-inset-top)' }} className='shrink-0' />

      <div className='absolute top-4 right-4 z-10' style={{ top: 'calc(1rem + var(--safe-area-inset-top))' }}>
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
      <div className='flex-1 flex items-center justify-center'>
        <StartConversationButton
          onClick={onConnectButtonPress}
          label={t('conversation.startChatting')}
        />
      </div>
      <div className='absolute bottom-0 right-0 p-6 pointer-events-none' style={{ bottom: 'var(--safe-area-inset-bottom)' }}>
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

      {/* Safe area spacer for home indicator */}
      <div style={{ height: 'var(--safe-area-inset-bottom)' }} className='shrink-0' />
    </div>
  );
};

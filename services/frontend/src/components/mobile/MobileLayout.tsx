'use client';

import { History, Settings } from 'lucide-react';
import { FC } from 'react';
import StartConversationButton from '@/components/ui/StartConversationButton';
import { useTranslations } from '@/i18n';

interface MobileNoConversationProps {
  onConnectButtonPress: () => void;
  onSettingsPress: () => void;
  onHistoryPress?: () => void;
  hasHistory?: boolean;
}

export const MobileNoConversation: FC<MobileNoConversationProps> = ({
  onConnectButtonPress,
  onSettingsPress,
  onHistoryPress = undefined,
  hasHistory = false,
}) => {
  const t = useTranslations();

  return (
    <div className='w-full h-dvh flex flex-col text-white relative'>
      {/* Safe area spacer for notch/status bar */}
      <div
        style={{ height: 'var(--safe-area-inset-top)' }}
        className='shrink-0'
      />

      <div
        className='absolute top-4 right-4 z-10'
        style={{ top: 'calc(1rem + var(--safe-area-inset-top))' }}
      >
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
      <div className='flex-1 flex flex-col items-center justify-center gap-4'>
        <StartConversationButton
          onClick={onConnectButtonPress}
          label={t('conversation.startChatting')}
        />
        {hasHistory && onHistoryPress && (
          <button
            className='flex items-center gap-2 px-6 min-h-[44px] bg-gray-800 border border-gray-600 rounded-2xl text-sm text-gray-200 hover:bg-gray-700 transition-colors'
            onClick={onHistoryPress}
          >
            <History size={16} />
            {t('conversation.history')}
          </button>
        )}
      </div>
      <div
        className='absolute bottom-0 right-0 p-6 pointer-events-none'
        style={{ bottom: 'var(--safe-area-inset-bottom)' }}
      >
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
      <div
        style={{ height: 'var(--safe-area-inset-bottom)' }}
        className='shrink-0'
      />
    </div>
  );
};

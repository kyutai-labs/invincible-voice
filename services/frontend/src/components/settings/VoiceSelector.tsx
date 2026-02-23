import { LoaderCircleIcon, Play, XCircle } from 'lucide-react';
import { FC } from 'react';
import { useTranslations } from '@/i18n';

interface VoiceSelectorProps {
  selectedVoice: string | null;
  availableVoices: Record<string, string> | null;
  isLoadingVoices: boolean;
  isPlayingVoice: boolean;
  onVoiceChange: (value: string) => void;
  onTestVoice: () => void;
  onDeleteVoice: () => void;
  showDeleteButton?: boolean;
}

const VoiceSelector: FC<VoiceSelectorProps> = ({
  selectedVoice,
  availableVoices,
  isLoadingVoices,
  isPlayingVoice,
  onVoiceChange,
  onTestVoice,
  onDeleteVoice,
  showDeleteButton = false,
}) => {
  const t = useTranslations();

  return (
    <div className='flex gap-2'>
      <select
        value={selectedVoice || ''}
        onChange={(e) => onVoiceChange(e.target.value)}
        disabled={isLoadingVoices}
        className='flex-1 px-4 py-3 text-base text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green disabled:opacity-50'
      >
        <option value=''>{t('common.default')}</option>

        {availableVoices &&
          Object.entries(availableVoices)
            .sort(([, langA], [, langB]) => langA.localeCompare(langB))
            .map(([voiceName, language]) => (
              <option
                key={voiceName}
                value={voiceName}
              >
                {voiceName.includes('/')
                  ? voiceName.substring(voiceName.indexOf('/') + 1)
                  : voiceName}
                ({language})
              </option>
            ))}
      </select>

      <button
        type='button'
        onClick={onTestVoice}
        disabled={!selectedVoice || isPlayingVoice}
        className='px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-green hover:bg-[#2B2B2B] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap'
      >
        {isPlayingVoice ? (
          <LoaderCircleIcon
            size={16}
            className='animate-spin'
          />
        ) : (
          <Play size={16} />
        )}
        {t('settings.testYourVoice')}
      </button>

      {showDeleteButton && (
        <button
          type='button'
          onClick={onDeleteVoice}
          className='px-3 py-2 text-white bg-[#1B1B1B] border border-white rounded-2xl focus:outline-none focus:border-red-500 hover:bg-[#2B2B2B] hover:border-[#FF6459]'
          title={t('common.delete')}
        >
          <XCircle
            size={16}
            className='text-[#FF6459]'
          />
        </button>
      )}
    </div>
  );
};

export default VoiceSelector;

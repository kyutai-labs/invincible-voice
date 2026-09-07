import { LoaderCircleIcon } from 'lucide-react';
import { FC } from 'react';
import { useTranslations } from '@/i18n';
import { MAX_TEXT_WORDS } from '@/utils/tokenUtils';

interface TooLongTextNoticeProps {
  wordCount: number;
  messageKey: 'settings.promptTooLong' | 'settings.documentTooLong';
  isSummarizing: boolean;
  canUndo: boolean;
  error: string | null;
  onSummarize: () => void;
  onUndo: () => void;
}

/**
 * Shown under a prompt or document editor when the text exceeds MAX_TEXT_WORDS:
 * explains the limit and offers an LLM summary. Right after a summary it also
 * offers to undo it.
 */
const TooLongTextNotice: FC<TooLongTextNoticeProps> = ({
  wordCount,
  messageKey,
  isSummarizing,
  canUndo,
  error,
  onSummarize,
  onUndo,
}) => {
  const t = useTranslations();
  const isTooLong = wordCount > MAX_TEXT_WORDS;

  if (!isTooLong && !canUndo) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3 text-sm bg-[#181818] border rounded-2xl ${
        isTooLong ? 'border-[#FF6459]' : 'border-white'
      }`}
    >
      {isTooLong && (
        <p className='text-white'>
          {t(messageKey).replace('{max}', String(MAX_TEXT_WORDS))}
        </p>
      )}
      <div className='flex gap-2'>
        {isTooLong && (
          <button
            type='button'
            onClick={onSummarize}
            disabled={isSummarizing}
            className='px-4 py-2 text-sm text-black bg-[#39F2AE] rounded-xl focus:outline-none hover:bg-[#2EDB9B] disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isSummarizing ? (
              <LoaderCircleIcon
                size={16}
                className='animate-spin mx-auto'
              />
            ) : (
              t('settings.summarizeYes')
            )}
          </button>
        )}
        {canUndo && (
          <button
            type='button'
            onClick={onUndo}
            className='px-4 py-2 text-sm text-white bg-[#1B1B1B] border border-white rounded-xl focus:outline-none focus:border-green hover:bg-[#2B2B2B]'
          >
            {t('settings.undoSummary')}
          </button>
        )}
      </div>
      {error && <p className='text-xs text-red-400'>{error}</p>}
    </div>
  );
};

export default TooLongTextNotice;

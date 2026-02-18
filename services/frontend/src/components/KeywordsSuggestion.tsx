'use client';

import { FC, Fragment, useCallback, useMemo } from 'react';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';

interface Keyword {
  id: string;
  text: string;
  isComplete: boolean;
}

interface KeywordsSuggestionProps {
  keywords: Keyword[];
  onSelect: (text: string) => void;
  alwaysShow?: boolean;
  mobile?: boolean;
}

const KeywordsSuggestion: FC<KeywordsSuggestionProps> = ({
  keywords,
  onSelect,
  alwaysShow = false,
  mobile = false,
}) => {
  const t = useTranslations();
  const validKeywords = useMemo(
    () => keywords.filter((keyword) => keyword.text.trim()),
    [keywords],
  );
  const displayKeywords = useMemo(() => {
    return alwaysShow
      ? [
          ...Array.from({ length: 10 }, (_, index) => {
            const existingKeyword = keywords[index];
            return (
              existingKeyword || {
                id: `empty-keyword-${index}`,
                text: '',
                isComplete: false,
              }
            );
          }),
        ]
      : validKeywords;
  }, [alwaysShow, keywords, validKeywords]);
  const isPending = useMemo(() => {
    return displayKeywords.some(
      (keyword) => keyword.isComplete || keyword.text.trim(),
    );
  }, [displayKeywords]);
  const onSelectKeyword = useCallback(
    (text: string) => {
      if (text.trim()) {
        onSelect(text);
      }
    },
    [onSelect],
  );

  if (!alwaysShow && validKeywords.length === 0) {
    return null;
  }

  if (mobile) {
    return (
      <div className='w-full'>
        <div className='flex gap-2 pb-2 overflow-x-auto scrollbar-hidden'>
          {displayKeywords.map((keyword) => (
            <MobileKeyword
              key={keyword.id}
              keyword={keyword.text}
              isComplete={keyword.isComplete}
              onSelect={onSelectKeyword}
            />
          ))}
        </div>
        {isPending && (
          <div className='mt-2 text-xs text-center text-gray-500'>
            {t('settings.keywordsLoading')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
      <div className='mb-1 text-sm font-medium text-white'>
        {t('settings.suggestions')}
      </div>
      <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
        {displayKeywords.map((keyword) => (
          <DesktopKeyword
            key={keyword.id}
            keyword={keyword.text.trim() || '…'}
            onSelect={onSelectKeyword}
          />
        ))}
        {isPending && (
          <div className='mt-2 text-xs text-center text-gray-500'>
            {t('settings.keywordsLoading')}
          </div>
        )}
      </div>
    </div>
  );
};

export default KeywordsSuggestion;

interface MobileKeywordProps {
  keyword: string;
  isComplete: boolean;
  onSelect: (text: string) => void;
}

const MobileKeyword: FC<MobileKeywordProps> = ({
  keyword,
  isComplete,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(keyword);
  }, [onSelect, keyword]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'shrink-0 px-4 py-2 text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 whitespace-nowrap',
        {
          'bg-amber-700 hover:bg-amber-600 text-white border-amber-500 focus:ring-amber-500 cursor-pointer':
            keyword.trim() && isComplete,
          'bg-gray-600 text-gray-300 border-gray-500 cursor-wait':
            keyword.trim() && !isComplete,
          'bg-gray-600 text-gray-400 border-gray-500 cursor-default':
            !keyword.trim(),
        },
      )}
      disabled={!keyword.trim() || !isComplete}
    >
      {keyword.trim() ? (
        <Fragment>
          {keyword}
          {!isComplete && (
            <span className='inline-block w-1 h-2 ml-1 bg-gray-400 animate-pulse' />
          )}
        </Fragment>
      ) : (
        <span className='text-gray-400'>…</span>
      )}
    </button>
  );
};

interface DesktopKeywordProps {
  keyword: string;
  onSelect: (text: string) => void;
}

const DesktopKeyword: FC<DesktopKeywordProps> = ({ keyword, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(keyword);
  }, [onSelect, keyword]);

  return (
    <button
      className='h-10 p-px transition-colors cursor-pointer min-w-16 purple-to-pink-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500'
      onClick={handleClick}
    >
      <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
        {keyword || '…'}
      </div>
    </button>
  );
};

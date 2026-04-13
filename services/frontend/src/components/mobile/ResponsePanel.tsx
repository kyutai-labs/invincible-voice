'use client';

import { Edit2 } from 'lucide-react';
import { useMemo, useCallback, FC, MouseEvent, Fragment } from 'react';
import { PendingResponse } from '@/components/chat/ChatInterface';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';

interface ResponsePanelProps {
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  onEditResponseInChat?: (text: string) => void;
  additionalKeywords?: string[];
}

const ResponsePanel: FC<ResponsePanelProps> = ({
  frozenResponses,
  onFreezeToggle,
  pendingResponses,
  onResponseEdit = undefined,
  onResponseSelect,
  onEditResponseInChat = undefined,
  additionalKeywords = [],
}) => {
  const t = useTranslations();
  const isFrozen = useMemo(() => frozenResponses !== null, [frozenResponses]);
  const responsesToShow = useMemo(
    () => frozenResponses || pendingResponses,
    [frozenResponses, pendingResponses],
  );

  const allResponses = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const existingResponse = responsesToShow[index];
        return (
          existingResponse || {
            id: `empty-${index}`,
            text: '',
            isComplete: false,
            messageId: crypto.randomUUID(),
          }
        );
      }),
    [responsesToShow],
  );

  return (
    <div className='flex flex-col flex-1 min-h-0 overflow-hidden'>
      {/* Quick response keywords from user settings */}
      {additionalKeywords.length > 0 && (
        <div className='px-4 pt-2 pb-1 landscape:pt-1 landscape:pb-0 border-b border-gray-700 shrink-0 flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain'>
          {additionalKeywords.map((keyword) => (
            <button
              key={keyword}
              className='shrink-0 px-4 min-h-[36px] bg-gray-800 border border-gray-600 rounded-full text-sm text-gray-200 hover:bg-gray-700 transition-colors'
              onClick={() => onResponseEdit?.(keyword)}
            >
              {keyword}
            </button>
          ))}
        </div>
      )}

      {/* Freeze toggle control */}
      <div className='px-4 py-2 landscape:py-1 border-b border-gray-700 shrink-0 flex items-center justify-end'>
        <button
          className={cn(
            'px-3 py-1.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
            isFrozen
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
              : 'bg-gray-800 text-gray-400 border border-gray-600 hover:text-gray-200',
          )}
          onClick={onFreezeToggle}
          title={t('conversation.freezeResponses')}
        >
          {t('conversation.freezeResponses')}
        </button>
      </div>

      {/* Response grid — 4-row portrait layout, 2x2 grid in landscape */}
      <div className='flex-1 overflow-hidden px-4 pb-4 grid grid-rows-4 gap-1 pt-2 landscape:grid-rows-2 landscape:grid-cols-2'>
        {allResponses.slice(0, 4).map((response) => (
          <div
            key={response.id}
            className='min-h-0'
          >
            <div className='w-full h-full px-4 py-2 bg-[#101010] rounded-[20px]'>
              <BaseResponse
                isFrozen={isFrozen}
                onResponseEdit={onResponseEdit}
                onResponseSelect={onResponseSelect}
                response={response}
                onEditResponseInChat={onEditResponseInChat}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResponsePanel;

interface BaseResponseProps {
  isFrozen: boolean;
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  response: PendingResponse;
  onEditResponseInChat?: (text: string) => void;
}

const BaseResponse: FC<BaseResponseProps> = ({
  isFrozen,
  onResponseEdit = undefined,
  onResponseSelect,
  response,
  onEditResponseInChat = undefined,
}) => {
  const onClickResponse = useCallback(() => {
    onResponseSelect(response.id);
  }, [onResponseSelect, response]);

  // Tapping edit fills the chat text input and switches to the Chat tab
  const onClickEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onEditResponseInChat) {
        onEditResponseInChat(response.text);
      } else if (onResponseEdit) {
        onResponseEdit(response.text);
      }
    },
    [response.text, onEditResponseInChat, onResponseEdit],
  );
  const t = useTranslations();

  return (
    <div className='relative w-full h-full'>
      <button
        className={cn(
          'w-full h-full min-h-[44px] px-4 py-3 text-left rounded-[20px] border-2 transition-all duration-200 flex flex-col items-start justify-center overflow-hidden',
          {
            'border-cyan-400 bg-[#181818] hover:border-cyan-500':
              isFrozen && response.text.trim() && response.isComplete,
            'border-green-500 bg-[#181818] hover:border-green-400':
              !isFrozen && response.text.trim() && response.isComplete,
            'border-gray-600 bg-[#1B1B1B]':
              !isFrozen && response.text.trim() && !response.isComplete,
            'border-gray-700 bg-[#1B1B1B]':
              !isFrozen && !response.text.trim() && !response.isComplete,
            'cursor-pointer': response.text.trim() && response.isComplete,
            'cursor-default': !response.text.trim() || !response.isComplete,
          },
        )}
        disabled={!response.text.trim() || !response.isComplete}
        onClick={onClickResponse}
      >
        <div className='w-full overflow-hidden text-ellipsis line-clamp-3 pr-8'>
          <p className='text-white leading-relaxed wrap-break-word text-base'>
            {response.text.trim() ? (
              <Fragment>
                {response.text}
                {!response.isComplete && (
                  <span className='inline-block w-1 h-4 bg-gray-400 ml-1 animate-pulse' />
                )}
              </Fragment>
            ) : (
              <span className='text-gray-500 italic text-base'>
                {t('conversation.waitingForResponse')}
              </span>
            )}
          </p>
        </div>
        {response.text.trim() && !response.isComplete && (
          <div className='flex justify-end mt-1'>
            <div className='w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin' />
          </div>
        )}
      </button>
      {response.text.trim() &&
        response.isComplete &&
        (onResponseEdit || onEditResponseInChat) && (
          <button
            className='absolute top-1 right-1 w-11 h-11 flex items-center justify-center rounded hover:bg-gray-700 transition-colors cursor-pointer'
            onClick={onClickEdit}
            title={t('conversation.editResponse')}
          >
            <Edit2 className='w-5 h-5 text-gray-400' />
          </button>
        )}
    </div>
  );
};

'use client';

import { Edit2 } from 'lucide-react';
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  ChangeEvent,
  KeyboardEvent,
  FC,
  MouseEvent,
  Fragment,
} from 'react';
import { PendingResponse } from '@/components/chat/ChatInterface';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';

interface ResponsePanelProps {
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
}

const ResponsePanel: FC<ResponsePanelProps> = ({
  frozenResponses,
  onFreezeToggle,
  pendingResponses,
  onResponseEdit = undefined,
  onResponseSelect,
}) => {
  const t = useTranslations();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');
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
      {/* Freeze toggle control */}
      <div className='px-4 py-2 border-b border-gray-700 shrink-0 flex items-center justify-end'>
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

      {/* Response grid — grid-rows-4 fills remaining space */}
      <div className='flex-1 overflow-hidden px-4 pb-4 grid grid-rows-4 gap-2 pt-2'>
        {allResponses.slice(0, 4).map((response, index) => (
          <div
            key={response.id}
            className='min-h-0'
          >
            <div className='w-full h-full px-4 py-2 bg-[#101010] rounded-[20px]'>
              {editingIndex === index && (
                <EditingResponse
                  editingText={editingText}
                  onResponseEdit={onResponseEdit}
                  setEditingIndex={setEditingIndex}
                  setEditingText={setEditingText}
                />
              )}
              {editingIndex !== index && (
                <BaseResponse
                  index={index}
                  isFrozen={isFrozen}
                  onResponseEdit={onResponseEdit}
                  onResponseSelect={onResponseSelect}
                  response={response}
                  setEditingIndex={setEditingIndex}
                  setEditingText={setEditingText}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResponsePanel;

interface EditingResponseProps {
  editingText: string;
  onResponseEdit?: (text: string) => void;
  setEditingIndex: (index: number | null) => void;
  setEditingText: (text: string) => void;
}

const EditingResponse: FC<EditingResponseProps> = ({
  editingText,
  onResponseEdit = () => {},
  setEditingIndex,
  setEditingText,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setEditingText(event.target.value);
    },
    [setEditingText],
  );
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (editingText.trim()) {
          onResponseEdit(editingText.trim());
          setEditingIndex(null);
          setEditingText('');
        }
      } else if (event.key === 'Escape') {
        setEditingIndex(null);
        setEditingText('');
      }
    },
    [editingText, onResponseEdit, setEditingIndex, setEditingText],
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(
        ref.current.value.length,
        ref.current.value.length,
      );
    }
  }, []);

  return (
    <textarea
      ref={ref}
      value={editingText}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className='w-full h-full bg-transparent outline-none resize-none text-white'
      style={{ fontSize: 'clamp(16px, 3.5vw, 20px)' }}
      placeholder='Type your message…'
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
    />
  );
};

interface BaseResponseProps {
  index: number;
  isFrozen: boolean;
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  response: PendingResponse;
  setEditingIndex: (index: number | null) => void;
  setEditingText: (text: string) => void;
}

const BaseResponse: FC<BaseResponseProps> = ({
  index,
  isFrozen,
  onResponseEdit = undefined,
  onResponseSelect,
  response,
  setEditingIndex,
  setEditingText,
}) => {
  const onClickResponse = useCallback(() => {
    onResponseSelect(response.id);
  }, [onResponseSelect, response]);
  const onClickEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setEditingIndex(index);
      setEditingText(response.text);
    },
    [index, response.text, setEditingIndex, setEditingText],
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
        <div className='w-full overflow-hidden text-ellipsis line-clamp-3'>
          <p
            className='text-white leading-relaxed wrap-break-word'
            style={{ fontSize: 'clamp(16px, 3.5vw, 20px)' }}
          >
            {response.text.trim() ? (
              <Fragment>
                {response.text}
                {!response.isComplete && (
                  <span className='inline-block w-1 h-4 bg-gray-400 ml-1 animate-pulse' />
                )}
              </Fragment>
            ) : (
              <span
                className='text-gray-500 italic'
                style={{ fontSize: 'clamp(16px, 3.5vw, 20px)' }}
              >
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
      {response.text.trim() && response.isComplete && onResponseEdit && (
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

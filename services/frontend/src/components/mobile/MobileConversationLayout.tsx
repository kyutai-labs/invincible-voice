'use client';

import { Edit2, Pause } from 'lucide-react';
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

interface MobileConversationLayoutProps {
  textInput: string;
  onTextInputChange: (value: string) => void;
  onSendMessage: () => void;
  frozenResponses: PendingResponse[] | null;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  onConnectButtonPress: () => void;
}

const MobileConversationLayout: FC<MobileConversationLayoutProps> = ({
  textInput,
  onTextInputChange,
  onSendMessage,
  frozenResponses,
  pendingResponses,
  onResponseEdit = undefined,
  onResponseSelect,
  onConnectButtonPress,
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
  const onMessageChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onTextInputChange(event.target.value);
    },
    [onTextInputChange],
  );
  const onMessageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSendMessage();
      }
    },
    [onSendMessage],
  );

  return (
    <div className='w-full h-screen flex flex-col bg-[#121212] text-white overflow-hidden'>
      {/* Header with stop button */}
      <div className='flex items-center justify-between px-4 py-3'>
        <button
          aria-label='Stop conversation'
          className='shrink-0 h-10 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl'
          onClick={onConnectButtonPress}
          title={t('conversation.stopConversation')}
        >
          <div className='h-full w-full flex flex-row bg-[#181818] items-center justify-center gap-2 rounded-2xl text-sm px-5'>
            {t('conversation.stopConversation')}
            <Pause
              width={24}
              height={24}
              className='shrink-0 text-white'
            />
          </div>
        </button>
      </div>

      {/* Text Input Area */}
      <div className='px-4 py-4 bg-[#101010] rounded-[32px] mx-4 mb-3 flex flex-col gap-2'>
        <textarea
          className='w-full min-h-[60px] px-4 py-3 text-base text-white bg-[#1B1B1B] border border-white rounded-3xl resize-none focus:outline-none focus:border-green scrollbar-hidden scrollable'
          placeholder={t('conversation.typeMessagePlaceholder')}
          rows={1}
          value={textInput}
          onChange={onMessageChange}
          onKeyDown={onMessageKeyDown}
        />
      </div>

      {/* Response Options */}
      <div className='flex-1 overflow-hidden px-4'>
        <div className='flex flex-col gap-2 h-full overflow-y-auto scrollbar-hidden'>
          <div className='flex flex-col gap-2 h-full'>
            {allResponses.slice(0, 4).map((response, index) => (
              <Fragment key={response.id}>
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
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileConversationLayout;

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
    <div className='p-3 rounded-[20px] border-2 border-green-400 bg-[#101010] flex flex-col'>
      <textarea
        ref={ref}
        value={editingText}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className='flex-1 bg-transparent outline-none resize-none text-sm text-white'
        placeholder='Type your message…'
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
    </div>
  );
};

interface BaseReponseProps {
  index: number;
  isFrozen: boolean;
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  response: PendingResponse;
  setEditingIndex: (index: number | null) => void;
  setEditingText: (text: string) => void;
}

const BaseResponse: FC<BaseReponseProps> = ({
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
    <div className='relative'>
      <button
        className={cn(
          'w-full px-4 py-3 text-left rounded-[20px] border-2 transition-all duration-200 flex flex-col gap-2 text-sm',
          {
            'border-cyan-400 bg-[#101010] hover:border-cyan-500':
              isFrozen && response.text.trim() && response.isComplete,
            'border-green-500 bg-[#101010] hover:border-green-400':
              !isFrozen && response.text.trim() && response.isComplete,
            'border-gray-600 bg-[#181818]':
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
        <p className='text-sm text-white leading-tight wrap-break-word'>
          {response.text.trim() ? (
            <Fragment>
              {response.text}
              {!response.isComplete && (
                <span className='inline-block w-1 h-3 bg-gray-400 ml-1 animate-pulse' />
              )}
            </Fragment>
          ) : (
            <span className='text-gray-500 italic text-sm'>
              {t('conversation.waitingForResponse')}
            </span>
          )}
        </p>
        {response.text.trim() && !response.isComplete && (
          <div className='flex justify-end mt-1'>
            <div className='w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin' />
          </div>
        )}
      </button>
      {response.text.trim() && response.isComplete && onResponseEdit && (
        <button
          className='absolute top-2 right-2 p-1 rounded hover:bg-gray-700 transition-colors cursor-pointer block'
          onClick={onClickEdit}
          title={t('conversation.editResponse')}
        >
          <Edit2 className='w-3 h-3 text-gray-400' />
        </button>
      )}
    </div>
  );
};

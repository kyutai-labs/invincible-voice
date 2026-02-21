'use client';

import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Pause,
  Snowflake,
} from 'lucide-react';
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
import KeywordsSuggestion from '@/components/KeywordsSuggestion';
import { PendingResponse } from '@/components/chat/ChatInterface';
import { ResponseSize } from '@/constants';
import { useTranslations } from '@/i18n';
import { cn } from '@/utils/cn';
import { UserData } from '@/utils/userData';

interface PendingKeyword {
  id: string;
  text: string;
  isComplete: boolean;
}

interface MobileConversationLayoutProps {
  userData: UserData | null;
  onWordBubbleClick: (word: string) => void;
  pendingKeywords: PendingKeyword[];
  onKeywordSelect: (keywordText: string) => void;
  textInput: string;
  onTextInputChange: (value: string) => void;
  onSendMessage: () => void;
  responseSize: ResponseSize;
  onResponseSizeChange: (direction: 'prev' | 'next') => void;
  frozenResponses: PendingResponse[] | null;
  onFreezeToggle: () => void;
  pendingResponses: PendingResponse[];
  onResponseEdit?: (text: string) => void;
  onResponseSelect: (responseId: string) => void;
  onConnectButtonPress: () => void;
}

const MobileConversationLayout: FC<MobileConversationLayoutProps> = ({
  userData,
  onWordBubbleClick,
  pendingKeywords,
  onKeywordSelect,
  textInput,
  onTextInputChange,
  onSendMessage,
  responseSize,
  onResponseSizeChange,
  frozenResponses,
  onFreezeToggle,
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
  const staticContextOption = useMemo(
    () => ({
      id: 'static-context-question',
      text: t('conversation.contextQuestion'),
      isComplete: true,
      messageId: '00000000-0000-4000-8000-000000000001',
    }),
    [t],
  );
  const staticRepeatOption = useMemo(
    () => ({
      id: 'static-repeat-question',
      text: t('conversation.repeatQuestion'),
      isComplete: true,
      messageId: '00000000-0000-4000-8000-000000000002',
    }),
    [t],
  );

  const allResponses = useMemo(
    () => [
      ...Array.from({ length: 4 }, (_, index) => {
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
      staticContextOption,
      staticRepeatOption,
    ],
    [responsesToShow, staticContextOption, staticRepeatOption],
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
  const onClickPreviousSize = useCallback(() => {
    onResponseSizeChange('prev');
  }, [onResponseSizeChange]);
  const onClickNextSize = useCallback(() => {
    onResponseSizeChange('next');
  }, [onResponseSizeChange]);

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

      {/* Additional Keywords */}
      <div className='px-4 py-4 bg-[#101010] rounded-[32px] mx-4 mb-3'>
        <div className='mb-1 text-sm font-medium text-white'>
          {t('conversation.keywords')}
        </div>
        <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
          {userData?.user_settings?.additional_keywords?.map((word) => (
            <button
              key={word}
              className='h-10 p-px transition-colors cursor-pointer green-to-light-green-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500'
              onClick={() => onWordBubbleClick(word)}
            >
              <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
                {word}
              </div>
            </button>
          )) || []}
          {(!userData?.user_settings?.additional_keywords ||
            userData.user_settings.additional_keywords.length === 0) && (
            <p className='text-xs italic text-gray-500'>
              No keywords added yet. Add them in settings.
            </p>
          )}
        </div>
      </div>

      {/* Friends */}
      <div className='px-4 py-4 bg-[#101010] rounded-[32px] mx-4 mb-3'>
        <div className='mb-1 text-sm font-medium text-white'>
          {t('common.friends')}
        </div>
        <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
          {userData?.user_settings?.friends?.map((friend) => (
            <button
              key={friend}
              className='h-10 p-px transition-colors cursor-pointer blue-to-light-blue-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
              onClick={() => onWordBubbleClick(friend)}
            >
              <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
                {friend}
              </div>
            </button>
          ))}
          {(!userData?.user_settings?.friends ||
            userData.user_settings.friends.length === 0) && (
            <p className='text-xs italic text-gray-500'>
              {t('settings.noFriendsAdded')}
            </p>
          )}
        </div>
      </div>

      {/* Keywords Suggestion */}
      <div className='px-4 py-3 bg-[#101010] rounded-[32px] mx-4 mb-3'>
        <KeywordsSuggestion
          keywords={pendingKeywords}
          onSelect={onKeywordSelect}
          alwaysShow
        />
      </div>

      {/* Text Input Area */}
      <div className='px-4 py-4 bg-[#101010] rounded-[32px] mx-4 mb-3 flex flex-col gap-2'>
        <div className='grid grid-cols-2 gap-2 pb-2'>
          <button
            onClick={() => onResponseSelect(staticContextOption.id)}
            className='w-full h-full p-px text-left transition-all duration-200 rounded-2xl light-orange-to-orange-gradient group focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50'
          >
            <div className='px-3 py-4 overflow-hidden bg-[#1B1B1B] group-hover:bg-[#181818] flex flex-row items-center text-base font-bold rounded-2xl size-full gap-4'>
              <div className='flex items-center'>
                <span className='flex flex-col items-center justify-center font-light text-white border border-white rounded-sm size-10 font-base bg-[#101010]'>
                  W
                </span>
              </div>
              <div className='flex-1 pr-2'>
                <p className='overflow-hidden text-xs leading-tight text-gray-100'>
                  {staticContextOption.text}
                </p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onResponseSelect(staticRepeatOption.id)}
            className='w-full h-full p-px text-left transition-all duration-200 rounded-2xl light-orange-to-orange-gradient group focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50'
          >
            <div className='px-3 py-4 overflow-hidden bg-[#1B1B1B] group-hover:bg-[#181818] flex flex-row items-center text-base font-bold rounded-2xl size-full gap-4'>
              <div className='flex items-center'>
                <span className='flex flex-col items-center justify-center font-light text-white border border-white rounded-sm size-10 font-base bg-[#101010]'>
                  X
                </span>
              </div>
              <div className='flex-1 pr-2'>
                <p className='overflow-hidden text-xs leading-tight text-gray-100'>
                  {staticRepeatOption.text}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Response size controls */}
        <div className='flex items-center gap-2'>
          <button
            onClick={onClickPreviousSize}
            className='p-2 text-white transition-colors bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
            title={t('conversation.decreaseResponseSize')}
          >
            <ChevronLeft className='w-3 h-3' />
          </button>
          <span className='px-2 py-2 bg-gray-700 text-white text-sm rounded border border-gray-600 min-w-8 text-center'>
            {responseSize}
          </span>
          <button
            onClick={onClickNextSize}
            className='p-2 text-white transition-colors bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500'
            title={t('conversation.increaseResponseSize')}
          >
            <ChevronRight className='w-3 h-3' />
          </button>
          <button
            onClick={onFreezeToggle}
            className={cn(
              'ml-auto px-4 py-2 text-sm rounded-lg border-2 transition-all duration-200',
              {
                'border-cyan-400 bg-cyan-900/20 hover:border-cyan-500 hover:bg-cyan-900/30 text-cyan-400':
                  isFrozen,
                'border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600 text-gray-400':
                  !isFrozen,
              },
            )}
            title={t('conversation.freezeResponses')}
          >
            <Snowflake className='w-4 h-4' />
          </button>
        </div>

        <textarea
          className='grow w-full min-h-0 px-4 py-3 text-base text-white bg-[#1B1B1B] border border-white rounded-3xl resize-none focus:outline-none focus:border-green scrollbar-hidden scrollable'
          placeholder={t('conversation.typeMessagePlaceholder')}
          rows={2}
          value={textInput}
          onChange={onMessageChange}
          onKeyDown={onMessageKeyDown}
        />
        <button
          onClick={onSendMessage}
          className='self-end p-px h-14 green-to-purple-via-blue-gradient rounded-2xl w-fit'
          disabled={!textInput.trim()}
        >
          <div className='flex flex-row bg-[#181818] size-full items-center justify-center gap-4 px-8 rounded-2xl'>
            {t('conversation.sendMessage')}
            <Snowflake className='w-5 h-5' />
          </div>
        </button>
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

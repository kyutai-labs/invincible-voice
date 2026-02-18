/* eslint-disable react/no-array-index-key */

'use client';

import { ChevronLeft, ChevronRight, Snowflake, Edit2 } from 'lucide-react';
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
import HorizontalScrollableList from '@/components/ui/HorizontalScrollableList';
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
    <div className='w-full h-screen flex flex-col bg-background text-white overflow-hidden'>
      <div className='flex items-center px-4 py-2 border-b border-gray-700 gap-4'>
        <button
          aria-label='Stop conversation'
          className='w-10 h-10 bg-red-500 border-red-400 hover:bg-red-600 rounded-full border-2 transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-105 shrink-0'
          onClick={onConnectButtonPress}
          title={t('conversation.stopConversation')}
        >
          <svg
            className='text-white w-5 h-5'
            fill='currentColor'
            viewBox='0 0 24 24'
          >
            <path d='M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.21 14.47 16 12 16s-4.52-1.79-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.09-.6-.39-1.14-1-1.14z' />
          </svg>
        </button>
        <div className='flex-1 overflow-hidden'>
          {userData?.user_settings?.additional_keywords &&
          userData.user_settings.additional_keywords.length > 0 ? (
            <div className='flex gap-2 overflow-x-auto scrollbar-hidden'>
              {userData.user_settings.additional_keywords.map(
                (keyword, index) => (
                  <AdditionalKeyword
                    key={`${keyword}-${index}`}
                    keyword={keyword}
                    onWordBubbleClick={onWordBubbleClick}
                  />
                ),
              )}
            </div>
          ) : (
            <p className='text-xs text-gray-500 italic'>
              No keywords added yet. Add them in settings.
            </p>
          )}
        </div>
      </div>
      <HorizontalScrollableList
        items={userData?.user_settings?.friends || []}
        onItemClick={onWordBubbleClick}
        itemClassName='!bg-blue-700 hover:!bg-blue-600 !border-blue-500'
        emptyMessage={t('settings.noFriendsAdded')}
      />
      <div className='border-b border-gray-700 px-4'>
        <KeywordsSuggestion
          keywords={pendingKeywords}
          onSelect={onKeywordSelect}
          alwaysShow
          mobile
        />
      </div>
      <div className='px-4 py-2 border-b border-gray-700'>
        <div className='flex gap-2'>
          <textarea
            className='flex-1 p-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
            placeholder='Type your message here…'
            rows={2}
            value={textInput}
            onChange={onMessageChange}
            onKeyDown={onMessageKeyDown}
          />
          <button
            className='px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm'
            onClick={onSendMessage}
            disabled={!textInput.trim()}
          >
            Send
          </button>
        </div>
      </div>
      <div className='px-4 border-b border-gray-700'>
        <div className='flex gap-2'>
          <div className='flex items-center gap-1'>
            <button
              onClick={onClickPreviousSize}
              className='p-2 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 transition-colors'
              title={t('conversation.decreaseResponseSize')}
            >
              <ChevronLeft className='w-3 h-3' />
            </button>
            <span className='px-2 py-2 bg-gray-700 text-white text-sm rounded border border-gray-600 min-w-8 text-center'>
              {responseSize}
            </span>
            <button
              onClick={onClickNextSize}
              className='p-2 bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600 transition-colors'
              title={t('conversation.increaseResponseSize')}
            >
              <ChevronRight className='w-3 h-3' />
            </button>
          </div>
          <button
            onClick={onFreezeToggle}
            className={`
              flex-1 px-4 py-2 flex items-center justify-center rounded-lg border-2 transition-all duration-200
              ${
                isFrozen
                  ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 hover:border-cyan-500 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                  : 'border-gray-300 bg-gray-100 dark:bg-gray-700 hover:border-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
              }
            `}
            title={t('conversation.freezeResponses')}
          >
            <Snowflake className='w-4 h-4' />
          </button>
        </div>
      </div>
      <div className='flex-1 overflow-hidden'>
        <div className='flex gap-2 overflow-x-auto h-full scrollbar-hidden'>
          <div className='shrink-0 w-full grid grid-rows-4 gap-2 h-full'>
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
          <div className='shrink-0 w-full grid grid-rows-2 gap-2 h-full'>
            {allResponses.slice(4, 6).map((response, index) => (
              <StaticResponse
                key={response.id}
                index={index}
                onResponseSelect={onResponseSelect}
                response={response}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileConversationLayout;

interface AdditionalKeywordProps {
  keyword: string;
  onWordBubbleClick: (word: string) => void;
}

const AdditionalKeyword: FC<AdditionalKeywordProps> = ({
  keyword,
  onWordBubbleClick,
}) => {
  const onClickKeyword = useCallback(() => {
    onWordBubbleClick(keyword);
  }, [onWordBubbleClick, keyword]);

  return (
    <button
      onClick={onClickKeyword}
      className='shrink-0 px-4 py-2 text-white text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 whitespace-nowrap bg-green-700 hover:bg-green-600 border-green-500'
    >
      {keyword}
    </button>
  );
};

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
    <div className='p-3 rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-900/20 flex flex-col'>
      <textarea
        ref={ref}
        value={editingText}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className='flex-1 bg-transparent outline-none resize-none text-xs text-gray-900 dark:text-gray-100'
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
          'p-3 text-left rounded-lg border-2 transition-all duration-200 flex flex-col justify-between text-xs relative focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50',
          {
            'border-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 hover:border-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30':
              isFrozen && response.text.trim() && response.isComplete,
            'border-green-300 bg-green-50 dark:bg-green-900/20 hover:border-green-400 hover:bg-green-100 dark:hover:bg-green-900/30':
              !isFrozen && response.text.trim() && response.isComplete,
            'border-gray-200 bg-gray-50 dark:bg-gray-800':
              !isFrozen && response.text.trim() && !response.isComplete,
            'border-gray-300 bg-gray-100 dark:bg-gray-700':
              !isFrozen && !response.text.trim() && !response.isComplete,
            'cursor-pointer': response.text.trim() && response.isComplete,
            'cursor-default': !response.text.trim() || !response.isComplete,
          },
        )}
        disabled={!response.text.trim() || !response.isComplete}
        onClick={onClickResponse}
      >
        <div className='flex-1 overflow-hidden pr-8'>
          <p className='text-xs text-gray-900 dark:text-gray-100 leading-tight wrap-break-word'>
            {response.text.trim() ? (
              <Fragment>
                {response.text}
                {!response.isComplete && (
                  <span className='inline-block w-1 h-3 bg-gray-400 ml-1 animate-pulse' />
                )}
              </Fragment>
            ) : (
              <span className='text-gray-400 italic'>
                Waiting for response…
              </span>
            )}
          </p>
        </div>
        {response.text.trim() && !response.isComplete && (
          <div className='flex justify-end mt-2'>
            <div className='w-3 h-3 border-2 border-green-300 border-t-transparent rounded-full animate-spin' />
          </div>
        )}
      </button>
      {response.text.trim() && response.isComplete && onResponseEdit && (
        <button
          className='absolute top-2 right-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer block'
          onClick={onClickEdit}
          title={t('conversation.editResponse')}
        >
          <Edit2 className='w-3 h-3 text-gray-600 dark:text-gray-400' />
        </button>
      )}
    </div>
  );
};

interface StaticResponseProps {
  index: number;
  onResponseSelect: (responseId: string) => void;
  response: PendingResponse;
}

const StaticResponse: FC<StaticResponseProps> = ({
  index,
  onResponseSelect,
  response,
}) => {
  const onClickResponse = useCallback(() => {
    onResponseSelect(response.id);
  }, [onResponseSelect, response]);

  return (
    <button
      key={response.id}
      onClick={onClickResponse}
      className={cn(
        'p-3 text-left rounded-lg border-2 transition-all duration-200 flex flex-col justify-center text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
        {
          'border-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30':
            index === 0,
          'border-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:border-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30':
            index !== 1,
        },
      )}
    >
      <div className='flex-1 flex items-center overflow-hidden'>
        <p className='text-xs text-gray-900 dark:text-gray-100 leading-tight wrap-break-word'>
          {response.text}
        </p>
      </div>
    </button>
  );
};

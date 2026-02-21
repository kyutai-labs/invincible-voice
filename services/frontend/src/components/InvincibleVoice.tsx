'use client';

import { prettyPrintJson } from 'pretty-print-json';
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  Fragment,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useMemo,
} from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import Cookies from 'universal-cookie';
import { addAuthHeaders } from '@/auth/authUtils';
import CouldNotConnect, { HealthStatus } from '@/components/CouldNotConnect';
import KeywordsSuggestion from '@/components/KeywordsSuggestion';
import ResponseOptions from '@/components/ResponseOptions';
import ChatInterface, {
  PendingResponse,
} from '@/components/chat/ChatInterface';
import ConfirmationDialog from '@/components/conversations/ConfirmationDialog';
import ConversationHistory from '@/components/conversations/ConversationHistory';
import Pause from '@/components/icons/Pause';
import Reply from '@/components/icons/Reply';
import MobileConversationLayout from '@/components/mobile/MobileConversationLayout';
import { MobileNoConversation } from '@/components/mobile/MobileLayout';
import SettingsPopup from '@/components/settings/SettingsPopup';
import ErrorMessages, {
  ErrorItem,
  makeErrorItem,
} from '@/components/ui/ErrorMessages';
import SettingsButton from '@/components/ui/SettingsButton';
import StartConversationButton from '@/components/ui/StartConversationButton';
import { ResponseSize, RESPONSES_SIZES } from '@/constants';
import { useAudioProcessor } from '@/hooks/useAudioProcessor';
import { useBackendServerUrl } from '@/hooks/useBackendServerUrl';
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts';
import { useMicrophoneAccess } from '@/hooks/useMicrophoneAccess';
import { useMobileDetection } from '@/hooks/useMobileDetection';
import useWakeLock from '@/hooks/useWakeLock';
import { useTranslations } from '@/i18n';
import { ChatMessage } from '@/types/chatHistory';
import { base64EncodeOpus } from '@/utils/audioUtil';
import {
  convertConversationToChat,
  getStaticContextOption,
  getStaticRepeatOption,
} from '@/utils/conversationUtils';
import { calculateTotalTokens, formatTokenCount } from '@/utils/tokenUtils';
import { ttsCache } from '@/utils/ttsCache';
import { playTTSStream } from '@/utils/ttsUtil';
import {
  getUserData,
  UserData,
  UserSettings,
  deleteConversation,
} from '@/utils/userData';

interface PendingKeyword {
  id: string;
  text: string;
  isComplete: boolean;
}

const InvincibleVoice = () => {
  const t = useTranslations();
  const { isDevMode } = useKeyboardShortcuts();
  const isMobile = useMobileDetection();
  const { microphoneAccess, askMicrophoneAccess } = useMicrophoneAccess();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userDataError, setUserDataError] = useState<string | null>(null);
  const [debugDict, setDebugDict] = useState<object | null>(null);
  const [rawChatHistory, setRawChatHistory] = useState<ChatMessage[]>([]);
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>(
    [],
  );
  const [responseTimelines, setResponseTimelines] = useState<number[]>([
    0, 0, 0, 0,
  ]);
  const hidePanes = false;
  const [pendingKeywords, setPendingKeywords] = useState<PendingKeyword[]>([]);
  const [keywordTimelines, setKeywordTimelines] = useState<number[]>(
    Array(10).fill(0),
  );
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<
    string | null
  >(null);
  const [currentSpeakerMessage, setCurrentSpeakerMessage] =
    useState<string>('');
  const [currentSpeakerMessageStartTime, setCurrentSpeakerMessageStartTime] =
    useState<number | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [lastSentKeywords, setLastSentKeywords] = useState<string | null>(null);
  const [lastSentText, setLastSentText] = useState<string>('');
  const textInputTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsBlockedMessage, setSettingsBlockedMessage] = useState<
    string | null
  >(null);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState<
    number | null
  >(null);
  const [isViewingPastConversation, setIsViewingPastConversation] =
    useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [conversationToDelete, setConversationToDelete] = useState<
    number | null
  >(null);
  const [isInEditMode, setIsInEditMode] = useState<boolean>(false);
  const [insertTextAtCursor, setInsertTextAtCursor] = useState<
    ((text: string) => void) | null
  >(null);
  const [frozenResponses, setFrozenResponses] = useState<
    PendingResponse[] | null
  >(null);
  const [responseSize, setResponseSize] = useState<ResponseSize>(
    RESPONSES_SIZES.M,
  );
  const [shouldConnect, setShouldConnect] = useState(false);
  const backendServerUrl = useBackendServerUrl();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const bearerToken = useMemo(() => new Cookies().get('bearerToken'), []);

  const staticContextOption = useMemo(() => getStaticContextOption(t), [t]);
  const staticRepeatOption = useMemo(() => getStaticRepeatOption(t), [t]);
  const newConversationUrl = useMemo(() => {
    // Create timezone-aware datetime for local_time parameter
    const localTime = new Date().toISOString();
    const encodedLocalTime = encodeURIComponent(localTime);
    return `${backendServerUrl.toString()}/v1/user/new-conversation?local_time=${encodedLocalTime}`;
  }, [backendServerUrl]);
  const handleInComingMessage = useCallback(
    (lastMessage: WebSocketEventMap['message']) => {
      if (lastMessage === null) {
        return;
      }

      const data = JSON.parse(lastMessage.data);

      // Prevent processing the same message multiple times
      if (data.event_id && data.event_id === lastProcessedMessageId) {
        return;
      }
      if (data.event_id) {
        setLastProcessedMessageId(data.event_id);
      }

      if (data.type === 'unmute.additional_outputs') {
        setDebugDict(data.args.debug_dict);
      } else if (data.type === 'error') {
        if (data.error.type === 'warning') {
          console.warn(`Warning from server: ${data.error.message}`, data);
        } else {
          console.error(`Error from server: ${data.error.message}`, data);
          setErrors((prev) => [...prev, makeErrorItem(data.error.message)]);
        }
      } else if (
        data.type === 'conversation.item.input_audio_transcription.delta'
      ) {
        // Real-time transcription of speaker
        setCurrentSpeakerMessage((prev) => {
          const newMessage = prev + (prev.length > 0 ? ' ' : '') + data.delta;
          // Set start time when first transcription arrives
          if (prev.length === 0) {
            setCurrentSpeakerMessageStartTime(Date.now());
          }
          return newMessage;
        });
      } else if (data.type === 'one.response') {
        // Progressive response handling - responses come one at a time
        // Only update if this response is newer than what we have
        // Convert ISO string timestamp to number for comparison
        const responseTimestamp = new Date(data.timestamp).getTime();
        if (responseTimestamp >= responseTimelines[data.index]) {
          // Add speaker message to history on first response if not already added
          if (
            data.index === 0 &&
            currentSpeakerMessage.trim() &&
            pendingResponses.length === 0
          ) {
            setRawChatHistory((prev) => [
              ...prev,
              {
                role: 'user',
                content: currentSpeakerMessage,
                timestamp: currentSpeakerMessageStartTime || Date.now(),
              },
            ]);
            setCurrentSpeakerMessage('');
            setCurrentSpeakerMessageStartTime(null);
          }

          setResponseTimelines((prev) => {
            const newTimelines = [...prev];
            newTimelines[data.index] = responseTimestamp;
            return newTimelines;
          });

          const responseMessageId = crypto.randomUUID();
          setPendingResponses((prev) => {
            const newResponses = [...prev];
            // Ensure we have at least index + 1 responses
            while (newResponses.length <= data.index) {
              newResponses.push({
                id: `response-${newResponses.length}`,
                text: '',
                isComplete: false,
                messageId: crypto.randomUUID(),
              });
            }
            newResponses[data.index] = {
              id: `response-${data.index}`,
              text: data.content,
              isComplete: true,
              messageId: responseMessageId,
            };
            return newResponses;
          });
        }
      } else if (data.type === 'one.keyword') {
        // Progressive keyword handling - keywords come one at a time
        // Only update if this keyword is newer than what we have
        // Convert ISO string timestamp to number for comparison
        const keywordTimestamp = new Date(data.timestamp).getTime();
        if (keywordTimestamp >= keywordTimelines[data.index]) {
          setKeywordTimelines((prev) => {
            const newTimelines = [...prev];
            newTimelines[data.index] = keywordTimestamp;
            return newTimelines;
          });
          setPendingKeywords((prev) => {
            const newKeywords = [...prev];
            // Ensure we have at least index + 1 keywords
            while (newKeywords.length <= data.index) {
              newKeywords.push({
                id: `keyword-${newKeywords.length}`,
                text: '',
                isComplete: false,
              });
            }
            newKeywords[data.index] = {
              id: `keyword-${data.index}`,
              text: data.content,
              isComplete: true,
            };
            return newKeywords;
          });
        }
      } else if (
        ![
          'input_audio_buffer.speech_stopped',
          'input_audio_buffer.speech_started',
          'unmute.interrupted_by_vad',
          'unmute.response.text.delta.ready',
          'unmute.response.audio.delta.ready',
        ].includes(data.type)
      ) {
        console.warn('Received unknown message:', data);
      }
    },
    [
      currentSpeakerMessage,
      currentSpeakerMessageStartTime,
      keywordTimelines,
      lastProcessedMessageId,
      pendingResponses.length,
      responseTimelines,
    ],
  );
  const { sendMessage, readyState } = useWebSocket(
    newConversationUrl,
    {
      protocols: ['realtime', `Bearer.${bearerToken}`],
      onMessage: handleInComingMessage,
    },
    shouldConnect,
  );
  const clearResponses = useCallback(() => {
    setPendingResponses([]);
    setResponseTimelines([0, 0, 0, 0]);
    setPendingKeywords([]);
    setKeywordTimelines(Array(10).fill(0));
    setCurrentSpeakerMessageStartTime(null);
  }, []);
  const handleFreezeToggle = useCallback(() => {
    setFrozenResponses((prev) => {
      if (prev) {
        return null;
      }
      return pendingResponses.filter(
        (response) => response.text.trim() && response.isComplete,
      );
    });
  }, [pendingResponses]);
  const unfreezeResponses = useCallback(() => {
    setFrozenResponses(null);
  }, []);
  const onOpusRecorded = useCallback(
    (opus: Uint8Array) => {
      sendMessage(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64EncodeOpus(opus),
        }),
      );
    },
    [sendMessage],
  );
  const { setupAudio, shutdownAudio } = useAudioProcessor(onOpusRecorded);
  const sendCurrentKeywords = useCallback(
    (keywords: string | null) => {
      if (keywords !== lastSentKeywords) {
        sendMessage(
          JSON.stringify({
            type: 'current.keywords',
            keywords,
          }),
        );
        setLastSentKeywords(keywords);
      }
    },
    [sendMessage, lastSentKeywords],
  );
  const handleSelectResponseSize = useCallback(
    (newSize: ResponseSize) => {
      setResponseSize(newSize);
      sendMessage(
        JSON.stringify({
          type: 'desired.responses.length',
          length: newSize,
        }),
      );
    },
    [sendMessage],
  );

  const handleResponseSelection = useCallback(
    async (responseId: string) => {
      if (
        responseId === 'static-context-question' ||
        responseId === 'static-repeat-question'
      ) {
        const staticText =
          responseId === 'static-context-question'
            ? t('conversation.contextQuestion')
            : t('conversation.repeatQuestion');
        const staticMessageId =
          responseId === 'static-context-question'
            ? '00000000-0000-4000-8000-000000000001'
            : '00000000-0000-4000-8000-000000000002';

        // Flush any pending speaker message to chat history first
        if (currentSpeakerMessage.trim()) {
          setRawChatHistory((prev) => [
            ...prev,
            {
              role: 'user',
              content: currentSpeakerMessage,
              timestamp: currentSpeakerMessageStartTime || Date.now(),
            },
          ]);
          setCurrentSpeakerMessage('');
          setCurrentSpeakerMessageStartTime(null);
        }

        setRawChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: staticText,
            timestamp: Date.now(),
            messageId: staticMessageId,
          },
        ]);
        sendMessage(
          JSON.stringify({
            type: 'response.selected.by.writer',
            text: staticText,
            id: staticMessageId,
          }),
        );
        playTTSStream({
          text: staticText,
          cacheType: 'permanent', // Use permanent cache for static messages
          messageId: staticMessageId,
        }).catch(console.error);
      } else {
        const allResponses = frozenResponses || pendingResponses;
        const selectedResponse = allResponses.find((r) => r.id === responseId);
        if (!selectedResponse) {
          return;
        }

        // Flush any pending speaker message to chat history first
        if (currentSpeakerMessage.trim()) {
          setRawChatHistory((prev) => [
            ...prev,
            {
              role: 'user',
              content: currentSpeakerMessage,
              timestamp: currentSpeakerMessageStartTime || Date.now(),
            },
          ]);
          setCurrentSpeakerMessage('');
          setCurrentSpeakerMessageStartTime(null);
        }

        setRawChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: selectedResponse.text,
            timestamp: Date.now(),
            messageId: selectedResponse.messageId,
          },
        ]);
        sendMessage(
          JSON.stringify({
            type: 'response.selected.by.writer',
            text: selectedResponse.text,
            id: selectedResponse.messageId,
          }),
        );
        playTTSStream({
          text: selectedResponse.text,
          cacheType: 'temporary',
          messageId: selectedResponse.messageId,
        }).catch(console.error);
      }
      if (!frozenResponses) {
        clearResponses();
      }
      setTextInput('');
      setLastSentText('');
      sendCurrentKeywords(null);

      if (textInputTimeoutRef.current) {
        clearTimeout(textInputTimeoutRef.current);
      }
    },
    [
      pendingResponses,
      frozenResponses,
      sendMessage,
      sendCurrentKeywords,
      clearResponses,
      currentSpeakerMessage,
      currentSpeakerMessageStartTime,
      t,
    ],
  );
  const handleWordBubbleClick = useCallback(
    (word: string) => {
      if (isInEditMode && insertTextAtCursor) {
        insertTextAtCursor(word);
      } else {
        const newValue = textInput ? `${textInput} ${word}` : word;
        setTextInput(newValue);
        sendCurrentKeywords(newValue.trim());
        // Unfreeze responses when text input changes
        unfreezeResponses();
      }
    },
    [
      textInput,
      sendCurrentKeywords,
      isInEditMode,
      insertTextAtCursor,
      unfreezeResponses,
    ],
  );
  const handleKeywordSelect = useCallback(
    (keywordText: string) => {
      handleWordBubbleClick(keywordText);
    },
    [handleWordBubbleClick],
  );
  const handleTextInputChange = useCallback(
    (newValue: string) => {
      setTextInput((oldValue) => {
        if (newValue !== oldValue) {
          unfreezeResponses();
        }
        if (textInputTimeoutRef.current) {
          clearTimeout(textInputTimeoutRef.current);
        }

        // Detect word completion: user typed a space after non-space characters
        if (
          newValue.length > oldValue.length &&
          newValue.endsWith(' ') &&
          !oldValue.endsWith(' ')
        ) {
          // A word was just completed, send current keywords
          sendCurrentKeywords(newValue.trim());
          setLastSentText(newValue);
        } else if (newValue.trim() === '' && oldValue.trim() !== '') {
          // Text was cleared, send null
          sendCurrentKeywords(null);
          setLastSentText('');
        }

        textInputTimeoutRef.current = setTimeout(() => {
          if (newValue !== lastSentText) {
            if (newValue.trim() !== '') {
              sendCurrentKeywords(newValue.trim());
            } else {
              sendCurrentKeywords(null);
            }
            setLastSentText(newValue);
          }
        }, 2000);
        return newValue;
      });
    },
    [sendCurrentKeywords, lastSentText, unfreezeResponses],
  );
  const handleEditModeChange = useCallback(
    (isEditing: boolean, insertTextCallback: (text: string) => void) => {
      setIsInEditMode(isEditing);
      setInsertTextAtCursor(() => insertTextCallback);
    },
    [],
  );
  const handleSettingsOpen = useCallback(() => {
    if (shouldConnect) {
      setSettingsBlockedMessage(
        'You cannot modify the settings while a conversation is happening, please end the conversation first.',
      );
      setTimeout(() => setSettingsBlockedMessage(null), 5000);
    } else {
      setIsSettingsOpen(true);
    }
  }, [shouldConnect]);
  const handleSettingsSave = useCallback((newSettings: UserSettings) => {
    setUserData((prev) =>
      prev
        ? {
            ...prev,
            user_settings: newSettings,
          }
        : null,
    );
    setIsSettingsOpen(false);
  }, []);
  const handleSettingsCancel = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);
  const handleConversationSelect = useCallback(
    (index: number) => {
      if (shouldConnect) {
        // Don't allow switching conversations while connected
        return;
      }

      setSelectedConversationIndex(index);
      setIsViewingPastConversation(true);

      if (userData?.conversations[index]) {
        const selectedConversation = userData.conversations[index];
        const convertedHistory =
          convertConversationToChat(selectedConversation);
        setRawChatHistory(convertedHistory);
      }

      clearResponses();
      setTextInput('');
      setLastSentText('');
      if (textInputTimeoutRef.current) {
        clearTimeout(textInputTimeoutRef.current);
      }
      setCurrentSpeakerMessage('');
      setCurrentSpeakerMessageStartTime(null);
    },
    [shouldConnect, userData, clearResponses],
  );
  const handleNewConversation = useCallback(() => {
    if (shouldConnect) {
      // Don't allow creating new conversation while connected
      return;
    }

    setSelectedConversationIndex(null);
    setIsViewingPastConversation(false);
    setRawChatHistory([]);
    clearResponses();
    setTextInput('');
    setLastSentText('');
    if (textInputTimeoutRef.current) {
      clearTimeout(textInputTimeoutRef.current);
    }
    setCurrentSpeakerMessage('');
    setCurrentSpeakerMessageStartTime(null);
  }, [shouldConnect, clearResponses]);
  const handleDeleteConversation = useCallback((conversationIndex: number) => {
    setConversationToDelete(conversationIndex);
    setIsDeleteDialogOpen(true);
  }, []);
  const toggleDeleteConversationDialog = useCallback(() => {
    setIsDeleteDialogOpen((prev) => !prev);
  }, []);
  const confirmDeleteConversation = useCallback(async () => {
    if (conversationToDelete === null || !userData) {
      return;
    }

    try {
      const result = await deleteConversation(conversationToDelete);

      if (result.error) {
        setErrors((prev) => [
          ...prev,
          makeErrorItem(`Failed to delete conversation: ${result.error}`),
        ]);
        return;
      }

      // Update local state by removing the conversation
      setUserData((prev) => {
        if (!prev) {
          return prev;
        }
        const newConversations = structuredClone(prev.conversations);
        newConversations.splice(conversationToDelete, 1);

        return {
          ...prev,
          conversations: newConversations,
        };
      });

      if (selectedConversationIndex === conversationToDelete) {
        setSelectedConversationIndex(null);
        setIsViewingPastConversation(false);
        setRawChatHistory([]);
        clearResponses();
        setTextInput('');
        setLastSentText('');
        if (textInputTimeoutRef.current) {
          clearTimeout(textInputTimeoutRef.current);
        }
        setCurrentSpeakerMessage('');
        setCurrentSpeakerMessageStartTime(null);
      } else if (
        selectedConversationIndex !== null &&
        selectedConversationIndex > conversationToDelete
      ) {
        // If we deleted a conversation before the selected one, adjust the index
        setSelectedConversationIndex((prev) =>
          prev !== null ? prev - 1 : null,
        );
      }
    } catch (error) {
      setErrors((prev) => [
        ...prev,
        makeErrorItem(`Failed to delete conversation: ${error}`),
      ]);
    } finally {
      setConversationToDelete(null);
      setIsDeleteDialogOpen(false);
    }
  }, [
    conversationToDelete,
    userData,
    selectedConversationIndex,
    clearResponses,
  ]);
  const handleSendMessage = useCallback(() => {
    if (!textInput.trim()) {
      return;
    }

    const customMessageId = crypto.randomUUID();

    setRawChatHistory((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: textInput,
        timestamp: Date.now(),
        messageId: customMessageId,
      },
    ]);
    sendMessage(
      JSON.stringify({
        type: 'response.selected.by.writer',
        text: textInput,
        id: customMessageId,
      }),
    );
    playTTSStream({
      text: textInput,
      cacheType: 'temporary',
      messageId: customMessageId,
    }).catch(console.error);

    setTextInput('');
    setLastSentText('');
    if (textInputTimeoutRef.current) {
      clearTimeout(textInputTimeoutRef.current);
    }
    clearResponses();
    sendCurrentKeywords(null);
  }, [textInput, sendMessage, sendCurrentKeywords, clearResponses]);
  const onConnectButtonPress = useCallback(async () => {
    // Don't allow connecting when viewing a past conversation
    if (isViewingPastConversation) {
      return;
    }

    if (!shouldConnect) {
      // Check token limit before connecting
      if (userData?.user_settings) {
        const totalTokens = calculateTotalTokens(userData.user_settings);
        const limitTokens = 64000;
        if (totalTokens > limitTokens) {
          const tokenErrorMessage = `The total number of tokens used in the documents and prompt is currently ${formatTokenCount(totalTokens)} which is above the limit of ${formatTokenCount(limitTokens)}, please remove or reduce the size of some documents.`;
          setErrors((prev) => {
            const filteredErrors = prev.filter(
              (error) => !error.message.includes('total number of tokens'),
            );
            return [...filteredErrors, makeErrorItem(tokenErrorMessage)];
          });
          return; // Prevent connection
        }
        setErrors((prev) =>
          prev.filter(
            (error) => !error.message.includes('total number of tokens'),
          ),
        );
      }

      const mediaStream = await askMicrophoneAccess();
      if (mediaStream) {
        await setupAudio(mediaStream);
        setShouldConnect(true);
      }
    } else {
      setShouldConnect(false);
      shutdownAudio();
    }
  }, [
    askMicrophoneAccess,
    isViewingPastConversation,
    setupAudio,
    shouldConnect,
    shutdownAudio,
    userData?.user_settings,
  ]);
  const onResponseEdit = useCallback(
    (editedText: string) => {
      const editedMessageId = crypto.randomUUID();
      setRawChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: editedText,
          timestamp: Date.now(),
          messageId: editedMessageId,
        },
      ]);
      sendMessage(
        JSON.stringify({
          type: 'response.selected.by.writer',
          text: editedText,
          id: editedMessageId,
        }),
      );
      playTTSStream({
        text: editedText,
        cacheType: 'temporary',
        messageId: editedMessageId,
      }).catch(console.error);

      clearResponses();
      setTextInput('');
      setLastSentText('');
      if (textInputTimeoutRef.current) {
        clearTimeout(textInputTimeoutRef.current);
      }
      sendCurrentKeywords(null);
    },
    [clearResponses, sendCurrentKeywords, sendMessage],
  );
  const onChangeTextInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      handleTextInputChange(event.target.value);
    },
    [handleTextInputChange],
  );
  const onTextInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  useEffect(() => {
    const fetchUserData = async () => {
      setUserDataError(null);
      const result = await getUserData();

      if (result.error) {
        console.error('Failed to fetch user data:', result.error);
        setUserDataError(result.error);
      } else if (result.data) {
        setUserData(result.data);
      }
    };

    fetchUserData();
  }, []);

  useWakeLock(shouldConnect);

  useEffect(() => {
    if (!backendServerUrl) {
      return;
    }

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`/api/v1/health`, {
          signal: controller.signal,
          headers: addAuthHeaders(),
        });

        clearTimeout(timeoutId);
        if (!response.ok) {
          setHealthStatus({
            connected: 'yes_request_fail',
            ok: false,
          });
        }
        const data = await response.json();
        data.connected = 'yes_request_ok';

        setHealthStatus(data);
      } catch {
        setHealthStatus({
          connected: 'no',
          ok: false,
        });
      }
    };

    checkHealth();
  }, [backendServerUrl]);

  useEffect(() => {
    if (microphoneAccess === 'refused') {
      setErrors((prev) => {
        const microphoneErrorExists = prev.some((error) =>
          error.message.includes('microphone access'),
        );
        if (!microphoneErrorExists) {
          return [
            ...prev,
            makeErrorItem(
              'Please allow microphone access to use InvincibleVoice.',
            ),
          ];
        }
        return prev;
      });
    }
  }, [microphoneAccess]);

  // Keyboard shortcuts for response selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isViewingPastConversation) {
        return;
      }

      const { activeElement } = document;
      const isInputField =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true');

      if (isInputField) {
        return;
      }

      const validShortcuts = ['a', 'z', 'q', 's', 'w', 'x'];
      const responseIndex = validShortcuts.indexOf(event.key.toLowerCase());

      // Handle Shift+A/Z/Q/S for editing responses
      if (event.shiftKey && responseIndex !== -1 && responseIndex < 4) {
        event.preventDefault();
        const responsesToUse = frozenResponses || pendingResponses;
        const allResponses = [
          ...Array.from({ length: 4 }, (_, index) => {
            const existingResponse = responsesToUse[index];
            return (
              existingResponse || {
                id: `empty-${index}`,
                text: '',
                isComplete: false,
              }
            );
          }),
        ];

        const selectedResponse = allResponses[responseIndex];
        if (
          selectedResponse &&
          selectedResponse.text.trim() &&
          selectedResponse.isComplete
        ) {
          // Trigger edit mode by programmatically clicking the edit button
          const responseElements = document.querySelectorAll(
            '[data-response-index]',
          );
          const targetElement = responseElements[responseIndex];
          if (targetElement) {
            const editButton = targetElement.querySelector(
              'div[title*="Edit"]',
            ) as HTMLDivElement;
            if (editButton) {
              editButton.click();
            }
          }
        }
        return;
      }

      if (responseIndex !== -1 && !event.shiftKey) {
        event.preventDefault();

        if (responseIndex === 4) {
          handleResponseSelection('static-context-question');
        } else if (responseIndex === 5) {
          handleResponseSelection('static-repeat-question');
        } else {
          const responsesToUse = frozenResponses || pendingResponses;
          const allResponses = [
            ...Array.from({ length: 4 }, (_, index) => {
              const existingResponse = responsesToUse[index];
              return (
                existingResponse || {
                  id: `empty-${index}`,
                  text: '',
                  isComplete: false,
                }
              );
            }),
          ];

          const selectedResponse = allResponses[responseIndex];
          if (
            selectedResponse &&
            selectedResponse.text.trim() &&
            selectedResponse.isComplete
          ) {
            handleResponseSelection(selectedResponse.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    pendingResponses,
    frozenResponses,
    handleResponseSelection,
    isViewingPastConversation,
    shouldConnect,
  ]);

  // Handle websocket disconnection
  useEffect(() => {
    if (readyState === ReadyState.CLOSING || readyState === ReadyState.CLOSED) {
      setShouldConnect(false);
      shutdownAudio();

      // Re-fetch user data when WebSocket connection is fully closed
      // This ensures the backend has had time to save the conversation
      if (readyState === ReadyState.CLOSED) {
        const fetchUserData = async () => {
          setUserDataError(null);
          const result = await getUserData();

          if (result.error) {
            console.error(
              'Failed to fetch user data after disconnect:',
              result.error,
            );
            setUserDataError(result.error);
          } else if (result.data) {
            setUserData(result.data);
          }
        };

        fetchUserData();
      }
    }
  }, [readyState, shutdownAudio]);

  // When we connect, send the initial config and clear chat history
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) {
      return;
    }

    setRawChatHistory([]);
    clearResponses();
    setCurrentSpeakerMessage('');
    setCurrentSpeakerMessageStartTime(null);
  }, [readyState, clearResponses]);

  // Cleanup temporary TTS cache when component unmounts
  useEffect(() => {
    return () => {
      ttsCache.clearTemporary();
    };
  }, []);

  if (!healthStatus || !backendServerUrl) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen gap-4'>
        <h1 className='mb-4 text-xl'>Loading InvincibleVoice…</h1>
      </div>
    );
  }

  if (healthStatus && !healthStatus.ok) {
    return <CouldNotConnect healthStatus={healthStatus} />;
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className='flex flex-col w-full h-screen text-white'>
        <ErrorMessages
          errors={errors}
          setErrors={setErrors}
        />
        {!shouldConnect && !isViewingPastConversation && (
          <MobileNoConversation onConnectButtonPress={onConnectButtonPress} />
        )}
        {shouldConnect && !isViewingPastConversation && (
          <MobileConversationLayout
            textInput={textInput}
            onTextInputChange={handleTextInputChange}
            onSendMessage={handleSendMessage}
            frozenResponses={frozenResponses}
            pendingResponses={pendingResponses}
            onResponseSelect={handleResponseSelection}
            onResponseEdit={onResponseEdit}
            onConnectButtonPress={onConnectButtonPress}
          />
        )}
        {isSettingsOpen && userData && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
            <div className='w-full h-full max-w-6xl max-h-full p-4 overflow-y-auto border bg-darkgray border-green'>
              <SettingsPopup
                userSettings={userData.user_settings}
                onSave={handleSettingsSave}
                onCancel={handleSettingsCancel}
              />
            </div>
          </div>
        )}
        <ConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={toggleDeleteConversationDialog}
          onConfirm={confirmDeleteConversation}
          title={t('conversation.deleteConversation')}
          message={t('conversation.deleteConversationMessage')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
        />
      </div>
    );
  }

  return (
    <div className='relative flex flex-col w-full h-screen overflow-hidden text-white'>
      <ErrorMessages
        errors={errors}
        setErrors={setErrors}
      />
      <div className='flex flex-row grow h-screen'>
        {!hidePanes && (
          <ConversationHistory
            conversations={userData?.conversations || []}
            selectedConversationIndex={selectedConversationIndex}
            onConversationSelect={handleConversationSelect}
            onNewConversation={handleNewConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        )}
        <div className='relative z-0 grid grow h-screen grid-cols-2 overflow-hidden'>
          {!shouldConnect && !isViewingPastConversation && (
            <div className='absolute inset-0 z-20 flex items-center justify-center pointer-events-none'>
              <StartConversationButton
                onClick={onConnectButtonPress}
                label={t('conversation.startChatting')}
              />
            </div>
          )}
          {!shouldConnect && !isViewingPastConversation && (
            <div className='absolute bottom-0 right-0 z-20 p-6 pointer-events-none'>
              <div className='flex flex-col items-end pointer-events-auto'>
                <p className='text-xs text-gray-500'>
                  {t('common.textToSpeechProvider')}
                </p>
                <img
                  src='/gradium.svg'
                  alt='Gradium'
                  className='h-6 mt-1'
                />
              </div>
            </div>
          )}
          {!hidePanes && (
            <div className='relative z-0 flex flex-col h-screen gap-8 px-4 pt-6 pb-4 overflow-y-auto'>
              <div className='flex flex-row items-center justify-end h-10'>
                {shouldConnect && !isViewingPastConversation && (
                  <button
                    onClick={onConnectButtonPress}
                    className='shrink-0 h-10 p-px cursor-pointer orange-to-light-orange-gradient rounded-2xl'
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
                )}
              </div>
              <ChatInterface
                chatHistory={rawChatHistory}
                isConnected={shouldConnect}
                currentSpeakerMessage={currentSpeakerMessage}
                pastConversation={
                  selectedConversationIndex !== null &&
                  userData?.conversations[selectedConversationIndex]
                    ? userData.conversations[selectedConversationIndex]
                    : undefined
                }
                isViewingPastConversation={isViewingPastConversation}
              />
              {shouldConnect && !isViewingPastConversation && (
                <div className='shrink-0'>
                  <ResponseOptions
                    responses={pendingResponses}
                    onSelect={handleResponseSelection}
                    onEditModeChange={handleEditModeChange}
                    onEdit={onResponseEdit}
                    alwaysShow
                    frozenResponses={frozenResponses}
                    onFreezeToggle={handleFreezeToggle}
                    onResponseSizeChange={handleSelectResponseSize}
                    currentResponseSize={responseSize}
                  />
                </div>
              )}
            </div>
          )}
          <div className='relative z-0 flex flex-col h-screen gap-4 px-4 pt-6 overflow-y-auto pb-14'>
            {!shouldConnect && !isViewingPastConversation && (
              <div className='flex flex-row items-center justify-end h-10'>
                <SettingsButton
                  onClick={handleSettingsOpen}
                  label={t('settings.changeSettings')}
                  variant='full'
                />
              </div>
            )}
            {shouldConnect && !isViewingPastConversation && (
              <Fragment>
                <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
                  <div className='mb-1 text-sm font-medium text-white'>
                    {t('conversation.keywords')}
                  </div>
                  <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
                    {userData?.user_settings?.additional_keywords?.map(
                      (word) => (
                        <button
                          key={word}
                          className='h-10 p-px transition-colors cursor-pointer green-to-light-green-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500'
                          onClick={() => handleWordBubbleClick(word)}
                        >
                          <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
                            {word}
                          </div>
                        </button>
                      ),
                    ) || []}
                    {(!userData?.user_settings?.additional_keywords ||
                      userData.user_settings.additional_keywords.length ===
                        0) && (
                      <p className='text-xs italic text-gray-500'>
                        No keywords added yet. Add them in settings.
                      </p>
                    )}
                  </div>
                </div>
                {userDataError && (
                  <div className='p-2 border-b border-gray-700'>
                    <div className='text-right'>
                      <span className='text-xs text-red-400'>
                        Failed to load user data
                      </span>
                    </div>
                  </div>
                )}
                {settingsBlockedMessage && (
                  <div className='p-2 border-b border-gray-700'>
                    <div className='px-2 py-1 text-xs text-yellow-200 border border-yellow-500 rounded bg-yellow-900/20'>
                      {settingsBlockedMessage}
                    </div>
                  </div>
                )}
                <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px]'>
                  <div className='mb-1 text-sm font-medium text-white'>
                    {t('common.friends')}
                  </div>
                  <div className='flex flex-wrap gap-1.5 min-h-6 max-h-32 overflow-y-auto overflow-x-hidden py-2 px-0.5'>
                    {userData?.user_settings?.friends?.map((friend) => (
                      <div
                        key={friend}
                        className='relative group'
                      >
                        <button
                          key={friend}
                          onClick={() => handleWordBubbleClick(friend)}
                          className='h-10 p-px transition-colors cursor-pointer blue-to-light-blue-gradient rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <div className='flex flex-col justify-center px-3 h-full text-sm text-white font-medium bg-[#181818] rounded-2xl'>
                            {friend}
                          </div>
                        </button>
                      </div>
                    ))}
                    {(!userData?.user_settings?.friends ||
                      userData.user_settings.friends.length === 0) && (
                      <p className='text-xs italic text-gray-500'>
                        {t('settings.noFriendsAdded')}
                      </p>
                    )}
                  </div>
                </div>
                <KeywordsSuggestion
                  keywords={pendingKeywords}
                  onSelect={handleKeywordSelect}
                  alwaysShow
                />
                <div className='w-full px-6 py-4 bg-[#101010] rounded-[40px] grow flex flex-col gap-2'>
                  <div className='grid grid-cols-2 gap-2 pb-2'>
                    <button
                      onClick={() =>
                        handleResponseSelection(staticContextOption.id)
                      }
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
                      onClick={() =>
                        handleResponseSelection(staticRepeatOption.id)
                      }
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
                  <textarea
                    className='grow w-full min-h-0 px-6 py-4 text-base text-white bg-[#1B1B1B] border border-white rounded-3xl resize-none focus:outline-none focus:border-green scrollbar-hidden scrollable'
                    placeholder={t('conversation.typeMessagePlaceholder')}
                    rows={2}
                    value={textInput}
                    onChange={onChangeTextInput}
                    onKeyDown={onTextInputKeyDown}
                  />
                  <button
                    onClick={handleSendMessage}
                    className='self-end p-px h-14 green-to-purple-via-blue-gradient rounded-2xl w-fit'
                    disabled={!textInput.trim()}
                  >
                    <div className='flex flex-row bg-[#181818] size-full items-center justify-center gap-4 px-8 rounded-2xl'>
                      {t('conversation.sendMessage')}
                      <Reply
                        width={24}
                        height={24}
                      />
                    </div>
                  </button>
                </div>
              </Fragment>
            )}
          </div>
        </div>
      </div>
      {isDevMode && (
        <div className='p-4 overflow-auto border-t border-gray-700 max-h-64'>
          <div className='text-xs'>
            <pre
              className='wrap-break-word whitespace-pre-wrap'
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: prettyPrintJson.toHtml(debugDict),
              }}
            />
          </div>
          <div className='mt-2 text-xs text-gray-400'>
            Dev mode: press D to toggle
          </div>
        </div>
      )}
      {isSettingsOpen && userData && (
        <div className='fixed inset-0 z-50 flex items-center justify-center px-14 py-8 bg-[#121212CC] backdrop-blur-2xl p-2'>
          <div className='w-full h-full max-w-7xl max-h-full px-12 pt-6 pb-8 overflow-y-auto border bg-[#121212] border-black rounded-[40px] shadow-custom'>
            <SettingsPopup
              userSettings={userData.user_settings}
              onSave={handleSettingsSave}
              onCancel={handleSettingsCancel}
            />
          </div>
        </div>
      )}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={toggleDeleteConversationDialog}
        onConfirm={confirmDeleteConversation}
        title={t('conversation.deleteConversation')}
        message={t('conversation.deleteConversationMessage')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
};

export default InvincibleVoice;

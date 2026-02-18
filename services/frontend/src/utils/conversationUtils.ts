import { STATIC_MESSAGE_UUIDS } from '@/constants';
import { ChatMessage } from '@/types/chatHistory';
import { Conversation, isSpeakerMessage, isWriterMessage } from './userData';

export function convertConversationToChat(
  conversation: Conversation,
): ChatMessage[] {
  return conversation.messages.map((message, index): ChatMessage => {
    if (isSpeakerMessage(message)) {
      return {
        role: 'user',
        content: message.content,
        timestamp: Date.now() + index,
      };
    }
    if (isWriterMessage(message)) {
      return {
        role: 'assistant',
        content: message.content,
        timestamp: Date.now() + index,
      };
    }
    return {
      role: 'user',
      content: 'Unknown message type',
      timestamp: Date.now() + index,
    };
  });
}

export const getStaticContextOption = (t: (key: string) => string) => ({
  id: 'static-context-question',
  text: t('conversation.contextQuestion'),
  isComplete: true,
  messageId: STATIC_MESSAGE_UUIDS.CONTEXT_QUESTION,
});

export const getStaticRepeatOption = (t: (key: string) => string) => ({
  id: 'static-repeat-question',
  text: t('conversation.repeatQuestion'),
  isComplete: true,
  messageId: STATIC_MESSAGE_UUIDS.REPEAT_QUESTION,
});

// TypeScript types equivalent to the Pydantic models in services/backend/backend/storage.py
import { addAuthHeaders } from '../auth/authUtils';

/**
 * Represents a message from a speaker (user input)
 */
export interface SpeakerMessage {
  speaker: string;
  content: string;
}

/**
 * Represents a message from the writer (AI response)
 */
export interface WriterMessage {
  content: string;
  messageId: string; // UUID as string in TypeScript
}

/**
 * Union type for conversation messages
 */
export type ConversationMessage = SpeakerMessage | WriterMessage;

/**
 * Represents a conversation containing multiple messages
 */
export interface Conversation {
  messages: ConversationMessage[];
  start_time: string; // ISO 8601 datetime string from backend
}

/**
 * Represents a document with title and content
 */
export interface Document {
  title: string;
  content: string;
}

/**
 * User settings and preferences
 */
export interface UserSettings {
  name: string;
  prompt: string;
  additional_keywords: string[];
  friends: string[];
  documents: Document[];
  thinking_mode: boolean;
  voice?: string;
}

/**
 * Complete user data structure
 */
export interface UserData {
  user_id: string; // UUID as string in TypeScript
  user_settings: UserSettings;
  conversations: Conversation[];
}

/**
 * Type guard to check if a message is from a speaker
 */
export function isSpeakerMessage(
  message: ConversationMessage,
): message is SpeakerMessage {
  return 'speaker' in message;
}

/**
 * Type guard to check if a message is from a writer
 */
export function isWriterMessage(
  message: ConversationMessage,
): message is WriterMessage {
  return 'messageId' in message;
}

/**
 * API response wrapper for error handling
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Fetches user data from the backend API
 * GET /v1/user/
 *
 * @returns Promise<ApiResponse<UserData>>
 */
export async function getUserData(): Promise<ApiResponse<UserData>> {
  try {
    const url = `/api/v1/user/`;

    const response = await fetch(url, {
      method: 'GET',
      headers: addAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      return {
        error: `Failed to fetch user data: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    const data: UserData = await response.json();

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Updates user settings on the backend API
 * POST /v1/user/settings
 *
 * @param settings - The updated user settings
 * @returns Promise<ApiResponse<void>>
 */
export async function updateUserSettings(
  settings: UserSettings,
): Promise<ApiResponse<void>> {
  try {
    const url = `/api/v1/user/settings`;

    const response = await fetch(url, {
      method: 'POST',
      headers: addAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      return {
        error: `Failed to update user settings: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    return {
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Deletes a conversation from the backend API
 * DELETE /v1/user/conversations/{conversation_id}
 *
 * @param conversationId - The index of the conversation to delete
 * @returns Promise<ApiResponse<void>>
 */
export async function deleteConversation(
  conversationId: number,
): Promise<ApiResponse<void>> {
  try {
    const url = `/api/v1/user/conversations/${conversationId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: addAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      return {
        error: `Failed to delete conversation: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    return {
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Fetches available voices from the backend API
 * GET /v1/voices
 *
 * @returns Promise<ApiResponse<Record<string, string>>>
 */
export async function getVoices(): Promise<
  ApiResponse<Record<string, string>>
> {
  try {
    const url = `/api/v1/voices`;

    const response = await fetch(url, {
      method: 'GET',
      headers: addAuthHeaders({
        'Content-Type': 'application/json',
      }),
    });

    if (!response.ok) {
      return {
        error: `Failed to fetch voices: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    const data: Record<string, string> = await response.json();

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Selects a voice for the user
 * POST /v1/voices/select
 *
 * @param voice - The voice to select
 * @returns Promise<ApiResponse<{ voice: string }>>
 */
export async function selectVoice(
  voice: string,
): Promise<ApiResponse<{ voice: string }>> {
  try {
    const url = `/api/v1/voices/select`;

    const response = await fetch(url, {
      method: 'POST',
      headers: addAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ voice }),
    });

    if (!response.ok) {
      return {
        error: `Failed to select voice: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    const data: { voice: string } = await response.json();

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

/**
 * Creates a new voice by uploading an audio file
 * POST /v1/voices/create
 *
 * @param audioFile - The audio file (WAV) to use for voice cloning
 * @param name - The name for the new voice
 * @returns Promise<ApiResponse<{ uid: string; name: string }>>
 */
export async function createVoice(
  audioFile: File,
  name: string,
): Promise<ApiResponse<{ uid: string; name: string }>> {
  try {
    const url = `/api/v1/voices/create`;

    const formData = new FormData();
    formData.append('audio_file', audioFile);
    formData.append('name', name);

    const response = await fetch(url, {
      method: 'POST',
      headers: addAuthHeaders({}),
      body: formData,
    });

    if (!response.ok) {
      return {
        error: `Failed to create voice: ${response.status} ${response.statusText}`,
        status: response.status,
      };
    }

    const data: { uid: string; name: string } = await response.json();

    return {
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 0,
    };
  }
}

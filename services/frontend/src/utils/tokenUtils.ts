/**
 * Utility functions for estimating token counts in text.
 *
 * This provides a rough estimation of tokens based on text content.
 * The actual token count may vary depending on the tokenizer used by the LLM.
 */

/**
 * Estimates the number of tokens in a given text.
 *
 * This uses a simple heuristic based on:
 * - Word count (split by whitespace)
 * - Character count for non-ASCII text
 * - Punctuation and special characters
 *
 * The estimation assumes roughly 1.3 tokens per word on average for English text.
 *
 * @param text The text to estimate tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Split by whitespace to get words
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  // Count non-ASCII characters (these often use more tokens)
  // eslint-disable-next-line no-control-regex
  const nonAsciiChars = (text.match(/[^\x00-\x7F]/g) || []).length;

  // Count punctuation marks
  const punctuationCount = (text.match(/[^\w\s]/g) || []).length;

  // Base estimation: ~1.3 tokens per word
  let tokenEstimate = wordCount * 1.3;

  // Add extra tokens for non-ASCII characters (common in multilingual text)
  tokenEstimate += nonAsciiChars * 0.5;

  // Add small adjustment for punctuation
  tokenEstimate += punctuationCount * 0.1;

  // Round to nearest integer
  return Math.round(tokenEstimate);
}

/**
 * Formats a token count for display with appropriate units.
 *
 * @param tokenCount The number of tokens
 * @returns Formatted string (e.g., "1.2K tokens", "450 tokens")
 */
export function formatTokenCount(tokenCount: number): string {
  if (tokenCount === 0) {
    return '0 tokens';
  }
  if (tokenCount === 1) {
    return '1 token';
  }
  if (tokenCount < 1000) {
    return `${tokenCount} tokens`;
  }
  if (tokenCount < 10000) {
    return `${(tokenCount / 1000).toFixed(1)}K tokens`;
  }
  return `${Math.round(tokenCount / 1000)}K tokens`;
}

/**
 * Calculates the total token count from user settings (prompt + all documents).
 *
 * @param userSettings The user settings containing prompt and documents
 * @returns Total estimated token count
 */
export function calculateTotalTokens(userSettings: {
  prompt: string;
  documents?: Array<{ content: string }>;
}): number {
  const promptTokens = estimateTokens(userSettings.prompt || '');
  const documentTokens = (userSettings.documents || []).reduce(
    (total, doc) => total + estimateTokens(doc.content || ''),
    0,
  );

  return promptTokens + documentTokens;
}

/**
 * Maximum number of words allowed in the user's prompt and in each document.
 * Above this, the UI proposes an LLM summary. Mirrors MAX_TEXT_WORDS in
 * services/backend/backend/llm/prompt_budget.py.
 */
export const MAX_TEXT_WORDS = 3000;

/**
 * Counts words by splitting on whitespace, the same way the backend does.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

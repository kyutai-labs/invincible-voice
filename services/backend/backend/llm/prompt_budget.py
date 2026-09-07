"""Rules that keep the prompt sent to the LLM bounded.

Every size here is a number of words, counted by splitting on whitespace, which
is also how the frontend counts them.
"""

import datetime as dt

from backend.typing import Conversation

# Past conversations longer than this get an LLM-written summary, which then
# replaces their messages in the prompt.
CONVERSATION_SUMMARY_MIN_WORDS = 1000
CONVERSATION_SUMMARY_TARGET_WORDS = 200

# Past conversations shorter than this and older than this are left out of the prompt.
SHORT_CONVERSATION_MAX_WORDS = 10
SHORT_CONVERSATION_MAX_AGE = dt.timedelta(days=30)

# The user's prompt and each document must stay under this. When they exceed it,
# the settings UI proposes an LLM summary of about TEXT_SUMMARY_TARGET_WORDS words.
MAX_TEXT_WORDS = 3000
TEXT_SUMMARY_TARGET_WORDS = 2000

# The whole prompt must stay under this: the oldest conversations are dropped first.
MAX_PROMPT_WORDS = 40000


def count_words(text: str) -> int:
    return len(text.split())


def conversation_word_count(conversation: Conversation) -> int:
    return sum(count_words(message.content) for message in conversation.messages)


def needs_summary(conversation: Conversation) -> bool:
    """True for a long conversation that has no summary yet."""
    return (
        conversation.summary is None
        and conversation_word_count(conversation) > CONVERSATION_SUMMARY_MIN_WORDS
    )


def is_dropped_from_prompt(conversation: Conversation, now: dt.datetime) -> bool:
    """True if a past conversation should not appear in the prompt at all.

    Empty conversations are dropped, and so are very short ones once they are old.
    """
    if len(conversation.messages) == 0:
        return True
    is_short = conversation_word_count(conversation) < SHORT_CONVERSATION_MAX_WORDS
    is_old = now - conversation.start_time > SHORT_CONVERSATION_MAX_AGE
    return is_short and is_old


def select_within_budget(
    rendered_conversations: list[str],
    reserved_words: int,
    max_words: int = MAX_PROMPT_WORDS,
) -> list[str]:
    """Keep the most recent rendered conversations that fit in the word budget.

    `rendered_conversations` is ordered oldest first. Conversations are added from
    the most recent one backwards, and the first one that does not fit ends the
    selection, so the dropped ones are always the oldest. `reserved_words` is the
    size of the rest of the prompt. The kept list keeps the original order.
    """
    budget = max_words - reserved_words
    kept: list[str] = []
    for rendered in reversed(rendered_conversations):
        words = count_words(rendered)
        if words >= budget:
            break
        kept.append(rendered)
        budget -= words
    kept.reverse()
    return kept

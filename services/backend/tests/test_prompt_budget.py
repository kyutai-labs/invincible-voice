import datetime as dt
import uuid

from backend.llm.prompt_budget import (
    CONVERSATION_SUMMARY_MIN_WORDS,
    SHORT_CONVERSATION_MAX_WORDS,
    conversation_word_count,
    count_words,
    is_dropped_from_prompt,
    needs_summary,
    select_within_budget,
)
from backend.typing import Conversation, SpeakerMessage, WriterMessage

NOW = dt.datetime(2025, 7, 9, 14, 56)


def conversation(*contents: str, days_ago: int = 0, summary: str | None = None):
    messages = [
        SpeakerMessage(speaker="Unknown speaker", content=c)
        if i % 2 == 0
        else WriterMessage(message_id=uuid.uuid4(), content=c)
        for i, c in enumerate(contents)
    ]
    return Conversation(
        messages=messages, start_time=NOW - dt.timedelta(days=days_ago), summary=summary
    )


def words(n: int) -> str:
    return " ".join(f"w{i}" for i in range(n))


def test_count_words_splits_on_any_whitespace() -> None:
    assert count_words("") == 0
    assert count_words("   ") == 0
    assert count_words("one two\tthree\nfour  five") == 5


def test_conversation_word_count_sums_all_messages() -> None:
    assert conversation_word_count(conversation("one two", "three")) == 3


def test_needs_summary_only_above_the_threshold_and_without_summary() -> None:
    assert not needs_summary(conversation(words(CONVERSATION_SUMMARY_MIN_WORDS)))
    assert needs_summary(conversation(words(CONVERSATION_SUMMARY_MIN_WORDS + 1)))
    assert not needs_summary(
        conversation(words(CONVERSATION_SUMMARY_MIN_WORDS + 1), summary="done")
    )


def test_empty_conversations_are_dropped() -> None:
    assert is_dropped_from_prompt(conversation(), NOW)


def test_short_and_old_conversations_are_dropped() -> None:
    short_old = conversation(words(SHORT_CONVERSATION_MAX_WORDS - 1), days_ago=40)
    assert is_dropped_from_prompt(short_old, NOW)


def test_short_but_recent_conversations_are_kept() -> None:
    short_recent = conversation(words(SHORT_CONVERSATION_MAX_WORDS - 1), days_ago=2)
    assert not is_dropped_from_prompt(short_recent, NOW)


def test_old_but_long_enough_conversations_are_kept() -> None:
    long_old = conversation(words(SHORT_CONVERSATION_MAX_WORDS), days_ago=40)
    assert not is_dropped_from_prompt(long_old, NOW)


def test_budget_keeps_everything_when_it_fits() -> None:
    rendered = [words(10), words(20), words(30)]
    assert select_within_budget(rendered, reserved_words=5, max_words=100) == rendered


def test_budget_drops_the_oldest_conversations_first() -> None:
    oldest, middle, newest = words(30), words(30), words(30)

    kept = select_within_budget(
        [oldest, middle, newest], reserved_words=10, max_words=80
    )

    assert kept == [middle, newest]


def test_budget_is_a_strict_upper_bound() -> None:
    # 10 reserved + 30 = 40 is not strictly under 40 words.
    assert select_within_budget([words(30)], reserved_words=10, max_words=40) == []
    assert select_within_budget([words(29)], reserved_words=10, max_words=40) == [
        words(29)
    ]


def test_budget_stops_at_the_first_conversation_that_does_not_fit() -> None:
    # A small old conversation is not squeezed in past a big one that doesn't fit.
    small_old, big, newest = words(1), words(50), words(10)

    kept = select_within_budget(
        [small_old, big, newest], reserved_words=0, max_words=30
    )

    assert kept == [newest]

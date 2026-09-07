"""Tests for the system prompt sent to the LLM.

The prompt is built by ``UserData.to_llm_ready_conversation`` and is the only
message the LLM receives, so these tests check that every section announced in
``BASE_SYSTEM_PROMPT`` is present, ordered, and filled from the user data.
"""

import datetime as dt
import re
import typing
import uuid

import pytest

from backend import openai_realtime_api_events as ora
from backend.llm.chatbot import Chatbot
from backend.llm.llm_utils import StructuredLLMResponse
from backend.llm.system_prompt import BASE_SYSTEM_PROMPT
from backend.storage import (
    LENGHT_TO_NB_WORDS,
    UserData,
    _add_to_llm_ready_conversation,
)
from backend.typing import (
    Conversation,
    Document,
    LLMMessage,
    SpeakerMessage,
    UserSettings,
    WriterMessage,
)

NOW = dt.datetime(2025, 7, 9, 14, 56)
TWO_DAYS_AGO = dt.datetime(2025, 7, 7, 14, 56)

# In the order they must appear after the base system prompt.
SECTION_HEADERS = [
    "## User's name",
    "## User's prompt",
    "## User's friends",
    "## User's documents",
    "## Past conversations with dates",
    "## Current conversation with the user",
    "## Desired responses length",
    "## User's keywords sent to you to guide your answers",
]


def make_user_data(
    *,
    name: str = "Ada",
    prompt: str = "Speak naturally.",
    friends: list[str] | None = None,
    documents: list[Document] | None = None,
    conversations: list[Conversation] | None = None,
) -> UserData:
    return UserData(
        user_id=uuid.uuid4(),
        email="user@example.com",
        hashed_password="hashed-password",
        google_sub=None,
        user_settings=UserSettings(
            name=name,
            prompt=prompt,
            additional_keywords=[],
            friends=friends or [],
            documents=documents or [],
        ),
        conversations=conversations or [],
    )


def speaker(content: str) -> SpeakerMessage:
    return SpeakerMessage(speaker="Unknown speaker", content=content)


def writer(content: str) -> WriterMessage:
    return WriterMessage(message_id=uuid.uuid4(), content=content)


def build_prompt(
    user_data: UserData,
    hint: str | None = None,
    length: ora.ResponsesLenght = "M",
) -> str:
    messages = user_data.to_llm_ready_conversation(
        user_text_hint=hint, desired_responses_length=length
    )
    assert [m.role for m in messages] == ["system"]
    return messages[0].content


def section(prompt: str, header: str) -> str:
    """Return the body of a ``## ...`` section, up to the next ``## `` header."""
    body = prompt.removeprefix(BASE_SYSTEM_PROMPT)
    assert body.count(header) == 1, f"{header!r} should appear exactly once"
    start = body.index(header) + len(header)
    next_header = re.search(r"^## ", body[start:], flags=re.MULTILINE)
    end = start + next_header.start() if next_header else len(body)
    return body[start:end]


def test_prompt_starts_with_the_base_system_prompt() -> None:
    assert build_prompt(make_user_data()).startswith(BASE_SYSTEM_PROMPT)


def test_sections_follow_the_order_announced_in_the_base_prompt() -> None:
    user_data = make_user_data(
        conversations=[
            Conversation(messages=[speaker("Hi")], start_time=TWO_DAYS_AGO),
            Conversation(messages=[speaker("Hello again")], start_time=NOW),
        ]
    )
    body = build_prompt(user_data, hint="dinner").removeprefix(BASE_SYSTEM_PROMPT)

    positions = [body.index(header) for header in SECTION_HEADERS]

    assert positions == sorted(positions)
    for header in SECTION_HEADERS:
        assert body.count(header) == 1, header


def test_user_name_prompt_and_friends_are_rendered() -> None:
    user_data = make_user_data(
        name="Ada", prompt="Keep it short.", friends=["Bob", "Carol"]
    )

    prompt = build_prompt(user_data)

    assert "The user is Ada." in section(prompt, "## User's name")
    assert "Keep it short." in section(prompt, "## User's prompt")
    friends = section(prompt, "## User's friends")
    assert "Bob" in friends
    assert "Carol" in friends


def test_documents_are_numbered_with_their_titles_and_content() -> None:
    documents = [
        Document(title="Family", content="Married to Bob."),
        Document(title="Work", content="Retired teacher."),
    ]

    prompt = build_prompt(make_user_data(documents=documents))

    documents_section = section(prompt, "## User's documents")
    assert '### Document 1 "Family"\nMarried to Bob.\n' in documents_section
    assert '### Document 2 "Work"\nRetired teacher.\n' in documents_section
    assert documents_section.index("Document 1") < documents_section.index("Document 2")


def test_documents_section_is_present_even_without_documents() -> None:
    prompt = build_prompt(make_user_data())

    assert "### Document" not in section(prompt, "## User's documents")


def test_past_conversations_intro_sentence_is_well_formed() -> None:
    prompt = build_prompt(make_user_data())

    past = section(prompt, "## Past conversations with dates")
    assert "are shown to give you context about the user" in past


def test_past_conversation_is_dated_relative_to_the_current_one() -> None:
    user_data = make_user_data(
        name="Ada",
        conversations=[
            Conversation(
                messages=[speaker("How are you?"), writer("Fine, thanks.")],
                start_time=TWO_DAYS_AGO,
            ),
            Conversation(messages=[speaker("Lunch?")], start_time=NOW),
        ],
    )

    prompt = build_prompt(user_data)

    past = section(prompt, "## Past conversations with dates")
    assert "### Conversation of Monday, July 07, 2025 at 14:56 (2 days ago)\n\n" in past
    assert "* Speaker: How are you?\n* Ada says: Fine, thanks.\n" in past
    current = section(prompt, "## Current conversation with the user")
    assert "* Speaker: Lunch?\n" in current
    assert "### Conversation of" not in current


def test_only_the_last_conversation_is_the_current_one() -> None:
    conversations = [
        Conversation(
            messages=[speaker(f"message {i}")],
            start_time=TWO_DAYS_AGO + dt.timedelta(hours=i),
        )
        for i in range(3)
    ]

    prompt = build_prompt(make_user_data(conversations=conversations))

    body = prompt.removeprefix(BASE_SYSTEM_PROMPT)
    assert body.count("### Conversation of") == 2
    assert "message 2" in section(prompt, "## Current conversation with the user")
    assert "message 2" not in section(prompt, "## Past conversations with dates")


def test_empty_past_conversations_are_skipped() -> None:
    conversations = [
        Conversation(messages=[], start_time=TWO_DAYS_AGO),
        Conversation(messages=[speaker("Hi")], start_time=NOW),
    ]

    prompt = build_prompt(make_user_data(conversations=conversations))

    assert "### Conversation of" not in prompt
    assert "* Speaker: Hi\n" in section(prompt, "## Current conversation with the user")


def test_empty_current_conversation_still_dates_past_ones_from_its_start() -> None:
    # The chatbot appends an empty conversation when a session starts.
    conversations = [
        Conversation(messages=[speaker("Hi")], start_time=TWO_DAYS_AGO),
        Conversation(messages=[], start_time=NOW),
    ]

    prompt = build_prompt(make_user_data(conversations=conversations))

    assert "## Current conversation with the user" not in prompt
    past = section(prompt, "## Past conversations with dates")
    assert "### Conversation of Monday, July 07, 2025 at 14:56 (2 days ago)" in past


def test_message_content_is_stripped() -> None:
    conversations = [
        Conversation(
            messages=[speaker("  hello  \n"), writer("\tworld ")], start_time=NOW
        )
    ]

    prompt = build_prompt(make_user_data(name="Ada", conversations=conversations))

    current = section(prompt, "## Current conversation with the user")
    assert "* Speaker: hello\n* Ada says: world\n" in current


@pytest.mark.parametrize("length", typing.get_args(ora.ResponsesLenght))
def test_desired_responses_length_bounds(length: ora.ResponsesLenght) -> None:
    min_words, max_words = LENGHT_TO_NB_WORDS[length]

    prompt = build_prompt(make_user_data(), length=length)

    expected = (
        f"Each response should be between {min_words} and {max_words} words long."
    )
    assert expected in section(prompt, "## Desired responses length")


def test_every_response_length_has_increasing_word_bounds() -> None:
    assert set(LENGHT_TO_NB_WORDS) == set(typing.get_args(ora.ResponsesLenght))
    bounds = [LENGHT_TO_NB_WORDS[size] for size in ("XS", "S", "M", "L", "XL")]
    assert all(low < high for low, high in bounds)
    assert bounds == sorted(bounds)


def test_keywords_hint_is_added_when_given() -> None:
    prompt = build_prompt(make_user_data(), hint="dinner, cinema")

    keywords = section(prompt, "## User's keywords sent to you to guide your answers")
    assert "use those concept in **all** of your responses: dinner, cinema." in keywords


def test_keywords_section_is_empty_without_hint() -> None:
    prompt = build_prompt(make_user_data())

    keywords = section(prompt, "## User's keywords sent to you to guide your answers")
    assert keywords.strip() == ""


def test_prompt_documents_the_json_keys_of_the_structured_response() -> None:
    for field in StructuredLLMResponse.model_fields:
        assert f'"{field}"' in BASE_SYSTEM_PROMPT


def test_consecutive_messages_with_the_same_role_are_merged() -> None:
    messages: list[LLMMessage] = []

    _add_to_llm_ready_conversation(messages, "system", "first")
    _add_to_llm_ready_conversation(messages, "system", "second")
    _add_to_llm_ready_conversation(messages, "user", "third")

    assert [(m.role, m.content) for m in messages] == [
        ("system", "first\nsecond"),
        ("user", "third"),
    ]


def test_chatbot_messages_reflect_live_transcript_keywords_and_length() -> None:
    chatbot = Chatbot(make_user_data(name="Ada"), start_time=NOW)
    chatbot.add_chat_message_delta("How", "user")
    chatbot.add_chat_message_delta("are you?", "user")
    chatbot.current_keywords = "tired"
    chatbot.desired_responses_length = "XS"

    messages = chatbot.preprocessed_messages()

    assert len(messages) == 1
    assert messages[0]["role"] == "system"
    prompt = messages[0]["content"]
    current = section(prompt, "## Current conversation with the user")
    assert "* Speaker: How are you?\n" in current
    assert "Each response should be between 1 and 5 words long." in prompt
    assert "use those concept in **all** of your responses: tired." in prompt


def test_chatbot_selected_response_is_attributed_to_the_user() -> None:
    chatbot = Chatbot(make_user_data(name="Ada"), start_time=NOW)
    chatbot.add_chat_message_delta("How are you?", "user")
    chatbot.select_response("I am tired.", uuid.uuid4())

    prompt = chatbot.preprocessed_messages()[0]["content"]

    current = section(prompt, "## Current conversation with the user")
    assert "* Speaker: How are you?\n* Ada says: I am tired.\n" in current

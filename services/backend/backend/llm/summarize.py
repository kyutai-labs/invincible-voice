"""LLM-written summaries of long texts and long conversations."""

import logging
from typing import TYPE_CHECKING

from openai import AsyncOpenAI

from backend.kyutai_constants import LLM_MODEL
from backend.llm.llm_utils import get_openai_client
from backend.llm.prompt_budget import CONVERSATION_SUMMARY_TARGET_WORDS, needs_summary
from backend.typing import Conversation, SpeakerMessage

if TYPE_CHECKING:
    from backend.storage import UserData

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM_PROMPT = """\
You summarize texts for the assistant of a person suffering from ALS (Amyotrophic \
Lateral Sclerosis). The text can be a description of the person, a document they \
wrote, or the transcript of a conversation they had.

Write a summary of the text given by the user, in the same language as the text.
The summary must be about {target_words} words long, whatever the length of the \
original text: a very long text still gets a summary of about {target_words} words.
Keep the facts that help understand the person later: names, relationships, places, \
dates, habits, preferences and decisions.
Write plain prose without headers, bullet points, or any introduction such as \
"Here is a summary".
"""


async def summarize_text(
    text: str, target_words: int, client: AsyncOpenAI | None = None
) -> str:
    """Ask the LLM for a summary of `text` of about `target_words` words."""
    if client is None:
        client = get_openai_client()
    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": SUMMARY_SYSTEM_PROMPT.format(target_words=target_words),
            },
            {"role": "user", "content": text},
        ],
        temperature=0.2,
    )
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise RuntimeError("The LLM returned an empty summary")
    return content.strip()


def conversation_transcript(conversation: Conversation, user_name: str) -> str:
    """The conversation as a transcript, one line per message."""
    lines = []
    for message in conversation.messages:
        if isinstance(message, SpeakerMessage):
            lines.append(f"Speaker: {message.content.strip()}")
        else:
            lines.append(f"{user_name}: {message.content.strip()}")
    return "\n".join(lines)


async def summarize_conversation(
    conversation: Conversation, user_name: str, client: AsyncOpenAI | None = None
) -> str:
    return await summarize_text(
        conversation_transcript(conversation, user_name),
        CONVERSATION_SUMMARY_TARGET_WORDS,
        client,
    )


async def summarize_long_conversations(
    user_data: "UserData", client: AsyncOpenAI | None = None
) -> int:
    """Write a summary for every past conversation that needs one, then save.

    The current conversation (the last one) is never summarized. A failed summary
    is logged and retried at the next session. Returns the number of summaries
    written.
    """
    written = 0
    for conversation in user_data.conversations[:-1]:
        if not needs_summary(conversation):
            continue
        try:
            conversation.summary = await summarize_conversation(
                conversation, user_data.user_settings.name, client
            )
        except Exception:
            logger.exception(
                "Failed to summarize a conversation, it will be retried next session"
            )
            continue
        written += 1
    if written:
        logger.info(f"Summarized {written} long conversation(s)")
        user_data.save()
    return written

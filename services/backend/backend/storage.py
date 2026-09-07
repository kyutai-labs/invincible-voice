import datetime as dt
import logging
import uuid
from typing import Literal

import humanize
import pydantic
from cloudpathlib import AnyPath

from backend import kyutai_constants
from backend import openai_realtime_api_events as ora
from backend.llm.prompt_budget import (
    MAX_PROMPT_WORDS,
    count_words,
    is_dropped_from_prompt,
    select_within_budget,
)
from backend.llm.system_prompt import BASE_SYSTEM_PROMPT
from backend.typing import Conversation, LLMMessage, SpeakerMessage, UserSettings

logger = logging.getLogger(__name__)


LENGHT_TO_NB_WORDS = {
    "XS": (1, 5),
    "S": (3, 10),
    "M": (5, 15),
    "L": (8, 20),
    "XL": (12, 25),
}


class UserData(pydantic.BaseModel):
    user_id: uuid.UUID
    email: str
    hashed_password: str
    google_sub: str | None

    user_settings: UserSettings
    conversations: list[Conversation]

    def save(self) -> None:
        """Write the user data to storage, leaving out empty conversations.

        A conversation is created as soon as a session starts, so a user who
        connects without saying anything would otherwise fill the file with
        empty conversations. Only the written copy is filtered: the in-memory
        list is untouched so that a live session keeps appending to its own
        (still empty) current conversation.
        """
        to_save = self.model_copy(
            update={
                "conversations": [
                    conversation
                    for conversation in self.conversations
                    if conversation.messages
                ]
            }
        )
        user_data_path = get_user_data_path(self.email)
        user_data_path.parent.mkdir(parents=True, exist_ok=True)
        with user_data_path.open("w") as f:
            f.write(to_save.model_dump_json(indent=4))
        logger.info(f"User data saved to {user_data_path}")

    def to_llm_ready_conversation(
        self, user_text_hint: str | None, desired_responses_length: ora.ResponsesLenght
    ) -> list[LLMMessage]:
        result = []

        prompt = BASE_SYSTEM_PROMPT + "\n"
        prompt += "\n"
        prompt += "## User's name\n"
        prompt += f"The user is {self.user_settings.name}.\n\n"
        prompt += "## User's prompt\n"
        prompt += self.user_settings.prompt + "\n\n"
        prompt += "## User's friends\n"
        prompt += f"The friends of the user are: {self.user_settings.friends}\n\n"
        prompt += "## User's documents\n"
        prompt += "The documents are here to get a better understanding of the user\n\n"
        for i, document in enumerate(self.user_settings.documents):
            prompt += f'### Document {i + 1} "{document.title}"\n'
            prompt += f"{document.content}\n\n"
        prompt += "## Past conversations with dates\n"
        prompt += "The conversations here were done with the software, and are shown to give you "
        prompt += "context about the user\n\n"

        # The last conversation is the current one, everything before it is history.
        current_conversation = self.conversations[-1] if self.conversations else None
        rendered_past: list[str] = []
        if current_conversation is not None:
            now = current_conversation.start_time
            rendered_past = [
                self._render_past_conversation(conversation, now)
                for conversation in self.conversations[:-1]
                if not is_dropped_from_prompt(conversation, now)
            ]

        current_text = ""
        if current_conversation is not None and current_conversation.messages:
            current_text += "## Current conversation with the user\n\n"
            current_text += self._render_messages(current_conversation)

        tail = "## Desired responses length\n"
        min_nb_words, max_nb_words = LENGHT_TO_NB_WORDS[desired_responses_length]
        tail += f"Each response should be between {min_nb_words} and {max_nb_words} words long.\n\n"
        tail += "## User's keywords sent to you to guide your answers\n\n"
        if user_text_hint is not None:
            # Add the current keywords to the last user message
            tail += "The user chose the following keywords to guide the answers, "
            tail += f"use those concept in **all** of your responses: {user_text_hint}."

        # Drop the oldest conversations if needed to stay under MAX_PROMPT_WORDS.
        reserved_words = (
            count_words(prompt) + count_words(current_text) + count_words(tail)
        )
        kept_past = select_within_budget(rendered_past, reserved_words)
        if len(kept_past) < len(rendered_past):
            logger.info(
                f"Dropped {len(rendered_past) - len(kept_past)} oldest conversations "
                f"to keep the prompt under {MAX_PROMPT_WORDS} words"
            )

        prompt += "".join(kept_past) + current_text + tail
        _add_to_llm_ready_conversation(result, "system", prompt)
        return result

    def _render_messages(self, conversation: Conversation) -> str:
        text = ""
        for message in conversation.messages:
            if isinstance(message, SpeakerMessage):
                text += f"* Speaker: {message.content.strip()}\n"
            else:
                text += f"* {self.user_settings.name} says: {message.content.strip()}\n"
        return text

    def _render_past_conversation(
        self, conversation: Conversation, now: dt.datetime
    ) -> str:
        readable_datetime = conversation.start_time.strftime(
            "%A, %B %d, %Y at %H:%M"  # Monday, July 07, 2025 at 14:56
        )
        readable_delta = humanize.naturaldelta(now - conversation.start_time)
        text = f"### Conversation of {readable_datetime} ({readable_delta} ago)\n\n"
        if conversation.summary is not None:
            text += f"Summary of the conversation: {conversation.summary.strip()}\n"
        else:
            text += self._render_messages(conversation)
        return text + "\n"


def _add_to_llm_ready_conversation(
    llm_ready_conversation: list[LLMMessage],
    role: Literal["user", "assistant", "system"],
    content: str,
) -> None:
    if len(llm_ready_conversation) == 0 or llm_ready_conversation[-1].role != role:
        llm_ready_conversation.append(LLMMessage(role=role, content=content))
    else:
        llm_ready_conversation[-1].content += f"\n{content}"


def get_user_data_path(email: str) -> AnyPath:
    return kyutai_constants.USERS_SETTINGS_AND_HISTORY_DIR / f"{email}.json"


class UserDataNotFoundError(Exception):
    pass


def get_user_data_from_storage(user_email: str) -> UserData:
    user_data_path = get_user_data_path(user_email)
    if not user_data_path.exists():
        raise UserDataNotFoundError(f"No user data found for email: {user_email}")
    else:
        return UserData.model_validate_json(user_data_path.read_text())

import logging
import uuid
from pathlib import Path
from typing import Literal

import humanize
import pydantic

from backend import kyutai_constants
from backend import openai_realtime_api_events as ora
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
        user_data_path = get_user_data_path(self.email)
        user_data_path.parent.mkdir(parents=True, exist_ok=True)
        with user_data_path.open("w") as f:
            f.write(self.model_dump_json(indent=4))
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
            prompt += "{document.content}\n\n"
        prompt += "## Past conversations with dates\n"
        prompt += "The conversations here were done with the software, and are shown to give you"
        prompt += "context about the user\n\n"

        for conversation in self.conversations:
            if len(conversation.messages) == 0:
                continue
            readable_datetime = conversation.start_time.strftime(
                "%A, %B %d, %Y at %H:%M"  # Monday, July 07, 2025 at 14:56
            )
            if conversation is self.conversations[-1]:
                prompt += "## Current conversation with the user\n\n"
            else:
                delta = self.conversations[-1].start_time - conversation.start_time
                readable_delta = f"({humanize.naturaldelta(delta)} ago)"
                prompt += (
                    f"### Conversation of {readable_datetime} {readable_delta}\n\n"
                )

            for message in conversation.messages:
                if isinstance(message, SpeakerMessage):
                    prompt += f"* Speaker: {message.content.strip()}\n"
                else:
                    prompt += (
                        f"* {self.user_settings.name} says: {message.content.strip()}\n"
                    )

        prompt += "## Desired responses length\n"

        min_nb_words, max_nb_words = LENGHT_TO_NB_WORDS[desired_responses_length]
        prompt += f"Each response should be between {min_nb_words} and {max_nb_words} words long.\n\n"
        prompt += "## User's keywords sent to you to guide your answers\n\n"
        if user_text_hint is not None:
            # Add the current keywords to the last user message
            prompt += "The user chose the following keywords to guide the answers, "
            prompt += (
                f"use those concept in **all** of your responses: {user_text_hint}."
            )

        _add_to_llm_ready_conversation(result, "system", prompt)
        return result


def _add_to_llm_ready_conversation(
    llm_ready_conversation: list[LLMMessage],
    role: Literal["user", "assistant", "system"],
    content: str,
) -> None:
    if len(llm_ready_conversation) == 0 or llm_ready_conversation[-1].role != role:
        llm_ready_conversation.append(LLMMessage(role=role, content=content))
    else:
        llm_ready_conversation[-1].content += f"\n{content}"


def get_user_data_path(email: str) -> Path:
    return kyutai_constants.USERS_SETTINGS_AND_HISTORY_DIR / f"{email}.json"


class UserDataNotFoundError(Exception):
    pass


def get_user_data_from_storage(user_email: str) -> UserData:
    user_data_path = get_user_data_path(user_email)
    if not user_data_path.exists():
        raise UserDataNotFoundError(f"No user data found for email: {user_email}")
    else:
        return UserData.model_validate_json(user_data_path.read_text())

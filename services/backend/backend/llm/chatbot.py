import datetime as dt
import uuid
from logging import getLogger
from typing import Literal

from backend.storage import UserData
from backend.typing import Conversation, SpeakerMessage, WriterMessage

ConversationState = Literal["waiting_for_user", "user_speaking", "bot_speaking"]

logger = getLogger(__name__)


class Chatbot:
    def __init__(self, user_data: UserData, start_time: dt.datetime):
        # It's actually a list of ChatCompletionStreamRequestMessagesTypedDict but then
        # it's really difficult to convince Python you're passing in the right type
        self.conversation_state_override: ConversationState | None = None
        # Text to guide the answers of the LLM
        self.current_keywords: str | None = None
        self.user_data = user_data
        # We start a new conversation in the user data
        # Note that the system prompt is not there, it's set dynamically
        # The user_data is just a reflection of what we see in the UI
        self.user_data.conversations.append(
            Conversation(messages=[], start_time=start_time)
        )
        self.desired_responses_length: Literal["XS", "S", "M", "L", "XL"] = "M"

    def proxy_hash(self) -> int:
        # to quickly compare if the chatbot state changed
        return hash(
            (
                self.current_keywords,
                len(self.user_data.conversations[-1].messages),
                self.user_data.conversations[-1].messages[-1].content,
                self.desired_responses_length,
            )
        )

    @property
    def current_conversation(self) -> list[SpeakerMessage | WriterMessage]:
        return self.user_data.conversations[-1].messages

    @property
    def last_message(self) -> SpeakerMessage | WriterMessage:
        return self.current_conversation[-1]

    def conversation_state(self) -> ConversationState:
        if self.conversation_state_override is not None:
            return self.conversation_state_override
        if len(self.current_conversation) == 0:
            return "waiting_for_user"

        if isinstance(self.last_message, WriterMessage):
            return "bot_speaking"
        else:
            if self.last_message.content.strip() != "":
                return "user_speaking"
            else:
                # Or do we want "user_speaking" here?
                return "waiting_for_user"

    def add_chat_message_delta(
        self,
        delta: str,
        role: Literal["user", "assistant"],
        generating_message_i: int | None = None,  # Avoid race conditions
    ) -> bool:
        """Add a partial message to the chat history, adding spaces if necessary.

        Returns:
            True if the message is a new message, False if it is a continuation of
            the last message.
        """
        if (
            generating_message_i is not None
            and len(self.current_conversation) > generating_message_i
        ):
            logger.warning(
                f"Tried to add {delta=} {role=} "
                f"but {generating_message_i=} didn't match"
            )
            return False

        if (
            role == "user"
            and self.current_conversation
            and isinstance(self.last_message, SpeakerMessage)
        ):
            # The only case where we need to fuse, otherwise the history will be displayed
            # in a strange way since we get those word by word
            needs_space = not self.last_message.content.startswith(
                " "
            ) and not delta.startswith(" ")
            if needs_space:
                delta = " " + delta
            self.current_conversation[-1].content += delta
            return False

        if role == "assistant":
            self.current_conversation.append(
                WriterMessage(
                    message_id=uuid.uuid4(),
                    content=delta,
                )
            )
        else:
            # If the last message was from the user, we need to fuse the messages
            # Otherwise we add a new message
            self.current_conversation.append(
                SpeakerMessage(
                    speaker="Unknown speaker",
                    content=delta,
                )
            )
        return True

    def preprocessed_messages(self):
        """Returns the chat history, properly formatted to be sent to the LLM. Hints are not supported yet."""
        logger.info(f"Length of chat history {len(self.current_conversation)}")

        result = self.user_data.to_llm_ready_conversation(
            self.current_keywords, self.desired_responses_length
        )
        messages = [x.model_dump(mode="json") for x in result]

        return messages

    def select_response(self, text: str, id_: uuid.UUID):
        self.current_conversation.append(
            WriterMessage(
                message_id=id_,
                content=text,
            )
        )

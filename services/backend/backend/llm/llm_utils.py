import asyncio
import logging
from typing import Any, AsyncIterator, cast

import openai
import pydantic
from openai import AsyncOpenAI, AsyncStream
from openai.types.chat.chat_completion_chunk import ChatCompletionChunk

from backend.kyutai_constants import (
    LLM_API_KEY,
    LLM_MODEL,
    LLM_URL,
)

logger = logging.getLogger(__name__)


def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=LLM_API_KEY, base_url=LLM_URL)


class StructuredLLMResponse(pydantic.BaseModel):
    suggested_keywords: list[str]
    suggested_answers: list[str]


class VLLMStream:
    def __init__(
        self,
        client: AsyncOpenAI,
        temperature: float = 1.0,
    ):
        """
        If `model` is None, it will look at the available models, and if there is only
        one model, it will use that one. Otherwise, it will raise.
        """
        self.client = client
        self.model = LLM_MODEL
        self.temperature = temperature

    async def get_stream(
        self, messages: list[dict[str, str]]
    ) -> AsyncStream[ChatCompletionChunk]:
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "response_suggestion",
                "strict": True,
                "schema": StructuredLLMResponse.model_json_schema(),
            },
        }
        logger.info(f"Start text stream from {LLM_URL} with model {self.model}")

        return await self.client.chat.completions.create(
            model=self.model,
            messages=cast(Any, messages),  # Cast and hope for the best
            stream=True,
            temperature=self.temperature,
            response_format=response_format,  # type: ignore
        )

    async def chat_completion(
        self, messages: list[dict[str, str]]
    ) -> AsyncIterator[str]:
        for retry_time in (1, 2, 4, 8):
            try:
                stream = await self.get_stream(messages)
                break
            except openai.RateLimitError as e:
                logger.warning(
                    f"Rate limit error when calling LLM, retrying in {retry_time}s. Error: {e}"
                )
                await asyncio.sleep(retry_time)
        else:
            raise RuntimeError(
                "Failed to get response from LLM after multiple retries, see error above."
            )

        async with stream:
            async for chunk in stream:
                chunk_content = chunk.choices[0].delta.content
                if chunk_content is None:
                    continue
                assert isinstance(chunk_content, str)
                yield chunk_content

import asyncio
import logging

from cloudpathlib import AnyPath

from backend import metrics as mt
from backend.storage import UserData

logger = logging.getLogger(__name__)

STORAGE_METRIC_POLL_INTERVAL_SECONDS = 180


def _collect_storage_metrics_sync(storage_dir: AnyPath) -> dict:
    try:
        json_files = list(storage_dir.glob("*.json"))
        total_accounts = len(json_files)
        total_conversations = 0

        conversations_per_account = []
        messages_per_conversation = []

        for json_file in json_files:
            try:
                user_data = UserData.model_validate_json(json_file.read_text())
                conversations_count = len(user_data.conversations)

                total_conversations += conversations_count
                conversations_per_account.append(conversations_count)

                for conversation in user_data.conversations:
                    messages_count = len(conversation.messages)
                    messages_per_conversation.append(messages_count)
            except Exception as e:
                logger.warning(
                    f"Failed to process user data file {json_file}: {e}",
                    exc_info=False,
                )
                continue

        return {
            "total_accounts": total_accounts,
            "total_conversations": total_conversations,
            "conversations_per_account": conversations_per_account,
            "messages_per_conversation": messages_per_conversation,
        }
    except Exception as e:
        logger.error(f"Error during storage metrics collection: {e}", exc_info=True)
        raise


async def update_storage_metrics(storage_dir: AnyPath):
    while True:
        try:
            # Run the blocking sync function in a thread pool
            metrics_data = await asyncio.to_thread(
                _collect_storage_metrics_sync, storage_dir
            )

            mt.STORAGE_ACCOUNTS.set(metrics_data["total_accounts"])
            mt.STORAGE_CONVERSATIONS.set(metrics_data["total_conversations"])

            for count in metrics_data["conversations_per_account"]:
                mt.STORAGE_CONVERSATIONS_PER_ACCOUNT.observe(count)

            for count in metrics_data["messages_per_conversation"]:
                mt.STORAGE_MESSAGES_PER_CONVERSATION.observe(count)

            logger.debug(
                f"Updated storage metrics - Accounts: {metrics_data['total_accounts']}, "
                f"Conversations: {metrics_data['total_conversations']}"
            )
        except Exception as e:
            logger.error(f"Failed to update storage metrics: {e}", exc_info=True)

        await asyncio.sleep(STORAGE_METRIC_POLL_INTERVAL_SECONDS)


class StorageMetricsBackgroundTask:
    def __init__(self, storage_dir: AnyPath):
        self.storage_dir = storage_dir
        self._task: asyncio.Task | None = None

    async def start(self):
        """Start the background task."""
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(update_storage_metrics(self.storage_dir))
            logger.info("Storage metrics background task started")

    async def stop(self):
        """Stop the background task."""
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                logger.info("Storage metrics background task cancelled")
            logger.info("Storage metrics background task stopped")

import asyncio
import logging

from cloudpathlib import AnyPath

from backend import metrics as mt
from backend.storage import UserData

logger = logging.getLogger(__name__)

STORAGE_METRIC_POLL_INTERVAL_SECONDS = 120


async def update_storage_metrics(storage_dir: AnyPath):
    """Background task that scans storage and updates storage-related metrics."""
    logger.info("Starting storage metrics collection")

    while True:
        try:
            await _collect_storage_metrics(storage_dir)
        except Exception as e:
            logger.error(f"Failed to update storage metrics: {e}", exc_info=True)

        await asyncio.sleep(STORAGE_METRIC_POLL_INTERVAL_SECONDS)


async def _collect_storage_metrics(storage_dir: AnyPath) -> None:
    """Collect and update all storage metrics."""
    try:
        json_files = list(storage_dir.glob("*.json"))
        total_accounts = len(json_files)
        total_conversations = 0

        for json_file in json_files:
            try:
                user_data = UserData.model_validate_json(json_file.read_text())
                conversations_count = len(user_data.conversations)

                total_conversations += conversations_count

                mt.STORAGE_CONVERSATIONS_PER_ACCOUNT.observe(conversations_count)

                for conversation in user_data.conversations:
                    messages_count = len(conversation.messages)
                    mt.STORAGE_MESSAGES_PER_CONVERSATION.observe(messages_count)
            except Exception as e:
                logger.warning(
                    f"Failed to process user data file {json_file}: {e}",
                    exc_info=False,
                )
                continue

        # Update gauge metrics
        mt.STORAGE_ACCOUNTS.set(total_accounts)
        mt.STORAGE_CONVERSATIONS.set(total_conversations)

        logger.debug(
            f"Updated storage metrics - Accounts: {total_accounts}, "
            f"Conversations: {total_conversations}"
        )
    except Exception as e:
        logger.error(f"Error during storage metrics collection: {e}", exc_info=True)


class StorageMetricsBackgroundTask:
    """Manages the lifecycle of the storage metrics background task."""

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

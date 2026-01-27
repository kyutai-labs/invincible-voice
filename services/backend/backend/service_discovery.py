"""Service discovery for the TTS, ASR, VLLM etc. Based on Redis."""

import asyncio
import logging
import random
import socket
import time
import typing as tp
from collections import defaultdict
from collections.abc import Awaitable
from functools import partial, wraps

from backend import metrics as mt
from backend.exceptions import MissingServiceAtCapacity, MissingServiceTimeout
from backend.kyutai_constants import STT_SERVER, LLM_URL
from backend.timer import Stopwatch

logger = logging.getLogger(__name__)

# Always use Gradium STT
SERVICES = {
    "stt": (STT_SERVER, False),
    "llm": (LLM_URL, True),
}
K = tp.TypeVar("K", bound=tp.Hashable)
V = tp.TypeVar("V")
S = tp.TypeVar("S", bound="ServiceWithStartup")


def async_ttl_cached(func: tp.Callable[[K], Awaitable[V]], ttl_sec: float = 0.1):
    """Cache an async function with some TTL for the cached values."""
    cache: dict[K, tuple[float, V]] = {}
    locks: dict[K, asyncio.Lock] = defaultdict(asyncio.Lock)

    @wraps(func)
    async def cached(key: K):
        async with locks[key]:
            now = time.time()
            try:
                key_time, value = cache[key]
            except KeyError:
                pass
            else:
                if now - key_time < ttl_sec:
                    return value
            value = await func(key)
            cache[key] = (now, value)
            return value

    return cached


@partial(async_ttl_cached, ttl_sec=0.5)
async def _resolve(hostname: str) -> list[str]:
    logger.info(f"Resolving {hostname}...")
    *_, ipaddrlist = await asyncio.to_thread(socket.gethostbyname_ex, hostname)
    return ipaddrlist


async def get_instances(service_name: str) -> list[str]:
    url, is_internal = SERVICES[service_name]
    if not is_internal:
        return [url]
    protocol, remaining = url.split("://", 1)
    hostname, port = remaining.split(":", 1)
    ips = list(await _resolve(hostname))
    random.shuffle(ips)
    return [f"{protocol}://{ip}:{port}" for ip in ips]


class ServiceWithStartup(tp.Protocol):
    async def start_up(self) -> None:
        """Initiate connection. Should raise an exception if the instance is not ready."""
        ...


async def find_instance(
    service_name: str,
    client_factory: tp.Callable[[str], S],
    timeout_sec: float = 0.5,
    max_trials: int = 3,
) -> S:
    stopwatch = Stopwatch()
    instances = await get_instances(service_name)
    max_trials = min(len(instances), max_trials)
    for instance in instances:
        client = client_factory(instance)
        logger.debug(f"[{service_name}]Trying to connect to {instance}")
        pingwatch = Stopwatch()
        try:
            async with asyncio.timeout(timeout_sec):
                await client.start_up()
        except Exception as exc:
            max_trials -= 1
            if isinstance(exc, MissingServiceAtCapacity):
                elapsed = pingwatch.time()
                logger.info(
                    f"[{service_name}] Instance {instance} took {elapsed * 1000:.1f}ms to reject us."
                )
                if service_name == "stt":
                    mt.STT_PING_TIME.observe(elapsed)
            else:
                mt.HARD_SERVICE_MISSES.inc()
                if service_name == "stt":
                    mt.STT_HARD_MISSES.inc()
                if isinstance(exc, TimeoutError):
                    logger.warning(
                        f"[{service_name}] Instance {instance} did not reply in time."
                    )
                else:
                    logger.error(
                        f"[{service_name}] Unexpected error connecting to {instance}: {exc}."
                    )
            if max_trials > 0:
                continue
            else:
                mt.SERVICE_MISSES.inc()
                if service_name == "stt":
                    mt.STT_MISSES.inc()
                if isinstance(exc, MissingServiceAtCapacity):
                    raise
                else:
                    if isinstance(exc, TimeoutError):
                        raise MissingServiceTimeout(service_name) from exc
                    else:
                        raise  # Let internal errors propagate
        elapsed = pingwatch.time()
        logger.info(
            f"[{service_name}] Instance {instance} took {elapsed * 1000:.1f}ms to accept us."
        )

        if service_name == "stt":
            mt.STT_PING_TIME.observe(elapsed)
        elapsed = stopwatch.time()
        if service_name == "stt":
            mt.STT_FIND_TIME.observe(elapsed)
        logger.info(
            f"[{service_name}] Connection to {instance} took {1000 * elapsed:.1f}ms."
        )
        return client
    raise AssertionError("Should not be reached.")

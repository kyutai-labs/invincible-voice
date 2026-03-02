from prometheus_client import Counter, Gauge, Histogram, Summary

SESSION_DURATION_BINS = [1.0, 10.0, 30.0, 60.0, 120.0, 240.0, 480.0, 960.0, 1920.0]
GENERATION_DURATION_BINS = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0]

# Time to first token.
TTFT_BINS_STT_MS = [
    10.0,
    15.0,
    25.0,
    50.0,
    75.0,
    100.0,
]
TTFT_BINS_STT = [x / 1000 for x in TTFT_BINS_STT_MS]

NUM_WORDS_REQUEST_BINS = [
    50.0,
    100.0,
    200.0,
    500.0,
    1000.0,
    2000.0,
    4000.0,
    6000.0,
    8000.0,
]
NUM_WORDS_STT_BINS = [0.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0, 4000.0]
NUM_WORDS_REPLY_BINS = [5.0, 10.0, 25.0, 50.0, 100.0, 200.0]

SESSIONS = Counter("worker_sessions", "")
FORCE_DISCONNECTS = Counter("worker_force_disconnects", "")
FATAL_SERVICE_MISSES = Counter("worker_fatal_service_misses", "")
HARD_ERRORS = Counter("worker_hard_errors", "")
ACTIVE_SESSIONS = Gauge("worker_active_sessions", "")
SESSION_DURATION = Histogram(
    "worker_session_duration", "", buckets=SESSION_DURATION_BINS
)
HEALTH_OK = Summary("worker_health_ok", "")

STT_ACTIVE_SESSIONS = Gauge("worker_stt_active_sessions", "")
STT_SENT_FRAMES = Counter("worker_stt_sent_frames", "")
STT_RECV_FRAMES = Counter("worker_stt_recv_frames", "")
STT_RECV_WORDS = Counter("worker_stt_recv_words", "")
STT_SESSION_DURATION = Histogram(
    "worker_stt_session_duration", "", buckets=SESSION_DURATION_BINS
)
STT_AUDIO_DURATION = Histogram(
    "worker_stt_audio_duration", "", buckets=SESSION_DURATION_BINS
)
STT_NUM_WORDS = Histogram("worker_stt_num_words", "", buckets=NUM_WORDS_STT_BINS)
STT_TTFT = Histogram("worker_stt_ttft", "", buckets=TTFT_BINS_STT)

VLLM_ACTIVE_SESSIONS = Gauge("worker_vllm_active_sessions", "")
VLLM_INTERRUPTS = Counter("worker_vllm_interrupt", "")
VLLM_HARD_ERRORS = Counter("worker_vllm_hard_errors", "")
VLLM_SENT_WORDS = Counter("worker_vllm_sent_words", "")
VLLM_RECV_WORDS = Counter("worker_vllm_recv_words", "")
VLLM_REQUEST_LENGTH = Histogram(
    "worker_vllm_request_length", "", buckets=NUM_WORDS_REQUEST_BINS
)
VLLM_REPLY_LENGTH = Histogram(
    "worker_vllm_reply_length", "", buckets=NUM_WORDS_REPLY_BINS
)
VLLM_GEN_DURATION = Histogram(
    "worker_vllm_gen_duration", "", buckets=GENERATION_DURATION_BINS
)

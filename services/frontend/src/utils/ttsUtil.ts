import { addAuthHeaders } from '../auth/authUtils';
import { ttsCache, CacheType } from './ttsCache';

export interface TTSOptions {
  text: string;
  cacheType?: CacheType;
  messageId: string;
  voiceName?: string;
}

/**
 * Plays TTS audio progressively using streaming
 * @param options - TTS options including text, cacheType
 */
export async function playTTSStream(
  options: TTSOptions,
): Promise<AudioContext> {
  /* Fetch sample rate from backend */
  const SAMPLE_RATE = await fetch('/api/v1/tts/sample_rate').then((res) =>
    res.json().then((data) => data.sample_rate),
  );
  const { text, messageId, cacheType = 'temporary', voiceName } = options;
  const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

  // Use voiceName as part of cache key so different voices have separate entries
  const cacheKey = voiceName ? `${text}|${voiceName}` : text;
  if (ttsCache.get(cacheKey)) {
    const fullAudio = ttsCache.get(cacheKey)!;
    const audioBuffer = audioContext.createBuffer(
      1,
      fullAudio?.length,
      SAMPLE_RATE,
    );
    audioBuffer.copyToChannel(fullAudio, 0);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    return audioContext;
  }

  let nextStartTime = 0;
  let isFirstChunk = true;

  const requestBody: {
    text: string;
    message_id: string;
    voice_name?: string;
  } = { text, message_id: messageId };
  if (options.voiceName) {
    requestBody.voice_name = options.voiceName;
  }

  const response = await fetch(`/api/v1/tts/`, {
    method: 'POST',
    headers: addAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok || !response.body) {
    throw new Error('TTS streaming failed');
  }

  const reader = response.body.getReader();
  const audioChunks: Float32Array[] = [];
  const processChunks = async () => {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      const pcmArrayBuffer = value.buffer;
      const numberOfFrames = pcmArrayBuffer.byteLength / 2;
      const audioBuffer = audioContext.createBuffer(
        1,
        numberOfFrames,
        SAMPLE_RATE,
      );
      const pcmInt16View = new Int16Array(pcmArrayBuffer);
      const pcmFloat32Data = new Float32Array(numberOfFrames);

      for (let i = 0; i < numberOfFrames; i += 1) {
        pcmFloat32Data[i] = pcmInt16View[i] / 32768.0;
      }

      audioBuffer.copyToChannel(pcmFloat32Data, 0);
      audioChunks.push(pcmFloat32Data);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      if (isFirstChunk) {
        // Start immediately (with a tiny buffer to avoid underrun)
        nextStartTime = audioContext.currentTime + 0.01;
        isFirstChunk = false;
      }

      source.start(nextStartTime);
      nextStartTime += audioBuffer.duration;
    }
  };

  await processChunks();

  let fullMessageLength = 0;
  for (let i = 0; i < audioChunks.length; i += 1) {
    fullMessageLength += audioChunks[i].length;
  }
  let index = 0;
  const fullMessageBuffer = new Float32Array(fullMessageLength);
  for (let i = 0; i < audioChunks.length; i += 1) {
    for (let j = 0; j < audioChunks[i].length; j += 1) {
      fullMessageBuffer[index] = audioChunks[i][j];
      index += 1;
    }
  }
  ttsCache.set(cacheKey, fullMessageBuffer, cacheType);

  return audioContext;
}

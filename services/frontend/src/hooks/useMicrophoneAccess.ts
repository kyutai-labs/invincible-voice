import { useState, useCallback, useRef } from 'react';

type MicrophoneAccessType = 'unknown' | 'granted' | 'refused';

export const useMicrophoneAccess = () => {
  const [microphoneAccess, setMicrophoneAccess] =
    useState<MicrophoneAccessType>('unknown');
  const mediaStream = useRef<MediaStream | null>(null);

  const askMicrophoneAccess = useCallback(async () => {
    try {
      if (!window.isSecureContext || !window.navigator.mediaDevices) {
        throw new Error(
          'Microphone access requires a secure connection (HTTPS). Please access this app via HTTPS or localhost.',
        );
      }
      mediaStream.current = await window.navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setMicrophoneAccess('granted');
      return mediaStream.current;
    } catch (e) {
      console.error(e);
      setMicrophoneAccess('refused');
      return null;
    }
  }, []);

  return {
    microphoneAccess,
    askMicrophoneAccess,
    mediaStream,
  };
};

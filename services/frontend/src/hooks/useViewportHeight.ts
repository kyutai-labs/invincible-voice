'use client';

import { useState, useEffect } from 'react';

interface ViewportHeight {
  /** Stable measured height: window.innerHeight at mount time (avoids iOS 100vh bug) */
  vh: number;
  /** Visual viewport height: shrinks when virtual keyboard is open */
  visualVh: number;
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/**
 * Returns stable viewport height measurements for iOS-safe layout.
 *
 * `vh`: Set once on mount via window.innerHeight. Use as the total container
 *   height instead of 100vh / h-screen. On iOS Safari, window.innerHeight
 *   at mount is the visible area; 100vh overshoots by the browser chrome height.
 *   Updated after orientation changes via a 400ms debounce to avoid layout flicker.
 *
 * `visualVh`: Tracks window.visualViewport.height, which shrinks when the
 *   virtual keyboard opens. Use to calculate scroll compensation for chat/input:
 *   keyboardHeight = vh - visualVh (positive when keyboard is open).
 *   This listener is NOT debounced — keyboard compensation must remain immediate.
 */
export const useViewportHeight = (): ViewportHeight => {
  const [vh, setVh] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  const [visualVh, setVisualVh] = useState<number>(
    typeof window !== 'undefined'
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 0,
  );

  useEffect(() => {
    // Set stable height once on mount (iOS: innerHeight before toolbar hides)
    setVh(window.innerHeight);
    setVisualVh(window.visualViewport?.height ?? window.innerHeight);

    // Debounced at 400ms — orientation changes fire many resize events in quick
    // succession; debouncing prevents layout flicker and redundant re-renders.
    const debouncedResize = debounce(() => {
      setVh(window.innerHeight);
    }, 400);

    const onVisualViewportResize = () => {
      setVisualVh(window.visualViewport?.height ?? window.innerHeight);
    };

    window.addEventListener('resize', debouncedResize);
    // Both 'resize' and 'orientationchange' are registered: browsers differ in
    // which event they fire (iOS Safari fires both; Android Chrome fires resize).
    window.addEventListener('orientationchange', debouncedResize);
    window.visualViewport?.addEventListener('resize', onVisualViewportResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', debouncedResize);
      window.visualViewport?.removeEventListener(
        'resize',
        onVisualViewportResize,
      );
    };
  }, []);

  return { vh, visualVh };
};

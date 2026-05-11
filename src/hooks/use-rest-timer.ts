'use client';

// src/hooks/use-rest-timer.ts
//
// Local-state hook for the sticky rest-timer banner (CONTEXT D-01g).
// No server involvement — the timer lives entirely in the client; if the
// page unmounts the timer dies (Phase 1 acceptance per CONTEXT.md;
// cross-navigation persistence is explicit non-goal until v1.x).
//
// Beep + haptic at zero:
//   - navigator.vibrate is best-effort; iOS Safari ignores it (silently
//     returns undefined). That's the documented Apple behavior; we don't
//     polyfill.
//   - AudioContext beep is a 200ms 880Hz tone via Web Audio. Will fail
//     silently in browsers that block AudioContext without a user gesture
//     (we created the timer FROM a user gesture — tap-done — so the
//     `secure context` rule is satisfied on the modern Chrome/Safari path).

import { useCallback, useEffect, useRef, useState } from 'react';

export type RestTimerApi = {
  /** Seconds remaining; null when no timer is active. */
  remainingSeconds: number | null;
  /** Start (or restart) the timer at the given seconds. */
  start: (seconds: number) => void;
  /** Add `delta` seconds to the running timer (clamped at 0). No-op if not running. */
  extend: (delta: number) => void;
  /** Stop and clear the timer. */
  dismiss: () => void;
};

export function useRestTimer(): RestTimerApi {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beepedRef = useRef(false);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    beepedRef.current = false;
  }, []);

  const fireBeepAndVibrate = useCallback(() => {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* iOS / unsupported — silent fallback */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return;
      const ac = new Ctor();
      const osc = ac.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.2);
    } catch {
      /* AudioContext blocked or unsupported — silent fallback */
    }
  }, []);

  const start = useCallback(
    (seconds: number) => {
      // Always reset state first — a fresh start during a running timer
      // (e.g. user taps done on set 2 while set 1's timer is still ticking)
      // restarts at the new value.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      beepedRef.current = false;
      setRemainingSeconds(seconds);
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((s) => {
          if (s === null) return null;
          if (s <= 1) {
            if (!beepedRef.current) {
              beepedRef.current = true;
              fireBeepAndVibrate();
            }
            // Stop the interval but keep the 0 visible until user dismisses.
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    },
    [fireBeepAndVibrate],
  );

  const extend = useCallback((delta: number) => {
    setRemainingSeconds((s) => (s === null ? null : Math.max(0, s + delta)));
  }, []);

  const dismiss = useCallback(() => {
    clear();
    setRemainingSeconds(null);
  }, [clear]);

  // Cleanup on unmount: kill the interval so we don't leak.
  useEffect(() => () => clear(), [clear]);

  return { remainingSeconds, start, extend, dismiss };
}

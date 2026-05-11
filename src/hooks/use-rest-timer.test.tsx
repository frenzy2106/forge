// @vitest-environment happy-dom
// src/hooks/use-rest-timer.test.tsx
//
// Tests for useRestTimer (CONTEXT D-01g — sticky banner with countdown,
// audible+haptic at zero). Covers behavior T8 from Plan 01-03.
//
// Uses happy-dom + vitest fake timers. We stub navigator.vibrate and
// AudioContext so the test runs headlessly without requiring a real audio
// subsystem.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRestTimer } from './use-rest-timer';

let vibrateCalls: unknown[];
let audioCreated: number;

beforeEach(() => {
  vi.useFakeTimers();
  vibrateCalls = [];
  audioCreated = 0;
  // Polyfill navigator.vibrate as a spy
  Object.defineProperty(window.navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: (pattern: unknown) => {
      vibrateCalls.push(pattern);
      return true;
    },
  });
  // Minimal AudioContext stub
  class FakeOsc {
    frequency = { value: 0 };
    connect() {
      /* noop */
    }
    start() {
      /* noop */
    }
    stop() {
      /* noop */
    }
  }
  class FakeAudio {
    currentTime = 0;
    destination = {};
    constructor() {
      audioCreated += 1;
    }
    createOscillator() {
      return new FakeOsc();
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).AudioContext = FakeAudio;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRestTimer', () => {
  it('starts at the supplied seconds and ticks down each second', () => {
    const { result } = renderHook(() => useRestTimer());

    expect(result.current.remainingSeconds).toBeNull();

    act(() => result.current.start(3));
    expect(result.current.remainingSeconds).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(1);
  });

  it('lands at 0, then beeps + vibrates', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => result.current.start(2));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(vibrateCalls).toHaveLength(1);
    expect(vibrateCalls[0]).toEqual([200, 100, 200]);
    expect(audioCreated).toBe(1);

    // Doesn't tick past 0 or beep again
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(vibrateCalls).toHaveLength(1);
  });

  it('extend(15) adds 15s to the remaining time', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => result.current.start(10));
    act(() => result.current.extend(15));
    expect(result.current.remainingSeconds).toBe(25);
  });

  it('dismiss() clears the timer', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => result.current.start(5));
    act(() => result.current.dismiss());
    expect(result.current.remainingSeconds).toBeNull();

    // No further ticks happen
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.remainingSeconds).toBeNull();
  });

  it('start() while running resets the existing timer', () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => result.current.start(10));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remainingSeconds).toBe(7);

    act(() => result.current.start(60));
    expect(result.current.remainingSeconds).toBe(60);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(59);
  });
});

// @vitest-environment happy-dom
// src/hooks/use-active-session.test.tsx
//
// Tests the optimistic logSet mutation behavior (T7) — the single most
// consequential UX behavior in Plan 01-03. The contract:
//   1. onMutate: optimistic Set immediately appears in the SessionView cache
//      with a temp id (tempId starts with "optimistic-").
//   2. onSuccess: the temp id is replaced with the server-returned id;
//      the rest of the cache shape is unchanged.
//   3. onError: the cache rolls back to the pre-mutation state.
//
// We mock the Server Action module (`@/app/actions/sets`) so the hook never
// hits the real DB — this is a unit test of the cache logic, not the Server
// Action itself (Server Actions are tested in src/db/queries/sets.test.ts).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock the Server Action module BEFORE importing the hook so the hook picks
// up the spies. The hook only imports logSetAction / editSetAction /
// deleteSetAction / tagAsDropTierAction from this path.
const logSetActionMock = vi.fn();
const editSetActionMock = vi.fn();
const deleteSetActionMock = vi.fn();
const tagAsDropTierActionMock = vi.fn();

vi.mock('@/app/actions/sets', () => ({
  logSetAction: (...args: unknown[]) => logSetActionMock(...args),
  editSetAction: (...args: unknown[]) => editSetActionMock(...args),
  deleteSetAction: (...args: unknown[]) => deleteSetActionMock(...args),
  tagAsDropTierAction: (...args: unknown[]) => tagAsDropTierActionMock(...args),
}));

vi.mock('@/app/actions/sessions', () => ({
  addExerciseToSessionAction: vi.fn(),
  endSessionAction: vi.fn(),
}));

import { useLogSetOptimistic, sessionKey } from './use-active-session';
import type { SessionView } from '@/db/queries/sessions';

const baseSessionView: SessionView = {
  session: {
    id: 'sess-1',
    routineId: 'r-1',
    startedAt: '2026-05-11T10:00:00.000Z',
    endedAt: null,
    localDate: '2026-05-11',
    intent: 'normal',
    notes: null,
    isDeleted: false,
    createdAt: '2026-05-11T10:00:00.000Z',
    updatedAt: '2026-05-11T10:00:00.000Z',
  },
  routine: null,
  exercises: [
    {
      sessionExercise: {
        id: 'se-1',
        sessionId: 'sess-1',
        exerciseId: 'ex-1',
        position: 1,
        notes: null,
        createdAt: '2026-05-11T10:00:00.000Z',
      },
      exercise: {
        id: 'ex-1',
        slug: 'incline-smith',
        displayName: 'Incline Smith',
        category: 'push',
        primaryMuscle: null,
        isCompound: false,
        defaultUnit: 'kg',
        defaultRestSeconds: 90,
        notes: null,
        createdAt: '2026-05-11T10:00:00.000Z',
        updatedAt: '2026-05-11T10:00:00.000Z',
      },
      sets: [],
    },
  ],
};

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  logSetActionMock.mockReset();
  editSetActionMock.mockReset();
  deleteSetActionMock.mockReset();
  tagAsDropTierActionMock.mockReset();
});

describe('useLogSetOptimistic (T7)', () => {
  it('writes an optimistic set immediately on mutate', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 0 }, queries: { retry: 0 } },
    });
    client.setQueryData(sessionKey('sess-1'), baseSessionView);
    // Server Action will resolve eventually, but we want to inspect the cache
    // mid-flight.
    let resolveAction: ((v: { id: string }) => void) | undefined;
    logSetActionMock.mockImplementationOnce(
      () => new Promise((r) => (resolveAction = r)),
    );

    const wrapper = makeWrapper(client);
    const { result } = renderHook(() => useLogSetOptimistic('sess-1'), { wrapper });

    act(() => {
      result.current.mutate({
        sessionExerciseId: 'se-1',
        position: 1,
        weightKg: 40,
        reps: 8,
      });
    });

    // Immediately after .mutate, onMutate has run. The optimistic set should
    // be in the cache.
    await waitFor(() => {
      const cached = client.getQueryData<SessionView>(sessionKey('sess-1'))!;
      expect(cached.exercises[0].sets).toHaveLength(1);
      expect(cached.exercises[0].sets[0].id).toMatch(/^optimistic-/);
      expect(cached.exercises[0].sets[0].weightKg).toBe(40);
      expect(cached.exercises[0].sets[0].reps).toBe(8);
    });

    // Resolve the action with a real id
    act(() => {
      resolveAction!({ id: 'real-set-id' });
    });

    await waitFor(() => {
      const cached = client.getQueryData<SessionView>(sessionKey('sess-1'))!;
      expect(cached.exercises[0].sets).toHaveLength(1);
      expect(cached.exercises[0].sets[0].id).toBe('real-set-id');
    });
  });

  it('rolls back the cache on error', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 0 }, queries: { retry: 0 } },
    });
    client.setQueryData(sessionKey('sess-1'), baseSessionView);
    logSetActionMock.mockRejectedValueOnce(new Error('boom'));

    const wrapper = makeWrapper(client);
    const { result } = renderHook(() => useLogSetOptimistic('sess-1'), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          sessionExerciseId: 'se-1',
          position: 1,
          weightKg: 40,
          reps: 8,
        });
      } catch {
        /* expected */
      }
    });

    const cached = client.getQueryData<SessionView>(sessionKey('sess-1'))!;
    expect(cached.exercises[0].sets).toHaveLength(0);
  });

  it('marks an optimistic set as drop-tier when parentSetId is provided', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 0 }, queries: { retry: 0 } },
    });
    // Pre-populate one logged set so the drop-tier child can chain to it
    const lead = {
      id: 'lead-set',
      sessionExerciseId: 'se-1',
      position: 1,
      reps: 8,
      weightKg: 40,
      durationSeconds: null,
      distanceMeters: null,
      isDropTier: false,
      parentSetId: null,
      isWarmup: false,
      rpe: null,
      loggedAt: '2026-05-11T10:01:00.000Z',
      isDeleted: false,
      createdAt: '2026-05-11T10:01:00.000Z',
      updatedAt: '2026-05-11T10:01:00.000Z',
    };
    client.setQueryData(sessionKey('sess-1'), {
      ...baseSessionView,
      exercises: [
        {
          ...baseSessionView.exercises[0],
          sets: [lead],
        },
      ],
    });
    logSetActionMock.mockResolvedValueOnce({ id: 'drop-real' });

    const wrapper = makeWrapper(client);
    const { result } = renderHook(() => useLogSetOptimistic('sess-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        sessionExerciseId: 'se-1',
        position: 1,
        weightKg: 30,
        reps: 6,
        parentSetId: 'lead-set',
      });
    });

    const cached = client.getQueryData<SessionView>(sessionKey('sess-1'))!;
    expect(cached.exercises[0].sets).toHaveLength(2);
    const drop = cached.exercises[0].sets[1];
    expect(drop.id).toBe('drop-real');
    expect(drop.isDropTier).toBe(true);
    expect(drop.parentSetId).toBe('lead-set');
  });
});

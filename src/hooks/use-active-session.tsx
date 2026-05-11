'use client';

// src/hooks/use-active-session.tsx
//
// TanStack Query hooks for the active-session UI (Plan 01-03).
//
// Design: ARCHITECTURE.md §Pattern 2 — optimistic mutations.
// - The cache is seeded from RSC `initialData` on first render.
// - Mutations write directly into the cache (onMutate) and never refetch
//   the SessionView. The Server Action is the only IO; the cache is the UI's
//   source of truth during a session.
// - On error we restore the snapshot taken before onMutate. No retries
//   (mutations.retry=0 in QueryClient defaults) so the rollback is
//   deterministic — a silent retry could create a phantom double-set.
//
// `sessionKey` is exported so the test harness can write directly to the
// cache without going through useQuery's initialData machinery.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  deleteSetAction,
  editSetAction,
  logSetAction,
  tagAsDropTierAction,
  type LogSetActionInput,
} from '@/app/actions/sets';
import { addExerciseToSessionAction } from '@/app/actions/sessions';
import type { SessionView } from '@/db/queries/sessions';
import type { Exercise, Set } from '@/db/schema';

export type SessionViewKey = ['session', string];
export const sessionKey = (id: string): SessionViewKey => ['session', id];

/** Read-only seed of the cache. queryFn intentionally throws — Phase 1 never
 *  invalidates the active session; if the cache is gone, force a full page
 *  reload via the route's RSC, don't background-refetch. */
export function useActiveSession(
  sessionId: string,
  initialData: SessionView,
): UseQueryResult<SessionView> {
  return useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () => {
      throw new Error(
        'useActiveSession queryFn invoked — cache should be cache-only in Phase 1.',
      );
    },
    initialData,
    staleTime: Infinity,
  });
}

function buildOptimisticSet(input: LogSetActionInput): Set {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    sessionExerciseId: input.sessionExerciseId,
    position: input.position,
    reps: input.reps ?? null,
    weightKg: input.weightKg ?? null,
    durationSeconds: input.durationSeconds ?? null,
    distanceMeters: input.distanceMeters ?? null,
    isDropTier: !!input.parentSetId,
    parentSetId: input.parentSetId ?? null,
    isWarmup: false,
    rpe: null,
    loggedAt: now,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function useLogSetOptimistic(sessionId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: logSetAction,
    onMutate: async (input: LogSetActionInput) => {
      await qc.cancelQueries({ queryKey: sessionKey(sessionId) });
      const prev = qc.getQueryData<SessionView>(sessionKey(sessionId));
      const optimistic = buildOptimisticSet(input);

      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: old.exercises.map((ex) =>
            ex.sessionExercise.id === input.sessionExerciseId
              ? { ...ex, sets: [...ex.sets, optimistic] }
              : ex,
          ),
        };
      });

      return { prev, tempId: optimistic.id };
    },
    onSuccess: (data, _input, ctx) => {
      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: old.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) =>
              s.id === ctx?.tempId ? { ...s, id: data.id } : s,
            ),
          })),
        };
      });
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKey(sessionId), ctx.prev);
    },
  });
}

export function useEditSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: editSetAction,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: sessionKey(sessionId) });
      const prev = qc.getQueryData<SessionView>(sessionKey(sessionId));
      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        const { setId, ...patch } = input;
        return {
          ...old,
          exercises: old.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKey(sessionId), ctx.prev);
    },
  });
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSetAction,
    onMutate: async (setId: string) => {
      await qc.cancelQueries({ queryKey: sessionKey(sessionId) });
      const prev = qc.getQueryData<SessionView>(sessionKey(sessionId));
      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: old.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.filter((s) => s.id !== setId),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKey(sessionId), ctx.prev);
    },
  });
}

export function useTagAsDropTier(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      setId,
      parentSetId,
    }: {
      setId: string;
      parentSetId: string;
    }) => tagAsDropTierAction(setId, parentSetId),
    onMutate: async ({ setId, parentSetId }) => {
      await qc.cancelQueries({ queryKey: sessionKey(sessionId) });
      const prev = qc.getQueryData<SessionView>(sessionKey(sessionId));
      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        return {
          ...old,
          exercises: old.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((s) =>
              s.id === setId ? { ...s, isDropTier: true, parentSetId } : s,
            ),
          })),
        };
      });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(sessionKey(sessionId), ctx.prev);
    },
  });
}

export function useAddExerciseToSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ exerciseId }: { exerciseId: string; exercise: Exercise }) =>
      addExerciseToSessionAction(sessionId, exerciseId),
    onSuccess: (data, { exercise }) => {
      qc.setQueryData<SessionView>(sessionKey(sessionId), (old) => {
        if (!old) return old;
        const newPos =
          (old.exercises[old.exercises.length - 1]?.sessionExercise.position ?? 0) +
          1;
        const now = new Date().toISOString();
        return {
          ...old,
          exercises: [
            ...old.exercises,
            {
              sessionExercise: {
                id: data.sessionExerciseId,
                sessionId,
                exerciseId: exercise.id,
                position: newPos,
                notes: null,
                createdAt: now,
              },
              exercise,
              sets: [],
            },
          ],
        };
      });
    },
  });
}

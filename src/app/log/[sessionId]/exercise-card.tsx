'use client';

// One card per session_exercise. Renders the persisted set rows in order
// followed by a single draft row for the next set. Drop-tier sets render
// inline (visually indented) directly after their parent — the SQL ORDER BY
// position, created_at already produces this order.
//
// `nextPosition` follows the convention "max position of NON-drop sets +1"
// because drop tiers re-use their parent's position. The first set in an
// empty exercise card is position 1.

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTagAsDropTier } from '@/hooks/use-active-session';
import { matchPriorPerformance } from '@/domain/previous-set';
import { SetRow } from './set-row';
import type { Exercise, SessionExercise, Set } from '@/db/schema';

type DraftPrefill = {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
} | null;

type Props = {
  sessionId: string;
  sessionExercise: SessionExercise;
  exercise: Exercise;
  sets: Set[];
  priorSets: Set[] | undefined;
  /** Called when the user taps the timer icon on a logged set. The parent
   *  (ActiveSession) starts the rest timer at this exercise's
   *  defaultRestSeconds. Opt-in per CONTEXT.md D-01g (revised — no auto-start). */
  onStartRestTimer: (restSeconds: number) => void;
  /** Marks the active exercise visually so the user can scroll back to it
   *  after using the +Add Exercise drawer. */
  isActive?: boolean;
};

export function ExerciseCard({
  sessionId,
  sessionExercise,
  exercise,
  sets,
  priorSets,
  onStartRestTimer,
  isActive,
}: Props) {
  const tagDrop = useTagAsDropTier(sessionId);

  // Draft prefill: when the user taps copy on a logged set, we stash that
  // set's values here. The draft row's useEffect picks up the new object
  // reference and mirrors values into its inputs. A fresh object on each
  // copy ensures successive copies of the same set still trigger the effect.
  const [draftPrefill, setDraftPrefill] = useState<DraftPrefill>(null);

  const handleCopyToDraft = (s: Set) => {
    setDraftPrefill({
      weightKg: s.weightKg ?? undefined,
      reps: s.reps ?? undefined,
      durationSeconds: s.durationSeconds ?? undefined,
    });
  };

  // Compute the next top-line set position. Drop tiers share their parent's
  // position so we exclude them from the max() calculation.
  const topPositions = sets.filter((s) => !s.isDropTier).map((s) => s.position);
  const nextPosition =
    (topPositions.length > 0 ? Math.max(...topPositions) : 0) + 1;

  /** Resolve the parent_set_id for tagging `targetSet` as a drop tier. The
   *  convention: parent = the most recent non-drop set in this exercise that
   *  was created before `targetSet` (chronological predecessor at the
   *  comparable spot). Returns null when no chainable parent exists — in
   *  that case the menu hides the option. */
  const resolveParentSetIdFor = (targetSet: Set): string | null => {
    const candidates = sets
      .filter(
        (s) =>
          s.id !== targetSet.id &&
          !s.isDropTier &&
          s.createdAt <= targetSet.createdAt,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return candidates[0]?.id ?? null;
  };

  return (
    <Card
      data-active={isActive ? 'true' : undefined}
      className={
        isActive
          ? 'ring-2 ring-primary transition-shadow'
          : 'transition-shadow'
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{exercise.displayName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Column headers — clarify which input is weight vs reps (or duration
            for endurance). Aligned with SetRow's flex column widths:
              w-8 set-number | w-20 weight | × | w-16 reps | done | timer
            For endurance variant: w-8 set-number | flex-1 duration | done. */}
        {exercise.category === 'endurance' ? (
          <div
            className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            aria-hidden="true"
          >
            <div className="w-8 text-center">#</div>
            <div className="flex-1 text-center">sec</div>
            <div className="size-12" />
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            aria-hidden="true"
          >
            <div className="w-8 text-center">#</div>
            <div className="w-20 text-center">kg</div>
            <span className="opacity-0">×</span>
            <div className="w-16 text-center">reps</div>
            <div className="size-12" />
          </div>
        )}

        {sets.map((s) => {
          const parentId = resolveParentSetIdFor(s);
          return (
            <SetRow
              key={s.id}
              set={s}
              exercise={exercise}
              priorSet={matchPriorPerformance(priorSets, s.position)}
              sessionId={sessionId}
              onTagAsDropTier={
                parentId
                  ? () => {
                      tagDrop.mutate({ setId: s.id, parentSetId: parentId });
                    }
                  : undefined
              }
              onStartRestTimer={() =>
                onStartRestTimer(exercise.defaultRestSeconds)
              }
              onCopyToDraft={() => handleCopyToDraft(s)}
            />
          );
        })}

        {/* Single persistent draft row for the next set. The prefill prop
            lets the user "copy" any logged set's values into this draft. */}
        <SetRow
          exercise={exercise}
          priorSet={matchPriorPerformance(priorSets, nextPosition)}
          sessionId={sessionId}
          draftSessionExerciseId={sessionExercise.id}
          draftPosition={nextPosition}
          prefill={draftPrefill}
        />
      </CardContent>
    </Card>
  );
}

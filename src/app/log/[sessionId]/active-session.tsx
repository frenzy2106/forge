'use client';

// Top-level client orchestrator for the active session route.
//
// Owns:
//   - The TanStack Query subscription to the session view (seeded by RSC)
//   - The local rest-timer state
//   - Open/close state for the +Add Exercise drawer and End Session dialog
//   - The endSession action invocation + post-end navigation
//
// Layout (top → bottom):
//   - Sticky rest-timer banner (renders only when active)
//   - Sticky header showing the routine name
//   - Scrolling list of exercise cards
//   - Floating +Add Exercise button (bottom-right, above the End Session bar)
//   - Persistent End Session bar pinned to the bottom edge

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useActiveSession } from '@/hooks/use-active-session';
import { useRestTimer } from '@/hooks/use-rest-timer';
import { endSessionAction } from '@/app/actions/sessions';
import { ExerciseCard } from './exercise-card';
import { RestTimerBanner } from './rest-timer-banner';
import { AddExerciseDrawer } from './add-exercise-drawer';
import type { SessionView } from '@/db/queries/sessions';
import type { Set } from '@/db/schema';

type Props = {
  sessionId: string;
  initialSessionView: SessionView;
  /** exerciseId → prior session's sets (already JSON-serialised on the server). */
  priorPerformances: Record<string, Set[]>;
};

export function ActiveSession({
  sessionId,
  initialSessionView,
  priorPerformances,
}: Props) {
  const { data: sessionView } = useActiveSession(sessionId, initialSessionView);
  const restTimer = useRestTimer();
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [isEnding, startEndTransition] = useTransition();
  const router = useRouter();

  const handleEnd = () => {
    startEndTransition(async () => {
      await endSessionAction(sessionId);
      // Plan 01-04 implements the comparison report; for now we redirect to
      // the (stubbed) route, where the user can confirm the session ended.
      router.push(`/sessions/${sessionId}/compare`);
    });
  };

  // initialData makes this unreachable at runtime, but TS narrows it.
  if (!sessionView) return null;

  return (
    <main className="min-h-screen pb-32">
      {/* Sticky rest timer banner at top */}
      <RestTimerBanner timer={restTimer} />

      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <h1 className="text-lg font-bold">
          {sessionView.routine?.name ?? 'Blank session'}
        </h1>
      </header>

      {/* Full ordered list of all session_exercises (D-01a) */}
      <div className="space-y-4 px-4 py-4">
        {sessionView.exercises.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No exercises yet. Tap "+ Add Exercise" below to get started.
          </p>
        )}
        {sessionView.exercises.map(({ sessionExercise, exercise, sets }) => (
          <ExerciseCard
            key={sessionExercise.id}
            sessionId={sessionId}
            sessionExercise={sessionExercise}
            exercise={exercise}
            sets={sets}
            priorSets={priorPerformances[exercise.id]}
            onSetLogged={(restSeconds) => restTimer.start(restSeconds)}
          />
        ))}
      </div>

      {/* Floating + Add exercise button (D-01e). Sits ABOVE the End Session
          bar so both stay in the thumb zone. */}
      <div className="fixed bottom-20 right-4 z-20">
        <Button
          size="lg"
          className="h-14 rounded-full px-6 shadow-lg"
          onClick={() => setAddExerciseOpen(true)}
        >
          + Add exercise
        </Button>
      </div>

      {/* Persistent End Session button (D-04a) */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background p-3">
        <Button
          variant="destructive"
          size="lg"
          className="h-14 w-full text-lg"
          onClick={() => setEndConfirmOpen(true)}
          disabled={isEnding}
        >
          {isEnding ? 'Ending…' : 'End Session'}
        </Button>
      </div>

      {/* Add exercise drawer */}
      <AddExerciseDrawer
        open={addExerciseOpen}
        onOpenChange={setAddExerciseOpen}
        sessionId={sessionId}
        existingExerciseIds={sessionView.exercises.map((e) => e.exercise.id)}
      />

      {/* End session confirmation (D-04a) */}
      <Dialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End session and see comparison?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEndConfirmOpen(false)}
              disabled={isEnding}
            >
              Cancel
            </Button>
            <Button onClick={handleEnd} disabled={isEnding}>
              {isEnding ? 'Ending…' : 'End'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

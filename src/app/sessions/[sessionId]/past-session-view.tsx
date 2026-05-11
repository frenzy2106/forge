'use client';

// Client orchestrator for the read-only past-session detail (HIST-05).
//
// Mirrors the active-session ExerciseCard layout (one card per
// session_exercise, sets in order, drop tiers indented under their lead) but
// strips all live-logging affordances: no draft row, no rest-timer trigger,
// no "next set" intent. Each set row exposes inline edit + soft-delete via
// PastSetRow.
//
// We don't use TanStack Query here. Past-session edits are deliberate, low
// frequency, and the Server Action's revalidatePath gives us a fresh RSC
// render — no need for an optimistic cache layer. PastSetRow uses
// useTransition for the pending UI.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { topSet, exerciseVolume } from '@/domain/volume';
import { PastSetRow } from './past-set-row';
import type { SessionView } from '@/db/queries/sessions';

export function PastSessionView({ sessionView }: { sessionView: SessionView }) {
  return (
    <div className="space-y-3">
      {sessionView.exercises.map(({ sessionExercise, exercise, sets }) => {
        const isEndurance = exercise.category === 'endurance';
        const ts = !isEndurance ? topSet(sets) : null;
        const vol = !isEndurance ? exerciseVolume(sets) : 0;

        return (
          <Card key={sessionExercise.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {exercise.displayName}
              </CardTitle>
              {sets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  no sets logged (skipped)
                </p>
              )}
              {sets.length > 0 && !isEndurance && ts && (
                <p className="font-mono text-xs text-muted-foreground">
                  top: {ts.weightKg}kg × {ts.reps} · vol {vol.toFixed(0)}kg
                </p>
              )}
            </CardHeader>
            {sets.length > 0 && (
              <CardContent className="space-y-2">
                {sets.map((s) => (
                  <PastSetRow key={s.id} set={s} isEndurance={isEndurance} />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// /sessions/[sessionId]/compare — Plan 01-04 end-of-session report.
//
// Replaces the Plan 01-03 stub. CONTEXT D-02 a–f is implemented here:
//   D-02a  Auto-shows on End Session — endSessionAction (Plan 01-03)
//          already redirects here.
//   D-02b  Sort exercises in TODAY's session order — that's the natural
//          order from loadSessionView (ORDER BY session_exercises.position).
//   D-02c  Per-exercise card with top-set headline + secondary deltas row.
//   D-02d  Cards collapsed by default; expand for per-set breakdown.
//   D-02e  Edge-case badges: first-time, stale, renamed, swapped.
//   D-02f  Single optional notes field at the bottom; save-on-blur.
//
// Server Component: fetches today's SessionView, the prior identical-routine
// SessionView, runs `compareSessions` (pure), then renders. All comparison
// logic lives in src/domain/comparison.ts and has 39 unit tests.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadSessionView, findPriorIdenticalSession } from '@/db/queries/sessions';
import { compareSessions } from '@/domain/comparison';
import { sessionVolume } from '@/domain/volume';
import { ComparisonCard } from './comparison-card';
import { NotesField } from './notes-field';
import { Button } from '@/components/ui/button';
import { formatLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function CompareSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const today = await loadSessionView(sessionId);
  if (!today) notFound();

  // Parallel: prior session (if any) doesn't depend on today.exercises so
  // both queries can fan out. loadSessionView already parallelizes its
  // internal queries (Plan 01-03 perf fix).
  const prior = await findPriorIdenticalSession(
    today.session.routineId,
    today.session.startedAt,
  );

  const comparisons = compareSessions(today, prior);
  const todayVol = sessionVolume(today);
  const priorVol = prior ? sessionVolume(prior) : null;
  const sessionVolDelta = priorVol !== null ? todayVol - priorVol : null;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-32">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight">
          {today.routine?.name ?? 'Blank session'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatLocal(today.session.startedAt, 'EEE MMM d, yyyy · h:mm a')}
        </p>
        {prior && (
          <p className="text-xs text-muted-foreground">
            vs {formatLocal(prior.session.startedAt, 'EEE MMM d, yyyy')}
            {sessionVolDelta !== null && (
              <>
                {' · session vol '}
                {todayVol.toFixed(0)}kg vs {priorVol!.toFixed(0)}kg{' '}
                <span
                  className={
                    sessionVolDelta > 0
                      ? 'text-green-600 dark:text-green-400'
                      : sessionVolDelta < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                  }
                >
                  ({sessionVolDelta > 0 ? '+' : ''}
                  {sessionVolDelta.toFixed(0)}kg)
                </span>
              </>
            )}
          </p>
        )}
        {!prior && today.session.routineId && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            First time doing this routine — every exercise will show as new.
          </p>
        )}
        {!today.session.routineId && (
          <p className="text-xs text-muted-foreground">
            Ad-hoc session — no comparison baseline.
          </p>
        )}
      </header>

      {comparisons.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No exercises logged in this session.
        </div>
      ) : (
        <div className="space-y-3">
          {comparisons.map((c) => (
            <ComparisonCard key={c.sessionExerciseId} comparison={c} />
          ))}
        </div>
      )}

      <NotesField
        sessionId={sessionId}
        initialNotes={today.session.notes ?? ''}
      />

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background p-3">
        <Link href="/" className="block">
          <Button size="lg" className="h-14 w-full text-lg">
            Done — back to home
          </Button>
        </Link>
      </div>
    </main>
  );
}

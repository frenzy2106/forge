import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadSessionView } from '@/db/queries/sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatLocal } from '@/lib/dates';

// /log/[sessionId] — STUB for Plan 01-02.
//
// Plan 01-03 replaces this with the active-session UI (live set logging,
// drop-set tagging via long-press, mid-session +Add Exercise drawer, rest
// timer, End Session → comparison report). For now we render the routine
// name + the copied session_exercises list so a tap from the home page lands
// somewhere useful and confirms WORK-02 copy-on-create worked end-to-end.

export const dynamic = 'force-dynamic';

export default async function LogSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const view = await loadSessionView(sessionId);
  if (!view) notFound();

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {view.routine?.name ?? 'Blank session'}
        </h1>
        <Link href="/">
          <Button variant="ghost" size="sm">
            Back
          </Button>
        </Link>
      </div>

      <p className="text-muted-foreground text-xs font-mono">
        Started {formatLocal(view.session.startedAt)} · session{' '}
        {sessionId.slice(0, 8)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Plan 01-02 stub</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The active-session logging UI (live set entry, drop-set tagging,
            rest timer, End Session → comparison) ships in Plan 01-03.
          </p>
          <p>
            What works today: this page reads the session, its (optional)
            routine, and the session_exercises that were copied from the
            routine_exercises at session-create time (WORK-02). That round
            trip is what Plan 01-03 will build the live UI on top of.
          </p>
        </CardContent>
      </Card>

      {view.exercises.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Exercises in this session ({view.exercises.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {view.exercises.map(({ sessionExercise, exercise }) => (
              <div
                key={sessionExercise.id}
                className="font-mono text-sm tabular-nums"
              >
                {String(sessionExercise.position).padStart(2, '0')}.{' '}
                {exercise.displayName}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

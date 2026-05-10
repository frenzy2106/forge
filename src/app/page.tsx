import Link from 'next/link';
import { listRoutines } from '@/db/queries/routines';
import { listRecentSessions } from '@/db/queries/sessions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  createBlankSessionForm,
  createSessionFromRoutineForm,
} from '@/app/actions/skeleton';
import { formatLocal } from '@/lib/dates';

// CONTEXT.md D-04c/D-04d: home page is a Server Component that lists the
// seeded routines as session-start cards alongside an ad-hoc "Start blank
// session" button (WORK-03). Below the routine list, render the recent
// sessions feed — the home screen IS the history list in v1.
//
// `dynamic = 'force-dynamic'` so a fresh revalidatePath('/') after a session
// is created always re-reads sessions; we never want a stale "you started 3
// minutes ago" card.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [routines, recent] = await Promise.all([
    listRoutines(),
    listRecentSessions(10),
  ]);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">Forge</h1>
      <p className="text-muted-foreground text-sm">
        {routines.length === 0
          ? "Run `pnpm seed` to load Ankit's PPL + Saturday routines."
          : 'Tap a routine to start a session.'}
      </p>

      {routines.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Forge</CardTitle>
            <CardDescription>
              No routines seeded yet. Use{' '}
              <code className="font-mono">pnpm seed</code> to load the four
              starter routines.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createBlankSessionForm}>
              <Button type="submit" size="lg" className="h-14 w-full text-lg">
                Start blank session
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Start a session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {routines.map((r) => (
              <form
                key={r.id}
                action={createSessionFromRoutineForm.bind(null, r.id)}
              >
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full justify-start text-lg"
                >
                  Start {r.name}
                </Button>
              </form>
            ))}
            <form action={createBlankSessionForm}>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="h-12 w-full"
              >
                Start blank session
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions ({recent.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sessions yet. Tap above to create one.
            </p>
          ) : (
            recent.map((s) => (
              <Link
                key={s.id}
                href={`/log/${s.id}`}
                className="block font-mono text-sm hover:underline"
              >
                {formatLocal(s.startedAt)} — {s.routineName ?? 'blank'}{' '}
                {s.endedAt ? '✓' : '(in progress)'}
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}

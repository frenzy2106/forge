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
import { RoutineFilter } from './routine-filter';

// CONTEXT.md D-04c/D-04d: home page is a Server Component that lists the
// seeded routines as session-start cards alongside an ad-hoc "Start blank
// session" button (WORK-03). Below the routine list, render the recent
// sessions feed — the home screen IS the history list in v1.
//
// HIST-04 (Plan 01-05): recent sessions list can be filtered by routine via
// a dropdown above the list. Filter state is in the URL (`?routine=<id>`) so
// it survives refresh, is shareable, and integrates with browser navigation.
//
// `dynamic = 'force-dynamic'` so a fresh revalidatePath('/') after a session
// is created always re-reads sessions; we never want a stale "you started 3
// minutes ago" card.
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ routine?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const filterRoutineId = sp.routine && sp.routine.length > 0 ? sp.routine : null;

  const [routines, recent] = await Promise.all([
    listRoutines(),
    listRecentSessions({ limit: 20, routineId: filterRoutineId ?? undefined }),
  ]);

  // Guard: if the URL contains a stale routine id that no longer matches any
  // seeded routine, the dropdown would render with no selection visible. The
  // Server Component just passes the raw param through; the client filter
  // falls back to 'all' on its own value-coercion. The empty-list message
  // below also handles this case verbally.
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
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Recent sessions</CardTitle>
            {routines.length > 0 && (
              <RoutineFilter routines={routines} value={filterRoutineId} />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {filterRoutineId
                ? 'No sessions for this routine yet.'
                : 'No sessions yet. Tap above to create one.'}
            </p>
          ) : (
            recent.map((s) => {
              // In-progress sessions still link to the live-logging view so
              // the user can resume; ended sessions go to the read-only
              // past-session detail (HIST-05) created in this plan.
              const href = s.endedAt ? `/sessions/${s.id}` : `/log/${s.id}`;
              return (
                <Link
                  key={s.id}
                  href={href}
                  className="-mx-2 block rounded-md px-2 py-2 hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {s.routineName ?? 'blank'}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatLocal(s.startedAt, 'EEE MMM d, h:mm a')}
                    </span>
                  </div>
                  {!s.endedAt && (
                    <span className="text-xs text-orange-500">in progress</span>
                  )}
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </main>
  );
}

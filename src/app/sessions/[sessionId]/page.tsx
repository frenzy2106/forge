// /sessions/[sessionId] — Plan 01-05 read-only past-session detail (HIST-05).
//
// Renders all of a session's logged sets with inline edit + soft-delete on
// each row. Distinct from the active-session UI at /log/[sessionId]:
//   - No draft row (this view is for inspecting/correcting past work, not
//     adding new sets to an in-progress session).
//   - No rest timer (irrelevant when reviewing history).
//   - No "End session" button.
//   - For an in-progress session, we offer a "Resume session" link back to
//     /log/[id] rather than letting the user accidentally edit a session
//     that's still being logged via TanStack Query elsewhere.
//
// Reuses the same Server Actions (editSetAction / deleteSetAction) as the
// active-session UI — single source of truth for set mutations per
// success_criteria #4. revalidatePath in the action triggers this page to
// re-render with fresh DB state after each save/delete.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadSessionView } from '@/db/queries/sessions';
import { sessionVolume } from '@/domain/volume';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLocal } from '@/lib/dates';
import { PastSessionView } from './past-session-view';
import { DeleteSessionButton } from './delete-session-button';

// loadSessionView reads from the per-request DB; we want the freshest data
// after every mutation (revalidatePath drives this from the Server Action).
export const dynamic = 'force-dynamic';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const sv = await loadSessionView(sessionId);
  if (!sv) notFound();

  const totalVolume = sessionVolume(sv);
  const isInProgress = !sv.session.endedAt;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Home
        </Link>
        <h1 className="mt-2 text-xl font-bold leading-tight">
          {sv.routine?.name ?? 'Blank session'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatLocal(sv.session.startedAt, 'EEE MMM d, yyyy · h:mm a')}
          {sv.session.endedAt && (
            <> – {formatLocal(sv.session.endedAt, 'h:mm a')}</>
          )}
          {isInProgress && (
            <span className="text-orange-500"> · in progress</span>
          )}
        </p>
        {!isInProgress && totalVolume > 0 && (
          <p className="text-xs text-muted-foreground">
            Total volume: {totalVolume.toFixed(0)} kg
          </p>
        )}
      </header>

      {/* Branch: ended sessions get the comparison link; in-progress sessions
          get a Resume link back to the live-logging UI so the user doesn't
          double-edit via TanStack Query + RSC simultaneously. */}
      {isInProgress ? (
        <Link href={`/log/${sessionId}`} className="block">
          <Button size="lg" className="h-12 w-full">
            Resume session →
          </Button>
        </Link>
      ) : (
        sv.session.routineId && (
          <Link href={`/sessions/${sessionId}/compare`} className="block">
            <Button variant="outline" size="lg" className="h-12 w-full">
              View comparison →
            </Button>
          </Link>
        )
      )}

      <PastSessionView sessionView={sv} />

      {sv.session.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{sv.session.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Bottom-right destructive action — soft-delete the session and
          redirect home. Available on both ended and in-progress sessions
          so the user can always remove a session from history. */}
      <div className="flex justify-end pt-2">
        <DeleteSessionButton sessionId={sessionId} />
      </div>
    </main>
  );
}

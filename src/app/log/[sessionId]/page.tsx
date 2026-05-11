import { notFound, redirect } from 'next/navigation';
import {
  loadPriorPerformances,
  loadSessionView,
} from '@/db/queries/sessions';
import { ActiveSession } from './active-session';
import type { Set } from '@/db/schema';

// /log/[sessionId] — active session route (Plan 01-03 replaces the 01-02 stub).
//
// Server Component: loads the SessionView + per-exercise prior performances,
// hands them to <ActiveSession /> as the TanStack Query cache seed. The
// active-session client never re-fetches this — mutations write into the
// cache and the route re-renders only when the user navigates away (or hard
// refreshes).
//
// If the session is already ended, redirect to the comparison report
// (Plan 01-04 implements; today it's a stub at /sessions/[id]/compare so the
// redirect doesn't 404).

export const dynamic = 'force-dynamic';

export default async function LogSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const sessionView = await loadSessionView(sessionId);
  if (!sessionView) notFound();

  if (sessionView.session.endedAt) {
    redirect(`/sessions/${sessionId}/compare`);
  }

  const exerciseIds = sessionView.exercises.map((e) => e.exercise.id);
  const priorMap = await loadPriorPerformances(
    exerciseIds,
    sessionView.session.startedAt,
  );

  // Map → plain object so it survives the RSC → client component boundary.
  const priorPerformances: Record<string, Set[]> = {};
  for (const [k, v] of priorMap.entries()) priorPerformances[k] = v;

  return (
    <ActiveSession
      sessionId={sessionId}
      initialSessionView={sessionView}
      priorPerformances={priorPerformances}
    />
  );
}

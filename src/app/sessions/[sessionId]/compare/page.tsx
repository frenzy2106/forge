import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// /sessions/[sessionId]/compare — STUB for Plan 01-03.
//
// Plan 01-04 owns the this-vs-last comparison report. This route exists today
// only so the active-session UI's "End Session" → confirm → redirect flow
// doesn't 404 when Plan 01-03 ships first. Same pattern Plan 01-02 used for
// /log/[id] before Plan 01-03 took it over.
//
// Acceptance: rendering this page proves endSessionAction wrote ended_at and
// the navigation transitioned cleanly. Comparison data lands in 01-04.

export const dynamic = 'force-dynamic';

export default async function CompareSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">Session ended</h1>
      <Card>
        <CardHeader>
          <CardTitle>Comparison report — Plan 01-04 stub</CardTitle>
          <CardDescription>
            The this-vs-last comparison renders here in Plan 01-04. For now,
            the route exists so the End Session redirect flow works.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Session id:{' '}
            <code className="font-mono text-xs">{sessionId}</code>
          </p>
          <Link href="/">
            <Button className="h-12 w-full">Back to home</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

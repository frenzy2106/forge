import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createBlankSessionForm } from '@/app/actions/skeleton';
import { formatLocal } from '@/lib/dates';

// Walking skeleton: home page is a Server Component that reads the most-recent
// sessions from Turso and renders the "Start blank session" button. Plan 01-02
// expands this to routine cards + recent sessions per CONTEXT.md D-04c/D-04d.
//
// `dynamic = 'force-dynamic'` because the recent-sessions read must run on
// every request (revalidatePath('/') after createBlankSession invalidates the
// cache, but we also want to defeat static prerender at build time when the
// table is empty). Single-user low-traffic app — no caching wins to chase.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const recent = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .limit(5);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-2xl font-bold">Forge</h1>
      <p className="text-muted-foreground text-sm">
        Walking skeleton — Plan 01-01.
      </p>

      <form action={createBlankSessionForm}>
        <Button type="submit" size="lg" className="h-14 w-full text-lg">
          Start blank session
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions ({recent.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No sessions yet. Tap above to create one.
            </p>
          ) : (
            recent.map((s) => (
              <div key={s.id} className="font-mono text-sm">
                {formatLocal(s.startedAt)} — {s.id.slice(0, 8)}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}

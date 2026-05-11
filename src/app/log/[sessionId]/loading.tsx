// Loading skeleton for /log/[sessionId]. Renders instantly while the
// Server Component fetches the session view + prior performances. Without
// this, Next.js shows the previous route's UI (or a blank page) until the
// new route's RSC resolves — which is exactly the "huge lag" sensation.

export default function LogSessionLoading() {
  return (
    <main className="min-h-screen pb-32">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </header>
      <div className="space-y-4 px-4 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-4 shadow-sm"
            aria-hidden
          >
            <div className="mb-3 h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="space-y-2">
              <div className="h-12 animate-pulse rounded bg-muted/60" />
              <div className="h-12 w-3/4 animate-pulse rounded bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

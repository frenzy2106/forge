'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * TanStack Query setup for the active-session UI (Plan 01-03).
 *
 * ARCHITECTURE.md §Pattern 2 (optimistic mutations) is the entire reason this
 * lib exists in v1. The home page + comparison report continue to be RSC-only;
 * only the active-session route mounts a QueryClient.
 *
 * Per the canonical Next.js App Router pattern (TanStack docs):
 *   - On the server, return a fresh QueryClient per request (no shared cache
 *     between users — but we are single-user, so this is mostly defensive).
 *   - In the browser, return a singleton so cache survives client navigation.
 *
 * Defaults are tuned for "I own the cache via mutations":
 *   - staleTime Infinity → never automatically refetch; mutations push updates.
 *   - refetchOnWindowFocus false → switching to the gym timer app and back
 *     must NOT trigger an in-flight invalidate that nukes the optimistic UI.
 *   - mutations retry 0 → optimistic UX needs deterministic onError rollback;
 *     a silent retry would create double-commits.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60, // 1h — drop session cache after a long idle.
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: per-request client.
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState ensures the same client instance survives StrictMode double-mounts.
  const [client] = useState(() => getQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

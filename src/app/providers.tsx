'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-client';

/**
 * Top-level client-side providers wrapper. Mounted from the root Server
 * Component layout. Add new client-only providers here (toasts, theme, etc.)
 * rather than thread them through every page.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}

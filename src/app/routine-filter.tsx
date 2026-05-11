'use client';

// HIST-04: small client-side dropdown that lets the home page's recent-sessions
// list be filtered by routine. The Server Component reads `?routine=<id>` from
// search params; this component owns the URL update on selection so the filter
// state is shareable + survives a refresh + plays nicely with browser back.
//
// We use base-ui Select via the shadcn wrapper. "All routines" is modelled as
// the literal value 'all' (an empty Item value confuses base-ui and causes
// nothing to render); selecting it clears the search param entirely.

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Routine } from '@/db/schema';

const ALL_VALUE = 'all';

export function RoutineFilter({
  routines,
  value,
}: {
  routines: Routine[];
  value: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(v) => {
        const params = new URLSearchParams(sp);
        if (!v || v === ALL_VALUE) params.delete('routine');
        else params.set('routine', v);
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : '/');
      }}
    >
      <SelectTrigger size="sm" className="text-xs">
        <SelectValue placeholder="All routines" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All routines</SelectItem>
        {routines.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

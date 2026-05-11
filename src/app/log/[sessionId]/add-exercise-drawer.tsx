'use client';

// CONTEXT D-01e: floating "+ Add Exercise" button at the bottom of the
// active session opens a bottom drawer with an autocomplete search over
// the exercise catalog. Selecting an exercise inserts a session_exercises
// row (via addExerciseToSessionAction) and updates the cache so the new
// card appears at the bottom of the list — no navigation, no page reload.
//
// Already-added exercises stay visible but render as "outline + already
// added" so the user can confirm before re-adding. Lat Pulldown (3 variants
// per D-03b) means an exercise list of 7 might pick from a catalog of 28;
// the visual diff matters.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddExerciseToSession } from '@/hooks/use-active-session';
import type { Exercise } from '@/db/schema';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Used to render "already added" visual state on existing entries. */
  existingExerciseIds: string[];
};

export function AddExerciseDrawer({
  open,
  onOpenChange,
  sessionId,
  existingExerciseIds,
}: Props) {
  const [query, setQuery] = useState('');
  const addEx = useAddExerciseToSession(sessionId);

  // Catalog search via the /api/exercises/search Route Handler. The drawer
  // pre-fetches the full sorted catalog when it opens (empty q) so the user
  // sees something immediately; subsequent keystrokes refilter via TanStack
  // Query's automatic refetch on key change.
  const { data: results = [] } = useQuery({
    queryKey: ['exercise-search', query] as const,
    queryFn: async (): Promise<Exercise[]> => {
      const resp = await fetch(
        `/api/exercises/search?q=${encodeURIComponent(query)}`,
      );
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add exercise</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-6">
          <Input
            type="text"
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="h-12"
            aria-label="Exercise search"
          />
          <div className="max-h-[60vh] space-y-1 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                {query ? `No matches for "${query}"` : 'Loading catalog…'}
              </p>
            ) : (
              results.map((ex) => {
                const alreadyAdded = existingExerciseIds.includes(ex.id);
                return (
                  <Button
                    key={ex.id}
                    variant={alreadyAdded ? 'outline' : 'ghost'}
                    className="h-12 w-full justify-start"
                    onClick={() => {
                      addEx.mutate({ exerciseId: ex.id, exercise: ex });
                      setQuery('');
                      onOpenChange(false);
                    }}
                  >
                    <span className="flex-1 text-left">{ex.displayName}</span>
                    {alreadyAdded && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        already added
                      </span>
                    )}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

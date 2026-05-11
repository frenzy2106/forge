'use client';

// CONTEXT D-01e: floating "+ Add Exercise" button at the bottom of the
// active session opens a bottom drawer with an autocomplete search over
// the exercise catalog. Selecting an exercise inserts a session_exercises
// row (via addExerciseToSessionAction) and updates the cache so the new
// card appears at the bottom of the list — no navigation, no page reload.
//
// Drawer has two modes:
//   1. "search" (default) — autocomplete over the catalog, with a
//      "+ Create new exercise" link if nothing matches.
//   2. "create" — small inline form (name + category + default rest)
//      that adds a new row to the catalog AND adds it to the current
//      session in one step.

import { useState, useTransition } from 'react';
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
import { createExerciseAction } from '@/app/actions/exercises';
import type { Exercise } from '@/db/schema';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  /** Used to render "already added" visual state on existing entries. */
  existingExerciseIds: string[];
};

const CATEGORIES = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'endurance', label: 'Cardio' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

export function AddExerciseDrawer({
  open,
  onOpenChange,
  sessionId,
  existingExerciseIds,
}: Props) {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('push');
  const [newRest, setNewRest] = useState('60');
  const [creating, startCreating] = useTransition();
  const addEx = useAddExerciseToSession(sessionId);

  // Reset transient UI state whenever the drawer closes.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode('search');
      setQuery('');
      setNewName('');
      setNewCategory('push');
      setNewRest('60');
    }
    onOpenChange(next);
  };

  // Catalog search via the /api/exercises/search Route Handler.
  const { data: results = [] } = useQuery({
    queryKey: ['exercise-search', query] as const,
    queryFn: async (): Promise<Exercise[]> => {
      const resp = await fetch(
        `/api/exercises/search?q=${encodeURIComponent(query)}`,
      );
      if (!resp.ok) return [];
      return resp.json();
    },
    enabled: open && mode === 'search',
    staleTime: 60_000,
  });

  const handleCreateAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const restSeconds = Number.parseInt(newRest, 10);
    startCreating(async () => {
      const created = await createExerciseAction({
        displayName: name,
        category: newCategory,
        defaultRestSeconds: Number.isFinite(restSeconds) ? restSeconds : 60,
      });
      // Construct an Exercise-shaped object for the optimistic cache.
      const optimisticExercise: Exercise = {
        id: created.id,
        slug: created.slug,
        displayName: created.displayName,
        category: newCategory,
        primaryMuscle: null,
        isCompound: false,
        defaultUnit: 'kg',
        defaultRestSeconds: Number.isFinite(restSeconds) ? restSeconds : 60,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addEx.mutate({ exerciseId: created.id, exercise: optimisticExercise });
      handleOpenChange(false);
    });
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'Create new exercise' : 'Add exercise'}
          </DrawerTitle>
        </DrawerHeader>

        {mode === 'search' && (
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

            <Button
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={() => {
                if (query.trim()) setNewName(query.trim());
                setMode('create');
              }}
            >
              + Create new exercise
              {query.trim() && (
                <span className="ml-2 text-muted-foreground">
                  &ldquo;{query.trim()}&rdquo;
                </span>
              )}
            </Button>

            <div className="max-h-[50vh] space-y-1 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {query
                    ? `No matches for "${query}". Tap + Create above to add it.`
                    : 'Loading catalog…'}
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
                        handleOpenChange(false);
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
        )}

        {mode === 'create' && (
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Cable Crossover"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="h-12"
                aria-label="Exercise name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </label>
              <div className="grid grid-cols-5 gap-1">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    type="button"
                    variant={newCategory === cat.value ? 'default' : 'outline'}
                    className="h-10 px-1 text-xs"
                    onClick={() => setNewCategory(cat.value)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Default rest (seconds)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={newRest}
                onChange={(e) => setNewRest(e.target.value)}
                className="h-12 w-24 text-center"
                aria-label="Default rest seconds"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="h-12 flex-1"
                onClick={() => setMode('search')}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={handleCreateAndAdd}
                disabled={creating || !newName.trim()}
              >
                {creating ? 'Creating…' : 'Create & add'}
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

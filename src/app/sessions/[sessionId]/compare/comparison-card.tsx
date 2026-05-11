'use client';

// Per-exercise comparison card. Plan 01-04 D-02c/d/e:
//   - Headline: top-set today vs prior with weight delta (color-coded)
//   - Secondary deltas row: working weight, top reps, volume, e1RM
//   - Collapsed by default; tap to expand → per-position lead-set breakdown
//   - Edge-case badges: first-time / stale / renamed / swapped
//
// Pure presentational client component — receives a fully-resolved
// ExerciseComparison from the Server Component and renders. Click handler
// drives the expand/collapse state locally; no server round trip.

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { ExerciseComparison } from '@/domain/comparison';
import type { Set } from '@/db/schema';

// ─── Formatters ───────────────────────────────────────────────────────────

const fmtKg = (n: number | null | undefined): string => {
  if (n == null) return '—';
  // Show one decimal only when needed (40 → "40", 42.5 → "42.5")
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}kg`;
};

const fmtReps = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `${n}`;
};

const fmtDelta = (n: number | null, unit: string): string => {
  if (n == null) return '—';
  if (n === 0) return `±0${unit}`;
  const abs = Math.abs(n);
  const formatted = abs % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
  return `${n > 0 ? '+' : ''}${formatted}${unit}`;
};

/** Format duration (seconds) as MM:SS for endurance exercises. */
const fmtDuration = (sec: number | null | undefined): string => {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const colorClass = (n: number | null): string => {
  if (n == null) return 'text-muted-foreground';
  if (n > 0) return 'text-green-600 dark:text-green-400';
  if (n < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
};

// ─── Helpers for endurance exercise rendering ────────────────────────────

/** Pick the lead duration set (first non-drop, non-deleted set with a
 *  non-null durationSeconds). Used for endurance headline. */
function leadDurationSet(sets: Set[]): Set | null {
  return (
    sets.find(
      (s) => !s.isDropTier && !s.isDeleted && s.durationSeconds != null,
    ) ?? null
  );
}

/** True when the exercise has any duration-only sets and no strength sets.
 *  Used to switch the headline format from "kg × reps" to "MM:SS". */
function isEnduranceExercise(sets: Set[]): boolean {
  const hasStrength = sets.some(
    (s) => !s.isDeleted && s.weightKg != null && s.reps != null,
  );
  const hasDuration = sets.some(
    (s) => !s.isDeleted && s.durationSeconds != null,
  );
  return hasDuration && !hasStrength;
}

// ─── Edge-case badge renderer ────────────────────────────────────────────

function EdgeCaseBadge({ edgeCase }: { edgeCase: ExerciseComparison['edgeCase'] }) {
  switch (edgeCase.kind) {
    case 'normal':
      return null;
    case 'first-time':
      return (
        <Badge className="mt-1 bg-blue-500 text-white hover:bg-blue-500">
          ✨ first time
        </Badge>
      );
    case 'stale':
      return (
        <Badge className="mt-1 bg-orange-500 text-white hover:bg-orange-500">
          ⏱ {edgeCase.daysAgo} days ago — context may differ
        </Badge>
      );
    case 'renamed':
      return (
        <Badge variant="secondary" className="mt-1">
          ↻ matched via canonical ID (was: {edgeCase.priorDisplayName})
        </Badge>
      );
    case 'swapped':
      return (
        <Badge variant="outline" className="mt-1 whitespace-normal text-left">
          — different exercise this time ({edgeCase.priorExerciseDisplayName} ≠ this);
          no comparison computed
        </Badge>
      );
  }
}

// ─── Main component ──────────────────────────────────────────────────────

export function ComparisonCard({ comparison: c }: { comparison: ExerciseComparison }) {
  const [expanded, setExpanded] = useState(false);
  const isEndurance = isEnduranceExercise(c.todaySets);
  const todayDur = isEndurance ? leadDurationSet(c.todaySets) : null;
  const priorDur =
    isEndurance && c.priorSets ? leadDurationSet(c.priorSets) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">
              {c.exercise.displayName}
            </h3>
            <EdgeCaseBadge edgeCase={c.edgeCase} />
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Collapse breakdown' : 'Expand breakdown'}
            className="h-12 w-12 shrink-0"
          >
            {expanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Headline (D-02c) */}
        <div className="font-mono text-sm">
          {isEndurance ? (
            // Endurance: MM:SS today vs prior
            priorDur ? (
              <>
                <span className="text-muted-foreground">
                  {fmtDuration(priorDur.durationSeconds)}
                </span>
                {' → '}
                <span className="font-semibold">
                  {fmtDuration(todayDur?.durationSeconds)}
                </span>
                {todayDur && priorDur && todayDur.durationSeconds != null && priorDur.durationSeconds != null && (
                  <>
                    {' '}
                    <span
                      className={colorClass(
                        todayDur.durationSeconds - priorDur.durationSeconds,
                      )}
                    >
                      ({fmtDelta(todayDur.durationSeconds - priorDur.durationSeconds, 's')})
                    </span>
                  </>
                )}
              </>
            ) : (
              <span className="font-semibold">
                {fmtDuration(todayDur?.durationSeconds)}
              </span>
            )
          ) : c.headline ? (
            // Strength normal/stale/renamed: top-set delta
            c.headline.priorTopSet ? (
              <>
                <span className="text-muted-foreground">
                  {fmtKg(c.headline.priorTopSet.weightKg)} × {c.headline.priorTopSet.reps}
                </span>
                {' → '}
                <span className="font-semibold">
                  {fmtKg(c.headline.todayTopSet?.weightKg ?? null)} ×{' '}
                  {fmtReps(c.headline.todayTopSet?.reps)}
                </span>
                {' '}
                <span className={colorClass(c.headline.weightDelta)}>
                  ({fmtDelta(c.headline.weightDelta, 'kg')})
                </span>
              </>
            ) : (
              // Prior had no strength top set (e.g., all-drop or empty)
              <span className="font-semibold">
                {fmtKg(c.headline.todayTopSet?.weightKg ?? null)} ×{' '}
                {fmtReps(c.headline.todayTopSet?.reps)}
              </span>
            )
          ) : (
            // First-time or swapped: show today's top set only
            (() => {
              const todayTop = c.todaySets.find(
                (s) => !s.isDropTier && !s.isDeleted && s.weightKg != null && s.reps != null,
              );
              if (!todayTop) {
                return (
                  <span className="text-muted-foreground">No sets logged</span>
                );
              }
              return (
                <span className="font-semibold">
                  {fmtKg(todayTop.weightKg)} × {fmtReps(todayTop.reps)}
                </span>
              );
            })()
          )}
        </div>

        {/* Secondary deltas row (D-02c) */}
        {c.secondary && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-muted-foreground">working wt:</span>{' '}
              <span className={colorClass(c.secondary.workingWeightDelta)}>
                {fmtDelta(c.secondary.workingWeightDelta, 'kg')}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">top reps:</span>{' '}
              <span className={colorClass(c.secondary.topSetRepsDelta)}>
                {fmtDelta(c.secondary.topSetRepsDelta, '')}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">vol:</span>{' '}
              <span className={colorClass(c.secondary.volumeDelta)}>
                {fmtDelta(c.secondary.volumeDelta, 'kg')}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">e1RM:</span>{' '}
              <span className={colorClass(c.secondary.e1rmDelta)}>
                {fmtDelta(c.secondary.e1rmDelta, 'kg')}
              </span>
            </span>
          </div>
        )}

        {/* Expanded per-set breakdown (D-02d) */}
        {expanded && c.perSetDeltas.length > 0 && (
          <div className="mt-3 space-y-1 border-t pt-2">
            {c.perSetDeltas.map((s) => (
              <div
                key={s.position}
                className="flex items-center gap-3 font-mono text-xs"
              >
                <span className="w-6 text-muted-foreground">#{s.position}</span>
                <span className="w-24 text-right text-muted-foreground">
                  {s.prior
                    ? `${fmtKg(s.prior.weightKg)} × ${fmtReps(s.prior.reps)}`
                    : '—'}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="w-24 font-semibold">
                  {s.today
                    ? `${fmtKg(s.today.weightKg)} × ${fmtReps(s.today.reps)}`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

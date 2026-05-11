'use client';

// Set row — the atom of the active-session UI.
//
// Two modes:
//   - Logged set (set != null): renders the persisted weight/reps; long-press
//     opens the LongPressMenu (delete + tag-as-drop). Editing in-place is a
//     v1.x feature; today's edit story is Plan 01-05's history view.
//   - Draft (set == null + draftPosition supplied): renders empty inputs with
//     prior-performance ghost text; tapping the green checkmark commits a
//     new set via useLogSetOptimistic, then clears.
//
// Friction-budget (LOG-09) details that matter:
//   - inputMode={'decimal' | 'numeric'} so the native numeric keypad opens.
//   - h-12 (= 48 px) on every interactive element per LOG-07.
//   - Done button is the visually largest element on the right edge — thumb
//     zone, no tooltip, single tap commits.
//   - autoComplete='off' + spellCheck=false so iOS doesn't try to correct
//     "40" into "4O" or autosuggest a contact name.

import { useRef, useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LongPressMenu } from './long-press-menu';
import {
  useDeleteSet,
  useEditSet,
  useLogSetOptimistic,
} from '@/hooks/use-active-session';
import type { Exercise, Set } from '@/db/schema';

type CommonProps = {
  sessionId: string;
  exercise: Exercise;
  /** Prior performance at this set position; used for ghost text. */
  priorSet: Set | null;
};

type LoggedProps = CommonProps & {
  set: Set;
  /** Callback invoked when the user taps "Tag as drop-set tier". The parent
   *  ExerciseCard owns parent-id resolution + the optimistic mutation; the
   *  row just dispatches the intent. Returns false (or no callback) to hide
   *  the menu option (e.g. when no chainable parent exists). */
  onTagAsDropTier?: () => void;
  draftPosition?: never;
  draftSessionExerciseId?: never;
  onDraftLogged?: never;
};

type DraftProps = CommonProps & {
  set?: null;
  draftPosition: number;
  draftSessionExerciseId: string;
  /** Called after a successful commit so the parent can start the rest timer. */
  onDraftLogged: () => void;
  onTagAsDropTier?: never;
};

type Props = LoggedProps | DraftProps;

const isEnduranceExercise = (ex: Exercise): boolean =>
  ex.category === 'endurance';

export function SetRow(props: Props) {
  const { exercise, priorSet, sessionId } = props;
  const isDraft = !props.set;
  const isEndurance = isEnduranceExercise(exercise);

  // Local input state. Logged sets are seeded from their persisted values;
  // drafts start empty (ghost text covers the visual default).
  const [weight, setWeight] = useState<string>(
    props.set?.weightKg != null ? String(props.set.weightKg) : '',
  );
  const [reps, setReps] = useState<string>(
    props.set?.reps != null ? String(props.set.reps) : '',
  );
  const [duration, setDuration] = useState<string>(
    props.set?.durationSeconds != null ? String(props.set.durationSeconds) : '',
  );

  const logSet = useLogSetOptimistic(sessionId);
  const editSet = useEditSet(sessionId);
  const deleteSet = useDeleteSet(sessionId);

  const ghostWeight = priorSet?.weightKg ?? null;
  const ghostReps = priorSet?.reps ?? null;
  const ghostDuration = priorSet?.durationSeconds ?? null;

  const handleDone = () => {
    // Resolve final values: typed override > ghost text > skip
    const finalWeight =
      weight !== '' ? Number.parseFloat(weight) : (ghostWeight ?? undefined);
    const finalReps =
      reps !== '' ? Number.parseInt(reps, 10) : (ghostReps ?? undefined);
    const finalDuration =
      duration !== ''
        ? Number.parseInt(duration, 10)
        : (ghostDuration ?? undefined);

    if (isDraft) {
      // Validation gate: at least one canonical field must be supplied.
      if (!isEndurance && (finalWeight == null || finalReps == null)) return;
      if (isEndurance && finalDuration == null) return;

      logSet.mutate({
        sessionExerciseId: props.draftSessionExerciseId,
        position: props.draftPosition,
        weightKg: isEndurance ? undefined : finalWeight,
        reps: isEndurance ? undefined : finalReps,
        durationSeconds: isEndurance ? finalDuration : undefined,
      });
      // Clear inputs after commit so the next draft starts fresh
      setWeight('');
      setReps('');
      setDuration('');
      props.onDraftLogged();
    } else if (props.set) {
      // Edit mode: only update if values actually changed
      const patch: Record<string, number | undefined> = {};
      if (!isEndurance) {
        if (finalWeight != null && finalWeight !== props.set.weightKg)
          patch.weightKg = finalWeight;
        if (finalReps != null && finalReps !== props.set.reps)
          patch.reps = finalReps;
      } else if (
        finalDuration != null &&
        finalDuration !== props.set.durationSeconds
      ) {
        patch.durationSeconds = finalDuration;
      }
      if (Object.keys(patch).length > 0) {
        editSet.mutate({ setId: props.set.id, ...patch });
      }
    }
  };

  // 600 ms long-press → context menu. Touch + mouse handlers so the same
  // code path works in DevTools mobile emulation and real touch.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const startLongPress = () => {
    if (!props.set) return; // drafts have no menu
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 600);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const indented = props.set?.isDropTier === true;
  const setNumberDisplay = props.set?.isDropTier
    ? 'DS'
    : (props.set?.position ?? props.draftPosition);

  return (
    <>
      <div
        className={`flex items-center gap-2 ${
          indented ? 'border-l-2 border-orange-400 pl-4' : ''
        }`}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
      >
        {/* Set number / DS badge */}
        <div
          className={`w-8 text-center text-sm tabular-nums ${
            indented ? 'font-semibold text-orange-500' : 'text-muted-foreground'
          }`}
          aria-label={indented ? 'Drop-set tier' : `Set ${setNumberDisplay}`}
        >
          {setNumberDisplay}
        </div>

        {/* Inputs */}
        {isEndurance ? (
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={ghostDuration != null ? `${ghostDuration}s` : '—'}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="h-12 flex-1 text-center text-base"
            aria-label="Duration in seconds"
          />
        ) : (
          <>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={ghostWeight != null ? `${ghostWeight}kg` : '—'}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-12 w-20 text-center text-base"
              aria-label="Weight in kilograms"
            />
            <span className="text-muted-foreground" aria-hidden="true">
              ×
            </span>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={ghostReps != null ? `${ghostReps}` : '—'}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="h-12 w-16 text-center text-base"
              aria-label="Reps"
            />
          </>
        )}

        {/* Done checkmark — primary thumb-zone target, ≥48 px */}
        <Button
          size="icon"
          onClick={handleDone}
          className="size-12 shrink-0"
          variant={isDraft ? 'default' : 'outline'}
          aria-label={isDraft ? 'Log set' : 'Save edit'}
        >
          <CheckIcon className="size-5" />
        </Button>
      </div>

      {/* Long-press context menu — only for logged sets */}
      {props.set && (
        <LongPressMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          set={props.set}
          onTagAsDropTier={props.onTagAsDropTier}
          onDelete={() => {
            if (props.set) deleteSet.mutate(props.set.id);
          }}
        />
      )}
    </>
  );
}

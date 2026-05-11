'use client';

// Inline edit + soft-delete row for the read-only past-session detail (HIST-05).
//
// Two visual states:
//   - View mode: weight×reps (or duration for endurance), pencil icon to edit,
//     trash icon to delete (with two-step confirm so a fat-finger doesn't
//     nuke a row).
//   - Edit mode: editable weight/reps/duration inputs, green checkmark to
//     save, X to cancel.
//
// Why two-step delete instead of long-press menu: past-session edits are
// deliberate and low-frequency, and the active-session long-press menu's
// thumb-zone bias doesn't apply here (the user is sitting reviewing history,
// not mid-rest). A visible Confirm button after tapping trash keeps the
// destructive action explicit per HIST-05's audit-trail intent.
//
// useTransition gives us a `pending` flag during the Server Action round trip
// so we can disable the Save/Confirm buttons + show a spinner-equivalent.
// The Server Action's revalidatePath('/sessions/[sessionId]', 'layout') causes
// the RSC parent to re-render with fresh DB state — no manual cache fiddling.

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from 'lucide-react';
import { editSetAction, deleteSetAction } from '@/app/actions/sets';
import type { Set } from '@/db/schema';

type Props = {
  set: Set;
  isEndurance: boolean;
};

export function PastSetRow({ set, isEndurance }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  // Local input state seeded from the persisted row each render. When the
  // parent re-renders with fresh data after revalidatePath, the new prop
  // values flow through — but the local state from a just-completed edit
  // doesn't auto-reset, which is fine because we exit edit mode after save.
  const [weight, setWeight] = useState<string>(
    set.weightKg != null ? String(set.weightKg) : '',
  );
  const [reps, setReps] = useState<string>(
    set.reps != null ? String(set.reps) : '',
  );
  const [duration, setDuration] = useState<string>(
    set.durationSeconds != null ? String(set.durationSeconds) : '',
  );

  const beginEdit = () => {
    // Re-seed inputs from the latest server state in case the row was
    // updated externally (e.g., another tab) since this component mounted.
    setWeight(set.weightKg != null ? String(set.weightKg) : '');
    setReps(set.reps != null ? String(set.reps) : '');
    setDuration(set.durationSeconds != null ? String(set.durationSeconds) : '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const save = () => {
    if (isEndurance) {
      const d =
        duration !== '' ? Number.parseInt(duration, 10) : undefined;
      // Refuse to send a meaningless edit (NaN, empty). Better to do nothing
      // than write `null` over a previously-valid value.
      if (d == null || Number.isNaN(d)) {
        setEditing(false);
        return;
      }
      startTransition(async () => {
        await editSetAction({ setId: set.id, durationSeconds: d });
        setEditing(false);
      });
    } else {
      const w = weight !== '' ? Number.parseFloat(weight) : undefined;
      const r = reps !== '' ? Number.parseInt(reps, 10) : undefined;
      // Same guard: empty/NaN inputs do nothing rather than clobbering data.
      if (
        (w == null || Number.isNaN(w)) &&
        (r == null || Number.isNaN(r))
      ) {
        setEditing(false);
        return;
      }
      startTransition(async () => {
        await editSetAction({
          setId: set.id,
          weightKg: w != null && !Number.isNaN(w) ? w : undefined,
          reps: r != null && !Number.isNaN(r) ? r : undefined,
        });
        setEditing(false);
      });
    }
  };

  const confirmAndDelete = () => {
    startTransition(async () => {
      await deleteSetAction(set.id);
      // Row vanishes from the parent list on next render; no local cleanup needed.
    });
  };

  const indented = set.isDropTier;
  const setNumberDisplay = set.isDropTier ? 'DS' : set.position;

  return (
    <div
      className={`flex items-center gap-2 ${
        indented ? 'border-l-2 border-orange-400 pl-4' : ''
      }`}
    >
      <div
        className={`w-8 text-center text-sm tabular-nums ${
          indented ? 'font-semibold text-orange-500' : 'text-muted-foreground'
        }`}
        aria-label={indented ? 'Drop-set tier' : `Set ${setNumberDisplay}`}
      >
        {setNumberDisplay}
      </div>

      {editing ? (
        <>
          {isEndurance ? (
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-12 flex-1 text-center text-base"
              aria-label="Duration in seconds"
              disabled={pending}
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
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-12 w-20 text-center text-base"
                aria-label="Weight in kilograms"
                disabled={pending}
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
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="h-12 w-16 text-center text-base"
                aria-label="Reps"
                disabled={pending}
              />
            </>
          )}
          <Button
            size="icon"
            onClick={save}
            disabled={pending}
            className="size-12 shrink-0"
            aria-label="Save edit"
          >
            <CheckIcon className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={cancelEdit}
            disabled={pending}
            className="size-12 shrink-0 text-muted-foreground"
            aria-label="Cancel edit"
          >
            <XIcon className="size-5" />
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1 font-mono text-sm tabular-nums">
            {isEndurance
              ? set.durationSeconds != null
                ? `${set.durationSeconds}s`
                : '—'
              : `${set.weightKg ?? '—'}kg × ${set.reps ?? '—'}`}
          </div>

          {confirmDelete ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmAndDelete}
                disabled={pending}
                className="h-12"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={pending}
                className="h-12 text-muted-foreground"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={beginEdit}
                disabled={pending}
                className="size-12 shrink-0 text-muted-foreground"
                aria-label="Edit set"
              >
                <PencilIcon className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="size-12 shrink-0 text-destructive"
                aria-label="Delete set"
              >
                <Trash2Icon className="size-5" />
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

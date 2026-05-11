'use client';

// Context menu shown after a 600 ms long-press on a logged set row
// (CONTEXT D-01d + D-01f). Sheet anchored to the bottom edge so the menu
// items live inside the user's thumb zone.
//
// "Tag as drop-set tier" is hidden when the set is already a drop tier
// (idempotent behavior + reduces accidental retags). Phase 1 doesn't ship
// in-place edit yet — Plan 01-05's history view owns past-session edit per
// CONTEXT.md D-01f. The Delete option here covers the in-session need.

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { Set } from '@/db/schema';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  set: Set;
  /** Callback invoked when the user taps "Tag as drop-set tier". The parent
   *  ExerciseCard owns parent-id resolution because it has the full ordered
   *  set list in scope. The menu just dispatches the intent. */
  onTagAsDropTier?: () => void;
  /** Soft-delete the set. */
  onDelete: () => void;
};

export function LongPressMenu({
  open,
  onOpenChange,
  set,
  onTagAsDropTier,
  onDelete,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto pb-6">
        <SheetHeader>
          <SheetTitle>Set actions</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 px-4 py-3">
          {!set.isDropTier && onTagAsDropTier && (
            <Button
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={() => {
                onTagAsDropTier();
                onOpenChange(false);
              }}
            >
              Tag as drop-set tier
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-12 w-full justify-start"
            onClick={() => {
              onDelete();
              onOpenChange(false);
            }}
          >
            Delete set
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

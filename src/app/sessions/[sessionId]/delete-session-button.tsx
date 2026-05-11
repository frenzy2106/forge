'use client';

// Delete-session button + confirmation dialog for the past-session detail
// view. Soft-delete via deleteSessionAction; on success redirects to home.
//
// Past-session view is otherwise a Server Component — this client island
// exists just for the dialog state + the post-action redirect.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteSessionAction } from '@/app/actions/sessions';

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteSessionAction(sessionId);
      router.push('/');
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isDeleting}
      >
        Delete session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The session and all its sets will be removed from your history.
            (Soft-delete — the data stays in the DB for audit, but vanishes
            from every screen.)
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

// Notes field for the comparison report. CONTEXT D-02f: single optional
// free-text field at the bottom of the report; saves on blur to sessions.notes.
// No required vibe rating, RPE, or other ceremony — friction stays at zero.
//
// Save strategy: blur OR debounced auto-save after 800ms idle. Debounced save
// covers the case where the user types a paragraph and never blurs (e.g.,
// they tap "Done — back to home" without dismissing the keyboard); blur
// covers the immediate case. Both paths route through the same Server Action
// and short-circuit if the buffered text equals the last persisted value.

import { useEffect, useRef, useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { saveSessionNotesAction } from '@/app/actions/sessions';

const DEBOUNCE_MS = 800;

export function NotesField({
  sessionId,
  initialNotes,
}: {
  sessionId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  // Track the last value successfully persisted, so we never re-issue an
  // identical save on blur/debounce.
  const lastSavedRef = useRef(initialNotes);
  const [savedTick, setSavedTick] = useState(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (notes === lastSavedRef.current) return;
    const snapshot = notes;
    startTransition(async () => {
      await saveSessionNotesAction({ sessionId, notes: snapshot });
      lastSavedRef.current = snapshot;
      setSavedTick((t) => t + 1);
    });
  };

  // Debounced auto-save while typing.
  useEffect(() => {
    if (notes === lastSavedRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // flush is closed over snapshot at call-time so it doesn't need to be in
    // deps; sessionId is stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  return (
    <div className="space-y-1">
      <label
        className="text-sm text-muted-foreground"
        htmlFor={`notes-${sessionId}`}
      >
        Notes (optional)
      </label>
      <Textarea
        id={`notes-${sessionId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={flush}
        placeholder="How did this session feel? Any context?"
        rows={3}
        maxLength={4000}
        className="resize-none"
      />
      <div className="h-4 text-xs">
        {pending && <span className="text-muted-foreground">Saving…</span>}
        {!pending && savedTick > 0 && (
          <span className="text-green-600 dark:text-green-400">Saved.</span>
        )}
      </div>
    </div>
  );
}

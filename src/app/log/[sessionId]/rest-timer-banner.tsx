'use client';

// Sticky top banner for the rest timer (CONTEXT D-01g).
// - Stays visible while scrolling the exercise list.
// - + button extends 15s; X dismisses.
// - When remainingSeconds is null the banner unmounts so it doesn't take
//   up space in the layout.

import { PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RestTimerApi } from '@/hooks/use-rest-timer';

type Props = { timer: RestTimerApi };

export function RestTimerBanner({ timer }: Props) {
  if (timer.remainingSeconds === null) return null;
  const total = Math.max(0, timer.remainingSeconds);
  const m = Math.floor(total / 60);
  const s = total % 60;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 flex items-center gap-2 bg-orange-500 px-4 py-2 text-white"
    >
      <span className="flex-1 font-mono text-2xl tabular-nums" aria-label="Rest remaining">
        {m}:{s.toString().padStart(2, '0')}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className="size-10 text-white hover:bg-white/10"
        onClick={() => timer.extend(15)}
        aria-label="Add 15 seconds"
      >
        <PlusIcon className="size-5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-10 text-white hover:bg-white/10"
        onClick={() => timer.dismiss()}
        aria-label="Dismiss rest timer"
      >
        <XIcon className="size-5" />
      </Button>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import type { Card, HeldView } from '../../types.ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '../ui/alert-dialog.tsx';
import { Button, TAP } from '../ui/button.tsx';
import { announce, copy } from '../ui.ts';
import { discardHeld, landHeld } from './actions.ts';
import { WARNING } from './parts.tsx';

const short = (sha: string) => sha.slice(0, 7);

function Moved({ card, held, id }: { card: Card; held: HeldView; id: string }) {
  if (held.state !== 'held' || held.tip === held.head) return null;
  if (held.tip === null)
    return (
      <p id={id} className={WARNING}>
        {`The board cannot read the branch tip of #${card.number}, so Land is off. Check the lane branch.`}
      </p>
    );
  return (
    <p id={id} className={WARNING}>
      {`The lane branch moved from head ${short(held.head)} to ${short(held.tip)}, so Land is off. Review it:`}
      <code className="mt-1 mb-2 block font-mono [overflow-wrap:anywhere]">{`git diff ${held.head}..${held.tip}`}</code>
      {'Then land it by hand:'}
      <code className="mt-1 block font-mono [overflow-wrap:anywhere]">{`celetis --agent <host> land ${card.number} '<subject>'`}</code>
    </p>
  );
}

export function HeldPanel({ card }: { card: Card }) {
  const { held } = card;
  const noteId = useId();
  const [isOpen, setOpen] = useState(false);
  const [pressed, setPressed] = useState<'land' | 'discard' | null>(null);
  const [refused, setRefused] = useState<{ head: string; line: string } | null>(null);
  const pressing = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const isLanding = pressed === 'land' || Boolean(card.landing);
  const isDiscarding = pressed === 'discard';
  const isBusy = isLanding || isDiscarding;
  const isOff = held !== null && held !== undefined && held.state === 'held' && held.tip !== held.head;
  useEffect(() => {
    if (isLanding) {
      announce('Landing…');
      setOpen(false);
    }
  }, [isLanding]);
  useEffect(() => {
    if (isDiscarding) announce('Discarding…');
  }, [isDiscarding]);
  const press = async (kind: 'land' | 'discard', act: () => Promise<unknown>) => {
    if (isBusy || pressing.current) return;
    pressing.current = true;
    setPressed(kind);
    try {
      await act();
    } finally {
      pressing.current = false;
      setPressed(null);
    }
  };
  const land = () => {
    if (!held || isOff) return;
    void press('land', async () => {
      setRefused(null);
      const line = await landHeld(card, held);
      if (line !== null) setRefused({ head: held.head, line });
    });
  };
  return (
    <>
      <div data-held="" className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
        {held && (
          <span className="inline-flex min-w-0 gap-[5px] font-mono text-[0.6875rem] leading-none whitespace-nowrap text-muted-foreground tabular-nums">
            <span title="Head commit">
              {'head '}
              <button
                type="button"
                aria-label={`Copy the full head SHA ${short(held.head)}`}
                title="Copy the full head SHA"
                className={`${TAP} cursor-pointer rounded-[3px] border-0 bg-transparent p-0 font-[inherit] text-[inherit] underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ring`}
                onClick={() => void copy(held.head, 'head SHA')}
              >
                {short(held.head)}
              </button>
            </span>
            <span aria-hidden="true">·</span>
            <span title="Patch ID">{`patch ${short(held.patch)}`}</span>
          </span>
        )}
        <div className="ml-auto inline-flex flex-none items-center gap-1">
          {held && (
            <Button
              variant="primary"
              size="action"
              aria-disabled={isOff || isBusy ? 'true' : undefined}
              aria-describedby={isOff ? noteId : undefined}
              aria-busy={isLanding ? 'true' : undefined}
              onClick={land}
            >
              {isLanding ? 'Landing…' : 'Land'}
            </Button>
          )}
          <Button
            variant="quiet"
            size="action"
            aria-disabled={isBusy ? 'true' : undefined}
            aria-busy={isDiscarding ? 'true' : undefined}
            onClick={() => {
              if (!isBusy) setOpen(true);
            }}
          >
            {isDiscarding ? 'Discarding…' : 'Discard'}
          </Button>
        </div>
      </div>
      {held && <Moved card={card} held={held} id={noteId} />}
      {held?.state === 'released' && refused?.head === held.head && <p className={WARNING}>{refused.line}</p>}
      <AlertDialog open={isOpen} onOpenChange={setOpen}>
        <AlertDialogContent initialFocus={cancel}>
          <AlertDialogTitle>Discard #{card.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            The issue closes as wontfix and the worktree goes. The commits stay on the origin branch.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false);
                void press('discard', () => discardHeld(card));
              }}
            >
              Discard change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

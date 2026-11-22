import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '../ui/alert-dialog.tsx';
import { pressAct, stopText } from './actions.ts';
import { columnStop } from './keys.ts';
import { screen, useScreen } from './state.ts';

export function StopDialog() {
  const stopFor = useScreen((state) => state.stopFor);
  const cancel = useRef<HTMLButtonElement>(null);
  const shown = useRef(stopFor);
  const column = useRef<string | null>(null);
  if (stopFor !== null && stopFor !== shown.current) {
    shown.current = stopFor;
    column.current = screen.index().byKey.get(stopFor.key)?.column ?? null;
  }
  const current = shown.current;

  const focusAfter = () => {
    if (current === null) return true;
    const card = document.querySelector<HTMLElement>(`#tp-board .card[data-key="${CSS.escape(current.key)}"]`);
    if (card?.isConnected) return card;
    const name = screen.index().byKey.get(current.key)?.column ?? column.current;
    return columnStop(`col-${name}`) ?? true;
  };

  const stop = () => {
    if (current === null) return;
    const { card } = current;
    screen.closeStop();
    void pressAct('stops', card, '/api/stop', { number: card.number, sessionId: card.sessionId }, stopText(card));
  };

  return (
    <AlertDialog open={stopFor !== null} onOpenChange={(isOpen) => !isOpen && screen.closeStop()}>
      <AlertDialogContent initialFocus={cancel} finalFocus={focusAfter}>
        <AlertDialogTitle>
          {current && `Stop the ${current.card.step} session of #${current.card.number}?`}
        </AlertDialogTitle>
        <AlertDialogDescription>
          The agent ends and its tab closes. The issue moves to Idle as set aside, and auto mode skips it. Resume opens
          the saved session again.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={stop}>Stop session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

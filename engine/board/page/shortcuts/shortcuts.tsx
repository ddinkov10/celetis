import { useSyncExternalStore } from 'react';
import { Icon } from '../app/icon.tsx';
import { shellStore, useShellStore } from '../store.ts';
import { Button } from '../ui/button.tsx';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../ui/dialog.tsx';
import { ViewBoundary } from '../ui/view-boundary.tsx';

const ROW = 'flex items-center gap-3.5 px-2 py-[7px] not-first:border-t not-first:border-border';

const listeners = new Set<() => void>();
let isOpen = false;

const setOpen = (next: boolean) => {
  if (next === isOpen) return;
  isOpen = next;
  for (const listener of listeners) listener();
};

export const openShortcuts = () => setOpen(true);
export const isShortcutsOpen = () => isOpen;
// The palette opens over this dialog with no nesting, so an Esc or an outside press reaches both.
const isCovered = () => document.querySelector('[data-slot="palette"]') !== null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function Shortcuts() {
  const open = useSyncExternalStore(subscribe, isShortcutsOpen);
  const keys = useShellStore((state) => state.settings.keys);
  return (
    <Dialog open={open} onOpenChange={(next) => (next || !isCovered()) && setOpen(next)}>
      <DialogContent>
        <ViewBoundary snapshot={keys} fallback={null}>
          <div className="flex items-center justify-between pt-4 pr-4 pb-2 pl-5">
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogClose render={<Button variant="icon" size="icon" className="[border:0]" aria-label="Close" />}>
              <Icon name="close" />
            </DialogClose>
          </div>
          <dl className="m-0 px-3 pt-1 pb-2">
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>⌘K</kbd>
                <kbd>/</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">
                Search the cards, history, and commands, or type #n to jump to an issue
              </dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>j</kbd>
                <kbd>k</kbd>
                <kbd>↓</kbd>
                <kbd>↑</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Next or previous card or epic group</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>h</kbd>
                <kbd>l</kbd>
                <kbd>←</kbd>
                <kbd>→</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Card in the column to the left or right</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>Enter</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">
                Main button of the card: Go, Run, Resume, Open agent, Open shell, or Open issue
              </dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>Space</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">
                {'Show the details of the card; '}
                <kbd>Esc</kbd>
                {' hides them'}
              </dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>Enter</kbd>
                <kbd>Space</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">On an epic group, show or hide its issues</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>m</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">All the actions of the card</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>o</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Open the issue</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>c</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Copy the command or the path of the card</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>s</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Set the card aside, or stop its session</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>v</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Change between the tabs Agents and Pipeline</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>d</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Open or close the tab History</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>r</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Read the issues again</dd>
            </div>
            <div className={ROW}>
              <dt className="flex w-[92px] flex-none gap-1">
                <kbd>?</kbd>
              </dt>
              <dd className="m-0 text-[0.8125rem]">Show this list</dd>
            </div>
          </dl>
          <label className="mx-3 mt-0 mb-3.5 flex cursor-pointer items-start gap-2.5 rounded-xl bg-secondary p-3 text-[0.78125rem] leading-[1.6] font-medium [&_kbd]:min-h-[18px] [&_kbd]:min-w-[18px] [&_kbd]:px-1 [&_kbd]:text-[0.6875rem]">
            <input
              type="checkbox"
              id="keys-on"
              className="mx-0 mt-[3px] mb-0 size-4 flex-none accent-ring"
              checked={keys}
              onChange={(event) => shellStore.setKeys(event.target.checked)}
            />
            <span>
              Single-key shortcuts (<kbd>j</kbd> <kbd>k</kbd> <kbd>h</kbd> <kbd>l</kbd> <kbd>v</kbd> <kbd>d</kbd>{' '}
              <kbd>r</kbd> <kbd>/</kbd> <kbd>?</kbd>
              ). The keys of a focused card or epic group always work.
            </span>
          </label>
        </ViewBoundary>
      </DialogContent>
    </Dialog>
  );
}

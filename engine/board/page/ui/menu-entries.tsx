import { useEffect, useRef } from 'react';
import type { MenuEntry } from '../../types.ts';
import { Icon } from '../app/icon.tsx';
import { AGENT_ICONS } from '../ui.ts';
import { DropdownMenuItem, DropdownMenuSeparator } from './dropdown-menu.tsx';

export function Entries({ list, close }: { list: () => (MenuEntry | 'rule')[]; close: () => void }) {
  return list().map((entry, at) =>
    entry === 'rule' ? (
      <DropdownMenuSeparator key={`rule-${at}`} />
    ) : (
      <DropdownMenuItem
        key={entry.label}
        title={entry.title}
        aria-disabled={entry.isDisabled ? 'true' : undefined}
        closeOnClick={false}
        onClick={() => {
          close();
          // Base UI focuses the clicked item after this handler; an act that moves the focus runs after that.
          queueMicrotask(entry.run);
        }}
      >
        {entry.host ? (
          <span className="grid size-4 place-items-center">
            <img className="block size-4" src={AGENT_ICONS[entry.host]} alt="" />
          </span>
        ) : (
          <Icon name={entry.icon} />
        )}
        <div className="flex min-w-0 items-center gap-2">
          <span>{entry.label}</span>
          {entry.tag && (
            <em className="flex-none rounded-full bg-accent px-[7px] py-px text-[0.6875rem] text-foreground not-italic">
              {entry.tag}
            </em>
          )}
        </div>
        {entry.key ? <kbd>{entry.key}</kbd> : <span />}
      </DropdownMenuItem>
    ),
  );
}

export function FirstFocus() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.parentElement?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, []);
  return <span ref={ref} hidden />;
}

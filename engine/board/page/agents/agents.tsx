import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { Host } from '../../../lib/config/core.ts';
import type { QuotaWait } from '../../types.ts';
import { areaStop } from '../operations/state.ts';
import { Button } from '../ui/button.tsx';
import { DropdownMenu, DropdownMenuContent } from '../ui/dropdown-menu.tsx';
import { useFocusedKey } from '../ui/focused-key.ts';
import { Entries, FirstFocus } from '../ui/menu-entries.tsx';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { AGENT_ICONS } from '../ui.ts';
import { useHandleDrag } from './drag.ts';
import { agentStore, useAgents } from './state.ts';

const ROOT =
  'group/order relative font-sans text-[0.8125rem] leading-[1.4] font-normal whitespace-normal text-foreground data-[dragging]:cursor-grabbing';
const HANDLE =
  'grid h-7 w-6 flex-none cursor-grab touch-none place-items-center rounded-sm border-0 bg-transparent text-muted-foreground group-data-[dragging]/order:cursor-grabbing aria-disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring phone:min-h-11 phone:min-w-11 [&:hover]:bg-accent [&:hover]:text-foreground';
const ROW = 'flex min-h-10 items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 select-none phone:min-h-12';
const NOTICE = 'mx-2.5 my-1.5 text-[0.75rem] wrap-anywhere text-card-foreground';

const GRIP = [2.5, 7.5].flatMap((cx) => [2.5, 7, 11.5].map((cy) => ({ cx, cy })));

const keyOf = (node: HTMLElement) => {
  const host = node.closest<HTMLElement>('[data-host]')?.dataset.host;
  if (host) return `handle:${host}`;
  return node.dataset.wait ? `wait:${node.dataset.wait}` : null;
};
const handleOf = (root: HTMLElement | null, host: Host | null) =>
  host ? (root?.querySelector<HTMLElement>(`[data-host="${host}"] [data-handle]`) ?? null) : null;

const Grip = () => (
  <svg className="h-3.5 w-2.5" viewBox="0 0 10 14" aria-hidden="true">
    {GRIP.map(({ cx, cy }) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="currentColor" />
    ))}
  </svg>
);

function RowBody({ host, rank, name, detail }: { host: Host; rank: number | null; name: string; detail: string }) {
  return (
    <>
      <span className="w-3.5 text-right text-[0.75rem] text-muted-foreground tabular-nums">
        {rank === null ? '–' : rank}
      </span>
      <span className="relative grid size-[18px] flex-none place-items-center rounded-[50%] bg-panel [box-shadow:0_0_0_2px_transparent] group-data-[excluded]/row:grayscale">
        <img className="block size-3" src={AGENT_ICONS[host]} alt="" />
      </span>
      <span className="min-w-0 flex-1 group-data-[excluded]/row:text-card-foreground">
        {name}
        <small
          className="line-clamp-2 text-[0.75rem] leading-[1.25] wrap-anywhere text-muted-foreground"
          title={detail}
        >
          {detail}
        </small>
      </span>
      {rank === 1 && (
        <span className="flex-none rounded-[999px] bg-accent px-[7px] py-px text-[0.6875rem] text-card-foreground">
          First
        </span>
      )}
    </>
  );
}

function WaitLine({ wait, isBusy }: { wait: QuotaWait; isBusy: boolean }) {
  return (
    <div className="mx-2.5 my-1.5">
      <p className="mx-0 mt-0 mb-1.5 text-[0.75rem] text-card-foreground">
        {`#${wait.number} is paused: every included agent reached a usage limit. ${
          wait.nextResetAt === null
            ? 'No reset time is known.'
            : `It tries again at ${agentStore.resetText(wait.nextResetAt).replace('resets ', '')}.`
        }`}
      </p>
      <Button
        variant="secondary"
        size="action"
        className="phone:min-h-11 active:scale-none active:[transform:scale(0.97)]"
        data-wait={wait.waitId}
        aria-label={`Retry #${wait.number} with the current agent order`}
        aria-busy={isBusy ? 'true' : undefined}
        onClick={() => void agentStore.retry(wait)}
      >
        {`Retry #${wait.number}`}
      </Button>
    </div>
  );
}

function AgentOrderBody() {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const drag = useHandleDrag({ list, marker, preview });
  const focused = useFocusedKey(root, keyOf);
  const pressedWith = useRef<Host | null>(null);
  const lastHost = useRef<Host | null>(null);
  const wasOutsidePress = useRef(false);
  const knownNames = useRef(new Map<Host, string>());
  const drawnToggle = useRef<{ host: Host | null; isIncluded: boolean }>({ host: null, isIncluded: false });
  const shown = useAgents((state) => state.shown);
  const live = useAgents((state) => state.live);
  const menuFor = useAgents((state) => state.menuFor);
  if (menuFor) lastHost.current = menuFor;
  const anchorHost = menuFor ?? lastHost.current;

  const rows = useMemo(
    () =>
      shown
        ? [
            ...shown.order.map((host, at) => ({ host, rank: (at + 1) as number | null })),
            ...shown.excluded.map((host) => ({ host, rank: null as number | null })),
          ].map((row) => {
            const name = shown.registry[row.host]?.name ?? knownNames.current.get(row.host) ?? row.host;
            knownNames.current.set(row.host, name);
            return { ...row, name, detail: agentStore.detail(row.host) };
          })
        : [],
    [shown],
  );

  useEffect(() => {
    const onPress = ({ target }: PointerEvent) => {
      const handle = target instanceof Element ? target.closest('[data-handle]') : null;
      pressedWith.current = handle && root.current?.contains(handle) ? agentStore.get().menuFor : null;
    };
    addEventListener('pointerdown', onPress, true);
    return () => removeEventListener('pointerdown', onPress, true);
  }, []);

  useLayoutEffect(() => {
    const section = root.current;
    const key = focused.current;
    if (!section || key === null) return;
    const active = document.activeElement;
    if (active && active !== document.body && !section.contains(active)) return;
    const control = key.startsWith('handle:')
      ? handleOf(section, key.slice(7) as Host)
      : section.querySelector<HTMLElement>(`[data-wait="${CSS.escape(key.slice(5))}"]`);
    if (control && active === control) return;
    (control ?? section.querySelector<HTMLElement>('[data-handle]'))?.focus({ preventScroll: true });
  });

  const isIncluded = Boolean(menuFor && shown?.order.includes(menuFor));
  useEffect(() => {
    const was = drawnToggle.current;
    drawnToggle.current = { host: menuFor, isIncluded };
    if (!menuFor || was.host !== menuFor || was.isIncluded === isIncluded) return;
    const items = document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-content"] [role="menuitem"]');
    const active = document.activeElement;
    if (active === document.body || active === items[items.length - 1]) items[0]?.focus({ preventScroll: true });
  }, [menuFor, isIncluded]);

  const ghost = drag.dragging ? rows.find((row) => row.host === drag.dragging) : undefined;

  const anchor = useCallback(() => handleOf(root.current, anchorHost), [anchorHost]);
  const finalFocus = () => {
    const wasOutside = wasOutsidePress.current;
    wasOutsidePress.current = false;
    if (wasOutside || agentStore.get().menuFor !== null) return false;
    const active = document.activeElement;
    if (active !== null && active !== document.body && !active.closest('[data-slot="dropdown-menu-content"]'))
      return false;
    const handle = handleOf(root.current, lastHost.current);
    if (handle && !handle.checkVisibility()) {
      areaStop().focus({ preventScroll: true });
      return false;
    }
    return handle ?? root.current?.querySelector<HTMLElement>('[data-handle]') ?? true;
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>, host: Host) => {
    const pressed = event.detail === 0 ? null : pressedWith.current;
    pressedWith.current = null;
    if (drag.takeClick()) return;
    if (pressed === host || agentStore.get().menuFor === host) {
      agentStore.closeMenu();
      event.currentTarget.focus();
    } else agentStore.openMenu(host);
  };
  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>, host: Host) => {
    const handles = [...(root.current?.querySelectorAll<HTMLElement>('[data-handle]') ?? [])];
    const index = handles.indexOf(event.currentTarget);
    const at = agentStore.get().shown?.order.indexOf(host) ?? -1;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      if (at >= 0) agentStore.move(host, at + (event.key === 'ArrowUp' ? -1 : 1));
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      handles[Math.max(0, Math.min(handles.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? handles[0] : handles.at(-1))?.focus();
    }
  };
  const onRootKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !agentStore.cancelDrag()) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const onPopupKey = (event: KeyboardEvent & { preventBaseUIHandler(): void }) => {
    if (event.key.length === 1 && event.key !== ' ') event.preventBaseUIHandler();
    if (event.key !== 'Tab') return;
    event.preventBaseUIHandler();
    const handle = handleOf(root.current, lastHost.current);
    flushSync(() => agentStore.closeMenu());
    handle?.focus();
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it only cancels a drag, and the handles own the keys. */}
      <div
        ref={root}
        className={ROOT}
        data-dragging={drag.dragging ? '' : undefined}
        id="agent-picker"
        onKeyDown={onRootKey}
      >
        {shown ? (
          <>
            <ol
              ref={list}
              className="relative m-0 list-none px-0 py-0.5"
              aria-label="Agents in priority order"
              aria-busy={shown.isSaving}
            >
              {rows.map(({ host, rank, name, detail }, index) => (
                <li
                  key={host}
                  className={`${index > 0 ? 'mt-0.5' : ''} group/row relative ${ROW} [&:hover]:bg-secondary data-[dragging]:opacity-40`}
                  data-host={host}
                  data-excluded={rank === null ? '' : undefined}
                  data-dragging={drag.dragging === host ? '' : undefined}
                >
                  <button
                    type="button"
                    className={HANDLE}
                    data-handle=""
                    aria-haspopup="menu"
                    aria-expanded={menuFor === host}
                    aria-label={
                      rank === null
                        ? `${name}, excluded from default work. Actions`
                        : `${name}, priority ${rank} of ${shown.order.length}. Move or exclude`
                    }
                    aria-disabled={shown.isSaving ? 'true' : undefined}
                    onClick={(event) => onClick(event, host)}
                    onKeyDown={(event) => onHandleKey(event, host)}
                    {...(rank === null ? {} : drag.handlers(host))}
                  >
                    <Grip />
                  </button>
                  <RowBody host={host} rank={rank} name={name} detail={detail} />
                </li>
              ))}
            </ol>
            <div
              ref={marker}
              className="pointer-events-none absolute right-3.5 left-3.5 h-0.5 rounded-[1px] bg-ring before:absolute before:-top-[3px] before:-left-2 before:box-border before:h-2 before:w-2 before:rounded-[50%] before:border-2 before:border-solid before:border-ring before:content-['']"
              hidden
            />
            <p className={NOTICE} hidden={!shown.status}>
              {shown.status}
            </p>
            <div>
              {shown.view.waits.map((wait) => (
                <WaitLine key={wait.waitId} wait={wait} isBusy={shown.retrying.has(wait.waitId)} />
              ))}
            </div>
          </>
        ) : (
          <p className={NOTICE}>The agent order is not read yet.</p>
        )}
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        {ghost && (
          <div
            ref={preview}
            className={`fixed z-50 ${ROW} bg-card opacity-95 pointer-events-none [box-shadow:var(--float)]`}
            aria-hidden="true"
          >
            <span className={`${HANDLE} px-1.5 py-px text-center`}>
              <Grip />
            </span>
            <RowBody {...ghost} />
          </div>
        )}
      </div>
      <DropdownMenu
        modal={false}
        open={menuFor !== null}
        onOpenChange={(isOpen, details) => {
          if (isOpen) return;
          wasOutsidePress.current = details.reason === 'outside-press';
          agentStore.closeMenu();
        }}
      >
        <DropdownMenuContent
          anchor={anchor}
          align="start"
          aria-label={menuFor ? `${shown?.registry[menuFor]?.name ?? menuFor} actions` : undefined}
          data-agent-menu=""
          finalFocus={finalFocus}
          onKeyDown={onPopupKey}
        >
          {menuFor && <FirstFocus key={menuFor} />}
          {menuFor && <Entries list={() => agentStore.entries(menuFor)} close={agentStore.closeMenu} />}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AgentOrder() {
  const shown = useAgents((state) => state.shown);
  return (
    <ViewBoundary snapshot={shown} fallback={<div className={ROOT} id="agent-picker" />} onFail={agentStore.closeMenu}>
      <AgentOrderBody />
    </ViewBoundary>
  );
}

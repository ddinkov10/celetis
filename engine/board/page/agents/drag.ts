import { type PointerEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Host } from '../../../lib/config/core.ts';
import { agentStore } from './state.ts';

type Press = {
  handle: HTMLElement;
  host: Host;
  pointer: number;
  x: number;
  y: number;
  offset: number;
  box: { left: number; width: number };
  started: boolean;
  to: number | null;
};

const THRESHOLD = 4;

export function useHandleDrag({
  list,
  marker,
  preview,
}: {
  list: RefObject<HTMLOListElement | null>;
  marker: RefObject<HTMLDivElement | null>;
  preview: RefObject<HTMLDivElement | null>;
}) {
  const [dragging, setDragging] = useState<Host | null>(null);
  const press = useRef<Press | null>(null);
  const top = useRef(0);
  const suppressClick = useRef(false);

  const clear = useCallback(() => {
    const current = press.current;
    if (!current) return;
    press.current = null;
    if (marker.current) marker.current.hidden = true;
    if (current.handle.hasPointerCapture(current.pointer)) current.handle.releasePointerCapture(current.pointer);
    setDragging(null);
  }, [marker]);

  useEffect(
    () => () => {
      agentStore.setDrag(null);
      clear();
    },
    [clear],
  );

  useEffect(() => {
    const onPress = ({ target }: globalThis.PointerEvent) => {
      if (target instanceof Node && list.current?.contains(target)) suppressClick.current = false;
    };
    addEventListener('pointerdown', onPress, true);
    return () => removeEventListener('pointerdown', onPress, true);
  }, [list]);

  useLayoutEffect(() => {
    const current = press.current;
    const node = preview.current;
    if (dragging === null || !current || !node) return;
    node.style.width = `${current.box.width}px`;
    node.style.left = `${current.box.left}px`;
    node.style.top = `${top.current}px`;
  }, [dragging, preview]);

  const place = (current: Press, y: number) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-host]:not([data-excluded])') ?? [])];
    let slot = rows.length;
    for (const [index, each] of rows.entries()) {
      const box = each.getBoundingClientRect();
      if (y < box.top + box.height / 2) {
        slot = index;
        break;
      }
    }
    const from = rows.findIndex((each) => each.dataset.host === current.host);
    const node = marker.current;
    if (!node) return;
    if (slot === from || slot === from + 1) {
      node.hidden = true;
      current.to = null;
      return;
    }
    const near = rows[Math.min(slot, rows.length - 1)] as HTMLElement;
    node.style.top = `${(list.current?.offsetTop ?? 0) + (slot < rows.length ? near.offsetTop - 2 : near.offsetTop + near.offsetHeight)}px`;
    node.hidden = false;
    current.to = slot > from ? slot - 1 : slot;
  };

  const handlers = (host: Host) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || agentStore.get().shown?.isSaving) return;
      agentStore.setDrag(null);
      clear();
      const handle = event.currentTarget;
      const item = handle.closest<HTMLElement>('[data-host]') as HTMLElement;
      const box = item.getBoundingClientRect();
      const current: Press = {
        handle,
        host,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        offset: event.clientY - box.top,
        box: { left: box.left, width: box.width },
        started: false,
        to: null,
      };
      press.current = current;
      agentStore.setDrag({ isStarted: () => current.started, cancel: clear });
      handle.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = press.current;
      if (!current || event.pointerId !== current.pointer) return;
      if (!current.started) {
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < THRESHOLD) return;
        current.started = true;
        agentStore.closeMenu();
        setDragging(current.host);
      }
      top.current = event.clientY - current.offset;
      if (preview.current) preview.current.style.top = `${top.current}px`;
      place(current, event.clientY);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const current = press.current;
      if (!current || event.pointerId !== current.pointer) return;
      const { started, to } = current;
      suppressClick.current = started;
      agentStore.setDrag(null);
      clear();
      if (started && to !== null) agentStore.move(host, to);
      else if (started) agentStore.redraw(true);
      else setTimeout(() => agentStore.redraw(), 0);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      const current = press.current;
      if (!current || event.pointerId !== current.pointer) return;
      suppressClick.current = current.started;
      agentStore.setDrag(null);
      clear();
      agentStore.redraw(true);
    },
  });

  const takeClick = () => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  };

  return { dragging, handlers, takeClick };
}

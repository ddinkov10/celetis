import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';
import { Icon } from '../app/icon.tsx';
import { Button } from '../ui/button.tsx';
import { coordinator, useCoordinator } from './coordinator.ts';
import { Entries } from './entries.tsx';
import { logItems } from './rules.ts';

export const CoordinatorLog = memo(function CoordinatorLog() {
  const entries = useCoordinator((state) => state.entries);
  const answers = useCoordinator((state) => state.answers);
  const lines = useCoordinator((state) => state.lines);
  const shown = useCoordinator((state) => state.shown);
  const view = useCoordinator((state) => state.view);
  const scrollAsks = useCoordinator((state) => state.scrollAsks);
  const sessionId = useCoordinator((state) => state.view.sessionId);
  const { scrollRef, contentRef, scrollToBottom, stopScroll, isAtBottom, state } = useStickToBottom({
    initial: 'instant',
    resize: 'instant',
  });
  const heldAtEnd = useRef<boolean | null>(null);
  const openedHeight = useRef<number | null>(null);
  const toEnd = useRef<HTMLButtonElement>(null);

  const reachEnd = useCallback(() => {
    openedHeight.current = null;
    const log = scrollRef.current;
    if (heldAtEnd.current === null || !log) {
      void scrollToBottom('instant');
      return;
    }
    log.scrollTop = log.scrollHeight;
    heldAtEnd.current = true;
  }, [scrollRef, scrollToBottom]);

  useLayoutEffect(() => {
    if (scrollAsks > 0) reachEnd();
  }, [scrollAsks, reachEnd]);

  const lastSession = useRef(sessionId);
  const sessionAtEnd = useRef(false);
  const readerAbove = useRef(false);
  const sessionTop = useRef(false);
  useLayoutEffect(() => {
    if (lastSession.current === sessionId) return;
    lastSession.current = sessionId;
    if (sessionId === null) return;
    sessionTop.current = readerAbove.current;
    if (readerAbove.current) {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } else {
      sessionAtEnd.current = true;
      // The empty list clamps scrollTop, and the hook reads that scroll event as the reader scrolling up.
      const { scrollTop } = state;
      state.scrollTop = scrollTop;
    }
    const selection = document.getSelection();
    if (selection === null || selection.isCollapsed || !scrollRef.current?.contains(selection.anchorNode))
      heldAtEnd.current = null;
  }, [sessionId, scrollRef, state]);

  useLayoutEffect(() => {
    if (!sessionAtEnd.current || entries.length === 0) return;
    sessionAtEnd.current = false;
    reachEnd();
  }, [entries, reachEnd]);

  useEffect(() => {
    const log = scrollRef.current;
    const content = contentRef.current;
    if (!log || !content) return;
    // The hook follows in the frame after a resize, so a stop here cancels the follow during a held selection.
    const observer = new ResizeObserver((changes) => {
      // The hook follows again when the emptied list shrinks to the end, and no scroll event of a reader above the end stops it.
      if (sessionTop.current && state.isAtBottom) stopScroll();
      if (state.isAtBottom) openedHeight.current = null;
      if (openedHeight.current !== null) {
        if (content.offsetHeight <= openedHeight.current && !changes.some((change) => change.target === log)) return;
        openedHeight.current = null;
        void scrollToBottom('instant');
        return;
      }
      if (!state.isAtBottom) return;
      if (heldAtEnd.current !== null) stopScroll();
      else if (changes.some((change) => change.target === log)) void scrollToBottom('instant');
    });
    observer.observe(log);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollRef, contentRef, scrollToBottom, state, stopScroll]);

  useEffect(() => {
    const log = scrollRef.current;
    if (!log) return;
    let lastTop = log.scrollTop;
    const onScroll = () => {
      const isAtEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 4;
      if (log.scrollTop < lastTop - 1) openedHeight.current = null;
      if (log.scrollTop > lastTop + 1 || isAtEnd) sessionTop.current = false;
      if (log.scrollTop < lastTop - 1 && !isAtEnd) readerAbove.current = true;
      else if (isAtEnd) readerAbove.current = false;
      if (heldAtEnd.current !== null) {
        if (log.scrollTop < lastTop - 1 && !isAtEnd) heldAtEnd.current = false;
        else if (isAtEnd || (log.scrollTop > lastTop + 1 && state.isNearBottom)) heldAtEnd.current = true;
      }
      lastTop = log.scrollTop;
    };
    const onSelection = () => {
      const selection = document.getSelection();
      const isHeld = selection !== null && !selection.isCollapsed && scrollRef.current?.contains(selection.anchorNode);
      if (isHeld && heldAtEnd.current === null) {
        heldAtEnd.current = state.isAtBottom || openedHeight.current !== null;
        openedHeight.current = null;
        if (state.isAtBottom) stopScroll();
      }
      if (!isHeld && heldAtEnd.current !== null) {
        const wasAtEnd = heldAtEnd.current;
        heldAtEnd.current = null;
        if (wasAtEnd) void scrollToBottom('instant');
      }
    };
    log.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('selectionchange', onSelection);
    return () => {
      log.removeEventListener('scroll', onScroll);
      document.removeEventListener('selectionchange', onSelection);
    };
  }, [scrollRef, scrollToBottom, state, stopScroll]);

  const toEndHadFocus = toEnd.current !== null && document.activeElement === toEnd.current;
  useLayoutEffect(() => {
    if (isAtBottom && toEndHadFocus) scrollRef.current?.focus({ preventScroll: true });
  }, [isAtBottom, toEndHadFocus, scrollRef]);

  const onToggle = (row: string, isOpen: boolean) => {
    const wasFollowing = state.isAtBottom || openedHeight.current !== null;
    coordinator.setRowOpen(row, isOpen);
    openedHeight.current = null;
    if (!isOpen || !wasFollowing) return;
    // The hook scrolls on each growth while it follows, so the follow resumes only at a growth after this one.
    stopScroll();
    if (heldAtEnd.current === null && state.isNearBottom)
      openedHeight.current = contentRef.current?.offsetHeight ?? null;
  };
  const goToEnd = () => {
    scrollRef.current?.focus({ preventScroll: true });
    reachEnd();
  };

  const keys = view.actions.includes('key') ? view.keys : [];
  const items = logItems({ entries, answers, dialog: shown === 'dialog' ? { lines, keys } : null, state: shown });
  return (
    <>
      <div
        ref={scrollRef}
        className="m-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-[max(20px,calc((100%-72ch)/2))] pt-[18px] pb-7 font-sans text-[0.8125rem] leading-[1.55] font-normal text-foreground [overflow-wrap:anywhere] group-data-[stale]/co:opacity-70 focus-visible:rounded-none focus-visible:outline-offset-[-2px] phone:scroll-pb-[calc(var(--dock)+8px)] phone:px-3.5 phone:pt-4 phone:pb-6"
        id="coordinator-log"
        role="log"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the log scrolls by keyboard, so it is a tab stop
        tabIndex={0}
        aria-label="Conversation with the coordinator"
      >
        <ol ref={contentRef} className="m-0 flex min-h-full list-none flex-col gap-3.5 p-0">
          <Entries items={items} onToggle={onToggle} />
        </ol>
      </div>
      <Button
        ref={toEnd}
        type="button"
        variant="secondary"
        size="action"
        className="absolute bottom-2.5 left-1/2 border-border-strong bg-card shadow-raise [&:hover]:bg-card [transform:translateX(-50%)] active:scale-100 active:[transform:translateX(-50%)_scale(0.97)] phone:absolute phone:min-h-11 [&_.icon]:[transform:rotate(90deg)]"
        id="coordinator-to-end"
        hidden={isAtBottom}
        onClick={goToEnd}
      >
        <Icon name="chevron" />
        <span className="label">Go to the end</span>
      </Button>
    </>
  );
});

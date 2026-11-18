import { useEffect } from 'react';

export const STATES = ['operations-rest', 'operations-stop-dialog', 'operations-palette'] as const;
export type State = (typeof STATES)[number];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.matches('input, select, textarea') || target.isContentEditable);

export function PrototypeBar({ state, setState }: { state: State; setState: (state: State) => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || (event.key !== '[' && event.key !== ']')) return;
      const at = STATES.indexOf(state) + (event.key === ']' ? 1 : -1);
      setState(STATES[(at + STATES.length) % STATES.length] as State);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [state]);
  return (
    <div
      id="prototype-bar"
      className="fixed bottom-3 left-1/2 z-[100] flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-2 rounded-lg bg-[#111] px-3 py-1.5 font-sans text-xs text-white shadow-lg phone:bottom-[78px]"
    >
      <b>A</b>
      <span className="truncate">React + shadcn/ui port · source: the current board, ported for fidelity</span>
      <select
        aria-label="State"
        value={state}
        onChange={(event) => setState(event.target.value as State)}
        className="rounded bg-[#333] px-1 text-white"
      >
        {STATES.map((each) => (
          <option key={each}>{each}</option>
        ))}
      </select>
    </div>
  );
}

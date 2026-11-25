import type { LifecycleNote } from '../daemon/lifecycle.ts';
import type { Host } from '../host/names.ts';
import type { SessionWork } from '../workflow/workflow.ts';
import { detaches, type Event, type State, type StateOf } from './machine.ts';

function worker(state: StateOf<'live'>): Readonly<{ step: SessionWork; host: Host }> {
  if (state.scope === 'unwatched' && state.fresh) return { step: state.work, host: state.host };
  return { step: state.session.step, host: state.session.host };
}

function exitOf(event: Event): number | null {
  if (event.kind === 'session-ended') return event.code;
  if (event.kind === 'usage-blocked') return event.ended?.code ?? null;
  return null;
}

export function transitionNotes(
  from: State,
  event: Event,
  to: State,
  dropped: Event['kind'] | null,
): readonly LifecycleNote[] {
  const notes: LifecycleNote[] = [
    {
      type: 'run.transition',
      data: { from: from.kind, event: event.kind, to: to.kind, ...(dropped === null ? {} : { dropped }) },
    },
  ];
  if (from.kind === 'opening' && to.kind === 'live' && event.kind === 'barrier-reported') {
    const { start } = from;
    const { step, host } = start.scope === 'issue' ? start.facts : { step: start.work, host: start.host };
    notes.push({ type: 'step.started', data: { step, host, tab: event.tab, attempt: start.entry.id } });
  }
  if (from.kind === 'live' && to.kind !== 'live' && !detaches(event))
    notes.push({ type: 'step.ended', data: { ...worker(from), event: event.kind, code: exitOf(event) } });
  return notes;
}

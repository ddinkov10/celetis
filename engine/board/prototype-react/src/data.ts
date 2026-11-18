import { useEffect, useState } from 'react';
import type { Board, Card, UpdateResponse } from '../../types.ts';
import { agentOf, cleanCause } from '../../view.ts';

export function useBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`/api/board${board && document.hidden ? '?local=1' : ''}`);
        if (response.ok) setBoard((await response.json()) as Board);
      } catch {}
      timer = setTimeout(load, document.hidden ? 15_000 : 5000);
    };
    void load();
    return () => clearTimeout(timer);
  }, []);
  return board;
}

export function useUpdate() {
  const [update, setUpdate] = useState<UpdateResponse | null>(null);
  useEffect(() => {
    fetch('/api/update')
      .then((response) => (response.ok ? response.json() : null))
      .then(setUpdate, () => {});
  }, []);
  return update;
}

export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export type MainAction = { id: string; label: string; icon: string; name: string; isDisabled: boolean };

const who = (card: Card) =>
  card.number === null ? (card.title ? `human session "${card.title}"` : 'a human session') : `#${card.number}`;

export const agentName = (board: Board, id: string) => agentOf({ agent: id }, board.registry)?.name ?? id;

const defaultReason = (board: Board) => {
  const next = board.next;
  if (next?.kind === 'wait') return 'Every included agent is limited. See the agent order.';
  const entry = next ? board.agents?.[next.host] : undefined;
  return entry?.available === false ? cleanCause(entry.cause) : null;
};

export const runName = ({ step, effort, number }: Card) =>
  `Run ${step}${effort ? ` on ${effort.model} at ${effort.level}` : ''}, #${number}`;

export function mainAction(board: Board, card: Card): MainAction | null {
  if (card.go) return { id: 'go', label: 'Go', icon: 'go', name: `Go to the pane of ${who(card)}`, isDisabled: false };
  if (card.state === 'quota-wait')
    return { id: 'agent-order', label: 'Agent order', icon: 'person', name: `Show the agent order and Retry of #${card.number}`, isDisabled: false };
  if (card.state === 'blocked')
    return {
      id: 'assist',
      label: 'Open agent',
      icon: 'terminal',
      name: `Open agent, #${card.number}`,
      isDisabled: Boolean(board.noRun || defaultReason(board)) || !card.assist,
    };
  if ((card.state === 'no-progress' || card.state === 'set-aside') && card.resume)
    return { id: 'resume', label: 'Resume', icon: 'terminal', name: `Resume the ${card.step} session of #${card.number}`, isDisabled: false };
  if (card.run)
    return {
      id: 'run',
      label: card.state === 'no-progress' || card.state === 'set-aside' ? 'Run again' : 'Run',
      icon: 'run',
      name: runName(card),
      isDisabled: Boolean(board.noRun),
    };
  if (card.state === 'dirty-tree')
    return { id: 'shell', label: 'Open shell', icon: 'terminal', name: `Open shell, #${card.number}`, isDisabled: false };
  if (card.state === 'blocked' && card.url)
    return { id: 'open', label: 'Open issue', icon: 'open', name: `Open issue #${card.number}`, isDisabled: false };
  return null;
}

import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Level } from '../../../lib/workflow/effort.ts';
import type { Action, Board, Card, HeldView, MenuEntry } from '../../types.ts';
import { agentOf, cleanCause, keyOf, knownAgent, levelSource, runTitle, startTitle } from '../../view.ts';
import { shellStore } from '../store.ts';
import { toast } from '../toast/toast.ts';
import { announce, copy, openUrl, post, send } from '../ui.ts';
import type { Launch } from './cards.ts';
import { openDetails, screen } from './state.ts';

const isReconnecting = () => shellStore.handlers().isReconnecting();
const readAgain = () => shellStore.handlers().readAgain();
const render = () => screen.handlers().render();
const { seeTurn } = screen;

const COPY: Record<string, string> = { 'no-progress': 'command', 'set-aside': 'command', 'dirty-tree': 'path' };
const STOPPING = 'The daemon ends the session. The card moves to Idle when the session has ended.';
const ON_ISSUE = new Set(['blocked']);
const QUEUE_LEVEL = 'The queue starts this step at the start pair, with no override';

export const who = (card: Card) =>
  card.number === null ? (card.title ? `human session "${card.title}"` : 'a human session') : `#${card.number}`;
const canRunLater = (card: Card) =>
  card.sessionId === null &&
  card.step &&
  (card.state === null || card.state === 'no-progress' || card.state === 'set-aside');
export const copyWhat = (card: Card) => (card.act ? COPY[card.state as string] : null);
export const onTracker = () => ((screen.read() as Board).tracker ? ` on ${(screen.read() as Board).tracker}` : '');

export const act = async (path: string, value: unknown, failure: string, onDone?: () => void) => {
  if (isReconnecting()) return false;
  const isOk = await post(path, value, failure);
  if (isOk) onDone?.();
  await readAgain();
  return isOk;
};

export const registry = () => (screen.read() as Board).registry;
export const agentDisplay = (id: string) => agentOf({ agent: id }, registry())?.name ?? id;

export const defaultReason = (work: 'run' | 'session' = 'session') => {
  const next = screen.read()?.next;
  if (next?.kind === 'wait') return work === 'session' ? 'Every included agent is limited. See the agent order.' : null;
  const entry = next ? screen.read()?.agents?.[next.host] : undefined;
  return entry?.available === false ? cleanCause(entry.cause) : null;
};

export const runReason = (agent: string | null, number?: IssueKey | null) => {
  const data = screen.read();
  if (data?.noRun) return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === 'me-gate' && number != null && record.numbers[0] === number && record.choice) {
    if (record.choice.kind === 'default') {
      if (agent !== null) return 'queue: recorded agent choice is the default order';
    } else {
      if (agent !== null && agent !== record.choice.host)
        return `queue: recorded agent choice is ${record.choice.host}`;
      agent = record.choice.host;
    }
  }
  const agents = data?.agents;
  if (agent) {
    const entry = data && knownAgent(data.registry, agent) ? agents?.[agent] : undefined;
    if (entry && entry.available === false) return cleanCause(entry.cause);
    return null;
  }
  return defaultReason('run');
};

const runName = ({ step, effort, number }: Card) =>
  `Run ${step}${effort ? ` on ${effort.model} at ${effort.level}` : ''}, #${number}`;

export const runAction = (card: Card, agent: string | null = null): Action => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent, card.number);
  const name = agent ? `Run with ${display}, ${card.step} of #${card.number}` : runName(card);
  return {
    id: agent ? `run:${agent}` : 'run',
    label: agent ? `Run with ${display}` : 'Run',
    icon: 'run',
    busy: 'Starting',
    name,
    title: reason ?? runTitle(card.step, (screen.read() as Board).flow, card.effort),
    isDisabled: Boolean(reason),
    run: reason
      ? async () => toast(reason, { isError: true })
      : async () => {
          if (await launch(card, '/api/run', agent ?? undefined))
            toast(`Started the ${card.step} step of #${card.number} in a new herdr tab`);
        },
  };
};

export const overrideActionsOf = (card: Card, isAgain: boolean): Action[] => {
  const agents = screen.read()?.agents;
  if (!card.run || !agents || screen.read()?.noRun) return [];
  return Object.keys(agents).map((id) => {
    const display = agentDisplay(id);
    const base = runAction(card, id);
    return isAgain
      ? {
          ...base,
          label: `Run again with ${display}`,
          name: `Run again with ${display}, ${card.step} of #${card.number}`,
          isGhost: true,
          title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`,
        }
      : base;
  });
};

export const levelEntries = (card: Card): (MenuEntry | 'rule')[] => {
  const { effort } = card;
  if (!effort || !(card.run || screen.read()?.noRun)) return [];
  const record = screen.read()?.queue?.record;
  const reason =
    screen.read()?.noRun ||
    (record?.state === 'me-gate' && record.numbers[0] === card.number ? QUEUE_LEVEL : runReason(null, card.number));
  return [
    'rule',
    ...(screen.read()?.flow?.levels ?? []).map((level) => ({
      icon: level === effort.level ? 'check' : 'run',
      label: `Run at ${level}${level === effort.level ? ` (${levelSource(effort)})` : ''}`,
      title: reason ?? startTitle(card.step, effort, level),
      isDisabled: Boolean(reason),
      run: reason
        ? async () => toast(reason, { isError: true })
        : async () => {
            if (await launch(card, '/api/run', undefined, level))
              toast(`Started the ${card.step} step of #${card.number} at ${level} in a new herdr tab`);
          },
    })),
  ];
};

export const namedHost = (card: Card): string | null => {
  const record = screen.read()?.queue?.record;
  if (record?.state === 'me-gate' && record.numbers[0] === card.number && record.choice?.kind === 'explicit')
    return record.choice.host;
  const start = card.step ? screen.read()?.starts?.[card.step] : undefined;
  return start?.kind === 'start' ? start.host : null;
};

export const toMenuEntry = (action: Action, card: Card): MenuEntry => {
  const data = screen.read();
  const host = action.id.startsWith('run:') ? action.id.slice(4) : null;
  if (host && data && knownAgent(data.registry, host))
    return {
      icon: action.icon,
      host,
      label: action.label,
      tag: host === namedHost(card) ? 'Default' : undefined,
      isDisabled: action.isDisabled,
      title: action.title,
      run: action.run as () => unknown,
    };
  return {
    icon: action.icon,
    label: action.name,
    key: action.isMain ? 'Enter' : (action.key ?? ''),
    isDisabled: action.isDisabled,
    title: action.title,
    run: action.href ? () => openUrl(action.href) : (action.run as () => unknown),
  };
};

const refusedRun = (isError: boolean, reason: string) => async () => {
  toast(reason, { isError });
  announce(reason);
};

export const actionsOf = (card: Card): Action[] => {
  const data = screen.read();
  const list: Action[] = [];
  if (card.go) {
    list.push({
      id: 'go',
      label: 'Go',
      icon: 'go',
      busy: 'Focusing',
      name: `Go to the pane of ${who(card)}`,
      title: 'Focus its pane in herdr (Enter)',
      run: () => {
        if (card.number === null) seeTurn(card);
        return act('/api/go', { sessionId: card.sessionId }, 'Go failed', () =>
          toast(`Focused the pane of ${who(card)} in herdr`, { detail: 'Switch to your terminal to see it.' }),
        );
      },
    });
  }
  if (card.state === 'quota-wait')
    list.push({
      id: 'agent-order',
      label: 'Agent order',
      icon: 'person',
      name: `Show the agent order and Retry of #${card.number}`,
      title: 'Show the usage limits and Retry in the agent order (Enter)',
      run: () => shellStore.handlers().agentOrder(),
    });
  if (card.state === 'blocked') {
    const reason = data?.noRun || defaultReason();
    list.push({
      id: 'assist',
      label: 'Open agent',
      icon: 'terminal',
      busy: 'Starting',
      name: `Open agent, #${card.number}`,
      title: reason ?? 'Open an assistance session in a new herdr tab (Enter)',
      isDisabled: Boolean(reason) || !card.assist,
      run: async () => {
        if (await launch(card, '/api/assist'))
          toast(`Opened an assistance session for #${card.number} in a new herdr tab`, {
            detail: 'Switch to your terminal to see it.',
          });
      },
    });
  }
  if (card.state === 'no-progress' || card.state === 'set-aside') {
    if (card.resume) {
      list.push({
        id: 'resume',
        label: 'Resume',
        icon: 'terminal',
        busy: 'Opening',
        name: `Resume the ${card.step} session of #${card.number}`,
        title: 'Open the session of this step again in a new herdr tab (Enter)',
        run: async () => {
          if (await launch(card, '/api/resume'))
            toast(`Opened the ${card.step} session of #${card.number} in a new herdr tab`, {
              detail: 'Switch to your terminal to see it.',
            });
        },
      });
    }
    if (card.run) {
      const base = runAction(card);
      list.push({
        ...base,
        label: 'Run again',
        name: `Run again, #${card.number}`,
        isGhost: true,
        title: base.isDisabled
          ? base.title
          : card.state === 'no-progress'
            ? `Start the ${card.step} step again. It made no progress last time.`
            : `Start the ${card.step} step again`,
      });
      list.push(...overrideActionsOf(card, true));
    }
  } else if (card.run) {
    list.push(runAction(card));
    list.push(...overrideActionsOf(card, false));
  }
  if (card.state === 'dirty-tree' || (card.state === 'set-aside' && card.path)) {
    list.push({
      id: 'shell',
      label: 'Open shell',
      icon: 'terminal',
      busy: 'Opening',
      name: `Open shell, #${card.number}`,
      title: `Open a shell in the worktree in a new herdr tab${card.state === 'dirty-tree' ? ' (Enter)' : ''}`,
      run: () =>
        act('/api/shell', { number: card.number }, 'Open shell failed', () =>
          toast(`Opened a shell in the worktree of #${card.number}`, {
            detail:
              card.state === 'dirty-tree'
                ? 'Commit or stash the changes there; then the card moves on.'
                : 'Commit or stash the changes there.',
          }),
        ),
    });
  }
  if (ON_ISSUE.has(card.state as string) && card.url) {
    list.push({
      id: 'open',
      label: 'Open issue',
      icon: 'open',
      name: `Open issue #${card.number}${onTracker()}`,
      title: `Open the issue${onTracker()}${list.length === 0 ? ' (Enter)' : ''}`,
      href: card.url,
    });
  }
  const { noRun } = data as Board;
  if (noRun && canRunLater(card)) {
    list.push({
      id: 'blocked',
      label: 'Run',
      icon: 'run',
      name: runName(card),
      title: noRun,
      isDisabled: true,
      run: async () => toast(noRun, { isError: true }),
    });
    if (data?.agents)
      for (const id of Object.keys(data.agents)) {
        const display = agentDisplay(id);
        list.push({
          id: `run:${id}`,
          label: `Run with ${display}`,
          icon: 'run',
          name: `Run ${card.step}, #${card.number} with ${display}`,
          title: noRun,
          isDisabled: true,
          run: async () => toast(noRun, { isError: true }),
        });
      }
  }
  if (card.aside) {
    const isBusy = screen.asides().has(card.number);
    list.push({
      id: 'aside',
      label: isBusy ? 'Setting aside' : 'Set aside',
      icon: 'aside',
      name: `Set aside #${card.number}`,
      key: 's',
      isGhost: true,
      isBusy,
      isDisabled: isBusy,
      title: isBusy
        ? 'The daemon sets this issue aside.'
        : 'Move this issue to Idle. Auto mode skips it until you press Run or Resume (s)',
      run: () => pressAct('asides', card, '/api/aside', { number: card.number }, asideText(card)),
    });
  }
  if (card.stop) {
    const isBusy = card.state === 'stopping' || screen.stops().has(card.number);
    const reason = isBusy ? STOPPING : card.stop.reason;
    list.push({
      id: 'stop',
      label: isBusy ? 'Stopping' : 'Stop',
      icon: 'stop',
      name: `Stop the ${card.step} session of #${card.number}`,
      key: 's',
      isGhost: true,
      isBusy,
      isDisabled: Boolean(reason),
      title: reason ?? 'End this session and set the issue aside (s)',
      run: card.stop.reason ? refusedRun(card.state !== 'stopping', card.stop.reason) : () => screen.openStop(card),
    });
  }
  list.forEach((action, index) => {
    action.isMain = index === 0;
  });
  return list;
};

export const landHeld = async (card: Card, held: HeldView) => {
  if (isReconnecting()) return null;
  const error = await send(
    '/api/held/land',
    { number: card.number, head: held.head, patch: held.patch },
    'Land failed',
  );
  await readAgain();
  return error;
};

export const discardHeld = (card: Card) =>
  act('/api/held/discard', { number: card.number }, 'Discard failed', () =>
    toast(`Discarded #${card.number}`, { detail: 'The commits stay on the origin branch.' }),
  );

const holdLanding = (card: Card) =>
  act('/api/hold', { number: card.number }, 'Hold landing failed', () =>
    toast(`Holding the landing of #${card.number}`, {
      detail: 'The change stays on its branch until you land or discard it.',
    }),
  );

export const menuOf = (card: Card, key: string): (MenuEntry | 'rule')[] => [
  ...actionsOf(card).map((action) => toMenuEntry(action, card)),
  ...(card.hold
    ? [
        {
          icon: 'aside',
          label: 'Hold landing',
          title: 'Keep this change on its branch until you land or discard it',
          run: () => holdLanding(card),
        },
      ]
    : []),
  ...levelEntries(card),
  'rule',
  { icon: 'panel', label: 'Show the details', key: 'Space', run: () => openDetails(key) },
  ...(card.url && !ON_ISSUE.has(card.state as string)
    ? [
        {
          icon: 'open',
          label: `Open the issue${onTracker()}`,
          key: 'o',
          run: () => openUrl(card.url),
        },
      ]
    : []),
  ...(copyWhat(card)
    ? [
        {
          icon: 'copy',
          label: `Copy the ${copyWhat(card)}`,
          key: 'c',
          run: () => copy(card.act as string, copyWhat(card) as string),
        },
      ]
    : []),
];

export const menuName = (card: Card, prefix: string) =>
  `${prefix} ${card.number === null ? card.title : `#${card.number}`}`;

export const detailActions = (card: Card): Action[] => {
  const list = actionsOf(card);
  const isAgain = card.state === 'no-progress' || card.state === 'set-aside';
  const host = namedHost(card);
  const mainId = list.find((action) => action.id === 'run' || action.id === 'blocked')?.id;
  const matching = host ? list.find((action) => action.id === `run:${host}`) : undefined;
  if (!mainId || !matching) return list;
  return list
    .filter((action) => action !== matching)
    .map((action) => {
      if (action.id === mainId)
        return {
          ...action,
          label: matching.label,
          name: matching.name,
          ...(isAgain ? { help: 'Starts a new session of the step.' } : {}),
        };
      if (action.id.startsWith('run:')) return { ...action, isGhost: true, group: 'Other agents' };
      if (action.id === 'resume') return { ...action, help: 'Opens the same session again.' };
      return action;
    });
};

export const runEntries = (card: Card): (MenuEntry | 'rule')[] => {
  const actions = actionsOf(card);
  if (!['run', 'blocked'].includes(actions[0]?.id as string)) return [];
  const entries = actions.filter((action) => action.id.startsWith('run:')).map((action) => toMenuEntry(action, card));
  return entries.length === 0 ? [] : [...entries, ...levelEntries(card)];
};

export const launch = async (
  card: Card,
  path: '/api/run' | '/api/resume' | '/api/assist',
  agent?: string,
  effort?: Level,
) => {
  const { number } = card;
  if (isReconnecting() || number === null) return false;
  const board = screen.board();
  const current =
    board &&
    Object.values(board.columns)
      .flat()
      .find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === '/api/run' ? 'run' : path === '/api/assist' ? 'assist' : 'resume']) return false;
  if (screen.startFailures().has(number)) {
    screen.setStartFailures((failures) => failures.delete(number));
    render();
  }
  const reason =
    path === '/api/resume'
      ? screen.read()?.noRun
      : path === '/api/assist'
        ? screen.read()?.noRun || defaultReason()
        : runReason(agent ?? null, number);
  if (reason) {
    toast(reason, { isError: true });
    return false;
  }
  const entry: Launch = { step: current.step, phase: 'pending', at: Date.now() };
  screen.setLaunches((launches) => launches.set(number, entry));
  render();
  if (document.activeElement === document.body)
    document
      .querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(keyOf(card))}"]`)
      ?.focus({ preventScroll: true });
  const failure = await send(
    path,
    {
      number,
      ...(path === '/api/run' && agent ? { agent } : {}),
      ...(path === '/api/run' && effort ? { effort } : {}),
    },
    path === '/api/run' ? 'Run failed' : path === '/api/assist' ? 'Open agent failed' : 'Resume failed',
  );
  const phase = failure === null ? 'done' : 'failed';
  screen.setLaunches((launches) => {
    const latest = launches.get(number);
    if (latest) launches.set(number, { ...latest, phase });
  });
  if (failure !== null) screen.setStartFailures((failures) => failures.set(number, failure));
  render();
  void readAgain();
  return failure === null;
};

export type ActText = { busy: string; failure: string; done: string; detail: string };
export const asideText = (card: Card): ActText => ({
  busy: `Setting aside #${card.number}`,
  failure: 'Set aside failed',
  done: `Set #${card.number} aside`,
  detail: 'It shows in Idle. Run or Resume starts it again.',
});
export const stopText = (card: Card): ActText => ({
  busy: `Stopping the ${card.step} session of #${card.number}`,
  failure: 'Stop failed',
  done: `Stopping the ${card.step} session of #${card.number}`,
  detail: 'The card moves to Idle when the session has ended.',
});

export const pressAct = async (
  kind: 'asides' | 'stops',
  card: Card,
  path: '/api/aside' | '/api/stop',
  value: unknown,
  text: ActText,
) => {
  const { number } = card;
  const press = kind === 'asides' ? screen.setAsides : screen.setStops;
  if (isReconnecting() || screen[kind]().has(number)) return;
  press((pressed) => pressed.set(number, 'pending'));
  screen.setRefusals((refusals) => refusals.delete(number));
  announce(text.busy);
  render();
  const error = await send(path, value, text.failure);
  if (error === null) {
    press((pressed) => pressed.set(number, 'done'));
    toast(text.done, { detail: text.detail });
    announce(text.done);
    render();
    void readAgain();
    return;
  }
  press((pressed) => pressed.delete(number));
  screen.setRefusals((refusals) => refusals.set(number, { sessionId: card.sessionId, state: card.state, line: error }));
  announce(`${text.failure}. ${error}`);
  render();
};

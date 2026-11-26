import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Action, Board, Card, Column, MenuEntry, PaletteItem } from '../../types.ts';
import { keyOf, runTitle } from '../../view.ts';
import { agentStore } from '../agents/state.ts';
import { coordinator } from '../coordinator/coordinator.ts';
import { actionsOf, agentDisplay, launch, onTracker } from '../operations/actions.ts';
import { toggleHistory, toggleView } from '../operations/keys.ts';
import { openDetails, screen, setArea, setTab } from '../operations/state.ts';
import { AREA_ICONS, AREA_NAMES, AREAS, type Area, type Shell } from '../shell.ts';
import { openShortcuts } from '../shortcuts/shortcuts.tsx';
import { shellStore } from '../store.ts';
import { THEME_WORDS } from '../theme/choice.ts';
import { toast } from '../toast/toast.ts';
import { openUrl } from '../ui.ts';

const shell = (): Shell => shellStore.get().shell;
const settings = () => shellStore.get().settings;
const { setEpicOpen } = screen;

const readAgainText = () =>
  screen.read()?.tracker ? `Read ${(screen.read() as Board).tracker} again` : 'Read the issues again';

export const agentOrder = (): void => {
  setArea('control');
  if (!agentStore.focusFirst()) document.getElementById('ctl-agents')?.focus();
};

const agentOrderEntry = {
  icon: 'person',
  label: 'Change the agent order',
  key: '',
  title: 'Open the agent order on Control',
  run: () => agentOrder(),
};

const readEntry = (): MenuEntry => ({
  label: readAgainText(),
  icon: 'refresh',
  key: 'r',
  run: () => void shellStore.refresh(),
});

const historyEntry = (): MenuEntry => ({
  label: shell().tab === 'history' ? 'Hide history' : 'Show history',
  icon: 'clock',
  key: 'd',
  run: toggleHistory,
});

const notifyEntry = (): MenuEntry => ({
  label: settings().notify ? 'Turn notifications off' : 'Turn notifications on',
  icon: settings().notify ? 'bell-off' : 'bell',
  key: '',
  run: () => void shellStore.toggleNotify(),
});

const themeEntry = (): MenuEntry => ({
  label: `Theme: ${THEME_WORDS[settings().theme]}`,
  icon: `theme-${settings().theme}`,
  key: '',
  run: () => shellStore.cycleTheme(),
});

const keysEntry = (): MenuEntry => ({
  label: 'Show the keyboard shortcuts',
  icon: 'keyboard',
  key: '?',
  run: openShortcuts,
});

const goEntries = (names: Area[]): MenuEntry[] =>
  names.map((area) => ({
    label: `Go to ${AREA_NAMES[area]}`,
    icon: AREA_ICONS[area],
    key: '',
    run: () => setArea(area),
  }));

const boardActions = (): MenuEntry[] => [
  ...goEntries([...AREAS]),
  ...(coordinator.hasSession()
    ? []
    : [{ label: 'Start the coordinator session', icon: 'message', key: '', run: coordinator.start }]),
  { label: 'Show the issue queue', icon: 'queue', key: '', run: () => setTab('queue') },
  readEntry(),
  historyEntry(),
  notifyEntry(),
  themeEntry(),
  keysEntry(),
];

const unnamed = (name: string, number: IssueKey | null) => {
  if (number === null) return name;
  let label = name;
  for (const tail of [`, #${number}`, ` of #${number}`]) if (label.endsWith(tail)) label = label.slice(0, -tail.length);
  const lead = `Open issue #${number}`;
  return label.startsWith(lead) ? `Open issue${label.slice(lead.length)}` : label;
};

export const paletteItems = (): PaletteItem[] => {
  const data = screen.read();
  const shown = screen.board();
  if (!data || !shown) return [];
  const items: PaletteItem[] = [];
  const add = (group: string, card: Card, _key: string, action: Action) =>
    items.push({
      group,
      number: card.number,
      label: unnamed(action.name, card.number),
      context: card.title,
      icon: action.icon,
      tone: group === 'Needs you' ? 'needs' : null,
      key: '',
      run: action.href ? () => openUrl(action.href) : (action.run as () => unknown),
    });
  const goTo: PaletteItem[] = [];
  for (const [column, group] of [
    ['needs', 'Needs you'],
    ['waiting', 'Waiting'],
    ['running', 'Running'],
    ['idle', 'Run the next step'],
    ['human', 'Human sessions'],
  ] as [Column, string][]) {
    for (const card of shown.columns[column]) {
      const key = screen.index().keyOf.get(card) ?? keyOf(card);
      if (card.number !== null)
        goTo.push({
          group: 'Go to',
          isGoTo: true,
          number: card.number,
          label: `Go to #${card.number}`,
          context: card.title,
          icon: 'panel',
          tone: null,
          key: '',
          run: () => {
            if (!document.querySelector(`#tp-board [data-key="${CSS.escape(key)}"]`)) setTab('agents');
            openDetails(key);
            const node = document.querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(key)}"]`);
            if (node?.checkVisibility()) node.focus();
          },
        });
      const [main] = actionsOf(card);
      if (main && !main.isDisabled) add(group, card, key, main);
      else if (card.number !== null || card.sessionId)
        items.push({
          group,
          number: card.number,
          label: 'Show the details',
          context: card.title,
          icon: 'panel',
          tone: null,
          key: '',
          run: () => openDetails(key),
        });
      if (card.run && card.number !== null && data?.agents && !data?.noRun) {
        for (const [id, entry] of Object.entries(data.agents)) {
          if (!entry.available) continue;
          const display = agentDisplay(id);
          items.push({
            group,
            number: card.number,
            label: `Run with ${display}`,
            context: card.title,
            icon: 'run',
            tone: group === 'Needs you' ? 'needs' : null,
            key: '',
            title: runTitle(card.step, (data as Board).flow, card.effort),
            run: async () => {
              if (await launch(card, '/api/run', id))
                toast(`Started the ${card.step} step of #${card.number} with ${display} in a new herdr tab`);
            },
          });
        }
      }
    }
  }
  const epics = new Map<IssueKey, string>();
  for (const card of [
    ...shown.columns.needs,
    ...shown.columns.waiting,
    ...shown.columns.running,
    ...shown.columns.idle,
  ])
    if (card.epic) epics.set(card.epic.number, card.epic.title);
  for (const [number, title] of epics)
    goTo.push({
      group: 'Go to',
      isGoTo: true,
      number,
      label: `Go to epic #${number}`,
      context: title,
      icon: 'chevron',
      tone: null,
      key: '',
      run: () => {
        const row = () => document.querySelector<HTMLElement>(`#tp-board .epic-row[data-epic="${number}"]`);
        setTab(shell().tab === 'pipeline' && row() ? 'pipeline' : 'agents');
        setEpicOpen(number, true);
        row()?.focus();
      },
    });
  for (const card of shown.history?.entries ?? [])
    if (card.url)
      items.push({
        group: 'History',
        number: card.number,
        label: `Open the issue${onTracker()}`,
        context: card.title,
        icon: 'open',
        tone: null,
        key: '',
        run: () => openUrl(card.url),
      });
  items.push(
    { group: 'Board', number: null, context: '', ...agentOrderEntry },
    {
      group: 'Board',
      number: null,
      label: shell().tab === 'pipeline' ? 'Show the agents' : 'Show the pipeline',
      context: '',
      icon: shell().tab === 'pipeline' ? 'board' : 'stages',
      key: 'v',
      run: toggleView,
    },
    ...boardActions().map((action) => ({ group: 'Board', number: null, context: '', ...action })),
    {
      group: 'Board',
      number: null,
      label: 'Expand all epic groups',
      context: '',
      icon: 'chevron',
      key: '',
      run: () => {
        screen.setEpicsOpen((open) => {
          for (const card of shown.columns.idle) if (card.epic) open.add(card.epic.number);
        });
      },
    },
    {
      group: 'Board',
      number: null,
      label: 'Collapse all epic groups',
      context: '',
      icon: 'chevron',
      key: '',
      run: () => {
        screen.setEpicsOpen((open) => open.clear());
      },
    },
  );
  return [...goTo, ...items];
};

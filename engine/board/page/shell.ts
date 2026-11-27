import type { IssueKey } from '../../lib/tracker/key.ts';

export const AREAS = ['home', 'operations', 'control', 'throughput'] as const;
export type Area = (typeof AREAS)[number];
export const TABS = ['agents', 'pipeline', 'queue', 'history'] as const;
export type Tab = (typeof TABS)[number];
export type Pane = 'chat' | 'agents';
export type DetailsTab = 'status' | 'conversation';
export type Opener = 'card' | 'history' | 'link';
export type Shell = Readonly<{
  area: Area;
  tab: Tab;
  details: string | null;
  detailsTab: DetailsTab;
  opener: Opener | null;
  pane: Pane;
}>;

export const AREA_ICONS: Record<Area, string> = {
  home: 'home',
  operations: 'board',
  control: 'sliders',
  throughput: 'trend',
};

export const AREA_NAMES: Record<Area, string> = {
  home: 'Home',
  operations: 'Operations',
  control: 'Control',
  throughput: 'Throughput',
};

const member = <T extends string>(list: readonly T[], value: string | null): T | undefined =>
  list.find((each) => each === value);

// A load never opens the wide Pipeline over the chat, so a stored Pipeline gives Agents.
export const readShell = (stored: { area: string | null; tab: string | null }): Shell => {
  const tab = member(TABS, stored.tab);
  return {
    area: member(AREAS, stored.area) ?? 'home',
    tab: tab === undefined || tab === 'pipeline' ? 'agents' : tab,
    details: null,
    detailsTab: 'status',
    opener: null,
    pane: 'chat',
  };
};

export const readFragment = (hash: string): { number: string; tab: DetailsTab | null } | null => {
  const fields = new URLSearchParams(hash.replace(/^#/, ''));
  const number = fields.get('issue');
  const tab = fields.get('tab');
  return number === null ? null : { number, tab: tab === 'conversation' || tab === 'status' ? tab : null };
};

export const fragmentOf = (number: IssueKey | null, tab: DetailsTab): string =>
  number === null ? '' : `#${new URLSearchParams({ issue: number, tab })}`;

export const isChatShown = (shell: Shell, isPhone: boolean): boolean =>
  shell.area === 'operations' && shell.details === null && (isPhone ? shell.pane === 'chat' : shell.tab !== 'pipeline');

export const FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

export const badgeText = (count: number): string => (count === 0 ? '' : count > 999 ? '999+' : String(count));

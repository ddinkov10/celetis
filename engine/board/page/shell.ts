export const AREAS = ['home', 'operations', 'control', 'throughput'] as const;
export type Area = (typeof AREAS)[number];
export const TABS = ['agents', 'pipeline', 'queue', 'history'] as const;
export type Tab = (typeof TABS)[number];
export type Pane = 'chat' | 'agents';
export type Shell = Readonly<{ area: Area; tab: Tab; details: string | null; pane: Pane }>;

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
    area: member(AREAS, stored.area) ?? 'operations',
    tab: tab === undefined || tab === 'pipeline' ? 'agents' : tab,
    details: null,
    pane: 'chat',
  };
};

export const isChatShown = (shell: Shell, isPhone: boolean): boolean =>
  shell.area === 'operations' && shell.details === null && (isPhone ? shell.pane === 'chat' : shell.tab !== 'pipeline');

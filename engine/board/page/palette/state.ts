import { useSyncExternalStore } from 'react';
import type { PaletteItem } from '../../types.ts';
import { paletteItems } from './items.ts';

export type PaletteState = Readonly<{ isOpen: boolean; items: readonly PaletteItem[]; query: string; session: number }>;

const listeners = new Set<() => void>();
let state: PaletteState = { isOpen: false, items: [], query: '', session: 0 };
let picked: PaletteItem | null = null;

const set = (next: Partial<PaletteState>) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};

export const paletteStore = {
  get: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  setQuery: (query: string) => set({ query }),
  pick: (item: PaletteItem) => {
    if (!state.isOpen) return;
    picked = item;
    set({ isOpen: false });
  },
  close: () => {
    if (state.isOpen) set({ isOpen: false });
  },
  takePicked: () => {
    const item = picked;
    picked = null;
    return item;
  },
};

export const openPalette = (): void => {
  try {
    // A reopen during the close cancels its completion, so the picked act runs here.
    paletteStore.takePicked()?.run();
  } finally {
    set({ isOpen: true, items: paletteItems(), query: '', session: state.session + 1 });
  }
};

export const usePalette = <T>(select: (state: PaletteState) => T): T =>
  useSyncExternalStore(paletteStore.subscribe, () => select(state));

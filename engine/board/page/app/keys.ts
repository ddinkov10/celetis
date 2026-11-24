import { useEffect } from 'react';
import { agentStore } from '../agents/state.ts';
import { handleKey } from '../operations/keys.ts';
import { screen } from '../operations/state.ts';
import { openPalette, paletteStore } from '../palette/state.ts';
import { isShortcutsOpen, openShortcuts } from '../shortcuts/shortcuts.tsx';
import { shellStore } from '../store.ts';
import { updateStore } from '../update/state.ts';

const settings = () => shellStore.get().settings;

const KEYS: Record<string, () => void> = {
  r: () => void shellStore.refresh(),
  '?': () => {
    agentStore.closeMenu();
    shellStore.setInputs({ moreOpen: false });
    openShortcuts();
  },
  '/': () => {
    agentStore.closeMenu();
    shellStore.setInputs({ moreOpen: false });
    openPalette();
  },
};

export function useGlobalKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof Node && document.getElementById('update-dialog')?.contains(event.target))
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        agentStore.closeMenu();
        shellStore.setInputs({ moreOpen: false });
        if (!paletteStore.get().isOpen) openPalette();
        return;
      }
      if (document.getElementById('agent-picker')?.contains(event.target as Node)) return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isShortcutsOpen() ||
        paletteStore.get().isOpen ||
        screen.get().stopFor !== null
      )
        return;
      if ((event.target as Element).closest?.<HTMLElement>('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'Escape' && shellStore.get().inputs.moreOpen) return;
      if (event.key === 'Escape' && updateStore.dismiss()) {
        event.preventDefault();
        return;
      }
      if (handleKey(event)) return;
      const press = settings().keys && KEYS[event.key];
      if (!press) return;
      event.preventDefault();
      press();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

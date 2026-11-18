import { createElement } from 'react';
import { ICONS } from '../../page/ui.ts';

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const parts = ICONS[name] ?? [];
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`icon i-${name} ${className}`.trim()}>
      {parts.map(([tag, attributes], index) =>
        createElement(tag, {
          key: index,
          ...Object.fromEntries(
            Object.entries(attributes).map(([key, value]) => [
              key === 'class' ? 'className' : key.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
              value,
            ]),
          ),
        }),
      )}
    </svg>
  );
}

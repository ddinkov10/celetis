import { createElement } from 'react';
import { ICONS } from '../ui.ts';

export function Icon({ name }: { name: string }) {
  return (
    <svg className={`icon i-${name}`} viewBox="0 0 16 16" aria-hidden="true">
      {(ICONS[name] ?? []).map(([tag, { class: className, ...attributes }], at) =>
        createElement(tag, { key: at, className, ...attributes }),
      )}
    </svg>
  );
}

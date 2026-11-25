import { createElement } from 'react';
import { ICONS } from '../ui.ts';

export function Icon({ name }: { name: string }) {
  return (
    <svg
      className={`icon i-${name} size-4 flex-none fill-none stroke-current stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round] [&_.fill]:fill-current [&_.fill]:stroke-none [&_.track]:opacity-30`}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {(ICONS[name] ?? []).map(([tag, { class: className, ...attributes }], at) =>
        createElement(tag, { key: at, className, ...attributes }),
      )}
    </svg>
  );
}

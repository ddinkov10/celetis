import { cn } from 'cn';
import { Icon } from '../app/icon.tsx';
import { Button } from '../ui/button.tsx';
import { coordinator, useCoordinator } from './coordinator.ts';
import type { Mirror } from './rules.ts';

const MARKS: Record<Mirror['state'], string> = {
  none: 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--fg3)]',
  starting: 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--working)]',
  works: 'bg-working',
  'turn-ended': 'bg-card-foreground',
  dialog: 'rounded-[1.5px] bg-needs [transform:rotate(45deg)]',
};

export function ChatMark({ state, stale, className }: Pick<Mirror, 'state' | 'stale'> & { className?: string }) {
  return (
    <i
      className={cn('size-[7px] flex-none rounded-[50%]', MARKS[state], stale && 'opacity-55', className)}
      aria-hidden="true"
    />
  );
}

export function ChatButton() {
  const mirror = useCoordinator((state) => state.mirror);
  const isDialog = mirror.state === 'dialog';
  return (
    <Button
      type="button"
      variant="secondary"
      size="action"
      id="pane-chat"
      className={cn(
        'gap-[7px] phone:min-h-11',
        isDialog &&
          'bg-[color-mix(in_srgb,var(--needs-tint)_10%,transparent)] border-[color-mix(in_srgb,var(--needs)_45%,transparent)] [&:hover]:bg-[color-mix(in_srgb,var(--needs-tint)_10%,transparent)] [&:hover]:border-[color-mix(in_srgb,var(--needs)_45%,transparent)]',
      )}
      data-state={mirror.state}
      data-stale={mirror.stale ? '' : undefined}
      data-new={mirror.unseen ? '' : undefined}
      aria-label={mirror.label}
      title={mirror.title}
      onClick={() => coordinator.open()}
    >
      <Icon name="message" />
      <span className="label">Chat</span>
      <ChatMark state={mirror.state} stale={mirror.stale} />
      <span
        className={cn(
          'font-normal',
          mirror.stale ? 'text-muted-foreground' : isDialog ? 'text-foreground' : 'text-card-foreground',
        )}
      >
        {mirror.words}
      </span>
      {mirror.unseen && (
        <i
          className="-ml-0.5 size-[7px] flex-none rounded-[50%] bg-foreground shadow-[0_0_0_3px_color-mix(in_srgb,var(--fg)_14%,transparent)]"
          aria-hidden="true"
        />
      )}
    </Button>
  );
}

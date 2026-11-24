import { defaultReason } from '../operations/actions.ts';
import { screen } from '../operations/state.ts';
import { boardKey, queryClient } from '../query.ts';
import { shellStore } from '../store.ts';
import { toast } from '../toast/toast.ts';
import { announce, post } from '../ui.ts';
import { isReconnecting } from '../update/state.ts';

const isServerDown = () => queryClient.getQueryState(boardKey)?.status === 'error';
let intakePending = false;

const intakeReason = () => {
  if (isReconnecting()) return 'The board is reconnecting';
  if (intakePending) return 'An intake tab is opening';
  const data = screen.read();
  const readAt = Date.parse(data?.source.readAt ?? '');
  if (!data || isServerDown() || data.source.error || !Number.isFinite(readAt) || Date.now() - readAt > 60_000)
    return null;
  return defaultReason();
};

export function drawIntake(): void {
  shellStore.setInputs({ intake: { reason: intakeReason(), pending: intakePending } });
}

export async function openIntake(): Promise<void> {
  if (intakeReason() !== null) return;
  intakePending = true;
  drawIntake();
  announce('Opening an intake tab');
  try {
    const outcome = await post('/api/intake', {}, 'New intake failed', { timeout: 10000 });
    if (outcome.status === 'accepted') announce('Intake tab opened');
    else {
      const detail =
        outcome.status === 'rejected'
          ? outcome.error
          : [
              outcome.error,
              'The launch outcome is unknown. Check Human sessions or herdr before pressing New intake again.',
            ]
              .filter(Boolean)
              .join(' ');
      toast('New intake failed', { detail, isError: true });
      announce(`New intake failed. ${detail}`);
    }
  } finally {
    intakePending = false;
    drawIntake();
  }
}

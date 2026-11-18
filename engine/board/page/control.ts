import type { DaemonView } from '../types.ts';
import { $, el } from './ui.ts';

const AUTO: Record<DaemonView['auto'], { tone: string; title: string }> = {
  on: { tone: 'ok', title: 'Auto mode starts each auto step.' },
  off: { tone: 'off', title: 'Auto mode is off: auto steps wait.' },
  stopping: { tone: 'off', title: 'Auto mode stops after its current work.' },
};
const WORDS: Record<DaemonView['auto'], string> = {
  on: 'Auto mode is on.',
  off: 'Auto mode is off.',
  stopping: 'Auto mode is stopping.',
};
const daemonItem = (daemon: DaemonView): { text: string; tone: string; title: string } => {
  const { tone, title } = AUTO[daemon.auto];
  return { text: `auto ${daemon.auto}`, tone, title: `The daemon PID ${daemon.pid} runs. ${title}` };
};

const write = (node: HTMLElement, text: string, code: string | null = null) => {
  if (node.textContent === text + (code ?? '')) return;
  node.replaceChildren(...(text ? [text] : []), ...(code ? [el('code', '', code)] : []));
};

export function drawControl({ daemon, isDown }: { daemon: DaemonView | null; isDown: boolean }): void {
  const auto = isDown ? null : (daemon?.auto ?? null);
  if (isDown) write($('ctl-auto-state'), 'No daemon answers. Start it in a terminal: ', 'celetis daemon start');
  else write($('ctl-auto-state'), auto ? WORDS[auto] : 'The daemon state is not read yet.');
  const command = $('ctl-auto-command');
  command.hidden = auto === null;
  if (auto) write(command, 'Change it in a terminal: ', `celetis daemon auto ${auto === 'on' ? 'off' : 'on'}`);
  else write(command, '');
  const item = isDown
    ? { text: 'not running', tone: 'fail', title: 'The board server does not answer.' }
    : daemon
      ? daemonItem(daemon)
      : { text: 'checking', tone: 'wait', title: '' };
  const row = $('daemon');
  if (row.dataset.tone !== item.tone) row.dataset.tone = item.tone;
  if (row.title !== item.title) row.title = item.title;
  if (row.textContent !== `Daemon${item.text}`)
    row.replaceChildren(el('i', 'dot'), el('span', 'sb-name', 'Daemon'), el('span', 'sb-text', item.text));
}

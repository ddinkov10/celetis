import { $ } from './ui.ts';

export const dialogOpen = () => ($('stop-dialog') as HTMLDialogElement).open;

export const openStopDialog = ({ title, stop, done }: { title: string; stop: () => void; done: () => void }) => {
  const dialog = $('stop-dialog') as HTMLDialogElement;
  let isConfirmed = false;
  $('stop-title').textContent = title;
  $('stop-confirm').onclick = () => {
    isConfirmed = true;
    dialog.close();
  };
  $('stop-cancel').onclick = () => dialog.close();
  dialog.onclose = () => {
    done();
    if (isConfirmed) stop();
  };
  dialog.showModal();
};

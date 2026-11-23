import { memo } from 'react';

const never = () => true;

export const QueueHost = memo(() => <section className="queue" id="queue" hidden />, never);

export const Layers = memo(
  () => (
    <>
      <p className="sr-only" id="announce" aria-live="polite" />
      <div className="toast" id="toast" role="alert" hidden>
        <span className="toast-icon" id="toast-icon" />
        <span id="toast-text" />
        <button type="button" className="toast-close" id="toast-close" aria-label="Close" />
      </div>
      <div className="menu" id="menu" role="menu" popover="" />
      <dialog className="palette" id="palette" aria-label="Search the cards, history, and commands">
        <div className="pal-input-row">
          <input
            id="pal-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <div className="pal-list" id="pal-list" role="listbox" aria-label="Results" />
        <div className="pal-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            move
          </span>
          <span>
            <kbd>Enter</kbd>
            do it
          </span>
          <span>
            <kbd>Esc</kbd>
            close
          </span>
        </div>
      </dialog>
      <dialog className="keys" id="keys" aria-labelledby="keys-title">
        <div className="keys-head">
          <h2 id="keys-title">Keyboard shortcuts</h2>
          <button type="button" className="icon-btn" id="keys-close" aria-label="Close" />
        </div>
        <dl className="keys-list">
          <div>
            <dt>
              <kbd>⌘K</kbd>
              <kbd>/</kbd>
            </dt>
            <dd>Search the cards, history, and commands, or type #n to jump to an issue</dd>
          </div>
          <div>
            <dt>
              <kbd>j</kbd>
              <kbd>k</kbd>
              <kbd>↓</kbd>
              <kbd>↑</kbd>
            </dt>
            <dd>Next or previous card or epic group</dd>
          </div>
          <div>
            <dt>
              <kbd>h</kbd>
              <kbd>l</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd>
            </dt>
            <dd>Card in the column to the left or right</dd>
          </div>
          <div>
            <dt>
              <kbd>Enter</kbd>
            </dt>
            <dd>Main button of the card: Go, Run, Resume, Open agent, Open shell, or Open issue</dd>
          </div>
          <div>
            <dt>
              <kbd>Space</kbd>
            </dt>
            <dd>
              {'Show the details of the card; '}
              <kbd>Esc</kbd>
              {' hides them'}
            </dd>
          </div>
          <div>
            <dt>
              <kbd>Enter</kbd>
              <kbd>Space</kbd>
            </dt>
            <dd>On an epic group, show or hide its issues</dd>
          </div>
          <div>
            <dt>
              <kbd>m</kbd>
            </dt>
            <dd>All the actions of the card</dd>
          </div>
          <div>
            <dt>
              <kbd>o</kbd>
            </dt>
            <dd>Open the issue</dd>
          </div>
          <div>
            <dt>
              <kbd>c</kbd>
            </dt>
            <dd>Copy the command or the path of the card</dd>
          </div>
          <div>
            <dt>
              <kbd>s</kbd>
            </dt>
            <dd>Set the card aside, or stop its session</dd>
          </div>
          <div>
            <dt>
              <kbd>v</kbd>
            </dt>
            <dd>Change between the tabs Agents and Pipeline</dd>
          </div>
          <div>
            <dt>
              <kbd>d</kbd>
            </dt>
            <dd>Open or close the tab History</dd>
          </div>
          <div>
            <dt>
              <kbd>r</kbd>
            </dt>
            <dd>Read the issues again</dd>
          </div>
          <div>
            <dt>
              <kbd>?</kbd>
            </dt>
            <dd>Show this list</dd>
          </div>
        </dl>
        <label className="keys-switch">
          <input type="checkbox" id="keys-on" />
          <span>
            Single-key shortcuts (<kbd>j</kbd> <kbd>k</kbd> <kbd>h</kbd> <kbd>l</kbd> <kbd>v</kbd> <kbd>d</kbd>{' '}
            <kbd>r</kbd> <kbd>/</kbd> <kbd>?</kbd>
            ). The keys of a focused card or epic group always work.
          </span>
        </label>
      </dialog>
      <p className="sr-only" id="update-status" role="status" aria-live="polite" />
      <dialog
        className="update-dialog"
        id="update-dialog"
        aria-labelledby="update-title"
        aria-describedby="update-description"
      >
        <h2 id="update-title" tabIndex={-1} />
        <p className="update-description" id="update-description" />
        <p className="update-status" id="update-progress" aria-hidden="true" />
        <p className="update-error" id="update-error" hidden />
        <p className="update-recovery" id="update-recovery" hidden />
        <div className="update-actions">
          <button type="button" className="btn primary" id="update-start">
            Update and restart
          </button>
          <button type="button" className="btn primary" id="update-check" hidden>
            Check again
          </button>
          <button type="button" className="btn ghost" id="update-later">
            Later
          </button>
        </div>
      </dialog>
    </>
  ),
  never,
);

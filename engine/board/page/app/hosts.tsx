import { memo } from 'react';

const never = () => true;
const autofocus = (node: HTMLElement | null) => node?.setAttribute('autofocus', '');

export const OperationsHost = memo(
  () => (
    <div className="ops" id="area-operations" data-tab="agents" data-pane="chat">
      <div className="center" id="center">
        <section className="coordinator" id="coordinator" aria-labelledby="coordinator-title" data-state="none" hidden>
          <header className="co-head">
            <h2 className="co-title" id="coordinator-title">
              Coordinator
            </h2>
            <span className="co-host" id="coordinator-host" />
            <span className="pill co-pill" id="coordinator-head-state" />
            <span className="co-head-end">
              <button type="button" className="btn ghost" id="coordinator-interrupt" hidden>
                <span className="label">Interrupt</span>
              </button>
              <button type="button" className="btn ghost" id="coordinator-end" hidden>
                <span className="label">End session</span>
              </button>
              <button
                type="button"
                className="btn ghost"
                id="coordinator-go"
                title="Show the tab of the session in the Herdr app"
                hidden
              >
                <span className="label">Go</span>
              </button>
            </span>
          </header>
          <p className="co-banner" id="coordinator-banner" role="status" hidden />
          <div className="co-body">
            <div
              className="co-log co-chat"
              id="coordinator-log"
              role="log"
              tabIndex={0}
              aria-label="Conversation with the coordinator"
            />
            <button type="button" className="btn ghost co-to-end" id="coordinator-to-end" hidden>
              <span className="label">Go to the end</span>
            </button>
          </div>
          <div className="co-foot">
            <form className="co-form" id="coordinator-form" hidden>
              <textarea
                className="co-field"
                id="coordinator-field"
                rows={1}
                aria-label="Message to the coordinator"
                aria-describedby="coordinator-hint"
                placeholder="Write to the coordinator"
              />
              <div className="co-row">
                <p className="co-hint" id="coordinator-hint" />
                <button type="submit" className="btn primary" id="coordinator-send">
                  <span className="label">Send</span>
                </button>
              </div>
            </form>
            <div className="co-start" id="coordinator-start-block" hidden>
              <p className="co-start-text" id="coordinator-start-text" hidden />
              <button type="button" className="btn primary" id="coordinator-start">
                <span className="label">Start a new session</span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="pane" id="pane" aria-label="Work views" tabIndex={-1}>
        <div className="pane-head">
          <button type="button" className="btn ghost pane-chat co-open" id="pane-chat" hidden>
            <span className="label">Chat</span>
            <i className="co-mark" aria-hidden="true" />
            <span className="co-open-state" />
          </button>
          <div className="tabs" role="tablist" aria-label="Work views" id="tabs">
            <button type="button" role="tab" className="tab" id="tab-agents" data-tab="agents" aria-controls="tp-board">
              <span className="label">Agents</span>
              <span className="tab-badge" id="agents-badge" hidden />
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              id="tab-pipeline"
              data-tab="pipeline"
              aria-controls="tp-board"
            >
              <span className="label">Pipeline</span>
            </button>
            <button type="button" role="tab" className="tab" id="tab-queue" data-tab="queue" aria-controls="queue">
              <span className="label">Queue</span>
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              id="tab-history"
              data-tab="history"
              aria-controls="history-pane"
            >
              <span className="label">History</span>
            </button>
          </div>
        </div>
        <div className="tp-board" id="tp-board" role="tabpanel" aria-labelledby="tab-agents">
          <section className="human" id="human" aria-labelledby="human-title" hidden />
          <div className="board" id="columns" aria-busy="true" />
        </div>
        <section className="queue" id="queue" role="tabpanel" aria-labelledby="tab-queue" hidden />
        <section className="history-pane" id="history-pane" role="tabpanel" aria-labelledby="tab-history" hidden />
      </section>
    </div>
  ),
  never,
);

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
            placeholder="Search an issue, a step, or a command; #n jumps to an issue"
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
      <dialog className="stop-dialog" id="stop-dialog" aria-labelledby="stop-title" aria-describedby="stop-description">
        <h2 id="stop-title" />
        <p className="stop-description" id="stop-description">
          The agent ends and its tab closes. The issue moves to Idle as set aside, and auto mode skips it. Resume opens
          the saved session again.
        </p>
        <div className="stop-actions">
          <button type="button" className="btn ghost" id="stop-cancel" ref={autofocus}>
            Cancel
          </button>
          <button type="button" className="btn primary" id="stop-confirm">
            Stop session
          </button>
        </div>
      </dialog>
    </>
  ),
  never,
);

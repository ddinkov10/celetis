// engine/board/queue.ts
import { $, el, iconButton, toast } from "./ui.mjs";
var board = null;
var submitted = null;
var agent = "";
var open = false;
var busy = false;
var uncertain = false;
var retired = new Set;
var options;
var section = () => $("queue");
var cards = () => Object.values(board?.columns ?? {}).flat();
var available = () => cards().filter((card) => card.number !== null && !card.sessionId && card.run && card.step);
var find = (number) => cards().find((card) => card.number === number);
var heading = () => section().querySelector(".queue-status h3");
var expected = () => ({
  id: submitted?.record?.id ?? null,
  revision: submitted?.record?.revision ?? 0,
  current: submitted?.record?.numbers[0] ?? null
});
var authoritative = () => Boolean(submitted && !uncertain && !board?.source.error);
var announce = (message) => {
  $("announce").textContent = message;
};
function accept(view) {
  const old = submitted?.record;
  const next = view.record;
  if (next && (retired.has(next.id) || old?.id === next.id && next.revision < old.revision))
    return;
  if (!next && old) {
    submitted = {
      ...submitted,
      error: view.error ?? "The queue record is unavailable. Refresh before acting.",
      actions: { add: false, edit: false, continue: false, retry: false }
    };
    return;
  }
  if (old && next && old.id !== next.id)
    retired.add(old.id);
  submitted = view;
}
var restore = (key) => {
  if (!key)
    return;
  const control = section().querySelector(`[data-control="${CSS.escape(key)}"]:not(:disabled)`);
  (control ?? section().querySelector(".queue-move button:not(:disabled), .queue-pick button:not(:disabled)") ?? heading())?.focus({ preventScroll: true });
};
var button = (text, key, action, disabled = false) => {
  const node = el("button", "btn ghost", text);
  node.type = "button";
  node.dataset.control = key;
  node.disabled = disabled;
  node.addEventListener("click", () => {
    if (!node.disabled)
      action();
  });
  return node;
};
var request = async (action) => {
  if (busy || !authoritative())
    return;
  busy = true;
  announce("Saving the queue");
  draw();
  try {
    const response = await fetch("/api/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...action.kind === "add" ? { agent: submitted?.record?.host ?? agent } : {} }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok)
      throw new Error((await response.json()).error);
    accept(await response.json());
    announce(action.kind === "add" ? `#${action.number} is saved in the queue` : "The queue is saved");
  } catch (error) {
    uncertain = true;
    toast("Queue action needs a refresh", {
      detail: error instanceof Error ? error.message : String(error),
      isError: true
    });
    try {
      const response = await fetch("/api/queue", { signal: AbortSignal.timeout(30000) });
      if (!response.ok)
        throw new Error("Queue state is unavailable");
      const view = await response.json();
      accept(view);
      uncertain = !view.actions.add && !view.actions.edit && !view.actions.continue && !view.actions.retry;
    } catch {
      uncertain = true;
    }
    announce("Check the saved queue before another attempt");
  } finally {
    busy = false;
    draw();
  }
};
var stateOf = () => {
  const record = submitted?.record;
  if (!record?.numbers.length)
    return "empty";
  if (record.state === "me-gate")
    return "me-gate";
  if (record.state === "error" || submitted?.error && !submitted.owner)
    return "error";
  const observed = cards().some((card) => card.number === record.numbers[0] && card.sessionId && card.step === record.current?.step && card.state !== null && card.state !== "starts");
  return record.state === "running" && observed ? "running" : "starting";
};
var row = (number, index, numbers) => {
  const node = el("li", `queue-row${index === 0 ? " queue-current" : ""}`);
  node.dataset.number = String(number);
  const copy = el("div", "queue-copy");
  const next = submitted?.next;
  const step = next?.kind === "run" ? next.step : submitted?.record?.current?.step;
  copy.append(el("span", "queue-number", `#${number}`), el("span", "queue-title", find(number)?.title ?? `Issue #${number}`), el("span", "queue-meta", index === 0 ? `${stateOf() === "me-gate" ? "Waiting for approval" : stateOf() === "error" ? "Stopped" : stateOf() === "running" ? "Running" : "Saved · starting"}${step ? ` · ${step}` : ""}` : "Waiting"));
  node.append(el("span", "queue-rank", String(index + 1)), copy);
  if (index > 0) {
    const controls = el("div", "queue-move");
    for (const direction of ["up", "down"]) {
      const control = iconButton("chevron", `Move #${number} ${direction}`, () => request({ kind: "move", number, direction, expected: expected() }));
      control.classList.add(`queue-${direction}`);
      control.dataset.control = `${direction}-${number}`;
      control.disabled = busy || !authoritative() || !submitted?.actions.edit || (direction === "up" ? index === 1 : index === numbers.length - 1);
      controls.append(control);
    }
    const remove = iconButton("close", `Remove #${number} from queue`, () => request({ kind: "remove", number, expected: expected() }));
    remove.dataset.control = `remove-${number}`;
    remove.disabled = busy || !authoritative() || !submitted?.actions.edit;
    controls.append(remove);
    node.append(controls);
  }
  return node;
};
function draw() {
  if (!board)
    return;
  const active = section().contains(document.activeElement) ? document.activeElement.dataset.control : undefined;
  const record = submitted?.record;
  const numbers = record?.numbers ?? [];
  const state = stateOf();
  section().dataset.state = state;
  section().setAttribute("aria-busy", String(busy));
  $("queue-open").textContent = `Queue${numbers.length ? ` ${numbers.length}` : ""}`;
  const head = el("header", "queue-head");
  const title = el("div", "queue-heading");
  title.append(el("h2", "", "Issue queue"), el("span", "queue-count", `${numbers.length} remaining`));
  head.append(title, button("Back to board", "back", options.back));
  const status = el("div", "queue-status");
  const headingNode = el("h3", "", busy ? "Saving the queue" : state === "empty" ? "Ready for work" : state === "starting" ? `Starting #${numbers[0]}` : state === "running" ? `Running #${numbers[0]}` : state === "me-gate" ? "Your approval is needed" : "The queue stopped");
  headingNode.tabIndex = -1;
  headingNode.dataset.control = "heading";
  status.append(headingNode, el("p", "", state === "starting" ? "Your issue is saved. Waiting for a verified session." : state === "me-gate" ? "Continue starts the displayed step. Later issues stay queued." : "Add issues at any time. Finished issues leave automatically."));
  const warning = !authoritative() ? "The queue state is unavailable. Refresh before acting." : submitted?.error ?? board.noRun;
  if (warning) {
    const node = el("p", "queue-warning", warning);
    node.setAttribute("role", "alert");
    status.append(node);
  }
  if (record?.act)
    status.append(el("p", "queue-recovery", record.act));
  const current = el("section", "queue-current-section");
  current.append(el("h4", "", "Current issue"));
  if (numbers[0]) {
    const list = el("ol", "queue-list");
    list.append(row(numbers[0], 0, numbers));
    current.append(list);
  } else
    current.append(el("p", "queue-empty", "No issue is running. Add one below to start work."));
  status.append(current);
  const actions = el("div", "queue-actions");
  const label = el("label", "queue-agent", "Agent ");
  const select = el("select");
  select.dataset.control = "agent";
  select.setAttribute("aria-label", "Queue agent");
  for (const host of ["claude", "codex"]) {
    const option = new Option(host === "claude" ? "Claude" : "Codex", host);
    option.disabled = board.agents?.[host]?.available !== true;
    select.add(option);
  }
  select.value = record?.host ?? agent;
  select.disabled = numbers.length > 0 || busy || !authoritative();
  select.addEventListener("change", () => {
    agent = select.value;
    draw();
  });
  label.append(select);
  actions.append(label);
  const next = submitted?.next;
  if (submitted?.actions.continue && next?.kind === "run")
    actions.append(button("Continue queue", "continue", () => request({ kind: "continue", step: next.step, expected: expected() }), busy || !authoritative()));
  else if (submitted?.actions.retry)
    actions.append(button("Try again", "retry", () => request({ kind: "retry", step: next?.kind === "run" ? next.step : null, expected: expected() }), busy || !authoritative()));
  if (uncertain)
    actions.append(button("Refresh queue", "refresh", () => options.refresh(), busy));
  const content = el("div", "queue-content");
  const waiting = el("section", "queue-order");
  waiting.append(el("h3", "", "Up next"));
  const list = el("ol", "queue-list");
  list.setAttribute("aria-label", "Waiting issues");
  list.start = 2;
  list.append(...numbers.slice(1).map((number, index) => row(number, index + 1, numbers)));
  waiting.append(numbers.length > 1 ? list : el("p", "queue-empty", "No issues waiting. Add more at any time."));
  const picker = el("section", "queue-picker");
  picker.append(el("h3", "", "Add from the board"), el("p", "", "Add starts an empty queue. Otherwise, the issue joins the end."));
  for (const card of available()) {
    const number = card.number;
    const item = el("div", "queue-pick");
    const copy = el("div");
    copy.append(el("span", "queue-number", `#${number}`), el("span", "queue-title", card.title));
    const selected = numbers.includes(number);
    const add = button(selected ? "In queue" : "Add", `add-${number}`, () => request({ kind: "add", number, step: card.step, expected: expected() }), selected || busy || !authoritative() || !submitted?.actions.add || !board.agents?.[record?.host ?? agent]?.available || Boolean(board.noRun));
    add.setAttribute("aria-label", `Add #${number} to queue`);
    item.append(copy, add);
    picker.append(item);
  }
  if (!available().length)
    picker.append(el("p", "", "No runnable issues are available."));
  content.append(waiting, picker);
  section().replaceChildren(head, status, actions, content);
  if (open)
    restore(active);
}
function setupQueue(next) {
  options = next;
}
function setQueueOpen(value) {
  open = value;
  section().hidden = !open;
  document.body.classList.toggle("queue-view-open", open);
  $("queue-open").setAttribute("aria-pressed", String(open));
  for (const button of document.querySelectorAll(".views button"))
    button.setAttribute("aria-pressed", String(!open && button.dataset.view === $("columns").dataset.view));
  if (open) {
    draw();
    heading()?.focus();
  }
}
function drawQueue(next) {
  board = next;
  if (!agent && board.defaultAgent)
    agent = board.defaultAgent;
  const before = submitted?.record?.numbers.length;
  if (board.queue) {
    accept(board.queue);
    if (!board.source.error && Object.values(board.queue.actions).some(Boolean))
      uncertain = false;
  }
  draw();
  if (before !== undefined && submitted?.record && before > submitted.record.numbers.length)
    announce(`${submitted.record.numbers.length} issues remain in the queue`);
}
export {
  drawQueue,
  setQueueOpen,
  setupQueue
};

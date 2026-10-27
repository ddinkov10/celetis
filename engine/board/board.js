// engine/board/board.ts
import { openMenu, openPalette, setupMenu, setupPalette } from "./palette.mjs";
import { drawPanel } from "./panel.mjs";
import {
  $,
  actionButton,
  copy,
  el,
  icon,
  iconButton,
  link,
  mark,
  post,
  SERVER_DOWN,
  store,
  timed,
  toast
} from "./ui.mjs";
import {
  age,
  agentOf,
  COLUMNS,
  cleanCause,
  favicon,
  groupNeeds,
  keyOf,
  laneTrack,
  needsYou,
  notice,
  pageTitle,
  pipeline,
  prFacts,
  runTitle,
  shortPath,
  signature,
  stateLabel,
  tail,
  tone
} from "./view.mjs";
var SUMMARY = [
  ["needs", "need you"],
  ["running", "running"],
  ["idle", "idle"],
  ["done", "done"]
];
var COPY = { "no-progress": "command", "dirty-tree": "path" };
var ON_ISSUE = new Set(["blocked"]);
var LIVE = new Set(["works", "waits", "unknown"]);
var GATES = {
  me: "This step starts only when you press Run",
  auto: "The automatic runner starts this step by itself"
};
var STATUS_ICONS = {
  works: "works",
  starts: "works",
  waits: "target",
  unknown: "pending",
  "no-progress": "alert",
  "dirty-tree": "diff",
  blocked: "person"
};
var FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
var DEFAULT_AGENT_REASON = "The main .celetis.yaml controls the default agent. Change host there.";
var data = null;
var selected = null;
var view = store.get("view") === "pipeline" ? "pipeline" : "now";
var isNotifyOn = store.get("notify") === "on";
var isKeysOn = store.get("keys") !== "off";
var isArchiveOpen = false;
var seen = null;
var needsKeys = null;
var starting = null;
var byKey = new Map;
var used = new Set;
var who = (card) => card.number === null ? card.title ? `human session "${card.title}"` : "a human session" : `#${card.number}`;
var canRunLater = (card) => card.sessionId === null && card.step && (card.state === null || card.state === "no-progress");
var copyWhat = (card) => card.act ? COPY[card.state] : null;
var onTracker = () => data.tracker ? ` on ${data.tracker}` : "";
var readAgain = () => data?.tracker ? `Read ${data.tracker} again` : "Read the issues again";
var act = async (path, value, failure, onDone) => {
  const isOk = await post(path, value, failure);
  if (isOk)
    onDone?.();
  await load();
  return isOk;
};
var agentDisplay = (id) => agentOf({ agent: id })?.name ?? id;
var runReason = (agent) => {
  if (data?.noRun)
    return data.noRun;
  const agents = data?.agents;
  if (agent) {
    const entry = agents?.[agent];
    if (entry && entry.available === false)
      return cleanCause(entry.cause);
    return null;
  }
  const def = data?.defaultAgent;
  if (def != null && agents?.[def]?.available === false)
    return cleanCause(agents[def].cause);
  return null;
};
var runAction = (card, agent = null) => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent);
  const name = agent ? `Run ${card.step}, #${card.number} with ${display}` : `Run ${card.step}, #${card.number}`;
  return {
    id: agent ? `run:${agent}` : "run",
    label: agent ? `Run with ${display}` : "Run",
    icon: "run",
    busy: "Starting",
    name,
    title: reason ?? runTitle(card.step, data.flow),
    isDisabled: Boolean(reason),
    run: reason ? async () => toast(reason, { isError: true }) : async () => {
      if (await launch(card, "/api/run", agent ?? undefined))
        toast(`Started the ${card.step} step of #${card.number} in a new herdr tab`);
    }
  };
};
var overrideActionsOf = (card, isAgain) => {
  const agents = data?.agents;
  if (!card.run || !agents || data?.noRun)
    return [];
  return Object.keys(agents).map((id) => {
    const display = agentDisplay(id);
    const base = runAction(card, id);
    return isAgain ? {
      ...base,
      label: `Run again with ${display}`,
      name: `Run ${card.step} again, #${card.number} with ${display}`,
      isGhost: true,
      title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`
    } : base;
  });
};
var defaultAgentEntry = {
  icon: "person",
  label: "Default agent is read-only",
  key: "",
  isDisabled: true,
  title: DEFAULT_AGENT_REASON,
  run: async () => toast(DEFAULT_AGENT_REASON, { isError: true })
};
var agentMenuOf = () => [defaultAgentEntry];
var toMenuEntry = (action) => ({
  icon: action.icon,
  label: action.name,
  key: action.isMain ? "Enter" : "",
  isDisabled: action.isDisabled,
  title: action.title,
  run: action.href ? () => window.open(action.href, "_blank", "noopener,noreferrer") : action.run
});
var actionsOf = (card) => {
  const list = [];
  if (card.go) {
    list.push({
      id: "go",
      label: "Go",
      icon: "go",
      busy: "Focusing",
      name: `Go to the pane of ${who(card)}`,
      title: "Focus its pane in herdr (Enter)",
      run: () => act("/api/go", { sessionId: card.sessionId }, "Go failed", () => toast(`Focused the pane of ${who(card)} in herdr`, { detail: "Switch to your terminal to see it." }))
    });
  }
  if (card.state === "no-progress") {
    if (card.resume) {
      list.push({
        id: "resume",
        label: "Resume",
        icon: "terminal",
        busy: "Opening",
        name: `Resume the ${card.step} session of #${card.number}`,
        title: "Open the session of this step again in a new herdr tab (Enter)",
        run: async () => {
          if (await launch(card, "/api/resume"))
            toast(`Opened the ${card.step} session of #${card.number} in a new herdr tab`, {
              detail: "Switch to your terminal to see it."
            });
        }
      });
    }
    if (card.run) {
      const base = runAction(card);
      list.push({
        ...base,
        label: "Run again",
        name: `Run ${card.step} again, #${card.number}`,
        isGhost: true,
        title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`
      });
      list.push(...overrideActionsOf(card, true));
    }
  } else if (card.run) {
    list.push(runAction(card));
    list.push(...overrideActionsOf(card, false));
  }
  if (card.state === "dirty-tree") {
    list.push({
      id: "shell",
      label: "Open shell",
      icon: "terminal",
      busy: "Opening",
      name: `Open a shell in the worktree of #${card.number}`,
      title: "Open a shell in the worktree in a new herdr tab (Enter)",
      run: () => act("/api/shell", { number: card.number }, "Open shell failed", () => toast(`Opened a shell in the worktree of #${card.number}`, {
        detail: "Commit or stash the changes there; then the card moves on."
      }))
    });
  }
  if (ON_ISSUE.has(card.state) && card.url) {
    list.push({
      id: "open",
      label: "Open issue",
      icon: "open",
      name: `Open issue #${card.number}${onTracker()}`,
      title: `Open the issue${onTracker()} (Enter)`,
      href: card.url
    });
  }
  const { noRun } = data;
  if (noRun && canRunLater(card)) {
    list.push({
      id: "blocked",
      label: "Run",
      icon: "run",
      name: `Run ${card.step}, #${card.number}`,
      title: noRun,
      isDisabled: true,
      run: async () => toast(noRun, { isError: true })
    });
    if (data?.agents)
      for (const id of Object.keys(data.agents)) {
        const display = agentDisplay(id);
        list.push({
          id: `run:${id}`,
          label: `Run with ${display}`,
          icon: "run",
          name: `Run ${card.step}, #${card.number} with ${display}`,
          title: noRun,
          isDisabled: true,
          run: async () => toast(noRun, { isError: true })
        });
      }
  }
  list.forEach((action, index) => {
    action.isMain = index === 0;
  });
  return list;
};
var menuOf = (card, key) => [
  ...actionsOf(card).map(toMenuEntry),
  "rule",
  { icon: "panel", label: "Show the details", key: "Space", run: () => openPanel(key) },
  ...card.url && !ON_ISSUE.has(card.state) ? [
    {
      icon: "open",
      label: `Open the issue${onTracker()}`,
      key: "o",
      run: () => window.open(card.url, "_blank", "noopener,noreferrer")
    }
  ] : [],
  ...copyWhat(card) ? [
    {
      icon: "copy",
      label: `Copy the ${copyWhat(card)}`,
      key: "c",
      run: () => copy(card.act, copyWhat(card))
    }
  ] : []
];
var track = (card) => {
  const steps = laneTrack(card, data.flow);
  if (!steps)
    return null;
  const at = steps.findIndex((step) => step.state === "now");
  const node = el("span", "track");
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", `Step ${at + 1} of ${steps.length}: ${steps[at].name}`);
  node.title = steps.map((step) => step.state === "next" ? step.name : `${step.name} (${step.state === "now" ? "now" : "done"})`).join(" · ");
  node.append(...steps.map((step) => el("i", `seg ${step.state}`)));
  return node;
};
var gate = (value) => value === "auto" ? Object.assign(el("span", "gate gate-auto", "auto"), { title: GATES.auto }) : null;
var status = (card, hasGlyph = true, isShort = false) => {
  const node = el("span", "status");
  if (card.state) {
    if (hasGlyph)
      node.append(icon(STATUS_ICONS[card.state] ?? "pending"));
    node.append(el("span", "status-label", stateLabel(card)));
    if (isShort)
      return node;
    const agent = agentOf(card);
    if (agent)
      node.append(el("span", "detail agent-name", agent.name));
    if (card.step && card.step !== card.type)
      node.append(el("span", "detail mono", card.step));
  } else if (card.step) {
    node.classList.add("next");
    if (hasGlyph)
      node.append(icon("pending"));
    node.append(el("span", "lead", "next"), el("span", "mono step", card.step));
    const auto = gate(card.gate);
    if (auto)
      node.append(auto);
  }
  return node;
};
var liveLine = (card) => {
  if (!card.diff)
    return null;
  const node = el("div", "live");
  const delta = el("span", "delta");
  delta.append(el("i", "", `+${card.diff.added}`), ` −${card.diff.removed}`);
  node.append(icon("diff"), el("span", "target", `${card.diff.files} ${card.diff.files === 1 ? "file" : "files"} changed`), delta);
  node.title = "Changed since the branch left its base";
  return node;
};
var chips = (card) => {
  const items = prFacts(card.pr);
  if (items.length === 0)
    return null;
  const node = el("div", "chips");
  for (const item of items) {
    const chip = link(`chip2 chip-${item.kind}`, "", item.url);
    chip.append(icon(item.kind === "pr" ? "pr" : item.kind === "checks-fail" ? "xcircle" : item.kind === "checks-pass" || item.kind === "review-approved" ? "check" : "clock"), item.text);
    if (item.url)
      chip.addEventListener("click", (event) => event.stopPropagation());
    node.append(chip);
  }
  return node;
};
var actLine = (card) => {
  const what = copyWhat(card);
  if (!what)
    return el("p", "act", card.act);
  const node = el("p", "act code");
  const code = el("code");
  shortPath(card.act).split("/").forEach((part, index) => {
    code.append(...index ? [el("wbr"), `/${part}`] : [part]);
  });
  code.title = card.act;
  node.append(code, iconButton("copy", `Copy the ${what}`, () => copy(card.act, what), "copy"));
  node.lastChild.title = `Copy the ${what} (c)`;
  return node;
};
var keyFor = (card) => {
  let key = keyOf(card);
  while (used.has(key))
    key += "-x";
  used.add(key);
  return key;
};
var shell = (card, column, isCompact, level = "h3") => {
  const key = keyFor(card);
  byKey.set(key, { card, column });
  const node = el("article", `card${isCompact ? " compact" : ""}${key === selected ? " is-selected" : ""}`);
  node.dataset.state = card.state ?? "next";
  node.dataset.key = key;
  node.tabIndex = -1;
  node.style.viewTransitionName = key;
  if (card.url)
    node.dataset.url = card.url;
  if (seen !== null && seen.get(key) !== signature(card, column))
    node.classList.add("is-unseen");
  const text = card.title || `Issue #${card.number}`;
  const title = el(level, "title");
  title.id = `t-${key}`;
  title.title = text;
  title.append(link("", text, card.url));
  title.querySelector("a")?.addEventListener("click", (event) => event.stopPropagation());
  node.setAttribute("aria-labelledby", title.id);
  const id = link("num", `#${card.number}`, card.url);
  id.addEventListener("click", (event) => event.stopPropagation());
  return { key, node, title, id };
};
var unseenDot = () => Object.assign(el("i", "unseen"), { title: "Changed since you last looked" });
var runWithButton = (card) => {
  const actions = actionsOf(card);
  if (!["run", "blocked"].includes(actions[0]?.id))
    return null;
  const entries = actions.filter((action) => action.id.startsWith("run:")).map(toMenuEntry);
  if (entries.length === 0)
    return null;
  const button = iconButton("chevron", "Run with another agent", (event) => openMenu(event.currentTarget, entries));
  button.setAttribute("aria-haspopup", "menu");
  return button;
};
var drawCard = (card, column, { isCompact = false, level } = {}) => {
  const { key, node, title, id } = shell(card, column, isCompact, level);
  const actions = actionsOf(card);
  const isQuiet = column !== "needs";
  if (isCompact) {
    const meta = el("div", "meta");
    meta.append(id);
    if (card.type && card.type !== card.step) {
      const type = el("span", "meta-type");
      type.append(el("span", "sep", "·"), card.type);
      meta.append(type);
    }
    meta.append(el("span", "sep", "·"), status(card, card.state === "starts", true));
    const main = el("div", "main");
    main.append(title, meta);
    if (card.warning)
      main.append(el("p", "warning", card.warning));
    node.append(mark(card), main);
    if (actions[0]) {
      const withButton = runWithButton(card);
      if (withButton) {
        const btns = el("div", "compact-btns");
        btns.append(actionButton(actions[0], isQuiet), withButton);
        node.append(btns);
      } else {
        node.append(actionButton(actions[0], isQuiet));
      }
    }
    if (node.classList.contains("is-unseen"))
      node.append(unseenDot());
    return node;
  }
  const head = el("div", "card-head");
  if (node.classList.contains("is-unseen"))
    head.append(unseenDot());
  head.append(mark(card), id);
  if (card.type)
    head.append(el("span", "sep", "·"), el("span", "type", card.type));
  const lane = track(card);
  if (lane)
    head.append(lane);
  const more = iconButton("dots", "More actions (m)", () => openMenu(more, menuOf(card, key)), "more");
  more.setAttribute("aria-haspopup", "menu");
  head.append(more);
  node.append(head, title);
  for (const part of [
    card.state === "works" ? liveLine(card) : null,
    chips(card),
    card.act ? actLine(card) : null,
    card.warning ? el("p", "warning", card.warning) : null
  ])
    if (part)
      node.append(part);
  const end = el("div", "foot-end");
  if (card.state !== "starts")
    end.append(timed(card.since, Boolean(card.sessionId) && LIVE.has(card.state)));
  if (actions[0])
    end.append(actionButton(actions[0], isQuiet));
  const withButton = runWithButton(card);
  if (withButton)
    end.append(withButton);
  const foot = el("div", "card-foot");
  foot.append(status(card), end);
  node.append(foot);
  return node;
};
var glyph = (key) => {
  const node = el("span", "glyph");
  node.append(icon(`col-${key}`));
  return node;
};
var empty = (key, [title, text]) => {
  const node = el("div", `empty empty-${key}`);
  node.append(icon(key === "needs" ? "clear" : `col-${key}`), el("p", "empty-title", title), el("p", "empty-text", text));
  return node;
};
var needsBody = (cards) => groupNeeds(cards).map((group) => {
  const node = el("div", `group group-${group.key}`);
  node.dataset.group = group.key;
  node.dataset.short = group.short;
  const label = el("h3", "group-label");
  label.id = `g-${group.key}`;
  label.append(el("span", "", group.label), el("span", "group-count", String(group.cards.length)));
  node.setAttribute("role", "group");
  node.setAttribute("aria-labelledby", label.id);
  node.append(label, ...group.cards.map((card) => drawCard(card, "needs", { isCompact: group.isCompact, level: "h4" })));
  return node;
});
var column = ({ key, name, note, empty: copyOf }, cards) => {
  const section = el("section", `col col-${key}`);
  section.id = `col-${key}`;
  section.setAttribute("aria-labelledby", `h-${key}`);
  section.classList.toggle("has-waits", cards.some((card) => card.state === "waits"));
  const heading = el("h2", "col-name", name);
  heading.id = `h-${key}`;
  const head = el("header", "col-head");
  head.title = note;
  head.append(glyph(key), heading, el("span", "count", String(cards.length)));
  const body = el("div", "col-body");
  if (cards.length === 0)
    body.append(empty(key, copyOf));
  else if (key === "needs")
    body.append(...needsBody(cards), drawTail());
  else
    body.append(...cards.map((card) => drawCard(card, key, { isCompact: key === "idle" })));
  section.append(head, body);
  return section;
};
var drawTail = () => {
  const wrap = el("div", "tail-wrap");
  const button = el("button", "tail");
  button.type = "button";
  button.append(icon("chevron"), el("span", "tail-text"));
  button.addEventListener("click", () => {
    const first = [...document.querySelectorAll(".col-needs .card[data-key]")].find((node) => node.dataset.hidden === "true");
    first?.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
    first?.focus({ preventScroll: true });
  });
  wrap.append(button);
  wrap.hidden = true;
  return wrap;
};
var tailFrame = 0;
var updateTail = () => {
  cancelAnimationFrame(tailFrame);
  tailFrame = requestAnimationFrame(() => {
    const body = document.querySelector(".col-needs .col-body");
    const wrap = body?.querySelector(".tail-wrap");
    if (!body || !wrap)
      return;
    const bottom = body.getBoundingClientRect().bottom - (wrap.hidden ? 0 : wrap.offsetHeight);
    const counts = new Map;
    for (const node of body.querySelectorAll(".card[data-key]")) {
      const isHidden = node.getBoundingClientRect().top > bottom - 24;
      node.dataset.hidden = String(isHidden);
      if (!isHidden)
        continue;
      const group = node.closest(".group");
      counts.set(group.dataset.group, {
        short: group.dataset.short,
        count: (counts.get(group.dataset.group)?.count ?? 0) + 1
      });
    }
    const text = body.scrollHeight > body.clientHeight + 4 ? tail([...counts.values()]) : "";
    wrap.hidden = text === "";
    wrap.querySelector(".tail-text").textContent = text;
  });
};
var pipelineView = (columns, flow) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const where = new Map([
    ...columns.needs.map((c) => [c, "needs"]),
    ...columns.running.map((c) => [c, "running"]),
    ...columns.idle.map((c) => [c, "idle"])
  ]);
  const { stages, hold } = pipeline(cards, flow);
  const sections = [];
  if (hold.length) {
    const strip = el("section", "col hold");
    strip.setAttribute("aria-label", "Not in a lane step");
    const label = el("h2", "hold-label", "Not in a step");
    const list = el("div", "hold-list");
    list.append(...hold.map((card) => drawCard(card, where.get(card), { isCompact: true })));
    strip.append(label, list);
    sections.push(strip);
  }
  for (const stage of stages) {
    const section = el("section", "col stage");
    section.setAttribute("aria-labelledby", `s-${stage.key}`);
    const head = el("header", "col-head");
    head.title = stage.steps.join(", ");
    const heading = el("h2", "col-name", stage.name);
    heading.id = `s-${stage.key}`;
    head.append(heading, el("span", "count", String(stage.cards.length)));
    const body = el("div", "col-body");
    body.append(...stage.cards.length ? stage.cards.map((card) => drawCard(card, where.get(card), { isCompact: true })) : [el("p", "stage-empty", "No issue at this step")]);
    section.append(head, body);
    sections.push(section);
  }
  return sections;
};
var focusFirst = (selector) => {
  const target = document.querySelector(selector);
  target?.focus();
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
};
var summary = (columns) => SUMMARY.map(([key, label]) => {
  const count = key === "needs" ? needsYou(columns).length : columns[key].length;
  const chip = el("button", `chip chip-${key}`);
  chip.type = "button";
  chip.classList.toggle("hot", key === "needs" && count > 0);
  chip.append(el("i", "dot"), el("b", "", String(count)), el("span", "", label));
  chip.addEventListener("click", () => {
    if (key === "done")
      return setArchive(true);
    if (view !== "now")
      setView("now");
    focusFirst(`${key === "needs" ? '.human-pill[data-wait="dialog"] .human-open, ' : ""}#col-${key} .card, #col-${key} .empty`);
  });
  return chip;
});
var humanPill = (card) => {
  const key = keyFor(card);
  byKey.set(key, { card, column: "human" });
  const pill = el("div", "human-pill");
  pill.dataset.state = card.state ?? "";
  pill.dataset.wait = card.waitFor ?? "";
  const open = el("button", `human-open${key === selected ? " is-selected" : ""}`);
  open.type = "button";
  open.dataset.key = key;
  open.title = "Show the details and the screen of this session";
  open.append(mark(card), el("span", "human-name", card.title || "A session"), el("i", "human-dot"), el("span", "human-state", stateLabel(card)), timed(card.since, true));
  open.addEventListener("click", () => selected === key ? closePanel() : openPanel(key));
  const [go] = actionsOf(card);
  pill.append(open, iconButton("go", go.name, () => go.run?.(), "human-go"));
  return pill;
};
var drawHuman = (cards) => {
  const strip = $("human");
  strip.hidden = cards.length === 0;
  strip.replaceChildren(...cards.length ? [Object.assign(el("h2", "hold-label", "Human sessions"), { id: "human-title" })] : [], ...cards.map(humanPill));
};
var done = [];
var drawArchive = () => {
  const list = $("archive-list");
  list.replaceChildren(...done.length ? done.map((card) => {
    const row = el("div", "fin");
    row.append(mark(card), link("num", `#${card.number}`, card.url), link("fin-title", card.title, card.url), timed(card.since));
    return row;
  }) : [el("p", "fin-empty", "The data gives no issue as done.")]);
  $("archive").hidden = !isArchiveOpen;
  $("done-toggle").setAttribute("aria-expanded", String(isArchiveOpen));
  $("done-count").textContent = String(done.length);
};
var setArchive = (isOpen) => {
  isArchiveOpen = isOpen;
  drawArchive();
  if (isOpen)
    $("archive-close").focus();
};
var markSeen = (key) => {
  const entry = byKey.get(key);
  if (!entry || seen === null)
    return;
  seen.set(key, signature(entry.card, entry.column));
  const node = document.querySelector(`.card[data-key="${CSS.escape(key)}"]`);
  node?.classList.remove("is-unseen");
  node?.querySelector(".unseen")?.remove();
};
var markAllSeen = () => {
  if (seen === null)
    return;
  for (const [key, { card, column }] of byKey)
    seen.set(key, signature(card, column));
};
var notify = (cards) => {
  const keys = new Set(cards.map((card) => keyOf(card)));
  const fresh = needsKeys === null ? [] : cards.filter((card) => !needsKeys.has(keyOf(card)) && !(card.sessionId === null && starting?.has(card.number)));
  const isAway = document.hidden || !document.hasFocus();
  if (isNotifyOn && isAway && "Notification" in window && Notification.permission === "granted") {
    for (const card of fresh) {
      const { title, body } = notice(card);
      const shown = new Notification(title, { body, tag: keyOf(card), icon: favicon("needs") });
      shown.addEventListener("click", () => {
        window.focus();
        if (view !== "now")
          setView("now");
        openPanel(keyOf(card));
      });
    }
  }
  needsKeys = keys;
  return fresh.map((card) => notice(card).title);
};
var startNotices = (columns) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const now = new Map;
  for (const card of cards)
    if (card.state === "starts" && card.number !== null)
      now.set(card.number, card.step);
  const lines = [];
  const before = starting;
  starting = now;
  if (before === null)
    return lines;
  for (const [number, step] of now)
    if (!before.has(number))
      lines.push(`#${number} is starting the ${step} step`);
  for (const [number, step] of before) {
    if (now.has(number))
      continue;
    const card = cards.find((other) => other.number === number);
    if (card?.warning)
      lines.push(`#${number}: ${card.warning}`);
    else if (card?.sessionId)
      lines.push(`#${number} started the ${step} step`);
  }
  return lines;
};
var drawHints = (card) => {
  const hints = $("hints");
  const entry = card ? byKey.get(card.dataset.key) : null;
  const pairs = entry ? [
    ["Enter", actionsOf(entry.card)[0]?.label],
    ["Space", "Details"],
    ["o", entry.card.url ? "Open" : null],
    ["c", copyWhat(entry.card) ? "Copy" : null],
    ["m", "Menu"]
  ] : [
    ["j", "k", "Move"],
    [FIND_KEY, "Search"]
  ];
  hints.replaceChildren(...pairs.filter((pair) => pair.at(-1)).map((pair) => {
    const node = el("span", "hint");
    node.append(...pair.slice(0, -1).map((key) => el("kbd", "", key)), pair.at(-1));
    return node;
  }));
};
var drawStatus = (source, isDown) => {
  const fresh = $("fresh");
  const state = isDown || source.error ? "fail" : source.readAt ? "ok" : "wait";
  const name = data?.tracker ?? "Issues";
  const text = el("span", "sb-text");
  if (isDown)
    text.append(SERVER_DOWN);
  else if (source.error)
    text.append(`cannot read: ${source.error}`);
  else if (!source.readAt)
    text.append("no data yet");
  else
    text.append("read ", timed(source.readAt, false, " ago"));
  fresh.dataset.tone = state;
  fresh.title = source.readAt ? `${name} was read at ${new Date(source.readAt).toLocaleTimeString()}` : "";
  fresh.replaceChildren(el("i", "dot"), el("span", "sb-name", name), text);
  const herdr = data?.herdr;
  const herdrNode = $("herdr");
  herdrNode.dataset.tone = herdr?.ok === true ? "ok" : herdr?.ok === false ? "fail" : "wait";
  herdrNode.title = herdr?.error ? `herdr: ${herdr.error}` : "Run and Go use herdr";
  herdrNode.replaceChildren(el("i", "dot"), el("span", "sb-name", "herdr"), el("span", "sb-text", herdr?.ok === true ? "up" : herdr?.ok === false ? "down" : "checking"));
  const runner = $("runner");
  runner.hidden = data?.runner === null || data?.runner === undefined;
  runner.dataset.tone = data?.runner ? "ok" : "off";
  runner.title = data?.runner ? "The automatic runner starts each auto step" : "No automatic runner runs: auto steps wait";
  runner.replaceChildren(el("i", "dot"), el("span", "sb-name", "Runner"), el("span", "sb-text", data?.runner ? "on" : "off"));
  const agentNode = $("agent");
  if (agentNode) {
    const agents = data?.agents;
    const def = data?.defaultAgent;
    agentNode.hidden = !data;
    const defText = def ? agentDisplay(def) : "No default agent";
    const defReason = def != null && agents?.[def]?.available === false ? cleanCause(agents[def].cause) : null;
    agentNode.dataset.tone = defReason ? "fail" : def != null && agents?.[def]?.available ? "ok" : "wait";
    agentNode.title = DEFAULT_AGENT_REASON;
    agentNode.setAttribute("aria-haspopup", "menu");
    agentNode.setAttribute("aria-label", `Agent: ${defText}. ${DEFAULT_AGENT_REASON}`);
    agentNode.replaceChildren(icon("person"), el("span", "sb-name", "Agent"), el("span", "sb-text", defText), icon("chevron"));
  }
  document.body.toggleAttribute("data-stale", isDown);
  $("stale").hidden = !isDown;
};
var drawNotify = () => {
  const button = $("notify");
  const isBlocked = "Notification" in window && Notification.permission === "denied";
  const isOn = isNotifyOn && !isBlocked;
  button.replaceChildren(icon(isOn ? "bell" : "bell-off"), el("span", "sb-name", "Notify"), el("b", "", isBlocked ? "blocked" : isOn ? "on" : "off"));
  button.setAttribute("aria-pressed", String(isOn));
  button.title = isBlocked ? "The browser blocks notifications for this page" : isOn ? "A system notification shows when a card needs you" : "Show a system notification when a card needs you";
};
var panelContext = (card) => ({
  actions: actionsOf(card),
  flow: data.flow,
  on: onTracker(),
  close: closePanel
});
var drawPanelFor = () => {
  const entry = byKey.get(selected);
  if (!entry)
    return closePanel();
  const focused = $("panel").contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  $("panel").replaceChildren(...drawPanel(entry.card, panelContext(entry.card)));
  if (focused)
    ($("panel").querySelector(`[aria-label="${CSS.escape(focused)}"]`) ?? $("panel").querySelector(".panel-head > .icon-btn:last-child"))?.focus({ preventScroll: true });
};
var openPanel = (key) => {
  if (!byKey.has(key))
    return;
  selected = key;
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.classList.add("is-selected");
  document.body.classList.add("has-panel");
  $("panel").hidden = false;
  drawPanelFor();
  markSeen(key);
  $("panel").querySelector(".panel-actions .btn, .ask .btn, .icon-btn")?.focus({ preventScroll: true });
  updateTail();
};
function closePanel() {
  const key = selected;
  selected = null;
  document.body.classList.remove("has-panel");
  $("panel").hidden = true;
  $("panel").replaceChildren();
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  if (key)
    document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  updateTail();
}
var drawBoard = (next) => {
  const active = document.activeElement;
  const holder = active?.closest?.(".human-pill, [data-key]");
  const target = (holder?.querySelector("[data-key]") ?? holder)?.dataset.key;
  const isGo = Boolean(active?.matches?.(".human-go"));
  used = new Set;
  byKey = new Map;
  const needs = next.columns.needs.length;
  document.title = pageTitle(next.repo, needsYou(next.columns).length);
  $("favicon").href = favicon(tone(next.columns));
  $("repo").textContent = next.repo;
  $("refresh").title = `${readAgain()} (r)`;
  $("dirty").hidden = !next.noRun;
  const banner = next.noRun ?? "";
  if ($("dirty").textContent !== banner)
    $("dirty").textContent = banner;
  $("summary").replaceChildren(...summary(next.columns));
  done = next.columns.done;
  drawArchive();
  const board = $("columns");
  board.dataset.view = view;
  board.style.setProperty("--stages", String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle("is-calm", needs === 0);
  board.replaceChildren(...view === "pipeline" ? pipelineView(next.columns, next.flow) : COLUMNS.map((spec) => column(spec, next.columns[spec.key])));
  drawHuman(next.columns.human);
  board.setAttribute("aria-busy", "false");
  if (seen === null) {
    seen = new Map;
    markAllSeen();
  }
  const lines = [...notify(needsYou(next.columns)), ...startNotices(next.columns)];
  if (lines.length)
    $("announce").textContent = lines.join(". ");
  if (selected) {
    if (byKey.has(selected))
      drawPanelFor();
    else
      closePanel();
  }
  if (target) {
    const node = document.querySelector(`[data-key="${CSS.escape(target)}"]`);
    const go = isGo ? node?.closest(".human-pill")?.querySelector(".human-go") : null;
    (go ?? node)?.focus({ preventScroll: true });
  }
  drawHints(document.activeElement?.closest?.(".card[data-key]") ?? null);
  updateTail();
};
var drawSkeleton = () => $("columns").replaceChildren(...COLUMNS.map(({ key, name }) => {
  const section = el("section", `col col-${key}`);
  const head = el("header", "col-head");
  head.append(glyph(key), el("h2", "col-name", name));
  const body = el("div", "col-body");
  body.append(...[0, 1, 2].map(() => el("div", "card ghost-card")));
  section.append(head, body);
  return section;
}));
var setView = (next) => {
  view = next;
  store.set("view", next);
  for (const button of document.querySelectorAll(".views button"))
    button.setAttribute("aria-pressed", String(button.dataset.view === next));
  if (data)
    drawBoard(project(data));
};
var tick = () => {
  const now = Date.now();
  for (const node of document.querySelectorAll("[data-since]"))
    node.textContent = `${age(node.dataset.since, now, "fine" in node.dataset)}${node.dataset.suffix ?? ""}`;
};
var isCalm = matchMedia("(prefers-reduced-motion: reduce)");
var layoutOf = (next) => JSON.stringify([
  view,
  Object.entries(next.columns).map(([key, cards]) => [key, cards.map((card) => keyOf(card))])
]);
var last = "";
var lastLayout = "";
var source = { readAt: null, error: null };
var hasRead = false;
var timer = 0;
var reads = 0;
var accepted = 0;
var settled = 0;
var launches = new Map;
var project = (board) => {
  if (launches.size === 0)
    return board;
  const columns = { needs: [], running: [], idle: [], done: [], human: [] };
  for (const [key, cards] of Object.entries(board.columns))
    for (const card of cards) {
      const launch = card.sessionId === null ? launches.get(card.number) : undefined;
      if (!launch)
        columns[key].push(card);
      else if (launch.phase !== "failed" && card.step === launch.step && (card.state === null || card.state === "no-progress"))
        columns.running.unshift({
          ...card,
          state: "starts",
          act: null,
          run: false,
          resume: false,
          go: false,
          warning: null
        });
      else
        columns[key].push({ ...card, run: false, resume: false });
    }
  return { ...board, columns };
};
var render = (canMove = true) => {
  const next = project(data);
  const cards = JSON.stringify([next.repo, next.noRun, next.flow, next.tracker, next.columns]);
  if (cards === last)
    return;
  const layout = layoutOf(next);
  const isMove = lastLayout !== "" && layout !== lastLayout && !document.hidden;
  if (canMove && isMove && document.startViewTransition && !isCalm.matches)
    document.startViewTransition(() => drawBoard(project(data)));
  else
    drawBoard(next);
  last = cards;
  lastLayout = layout;
};
var launch = async (card, path, agent) => {
  const number = card.number;
  const current = data && Object.values(project(data).columns).flat().find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === "/api/run" ? "run" : "resume"])
    return false;
  const reason = path === "/api/run" ? runReason(agent ?? null) : data?.noRun;
  if (reason) {
    toast(reason, { isError: true });
    return false;
  }
  const entry = { step: current.step, phase: "pending" };
  launches.set(number, entry);
  render(false);
  if (document.activeElement === document.body)
    document.querySelector(`[data-key="${CSS.escape(keyOf(card))}"]`)?.focus({ preventScroll: true });
  const isOk = await post(path, { number, ...agent ? { agent } : {} }, path === "/api/run" ? "Run failed" : "Resume failed");
  entry.phase = isOk ? "done" : "failed";
  settled = reads;
  render();
  load();
  return isOk;
};
async function load() {
  clearTimeout(timer);
  const isLocal = hasRead && document.hidden;
  const read = ++reads;
  try {
    const response = await fetch(`/api/board${isLocal ? "?local=1" : ""}`);
    if (!response.ok)
      throw new Error(response.statusText);
    const next = await response.json();
    if (read > accepted && read > settled) {
      accepted = read;
      data = next;
      hasRead = true;
      for (const [number, launch] of launches)
        if (launch.phase !== "pending")
          launches.delete(number);
      render();
      source = data.source;
      drawStatus(source, false);
    }
  } catch {
    drawStatus(source, true);
  }
  tick();
  timer = setTimeout(load, document.hidden ? 15000 : 5000);
}
var move = (across, down) => {
  const lists = [...document.querySelectorAll("#columns .col")].map((col) => [
    ...col.querySelectorAll(".card[data-key]")
  ]);
  const current = document.activeElement?.closest?.(".card[data-key]");
  const at = lists.findIndex((list) => list.includes(current));
  if (at < 0)
    return lists.flat()[0]?.focus();
  const row = lists[at].indexOf(current);
  if (down)
    return lists[at][Math.min(Math.max(row + down, 0), lists[at].length - 1)].focus();
  for (let next = at + across;next >= 0 && next < lists.length; next += across) {
    if (lists[next].length)
      return lists[next][Math.min(row, lists[next].length - 1)].focus();
  }
};
var boardActions = () => [
  { label: readAgain(), icon: "refresh", key: "r", run: () => $("refresh").click() },
  { label: isArchiveOpen ? "Hide Done" : "Show Done", icon: "check", key: "d", run: () => setArchive(!isArchiveOpen) },
  {
    label: isNotifyOn ? "Turn notifications off" : "Turn notifications on",
    icon: isNotifyOn ? "bell-off" : "bell",
    key: "",
    run: toggleNotify
  },
  { label: "Show the keyboard shortcuts", icon: "keyboard", key: "?", run: () => $("keys").showModal() }
];
var paletteItems = () => {
  if (!data)
    return [];
  const items = [];
  const add = (group, card, _key, action) => items.push({
    group,
    number: card.number,
    label: action.name.replace(/, #\d+$/, "").replace(/ of #\d+$/, "").replace(/^(Open issue) #\d+/, "$1"),
    context: card.title,
    icon: action.icon,
    tone: group === "Needs you" ? "needs" : null,
    key: "",
    run: action.href ? () => window.open(action.href, "_blank", "noopener,noreferrer") : action.run
  });
  const shown = project(data);
  for (const [column, group] of [
    ["needs", "Needs you"],
    ["running", "Running"],
    ["idle", "Run the next step"],
    ["human", "Human sessions"]
  ]) {
    for (const card of shown.columns[column]) {
      const key = [...byKey].find(([, entry]) => entry.card === card)?.[0] ?? keyOf(card);
      const [main] = actionsOf(card);
      if (main && !main.isDisabled)
        add(group, card, key, main);
      else if (card.number !== null || card.sessionId)
        items.push({
          group,
          number: card.number,
          label: "Show the details",
          context: card.title,
          icon: "panel",
          tone: null,
          key: "",
          run: () => openPanel(key)
        });
      if (card.run && card.number !== null && data?.agents && !data?.noRun) {
        for (const [id, entry] of Object.entries(data.agents)) {
          if (!entry.available)
            continue;
          const display = agentDisplay(id);
          items.push({
            group,
            number: card.number,
            label: `Run #${card.number} with ${id}`,
            context: card.title,
            icon: "run",
            tone: group === "Needs you" ? "needs" : null,
            key: "",
            title: runTitle(card.step, data.flow),
            run: async () => {
              if (await launch(card, "/api/run", id))
                toast(`Started the ${card.step} step of #${card.number} with ${display} in a new herdr tab`);
            }
          });
        }
      }
    }
  }
  for (const card of shown.columns.done)
    if (card.url)
      items.push({
        group: "Done",
        number: card.number,
        label: `Open the issue${onTracker()}`,
        context: card.title,
        icon: "open",
        tone: null,
        key: "",
        run: () => window.open(card.url, "_blank", "noopener,noreferrer")
      });
  items.push({ group: "Board", number: null, context: "", ...defaultAgentEntry }, {
    group: "Board",
    number: null,
    label: view === "now" ? "Show the pipeline" : "Show what needs you now",
    context: "",
    icon: view === "now" ? "stages" : "board",
    key: "v",
    run: () => setView(view === "now" ? "pipeline" : "now")
  }, ...boardActions().map((action) => ({ group: "Board", number: null, context: "", ...action })));
  return items;
};
async function toggleNotify() {
  if (!("Notification" in window))
    return toast("This browser has no notifications", { isError: true });
  if (!isNotifyOn && Notification.permission === "default")
    await Notification.requestPermission();
  if (Notification.permission === "denied") {
    isNotifyOn = false;
    toast("The browser blocks notifications for this page", {
      detail: "Allow them in the site settings of the browser, then press Notify again.",
      isError: true
    });
  } else if (Notification.permission === "default") {
    isNotifyOn = false;
    toast("Notifications stay off", {
      detail: "The browser did not get your permission. Press Notify again to answer it."
    });
  } else {
    isNotifyOn = !isNotifyOn;
    toast(isNotifyOn ? "Notifications are on" : "Notifications are off", {
      detail: isNotifyOn ? "A system notification shows when a card needs you and the board is not in front." : ""
    });
  }
  store.set("notify", isNotifyOn ? "on" : "off");
  drawNotify();
}
var KEYS = {
  j: () => move(0, 1),
  k: () => move(0, -1),
  h: () => move(-1, 0),
  l: () => move(1, 0),
  r: () => $("refresh").click(),
  d: () => setArchive(!isArchiveOpen),
  v: () => setView(view === "now" ? "pipeline" : "now"),
  "?": () => $("keys").showModal(),
  "/": () => openPalette(paletteItems())
};
var CARD_KEYS = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
  Enter: (card) => card.querySelector(".main-action")?.click(),
  " ": (card) => openPanel(card.dataset.key),
  o: (card) => card.dataset.url && window.open(card.dataset.url, "_blank", "noopener,noreferrer"),
  c: (card) => {
    const entry = byKey.get(card.dataset.key);
    if (entry && copyWhat(entry.card))
      copy(entry.card.act, copyWhat(entry.card));
  },
  m: (card) => {
    const entry = byKey.get(card.dataset.key);
    if (entry)
      openMenu(card.querySelector(".more") ?? card, menuOf(entry.card, card.dataset.key));
  }
};
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented)
    return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (!$("palette").open)
      openPalette(paletteItems());
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || $("keys").open || $("palette").open)
    return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]"))
    return;
  if (event.key === "Escape" && isArchiveOpen) {
    event.preventDefault();
    setArchive(false);
    return $("summary").querySelector(".chip-done")?.focus();
  }
  if (event.key === "Escape" && selected) {
    event.preventDefault();
    return closePanel();
  }
  const card = document.activeElement?.matches?.(".card[data-key]") ? document.activeElement : null;
  const press = card && CARD_KEYS[event.key] || isKeysOn && KEYS[event.key];
  if (!press)
    return;
  event.preventDefault();
  press(card);
});
var columns = $("columns");
columns.addEventListener("click", (event) => {
  const node = event.target.closest(".card[data-key]");
  if (!node || event.target.closest("a, button"))
    return;
  if (selected === node.dataset.key)
    return closePanel();
  openPanel(node.dataset.key);
});
columns.addEventListener("contextmenu", (event) => {
  const node = event.target.closest(".card[data-key]");
  const entry = node && byKey.get(node.dataset.key);
  if (!entry)
    return;
  event.preventDefault();
  openMenu(node.querySelector(".more") ?? node, menuOf(entry.card, node.dataset.key));
});
columns.addEventListener("focusin", (event) => {
  const node = event.target.closest(".card[data-key]");
  if (node)
    markSeen(node.dataset.key);
  drawHints(node);
});
columns.addEventListener("focusout", (event) => {
  if (!columns.contains(event.relatedTarget))
    drawHints(null);
});
columns.addEventListener("pointerover", (event) => {
  const node = event.target.closest(".card[data-key].is-unseen");
  if (node)
    markSeen(node.dataset.key);
});
columns.addEventListener("scroll", updateTail, true);
addEventListener("resize", updateTail);
addEventListener("blur", markAllSeen);
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    markAllSeen();
  else
    load();
});
$("logo").append(icon("logo"));
$("refresh").prepend(icon("refresh"));
$("refresh").addEventListener("click", async () => {
  if ($("refresh").getAttribute("aria-busy") === "true")
    return;
  $("refresh").setAttribute("aria-busy", "true");
  await act("/api/refresh", {}, "Refresh failed");
  $("refresh").removeAttribute("aria-busy");
});
$("find").prepend(icon("search"));
$("find").querySelector("kbd").textContent = FIND_KEY;
$("find").addEventListener("click", () => openPalette(paletteItems()));
for (const button of document.querySelectorAll(".views button")) {
  button.prepend(icon(button.dataset.view === "now" ? "board" : "stages"));
  button.setAttribute("aria-label", `${button.querySelector(".label").textContent} view`);
  button.setAttribute("aria-pressed", String(button.dataset.view === view));
  button.addEventListener("click", () => setView(button.dataset.view));
}
$("done-toggle").prepend(icon("col-done"));
$("done-toggle").addEventListener("click", () => setArchive(!isArchiveOpen));
$("archive-close").append(icon("close"));
$("archive-close").addEventListener("click", () => {
  setArchive(false);
  $("summary").querySelector(".chip-done")?.focus();
});
$("notify").addEventListener("click", toggleNotify);
$("board-more").append(icon("dots"));
$("board-more").addEventListener("click", () => openMenu($("board-more"), boardActions()));
$("agent").addEventListener("click", () => openMenu($("agent"), agentMenuOf()));
$("keys-open").prepend(icon("keyboard"));
$("keys-open").addEventListener("click", () => $("keys").showModal());
$("keys-close").append(icon("close"));
$("keys-close").addEventListener("click", () => $("keys").close());
$("keys").addEventListener("click", (event) => {
  if (event.target === $("keys"))
    $("keys").close();
});
$("keys-on").checked = isKeysOn;
$("keys-on").addEventListener("change", () => {
  isKeysOn = $("keys-on").checked;
  store.set("keys", isKeysOn ? "on" : "off");
});
$("toast-close").append(icon("close"));
$("toast-close").addEventListener("click", () => {
  $("toast").hidden = true;
});
setupPalette();
setupMenu();
drawNotify();
drawHints(null);
setInterval(tick, 1000);
drawSkeleton();
drawStatus(source, false);
load();

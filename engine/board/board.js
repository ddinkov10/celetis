// engine/board/view.ts
var COLUMNS = [
  {
    key: "needs",
    name: "Needs you",
    note: "Answer, unblock, or run the next step",
    empty: ["No issue needs you", "No agent of an issue waits, and no step is stuck."]
  },
  {
    key: "running",
    name: "Running",
    note: "Agents at work",
    empty: ["No agent runs", "Run starts the next step of an issue."]
  },
  {
    key: "idle",
    name: "Idle",
    note: "Next steps not started yet",
    empty: ["No issue waits", "Open issues show here until their first step runs."]
  }
];
var GROUPS = [
  { key: "answer", label: "Waits for your answer", short: "waiting", states: ["waits"], isCompact: false },
  { key: "stuck", label: "Stuck", short: "stuck", states: ["no-progress", "dirty-tree"], isCompact: false },
  { key: "input", label: "Your input on the issue", short: "input on the issue", states: ["blocked"], isCompact: true },
  { key: "paused", label: "Paused by usage limits", short: "paused", states: ["quota-wait"], isCompact: true },
  { key: "ready", label: "Ready to run", short: "ready to run", states: null, isCompact: true }
];
var STATES = {
  works: "works",
  waits: "waits for you",
  starts: "Starting",
  "checks-step": "checks step",
  "dirty-tree": "dirty tree",
  "no-progress": "no progress",
  "quota-wait": "waits for a usage limit"
};
var WAITS = { dialog: "waits for your answer", turn: "turn ended" };
var gateOf = (flow, step) => flow?.steps?.[step]?.gate ?? null;
var sourceText = (source, by) => source === "decided" ? `decided by ${by}` : source === "pinned" ? "pinned by the config" : "default";
var modelSource = (pair) => sourceText(pair.source.model, pair.decision?.by ?? null);
var levelSource = (pair) => sourceText(pair.source.level, pair.decision?.by ?? null);
var startName = (pair) => `model ${pair.model}, ${modelSource(pair)}; effort ${pair.level}, ${levelSource(pair)}`;
var startTitle = (step, pair, level = pair.level) => `Start the ${step} step on ${pair.model} at ${level}, ${level === pair.level ? levelSource(pair) : "this start only"}`;
var runTitle = (step, flow, effort) => {
  const hint = flow?.steps?.[step]?.hint;
  const start = effort ? `Start the ${step} step on ${effort.model} (${modelSource(effort)}) at ${effort.level} (${levelSource(effort)})` : `Start the ${step} step`;
  return `${start}${hint ? `. ${hint}` : ""} (Enter)`;
};
var AGENTS = {
  claude: "Claude Code",
  codex: "Codex"
};
var cleanCause = (cause) => {
  const line = String(cause ?? "").split(`
`).map((part) => part.trim()).find(Boolean) ?? "";
  return line.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
};
var groupNeeds = (cards) => {
  const left = new Set(cards);
  return GROUPS.map((group) => {
    const members = cards.filter((card) => left.has(card) && (group.states === null || group.states.includes(card.state)));
    for (const card of members)
      left.delete(card);
    return { ...group, cards: members };
  }).filter((group) => group.cards.length > 0);
};
var groupEpics = (cards, canGroup) => {
  const groups = new Map;
  const items = [];
  for (const card of cards) {
    if (!card.epic || !canGroup(card)) {
      items.push({ kind: "card", card });
      continue;
    }
    const known = groups.get(card.epic.number);
    if (known) {
      known.cards.push(card);
      continue;
    }
    const group = { kind: "group", epic: card.epic, cards: [card] };
    groups.set(card.epic.number, group);
    items.push(group);
  }
  return items;
};
var parseOpenEpics = (value) => {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => Number.isSafeInteger(item) && item > 0))
      return new Set(parsed);
  } catch {}
  return new Set;
};
var laneTrack = (card, flow) => {
  const steps = card.type && flow?.lanes?.[card.type];
  const at = steps ? steps.indexOf(card.step) : -1;
  if (at < 0)
    return null;
  return steps.map((name, index) => ({
    name,
    state: index < at ? "done" : index === at ? "now" : "next"
  }));
};
var agentOf = (card) => {
  if (!card.agent)
    return null;
  const name = Object.hasOwn(AGENTS, card.agent) ? AGENTS[card.agent] : card.agent;
  return { name, letter: card.agent[0].toUpperCase() };
};
var stateLabel = (card) => {
  if (card.state === "waits" && WAITS[card.waitFor])
    return WAITS[card.waitFor];
  if (card.state === "blocked")
    return card.reason;
  return STATES[card.state] ?? card.state;
};
var age = (iso, now, isFine = false) => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (Number.isNaN(seconds))
    return "";
  if (minutes < 1)
    return `${seconds}s`;
  if (hours < 1)
    return isFine ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${minutes}m`;
  if (hours < 24)
    return isFine ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};
var keyOf = (card) => `k-${String(card.number ?? card.sessionId).replace(/[^\w-]/g, "-")}`;
var signature = (card, column) => [column, card.state, card.step, card.waitFor].join("|");
var pageTitle = (repo, needs) => `${needs > 0 ? `(${needs}) ` : ""}${repo} · Agent board`;
var needsYou = (columns) => [
  ...columns.human.filter((card) => card.waitFor === "dialog"),
  ...columns.needs
];
var tone = (columns) => {
  if (needsYou(columns).length > 0)
    return "needs";
  return columns.running.some((card) => card.state === "works") ? "works" : "calm";
};
var BADGES = { needs: "#FF7A45", works: "#5EA2FF" };
var favicon = (badge) => {
  const dot = BADGES[badge] ? `<circle cx="24" cy="8" r="6" fill="${BADGES[badge]}" stroke="#18181B" stroke-width="2"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#18181B"/><rect x="7" y="7" width="7.5" height="18" rx="2.25" fill="#EEEEF0"/><rect x="17.5" y="7" width="7.5" height="11" rx="2.25" fill="#EEEEF0"/>${dot}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
var who = (card) => card.number === null ? card.title ? `Human session "${card.title}"` : "A human session" : `#${card.number}`;
var NOTICES = {
  waits: (card) => card.waitFor === "turn" ? "ended its turn" : "waits for your answer",
  "no-progress": () => "made no progress",
  "dirty-tree": () => "has a dirty worktree",
  blocked: (card) => card.reason
};
var notice = (card) => ({
  title: `${who(card)} ${(NOTICES[card.state] ?? (() => `is ready to run ${card.step}`))(card)}`,
  body: card.title || ""
});
var tail = (groups) => {
  const parts = groups.filter((group) => group.count > 0).map((group) => `${group.count} ${group.short}`);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return total > 0 ? `${total} more below: ${parts.join(", ")}` : "";
};
var diffText = (diff) => diff ? `+${diff.added} −${diff.removed}` : "";
var shortPath = (path) => path.includes("/.claude/worktrees/") ? path.slice(path.indexOf(".claude/worktrees/")) : path;
var CHECKS = { pass: "CI passed", fail: "CI failed", pending: "CI running" };
var REVIEWS = {
  approved: "Approved",
  changes: "Changes requested",
  required: "Review required"
};
var prFacts = (pr) => pr ? [
  { kind: "pr", text: `${pr.draft ? "Draft " : ""}PR #${pr.number}`, url: pr.url },
  ...CHECKS[pr.checks] ? [{ kind: `checks-${pr.checks}`, text: CHECKS[pr.checks] }] : [],
  ...REVIEWS[pr.review] ? [{ kind: `review-${pr.review}`, text: REVIEWS[pr.review] }] : []
] : [];
var pipeline = (cards, flow) => {
  const stages = (flow?.stages ?? []).map((stage, index) => ({
    ...stage,
    key: index,
    cards: cards.filter((card) => stage.steps.includes(card.step))
  }));
  const placed = new Set(stages.flatMap((stage) => stage.cards));
  return { stages, hold: cards.filter((card) => !placed.has(card)) };
};
var filterItems = (items, query) => {
  const text = query.trim().toLowerCase();
  if (text === "")
    return items;
  const number = /^#?(\d+)$/.exec(text)?.[1];
  if (number) {
    const found = items.filter((item) => item.number !== null && String(item.number).startsWith(number));
    return [
      ...found.filter((item) => String(item.number) === number),
      ...items.filter((item) => item.number === null && item.context === text),
      ...found.filter((item) => String(item.number) !== number)
    ];
  }
  const words = text.split(/\s+/);
  return items.filter((item) => words.every((word) => `${item.label} ${item.context ?? ""}`.toLowerCase().includes(word)));
};

// engine/board/page/ui.ts
var CODEX_ICON = "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkNvZGV4PC90aXRsZT48cGF0aCBkPSJNMTkuNTAzIDBINC40OTZBNC40OTYgNC40OTYgMCAwMDAgNC40OTZ2MTUuMDA3QTQuNDk2IDQuNDk2IDAgMDA0LjQ5NiAyNGgxNS4wMDdBNC40OTYgNC40OTYgMCAwMDI0IDE5LjUwM1Y0LjQ5NkE0LjQ5NiA0LjQ5NiAwIDAwMTkuNTAzIDB6IiBmaWxsPSIjZmZmIj48L3BhdGg+PHBhdGggZD0iTTkuMDY0IDMuMzQ0YTQuNTc4IDQuNTc4IDAgMDEyLjI4NS0uMzEyYzEgLjExNSAxLjg5MS41NCAyLjY3MyAxLjI3NS4wMS4wMS4wMjQuMDE3LjAzNy4wMjFhLjA5LjA5IDAgMDAuMDQzIDAgNC41NSA0LjU1IDAgMDEzLjA0Ni4yNzVsLjA0Ny4wMjIuMTE2LjA1N2E0LjU4MSA0LjU4MSAwIDAxMi4xODggMi4zOTljLjIwOS41MS4zMTMgMS4wNDEuMzE1IDEuNTk1YTQuMjQgNC4yNCAwIDAxLS4xMzQgMS4yMjMuMTIzLjEyMyAwIDAwLjAzLjExNWMuNTk0LjYwNy45ODggMS4zMyAxLjE4MyAyLjE3LjI4OSAxLjQyNS0uMDA3IDIuNzEtLjg4NyAzLjg1NGwtLjEzNi4xNjZhNC41NDggNC41NDggMCAwMS0yLjIwMSAxLjM4OC4xMjMuMTIzIDAgMDAtLjA4MS4wNzZjLS4xOTEuNTUxLS4zODMgMS4wMjMtLjc0IDEuNDk0LS45IDEuMTg3LTIuMjIyIDEuODQ2LTMuNzExIDEuODM4LTEuMTg3LS4wMDYtMi4yMzktLjQ0LTMuMTU3LTEuMzAyYS4xMDcuMTA3IDAgMDAtLjEwNS0uMDI0Yy0uMzg4LjEyNS0uNzguMTQzLTEuMjA0LjEzOGE0LjQ0MSA0LjQ0MSAwIDAxLTEuOTQ1LS40NjYgNC41NDQgNC41NDQgMCAwMS0xLjYxLTEuMzM1Yy0uMTUyLS4yMDItLjMwMy0uMzkyLS40MTQtLjYxN2E1LjgxIDUuODEgMCAwMS0uMzctLjk2MSA0LjU4MiA0LjU4MiAwIDAxLS4wMTQtMi4yOTguMTI0LjEyNCAwIDAwLjAwNi0uMDU2LjA4NS4wODUgMCAwMC0uMDI3LS4wNDggNC40NjcgNC40NjcgMCAwMS0xLjAzNC0xLjY1MSAzLjg5NiAzLjg5NiAwIDAxLS4yNTEtMS4xOTIgNS4xODkgNS4xODkgMCAwMS4xNDEtMS42Yy4zMzctMS4xMTIuOTgyLTEuOTg1IDEuOTMzLTIuNjE4LjIxMi0uMTQxLjQxMy0uMjUxLjYwMS0uMzMuMjE1LS4wODkuNDMtLjE2NC42NDYtLjIyN2EuMDk4LjA5OCAwIDAwLjA2NS0uMDY2IDQuNTEgNC41MSAwIDAxLjgyOS0xLjYxNSA0LjUzNSA0LjUzNSAwIDAxMS44MzctMS4zODh6bTMuNDgyIDEwLjU2NWEuNjM3LjYzNyAwIDAwMCAxLjI3MmgzLjYzNmEuNjM3LjYzNyAwIDEwMC0xLjI3MmgtMy42MzZ6TTguNDYyIDkuMjNhLjYzNy42MzcgMCAwMC0xLjEwNi42MzFsMS4yNzIgMi4yMjQtMS4yNjYgMi4xMzZhLjYzNi42MzYgMCAxMDEuMDk1LjY0OWwxLjQ1NC0yLjQ1NWEuNjM2LjYzNiAwIDAwLjAwNS0uNjRMOC40NjIgOS4yM3oiIGZpbGw9InVybCgjbG9iZS1pY29ucy1jb2RleC1fUl8wXykiPjwvcGF0aD48ZGVmcz48bGluZWFyR3JhZGllbnQgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJsb2JlLWljb25zLWNvZGV4LV9SXzBfIiB4MT0iMTIiIHgyPSIxMiIgeTE9IjMiIHkyPSIyMSI+PHN0b3Agc3RvcC1jb2xvcj0iI0IxQTdGRiI+PC9zdG9wPjxzdG9wIG9mZnNldD0iLjUiIHN0b3AtY29sb3I9IiM3QTlERkYiPjwvc3RvcD48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzOTQxRkYiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4=";
var CLAUDE_ICON = "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjFlbSIgc3R5bGU9ImZsZXg6bm9uZTtsaW5lLWhlaWdodDoxIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIxZW0iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkNsYXVkZSBDb2RlPC90aXRsZT48cGF0aCBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMC45OTggMTAuOTQ5SDI0djMuMTAyaC0zdjMuMDI4aC0xLjQ4N1YyMEgxOHYtMi45MjFoLTEuNDg3VjIwSDE1di0yLjkyMUg5VjIwSDcuNDg4di0yLjkyMUg2VjIwSDQuNDg3di0yLjkyMUgzVjE0LjA1SDBWMTAuOTVoM1Y1aDE3Ljk5OHY1Ljk0OXpNNiAxMC45NDloMS40ODhWOC4xMDJINnYyLjg0N3ptMTAuNTEgMEgxOFY4LjEwMmgtMS40OXYyLjg0N3oiIGZpbGw9IiNEOTc3NTciIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjwvc3ZnPg==";
var AGENT_ICONS = { claude: CLAUDE_ICON, codex: CODEX_ICON };
var NS = "http://www.w3.org/2000/svg";
var ring = (extra = {}) => [
  "circle",
  { cx: 8, cy: 8, r: 6, ...extra }
];
var ICONS = {
  logo: [
    ["rect", { x: 1.5, y: 1.5, width: 5.5, height: 13, rx: 1.75, class: "fill" }],
    ["rect", { x: 9, y: 1.5, width: 5.5, height: 8, rx: 1.75, class: "fill" }]
  ],
  "col-needs": [ring(), ["circle", { cx: 8, cy: 8, r: 2.6, class: "fill core" }]],
  "col-running": [ring({ class: "track" }), ["path", { d: "M8 4.6a3.4 3.4 0 0 1 0 6.8Z", class: "fill" }]],
  "col-idle": [ring({ "stroke-dasharray": "2.6 2.2" })],
  nolane: [["circle", { cx: 8, cy: 8, r: 5.5, "stroke-dasharray": "2.3 2" }]],
  clear: [ring(), ["path", { d: "m5.4 8.1 1.8 1.8 3.5-3.7" }]],
  bug: [
    [
      "path",
      {
        d: "M5.5 5.5h5a1 1 0 0 1 1 1V9a3.5 3.5 0 0 1-7 0V6.5a1 1 0 0 1 1-1ZM6 5.5a2 2 0 0 1 4 0M8 8v4.25M2.75 8.5H4.5M11.5 8.5h1.75M3.5 5.5l1.25.9M12.5 5.5l-1.25.9M3.5 12.5l1.4-1M12.5 12.5l-1.4-1"
      }
    ]
  ],
  pin: [["path", { d: "M5.5 2h5l-.8 4.2 2.3 2.3v1H8.6V14h-1.2V9.5H4v-1l2.3-2.3z", class: "fill" }]],
  spark: [["path", { d: "M8 2.25 9.3 6.7 13.75 8 9.3 9.3 8 13.75 6.7 9.3 2.25 8 6.7 6.7Z" }]],
  wrench: [
    [
      "path",
      {
        d: "M10.6 2.6a3.25 3.25 0 0 0-3.9 4.2L2.9 10.6a1.4 1.4 0 0 0 2 2l3.8-3.8a3.25 3.25 0 0 0 4.2-3.9l-2 2-1.8-.5-.5-1.8Z"
      }
    ]
  ],
  flame: [
    [
      "path",
      { d: "M8 14a4 4 0 0 0 4-4c0-2.5-2-4-2.5-6.5C8 5 7.5 6.5 7.5 6.5S6.5 5.5 6.5 4C5 5.5 4 7.5 4 10a4 4 0 0 0 4 4Z" }
    ]
  ],
  terminal: [
    ["rect", { x: 1.75, y: 2.75, width: 12.5, height: 10.5, rx: 2 }],
    ["path", { d: "m4.75 6.25 2 1.75-2 1.75M8.5 10h2.75" }]
  ],
  works: [
    ["circle", { cx: 8, cy: 8, r: 5.75, class: "track" }],
    ["path", { d: "M8 2.25A5.75 5.75 0 0 1 13.75 8" }]
  ],
  refresh: [["path", { d: "M13.25 8A5.25 5.25 0 1 1 11.7 4.3M13.25 2.5v3h-3" }]],
  run: [["path", { d: "M5 3.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L5.9 3.1a.6.6 0 0 0-.9.5Z", class: "fill" }]],
  go: [["path", { d: "M5 11 11 5M6.25 5H11v4.75" }]],
  open: [
    [
      "path",
      {
        d: "M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v2.75a1.25 1.25 0 0 1-1.25 1.25h-7A1.25 1.25 0 0 1 2.5 12.25v-7A1.25 1.25 0 0 1 3.75 4H6.5"
      }
    ]
  ],
  copy: [
    ["rect", { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.75 }],
    ["path", { d: "M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" }]
  ],
  check: [["path", { d: "m3.5 8.5 3 3 6-7" }]],
  alert: [
    ["path", { d: "M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5Z" }],
    ["path", { d: "M8 6.25v3" }],
    ["circle", { cx: 8, cy: 11.4, r: 0.45, class: "fill" }]
  ],
  chevron: [["path", { d: "m6 4 4 4-4 4" }]],
  keyboard: [
    ["rect", { x: 1.5, y: 4, width: 13, height: 8.5, rx: 2 }],
    ["path", { d: "M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5.25 9.75h5.5" }]
  ],
  target: [
    ["circle", { cx: 8, cy: 8, r: 5.75 }],
    ["circle", { cx: 8, cy: 8, r: 2.25, class: "fill" }]
  ],
  pending: [["circle", { cx: 8, cy: 8, r: 5.75, "stroke-dasharray": "2.4 2.1" }]],
  diff: [
    ["rect", { x: 2.25, y: 2.25, width: 11.5, height: 11.5, rx: 2.5 }],
    ["path", { d: "M8 4.75v4M6 6.75h4M6 11h4" }]
  ],
  question: [
    ["circle", { cx: 8, cy: 8, r: 6 }],
    ["path", { d: "M6.3 6.4a1.75 1.75 0 1 1 2.55 1.55c-.55.3-.85.65-.85 1.25" }],
    ["circle", { cx: 8, cy: 11.2, r: 0.45, class: "fill" }]
  ],
  person: [
    ["circle", { cx: 8, cy: 5.25, r: 2.75 }],
    ["path", { d: "M2.75 14c.6-2.6 2.6-4 5.25-4s4.65 1.4 5.25 4" }]
  ],
  message: [
    [
      "path",
      {
        d: "M2.5 4.25A1.75 1.75 0 0 1 4.25 2.5h7.5a1.75 1.75 0 0 1 1.75 1.75v5a1.75 1.75 0 0 1-1.75 1.75H7.25L4.5 13.25V11h-.25A1.75 1.75 0 0 1 2.5 9.25Z"
      }
    ]
  ],
  close: [["path", { d: "m4.5 4.5 7 7M11.5 4.5l-7 7" }]],
  dots: [
    ["circle", { cx: 3.5, cy: 8, r: 1.1, class: "fill" }],
    ["circle", { cx: 8, cy: 8, r: 1.1, class: "fill" }],
    ["circle", { cx: 12.5, cy: 8, r: 1.1, class: "fill" }]
  ],
  bell: [
    ["path", { d: "M4 11.25V7.5a4 4 0 0 1 8 0v3.75l1 1.25H3Z" }],
    ["path", { d: "M6.5 14a1.6 1.6 0 0 0 3 0" }]
  ],
  "bell-off": [
    [
      "path",
      {
        d: "M5.2 4.4A4 4 0 0 1 12 7.5v2.4M12.6 12.5H3l1-1.25V7.5c0-.5.1-1 .25-1.45M6.5 14a1.6 1.6 0 0 0 3 0M2.5 2.5l11 11"
      }
    ]
  ],
  search: [
    ["circle", { cx: 7.25, cy: 7.25, r: 4.25 }],
    ["path", { d: "m10.5 10.5 3 3" }]
  ],
  pr: [
    ["circle", { cx: 4.5, cy: 3.75, r: 1.6 }],
    ["circle", { cx: 4.5, cy: 12.25, r: 1.6 }],
    ["circle", { cx: 11.5, cy: 12.25, r: 1.6 }],
    ["path", { d: "M4.5 5.35v5.3M11.5 10.65V6.5A2 2 0 0 0 9.5 4.5H7.25M8.75 3 7.25 4.5 8.75 6" }]
  ],
  xcircle: [
    ["circle", { cx: 8, cy: 8, r: 6 }],
    ["path", { d: "m6 6 4 4M10 6l-4 4" }]
  ],
  clock: [
    ["circle", { cx: 8, cy: 8, r: 6 }],
    ["path", { d: "M8 4.75V8l2 1.5" }]
  ],
  file: [
    ["path", { d: "M4 1.75h5L12.5 5.25v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" }],
    ["path", { d: "M9 1.75v3.5h3.5" }]
  ],
  folder: [
    [
      "path",
      {
        d: "M2 4.25A1.25 1.25 0 0 1 3.25 3h3l1.5 1.75h5A1.25 1.25 0 0 1 14 6v5.75A1.25 1.25 0 0 1 12.75 13h-9.5A1.25 1.25 0 0 1 2 11.75Z"
      }
    ]
  ],
  board: [
    ["rect", { x: 1.75, y: 2.5, width: 3.5, height: 11, rx: 1 }],
    ["rect", { x: 6.25, y: 2.5, width: 3.5, height: 8, rx: 1 }],
    ["rect", { x: 10.75, y: 2.5, width: 3.5, height: 5.5, rx: 1 }]
  ],
  stages: [
    ["path", { d: "M1.75 8h2.5M6.75 8h2.5M11.75 8h2.5" }],
    ["circle", { cx: 5.5, cy: 8, r: 1.25 }],
    ["circle", { cx: 10.5, cy: 8, r: 1.25 }]
  ],
  panel: [
    ["rect", { x: 1.75, y: 2.5, width: 12.5, height: 11, rx: 2 }],
    ["path", { d: "M9.5 2.5v11" }]
  ]
};
var $ = (id) => document.getElementById(id);
var el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className)
    node.className = className;
  if (text !== undefined)
    node.textContent = text;
  return node;
};
var icon = (name) => {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `icon i-${name}`);
  for (const [tag, attributes] of ICONS[name]) {
    const part = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes))
      part.setAttribute(key, String(value));
    svg.append(part);
  }
  return svg;
};
var link = (className, text, url) => {
  if (url && !/[\u0000-\u0020\u007f-\u009f]/.test(url)) {
    try {
      const parsed = new URL(url);
      if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password)
        return Object.assign(el("a", className, text), { href: url, target: "_blank", rel: "noreferrer" });
    } catch {}
  }
  return el("span", className, text);
};
var timed = (iso, isFine = false, suffix = "") => {
  const node = el("time", "time", `${age(iso, Date.now(), isFine)}${suffix}`);
  node.dateTime = iso;
  node.dataset.since = iso;
  node.dataset.suffix = suffix;
  node.title = new Date(iso).toLocaleString();
  if (isFine)
    node.dataset.fine = "";
  return node;
};
var withCode = (text) => {
  const node = el("span", "toast-detail");
  text.split("`").forEach((part, index) => {
    if (part)
      node.append(index % 2 ? el("code", "", part) : part);
  });
  return node;
};
var toastTimer;
var toast = (title, { detail = "", isError = false } = {}) => {
  $("toast").dataset.tone = isError ? "error" : "ok";
  $("toast-icon").replaceChildren(icon(isError ? "alert" : "check"));
  $("toast-text").replaceChildren(el("strong", "toast-title", title));
  if (detail)
    $("toast-text").append(withCode(detail));
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 6000);
};
var SERVER_DOWN = "The board server does not answer";
var RESTART = "Start the daemon again in a terminal: celetis daemon start.";
async function post(path, value, failure, options) {
  const controller = options ? new AbortController : undefined;
  const timeout = options ? setTimeout(() => controller?.abort(), options.timeout) : undefined;
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
      signal: controller?.signal
    });
    if (options) {
      if (response.ok)
        return { status: "accepted", body: await response.json().catch(() => null) };
      const body = await response.json();
      const error = typeof body?.error === "string" ? body.error : undefined;
      if (response.status >= 400 && response.status < 500 && error !== undefined)
        return { status: "rejected", error };
      return { status: "unavailable", ...error !== undefined ? { error } : {} };
    }
    if (!response.ok)
      toast(failure, { detail: (await response.json()).error, isError: true });
    return response.ok;
  } catch {
    if (options)
      return { status: "unavailable" };
    toast(SERVER_DOWN, { detail: RESTART, isError: true });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
var copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied the ${what}`);
  } catch {
    toast("Copy failed", { detail: "The browser did not allow access to the clipboard.", isError: true });
  }
};
var pressable = (node, press, busy) => {
  node.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (node.getAttribute("aria-busy") === "true")
      return;
    const label = node.querySelector(".label");
    const text = label?.textContent;
    node.setAttribute("aria-busy", "true");
    if (label && busy)
      label.textContent = busy;
    await press();
    node.removeAttribute("aria-busy");
    if (label && busy)
      label.textContent = text;
  });
  return node;
};
var actionButton = (action, isQuiet = false) => {
  const kind = `btn ${isQuiet || action.isGhost ? "ghost" : "primary"}${action.isMain ? " main-action" : ""}`;
  const node = action.href ? Object.assign(el("a", kind), { href: action.href, target: "_blank", rel: "noreferrer" }) : el("button", kind);
  if (!action.href)
    node.type = "button";
  node.append(icon(action.icon), el("span", "label", action.label));
  node.title = action.title;
  node.setAttribute("aria-label", action.name);
  if (action.isDisabled)
    node.setAttribute("aria-disabled", "true");
  if (action.href)
    node.addEventListener("click", (event) => event.stopPropagation());
  else
    pressable(node, action.run, action.busy);
  return node;
};
var iconButton = (name, label, press, className = "") => {
  const node = el("button", `icon-btn ${className}`.trim());
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.title = label;
  node.append(icon(name));
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    press(event);
  });
  return node;
};
var store = {
  key: (name) => `celetis:${name}`,
  get: (key) => {
    try {
      return localStorage.getItem(store.key(key));
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(store.key(key), value);
    } catch {}
  }
};
var TYPES = { bug: "bug", feature: "spark", chore: "wrench", hotfix: "flame" };
var mark = (card, identifiedByText = false) => {
  const agent = agentOf(card);
  if (agent) {
    const node = el("span", `mark agent agent-${Object.hasOwn(AGENTS, card.agent) ? card.agent : "other"}`);
    node.title = agent.name;
    if (card.agent === "codex" || card.agent === "claude") {
      const image = el("img");
      image.src = AGENT_ICONS[card.agent];
      image.alt = identifiedByText ? "" : agent.name;
      node.classList.add("agent-image");
      node.append(image);
    } else
      node.textContent = agent.letter;
    return node;
  }
  const node = el("span", `mark type-${card.type ?? "none"}`);
  node.append(icon(Object.hasOwn(TYPES, card.type) ? TYPES[card.type] : card.number === null ? "terminal" : "nolane"));
  if (!card.type && card.number !== null)
    node.title = "No lane yet";
  return node;
};

// engine/board/page/agent-picker.ts
class OrderConflict extends Error {
  latest;
  constructor(latest, message) {
    super(message);
    this.latest = latest;
  }
}
var HOSTS = ["claude", "codex"];
var NAMES = { claude: "Claude Code", codex: "Codex" };
var NS2 = "http://www.w3.org/2000/svg";
var GAP = 8;
var EDGE = 12;
var svg = (className, viewBox, shapes) => {
  const node = document.createElementNS(NS2, "svg");
  node.setAttribute("class", className);
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("aria-hidden", "true");
  for (const [tag, attributes] of shapes) {
    const shape = document.createElementNS(NS2, tag);
    for (const [key, value] of Object.entries(attributes))
      shape.setAttribute(key, value);
    node.append(shape);
  }
  return node;
};
var chevron = () => svg("ap-chev", "0 0 10 10", [
  [
    "path",
    {
      d: "M2 3.5 5 6.5 8 3.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.4",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }
  ]
]);
var grip = () => svg("ap-grip", "0 0 10 14", [2.5, 7.5].flatMap((cx) => [2.5, 7, 11.5].map((cy) => [
  "circle",
  { cx: String(cx), cy: String(cy), r: "1.3", fill: "currentColor" }
])));
var agentIcon = (host) => {
  const node = el("span", "ap-icon");
  const image = el("img");
  image.src = AGENT_ICONS[host];
  image.alt = "";
  node.append(image);
  return node;
};
var resetText = (at) => {
  if (at === null)
    return "reset unknown";
  const date = new Date(at);
  const today = date.toDateString() === new Date().toDateString();
  return `resets ${date.toLocaleString([], today ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
};
var same = (a, b) => a.length === b.length && a.every((host, at) => b[at] === host);
function createAgentPicker(root, actions) {
  let view = null;
  let confirmed = null;
  let saving = null;
  let notice = "";
  let open = false;
  let menuFor = null;
  let drag = null;
  let suppressClick = false;
  let drawn = "";
  const retrying = new Set;
  const trigger = el("button", "ap-trigger");
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "agent-order");
  const stack = el("span", "ap-stack");
  trigger.append(stack, chevron());
  const pop = el("section", "ap-pop");
  pop.id = "agent-order";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-labelledby", "agent-order-title");
  pop.inert = true;
  const head = el("header", "ap-head");
  const title = el("h2", "", "Agent order");
  title.id = "agent-order-title";
  head.append(title, el("p", "", "New default work uses the first available agent. Drag a handle, or press it for move actions."));
  const list = el("ol", "ap-list");
  list.setAttribute("aria-label", "Agents in priority order");
  const message = el("p", "ap-notice");
  message.setAttribute("role", "status");
  const waits = el("div", "ap-waits");
  pop.append(head, list, message, waits);
  const live = el("p", "sr-only");
  live.setAttribute("aria-live", "polite");
  root.replaceChildren(trigger, pop, live);
  root.hidden = true;
  const announce = (text) => {
    live.textContent = "";
    setTimeout(() => {
      live.textContent = text;
    }, 50);
  };
  const shown = () => saving ?? confirmed?.order ?? [];
  const excluded = () => HOSTS.filter((host) => !shown().includes(host));
  const handleOf = (host) => list.querySelector(`.ap-row[data-host="${host}"] .ap-handle`);
  const paused = () => Boolean(view && shown().every((host) => view?.usage[host]));
  const place = () => {
    if (!open)
      return;
    const box = trigger.getBoundingClientRect();
    pop.style.maxHeight = `${Math.max(0, Math.min(innerHeight - EDGE * 2, box.top - GAP - EDGE))}px`;
    const left = Math.max(EDGE, Math.min(box.left, innerWidth - pop.offsetWidth - EDGE));
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(EDGE, box.top - pop.offsetHeight - GAP)}px`;
  };
  const resize = new ResizeObserver(place);
  resize.observe(pop);
  if (root.parentElement)
    resize.observe(root.parentElement);
  const detail = (host) => {
    if (!shown().includes(host))
      return "Excluded from default work";
    const parts = [];
    if (view?.activeHosts.includes(host))
      parts.push("In use");
    const block = view?.usage[host];
    if (block)
      parts.push(`Limit reached · ${resetText(block.resetAt)}`, block.reason);
    else if (!parts.length)
      parts.push("Available");
    return parts.join(" · ");
  };
  const row = (host, rank) => {
    const item = el("li", `ap-row${rank === null ? " ap-excluded" : ""}`);
    item.dataset.host = host;
    const handle = el("button", "ap-handle");
    handle.type = "button";
    handle.setAttribute("aria-haspopup", "menu");
    handle.setAttribute("aria-label", rank === null ? `${NAMES[host]}, excluded from default work. Actions` : `${NAMES[host]}, priority ${rank} of ${shown().length}. Move or exclude`);
    if (saving)
      handle.setAttribute("aria-disabled", "true");
    handle.append(grip());
    const name = el("span", "ap-name", NAMES[host]);
    const text = detail(host);
    const availability = el("small", "ap-detail", text);
    availability.title = text;
    name.append(availability);
    item.append(handle, el("span", "ap-rank", rank === null ? "–" : String(rank)), agentIcon(host), name);
    if (rank === 1)
      item.append(el("span", "ap-badge", "First"));
    return item;
  };
  const waitLine = (wait) => {
    const line = el("div", "ap-wait");
    line.append(el("p", "", `#${wait.number} is paused: every included agent reached a usage limit. ${wait.nextResetAt === null ? "No reset time is known." : `It tries again at ${resetText(wait.nextResetAt).replace("resets ", "")}.`}`));
    const button = el("button", "btn ghost ap-retry", `Retry #${wait.number}`);
    button.type = "button";
    button.dataset.wait = wait.waitId;
    button.setAttribute("aria-label", `Retry #${wait.number} with the current agent order`);
    if (retrying.has(wait.waitId))
      button.setAttribute("aria-busy", "true");
    button.addEventListener("click", () => void retry(wait));
    line.append(button);
    return line;
  };
  const focusKey = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active))
      return null;
    if (active === trigger)
      return "trigger";
    const host = active.closest(".ap-row")?.dataset.host;
    if (active.matches(".ap-menu button"))
      return `menu:${active.dataset.action}`;
    if (host)
      return `handle:${host}`;
    if (active.dataset.wait)
      return `wait:${active.dataset.wait}`;
    return null;
  };
  const restore = (key) => {
    if (!key)
      return;
    const target = key === "trigger" ? trigger : key.startsWith("menu:") ? list.querySelector(`.ap-menu [data-action="${key.slice(5)}"]:not(:disabled)`) : key.startsWith("handle:") ? handleOf(key.slice(7)) : waits.querySelector(`[data-wait="${CSS.escape(key.slice(5))}"]`);
    (target ?? (open ? list.querySelector(".ap-handle") : trigger))?.focus({ preventScroll: true });
  };
  const draw = (force = false) => {
    if (!view || !confirmed || drag)
      return;
    const signature = JSON.stringify([view, confirmed, saving, notice, open, menuFor, [...retrying]]);
    if (!force && signature === drawn)
      return;
    drawn = signature;
    const focus = focusKey();
    root.hidden = false;
    const order = shown();
    stack.replaceChildren(...order.map(agentIcon));
    const using = view.activeHosts.length ? ` In use: ${view.activeHosts.map((host) => NAMES[host]).join(", ")}.` : "";
    trigger.setAttribute("aria-label", `Agent order: ${order.map((host) => NAMES[host]).join(", then ")}.${using}${paused() ? " Default work is paused." : ""}`);
    trigger.title = `Agent order: ${order.map((host) => NAMES[host]).join(" › ")}`;
    trigger.dataset.state = paused() ? "paused" : "ready";
    list.replaceChildren(...order.map((host, at) => row(host, at + 1)), ...excluded().map((host) => row(host, null)), Object.assign(el("div", "ap-drop"), { hidden: true }));
    list.setAttribute("aria-busy", String(Boolean(saving)));
    const status = notice || (saving ? "Saving the agent order." : view.error ? `The agent state is unavailable: ${view.error}` : paused() && !view.waits.length ? "New default work waits: every included agent reached a usage limit." : "");
    message.textContent = status;
    message.hidden = !status;
    waits.replaceChildren(...view.waits.map(waitLine));
    if (menuFor)
      showMenu(menuFor, false);
    place();
    restore(focus);
  };
  const commit = async (next, success) => {
    if (!confirmed || saving || same(next, confirmed.order) || !next.length)
      return;
    const version = confirmed.version;
    saving = next;
    notice = "";
    announce("Saving the agent order.");
    draw();
    try {
      confirmed = await actions.replace(next, version);
      notice = "";
      announce(success);
    } catch (cause) {
      if (cause instanceof OrderConflict) {
        confirmed = cause.latest;
        notice = "Another tab or command saved a new order first. The current order shows now. Change it again.";
      } else
        notice = `The order was not saved: ${cause instanceof Error ? cause.message : String(cause)}`;
      announce(notice);
    } finally {
      saving = null;
      draw(true);
    }
  };
  const move = (host, to) => {
    const order = [...shown()];
    const from = order.indexOf(host);
    to = Math.max(0, Math.min(order.length - 1, to));
    if (from < 0 || from === to)
      return;
    order.splice(from, 1);
    order.splice(to, 0, host);
    commit(order, to === 0 ? `${NAMES[host]} is now first.` : `${NAMES[host]} moved to position ${to + 1} of ${order.length}.`);
  };
  const toggle = (host) => {
    const order = shown();
    if (order.includes(host)) {
      if (order.length > 1)
        commit(order.filter((each) => each !== host), `${NAMES[host]} is excluded from default work.`);
    } else
      commit([...order, host], `${NAMES[host]} is included in default work, last in the order.`);
  };
  const retry = async (wait) => {
    if (retrying.has(wait.waitId))
      return;
    retrying.add(wait.waitId);
    draw();
    try {
      await actions.retry(wait.number, wait.waitId);
      notice = "";
      announce(`Retry requested for #${wait.number}. Its run starts one attempt with the current order.`);
    } catch (cause) {
      notice = `Retry of #${wait.number} failed: ${cause instanceof Error ? cause.message : String(cause)}`;
      announce(notice);
    } finally {
      retrying.delete(wait.waitId);
      draw();
    }
  };
  const closeMenu = (refocus) => {
    const host = menuFor;
    list.querySelector(".ap-menu")?.remove();
    menuFor = null;
    if (refocus && host)
      handleOf(host)?.focus();
  };
  const showMenu = (host, focus = true) => {
    list.querySelector(".ap-menu")?.remove();
    const item = list.querySelector(`.ap-row[data-host="${host}"]`);
    if (!item) {
      menuFor = null;
      return;
    }
    menuFor = host;
    const order = shown();
    const at = order.indexOf(host);
    const included = at >= 0;
    const last = order.length - 1;
    const menu = el("div", "ap-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${NAMES[host]} actions`);
    const entry = (action, label, disabled, run) => {
      const button = el("button", "", label);
      button.type = "button";
      button.dataset.action = action;
      button.setAttribute("role", "menuitem");
      button.disabled = disabled || Boolean(saving);
      button.addEventListener("click", () => {
        closeMenu(false);
        handleOf(host)?.focus();
        run();
      });
      return button;
    };
    menu.append(entry("first", "Move first", !included || at === 0, () => move(host, 0)), el("hr"), entry("up", "Move up", !included || at === 0, () => move(host, at - 1)), entry("down", "Move down", !included || at === last, () => move(host, at + 1)), entry("bottom", "Move to bottom", !included || at === last, () => move(host, last)), el("hr"), included ? entry("exclude", "Exclude from default work", order.length === 1, () => toggle(host)) : entry("include", "Include in default work", false, () => toggle(host)));
    if (included && order.length === 1)
      menu.append(el("p", "ap-menu-note", "At least one agent stays included."));
    list.append(menu);
    const rows = list.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    const below = box.bottom + menu.offsetHeight <= innerHeight - EDGE;
    menu.style.top = `${(below ? box.bottom : Math.max(EDGE, box.top - menu.offsetHeight)) - rows.top}px`;
    menu.addEventListener("keydown", (event) => {
      const buttons = [...menu.querySelectorAll("button:not(:disabled)")];
      const index = buttons.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (step && buttons.length) {
        event.preventDefault();
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        (event.key === "Home" ? buttons[0] : buttons.at(-1))?.focus();
      } else if (event.key === "Tab")
        closeMenu(false);
    });
    if (focus)
      menu.querySelector("button:not(:disabled)")?.focus();
  };
  const setOpen = (value, refocus = true) => {
    open = value;
    pop.classList.toggle("ap-open", open);
    pop.inert = !open;
    trigger.setAttribute("aria-expanded", String(open));
    if (!open) {
      cancelDrag();
      closeMenu(false);
      if (refocus)
        trigger.focus();
      return;
    }
    draw(true);
    list.querySelector(".ap-handle")?.focus();
  };
  const cancelDrag = () => {
    if (!drag)
      return;
    const { row: item, ghost, pointer } = drag;
    drag = null;
    ghost?.remove();
    item.classList.remove("ap-dragging");
    root.classList.remove("ap-is-dragging");
    const marker = list.querySelector(".ap-drop");
    if (marker)
      marker.hidden = true;
    const handle = item.querySelector(".ap-handle");
    if (handle?.hasPointerCapture(pointer))
      handle.releasePointerCapture(pointer);
  };
  trigger.addEventListener("click", () => setOpen(!open));
  list.addEventListener("click", (event) => {
    const handle = event.target.closest(".ap-handle");
    if (!handle)
      return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const host = handle.closest(".ap-row")?.dataset.host;
    if (menuFor === host)
      closeMenu(true);
    else
      showMenu(host);
  });
  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".ap-handle");
    suppressClick = false;
    if (!handle || event.button !== 0 || saving)
      return;
    const item = handle.closest(".ap-row");
    const host = item.dataset.host;
    if (!shown().includes(host))
      return;
    drag = {
      row: item,
      host,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: event.clientY - item.getBoundingClientRect().top,
      started: false,
      to: null,
      ghost: null
    };
    handle.setPointerCapture(event.pointerId);
  });
  list.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointer)
      return;
    if (!drag.started) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4)
        return;
      drag.started = true;
      closeMenu(false);
      root.classList.add("ap-is-dragging");
      drag.row.classList.add("ap-dragging");
      const box = drag.row.getBoundingClientRect();
      const ghost = drag.row.cloneNode(true);
      ghost.className = "ap-row ap-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.width = `${box.width}px`;
      ghost.style.left = `${box.left}px`;
      root.append(ghost);
      drag.ghost = ghost;
    }
    drag.ghost.style.top = `${event.clientY - drag.offset}px`;
    const rows = [...list.querySelectorAll(".ap-row:not(.ap-excluded)")];
    let slot = rows.length;
    for (const [index, each] of rows.entries()) {
      const box = each.getBoundingClientRect();
      if (event.clientY < box.top + box.height / 2) {
        slot = index;
        break;
      }
    }
    const from = rows.indexOf(drag.row);
    const marker = list.querySelector(".ap-drop");
    if (slot === from || slot === from + 1) {
      marker.hidden = true;
      drag.to = null;
      return;
    }
    const near = rows[Math.min(slot, rows.length - 1)];
    marker.style.top = `${slot < rows.length ? near.offsetTop - 2 : near.offsetTop + near.offsetHeight}px`;
    marker.hidden = false;
    drag.to = slot > from ? slot - 1 : slot;
  });
  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointer)
      return;
    const { started, host, to } = drag;
    suppressClick = started;
    cancelDrag();
    if (started && to !== null)
      move(host, to);
    else if (started)
      draw(true);
    else
      setTimeout(draw, 0);
  };
  list.addEventListener("pointerup", endDrag);
  list.addEventListener("pointercancel", (event) => {
    if (!drag || event.pointerId !== drag.pointer)
      return;
    suppressClick = drag.started;
    cancelDrag();
    draw(true);
  });
  list.addEventListener("keydown", (event) => {
    const handle = event.target.closest(".ap-handle");
    if (!handle)
      return;
    const host = handle.closest(".ap-row")?.dataset.host;
    const handles = [...list.querySelectorAll(".ap-row .ap-handle")];
    const index = handles.indexOf(handle);
    const at = shown().indexOf(host);
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (at >= 0)
        move(host, at + (event.key === "ArrowUp" ? -1 : 1));
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      handles[Math.max(0, Math.min(handles.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)))]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? handles[0] : handles.at(-1))?.focus();
    }
  });
  const onKey = (event) => {
    if (event.key !== "Escape" || !open)
      return;
    event.preventDefault();
    event.stopPropagation();
    if (drag) {
      cancelDrag();
      draw(true);
    } else if (menuFor)
      closeMenu(true);
    else
      setOpen(false);
  };
  const onOutside = (event) => {
    if (open && !root.contains(event.target))
      setOpen(false, false);
  };
  root.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onOutside);
  addEventListener("resize", place);
  addEventListener("scroll", place, true);
  return {
    update(next) {
      const changed = Boolean(confirmed && next.order.version !== confirmed.version);
      view = next;
      if (saving)
        return;
      if (changed && drag) {
        const started = drag.started;
        cancelDrag();
        if (started) {
          notice = "The order changed in another tab or command. The drag stopped. The current order shows now.";
          announce(notice);
        }
      } else if (changed && notice.startsWith("Another tab"))
        notice = "";
      confirmed = next.order;
      draw();
    },
    destroy() {
      cancelDrag();
      resize.disconnect();
      root.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      root.replaceChildren();
    }
  };
}

// engine/board/page/palette.ts
var items = [];
var shown = [];
var active = 0;
var option = (item, index) => {
  const node = el("div", `pal-row${index === active ? " on" : ""}${item.tone ? ` tone-${item.tone}` : ""}`);
  node.id = `pal-${index}`;
  node.setAttribute("role", "option");
  node.setAttribute("aria-selected", String(index === active));
  if (item.isDisabled)
    node.setAttribute("aria-disabled", "true");
  if (item.title)
    node.title = item.title;
  const context = el("span", "ctx");
  if (item.number !== null)
    context.append(el("span", "num", `#${item.number}`));
  if (item.context)
    context.append(item.context);
  node.append(icon(item.icon), el("b", "", item.label), context, item.key ? el("kbd", "", item.key) : el("span"));
  node.addEventListener("mousemove", () => {
    if (active !== index)
      select(index);
  });
  node.addEventListener("click", () => pick(index));
  return node;
};
var draw = () => {
  const list = $("pal-list");
  const rows = [];
  let group = null;
  shown.forEach((item, index) => {
    if (item.group !== group) {
      group = item.group;
      rows.push(el("div", "pal-group", group));
    }
    rows.push(option(item, index));
  });
  if (shown.length === 0)
    rows.push(el("p", "pal-empty", "No card or command matches."));
  list.replaceChildren(...rows);
  $("pal-input").setAttribute("aria-activedescendant", shown.length ? `pal-${active}` : "");
};
var select = (index) => {
  active = index;
  draw();
  $(`pal-${index}`)?.scrollIntoView({ block: "nearest" });
};
var pick = (index) => {
  const item = shown[index];
  if (!item)
    return;
  $("palette").close();
  item.run();
};
var filter = () => {
  shown = filterItems(items, $("pal-input").value);
  active = 0;
  draw();
};
var openPalette = (next) => {
  items = next;
  $("pal-input").value = "";
  filter();
  $("palette").showModal();
  $("pal-input").focus();
};
var setupPalette = () => {
  $("pal-input").addEventListener("input", filter);
  $("pal-input").addEventListener("keydown", (event) => {
    const moves = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves && shown.length) {
      event.preventDefault();
      select((active + moves[event.key] + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(active);
    }
  });
  $("palette").addEventListener("click", (event) => {
    if (event.target === $("palette"))
      $("palette").close();
  });
};
var anchor = null;
var openMenu = (from, entries) => {
  const menu = $("menu");
  anchor = from;
  menu.replaceChildren(...entries.map((entry) => {
    if (entry === "rule")
      return el("hr");
    const node = el("button", `menu-row${entry.isDanger ? " danger" : ""}`);
    node.type = "button";
    node.setAttribute("role", "menuitem");
    node.append(icon(entry.icon), el("span", "", entry.label), entry.key ? el("kbd", "", entry.key) : el("span"));
    if (entry.isDisabled)
      node.setAttribute("aria-disabled", "true");
    if (entry.title)
      node.title = entry.title;
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidePopover();
      entry.run();
    });
    return node;
  }));
  menu.showPopover();
  const box = from.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.min(Math.max(8, box.right - width), innerWidth - width - 8);
  const below = box.bottom + 6 + height <= innerHeight - 8;
  menu.style.left = `${left}px`;
  menu.style.top = `${below ? box.bottom + 6 : Math.max(8, box.top - height - 6)}px`;
  menu.querySelector(".menu-row")?.focus();
};
var setupMenu = () => {
  const menu = $("menu");
  menu.addEventListener("keydown", (event) => {
    const rows = [...menu.querySelectorAll(".menu-row")];
    const at = rows.indexOf(document.activeElement);
    const moves = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in moves) {
      event.preventDefault();
      rows[(at + moves[event.key] + rows.length) % rows.length]?.focus();
    } else if (event.key === "Tab") {
      menu.hidePopover();
    }
  });
  menu.addEventListener("toggle", (event) => anchor?.setAttribute("aria-expanded", String(event.newState === "open")));
};

// engine/board/page/panel.ts
var TONES = {
  waits: "needs",
  blocked: "needs",
  works: "working",
  starts: "working",
  "no-progress": "danger",
  "dirty-tree": "amber"
};
var PILL_ICONS = {
  works: "works",
  starts: "works",
  waits: "target",
  "no-progress": "alert",
  "dirty-tree": "diff",
  blocked: "person"
};
var ASKS = {
  dialog: ["question", "waits for your answer"],
  turn: ["message", "ended its turn"]
};
var COPIES = { "no-progress": "command", "dirty-tree": "path" };
var clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
var section = (title, aside, ...children) => {
  const node = el("section", "sec");
  const head = el("h3", "sec-label", title);
  if (aside)
    head.append(el("span", "aside", aside));
  node.append(head, ...children);
  return node;
};
var screen = (card) => card.screen?.length ? el("pre", "screen", card.screen.join(`
`)) : null;
var ask = (card, actions) => {
  const [glyph, verb] = ASKS[card.waitFor] ?? ["target", "waits for your answer"];
  const node = el("div", "ask");
  const head = el("div", "ask-who");
  head.append(icon(glyph), el("b", "", agentOf(card)?.name ?? "The agent"), el("span", "", verb), timed(card.since, true, " ago"));
  node.append(head);
  const lines = screen(card);
  if (lines)
    node.append(lines);
  const foot = el("div", "ask-foot");
  foot.append(el("span", "hint", "Answer it in the terminal pane."), ...actions.slice(0, 1).map((action) => actionButton(action)));
  node.append(foot);
  return node;
};
var steps = (card, flow) => {
  const track = laneTrack(card, flow);
  if (!track)
    return null;
  const list = el("ol", "steps");
  for (const step of track) {
    const item = el("li", step.state);
    const node = el("span", "node");
    node.append(icon(step.state === "done" ? "check" : step.state === "now" ? PILL_ICONS[card.state] ?? "pending" : "pending"));
    const note = step.state === "done" ? "done" : step.state === "now" ? card.state ? stateLabel(card) : "next" : "";
    item.append(node, el("span", "name", step.name), el("span", "note", note));
    item.append(gateOf(flow, step.name) === "auto" ? Object.assign(el("span", "gate gate-auto", "auto"), {
      title: "Auto mode of the daemon starts this step by itself"
    }) : el("span"));
    list.append(item);
  }
  return section("Lane", `${card.type} · step ${track.findIndex((step) => step.state === "now") + 1} of ${track.length}`, list);
};
var facts = (rows) => {
  const list = el("dl", "facts");
  for (const [term, value, copyable] of rows.filter((row) => Boolean(row))) {
    const dd = el("dd", typeof value === "string" ? "mono" : "");
    dd.append(value);
    list.append(el("dt", "", term), dd);
    list.append(copyable ? iconButton("copy", `Copy the ${copyable[1]}`, () => copy(copyable[0], copyable[1])) : el("span"));
  }
  return list;
};
var whyOf = (pair) => {
  const pinned = ["model", "level"].filter((part) => pair.source[part] === "pinned");
  const pin = pinned.length ? `The config pins ${pinned.length === 2 ? "the model and the level" : `the ${pinned[0]}`} of this step.` : "";
  const decision = pair.decision ? pair.decision.reason || "No reason given." : pin ? "" : "No decision on the issue; the default applies.";
  return [decision, pin].filter(Boolean).join(" ");
};
var effortFacts = (pair) => pair ? [
  ["Model", `${pair.model} · ${modelSource(pair)}`],
  ["Effort", `${pair.level} · ${levelSource(pair)}`],
  ["Why", el("span", "why", whyOf(pair))]
] : [];
var pr = (card) => {
  const items = prFacts(card.pr);
  if (items.length === 0)
    return null;
  const row = el("div", "chips");
  for (const item of items) {
    const chip = link(`chip2 chip-${item.kind}`, "", item.url);
    chip.append(icon(item.kind === "pr" ? "pr" : item.kind.startsWith("checks-fail") ? "xcircle" : item.kind.startsWith("checks-pass") || item.kind === "review-approved" ? "check" : "clock"), item.text);
    row.append(chip);
  }
  return section("Pull request", null, row);
};
var drawPanel = (card, { actions, flow, on, close }) => {
  const { state } = card;
  const asks = state === "waits" && (card.number !== null || card.waitFor === "dialog");
  const head = el("div", "panel-head");
  const crumbs = el("div", "crumbs");
  crumbs.append(mark(card, true), card.number === null ? el("span", "num none", "human session") : link("num", `#${card.number}`, card.url));
  for (const part of [card.type, card.step === card.type ? null : card.step])
    if (part)
      crumbs.append(el("span", "sep", "·"), el("span", "", part));
  head.append(crumbs);
  if (card.url) {
    const open = Object.assign(el("a", "icon-btn"), {
      href: card.url,
      target: "_blank",
      rel: "noreferrer",
      title: `Open the issue${on} (o)`
    });
    open.setAttribute("aria-label", `Open the issue${on}`);
    open.append(icon("open"));
    head.append(open);
  }
  head.append(iconButton("close", "Close the details (Esc)", close));
  const top = el("div", "panel-top");
  const title = el("h2", "panel-title", card.title || (card.number === null ? "A session" : `Issue #${card.number}`));
  title.id = "panel-title";
  const line = el("div", "panel-state");
  if (state) {
    const pill = el("span", `pill pill-${(state !== "waits" || asks ? TONES[state] : null) ?? "muted"}`);
    pill.append(icon(PILL_ICONS[state] ?? "pending"), el("span", "pill-label", stateLabel(card)));
    line.append(pill);
  } else {
    const pill = el("span", "pill pill-muted");
    pill.append(icon("pending"), el("span", "pill-label", `next: ${card.step}`));
    line.append(pill);
  }
  if (card.state !== "starts")
    line.append(el("span", "", "since"), timed(card.since, Boolean(card.sessionId)));
  top.append(title, line);
  if (card.warning)
    top.append(el("p", "warning", card.warning));
  const body = el("div", "panel-body");
  body.append(top);
  if (asks)
    body.append(ask(card, actions));
  else if (actions.length) {
    const row = el("div", "panel-actions");
    row.append(...actions.map((action) => actionButton(action)));
    body.append(row);
  }
  const isSession = Boolean(card.sessionId);
  const details = isSession ? [
    ["Agent", agentOf(card)?.name ?? "unknown"],
    card.cwd && ["Folder", card.cwd, [card.cwd, "folder"]],
    card.diff && [
      "Changes",
      `${diffText(card.diff)} · ${card.diff.files} ${card.diff.files === 1 ? "file" : "files"}`
    ]
  ] : [
    card.act && COPIES[card.state] && [
      COPIES[card.state] === "path" ? "Worktree" : "Command",
      shortPath(card.act),
      [card.act, COPIES[card.state]]
    ],
    card.act && !COPIES[card.state] && ["Your act", card.act],
    ...effortFacts(card.effort),
    ["Updated", `${clock(card.since)}`]
  ];
  const pane = isSession && !asks ? screen(card) : null;
  body.append(...[
    pr(card),
    steps(card, flow),
    section(isSession ? "Session" : "Issue", null, facts(details)),
    pane && section("Screen", "the last lines of its pane", pane)
  ].filter((node) => Boolean(node)));
  $("panel").setAttribute("aria-labelledby", "panel-title");
  $("panel").dataset.state = state ?? "next";
  return [head, body];
};

// engine/board/page/queue.ts
var recordedHost = (record) => record?.choice?.kind === "explicit" ? record.choice.host : null;
var chosenHost = (record) => record?.choice ? recordedHost(record) : agent || null;
var board = null;
var submitted = null;
var agent = "";
var open = false;
var busy = false;
var uncertain = false;
var retired = new Set;
var options;
var section2 = () => $("queue");
var cards = () => Object.values(board?.columns ?? {}).flat();
var available = () => cards().filter((card) => card.number !== null && !card.sessionId && card.run && card.step);
var find = (number) => cards().find((card) => card.number === number);
var heading = () => section2().querySelector(".queue-status h3");
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
  const control = section2().querySelector(`[data-control="${CSS.escape(key)}"]:not(:disabled)`);
  (control ?? section2().querySelector(".queue-move button:not(:disabled), .queue-pick button:not(:disabled)") ?? heading())?.focus({ preventScroll: true });
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
  draw2();
  try {
    const response = await fetch("/api/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        ...action.kind === "add" && chosenHost(submitted?.record) ? { agent: chosenHost(submitted?.record) } : {}
      }),
      signal: AbortSignal.timeout(150000)
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
    draw2();
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
var hostAvailable = (host) => {
  const next = host ?? (board?.next?.kind === "start" ? board.next.host : null);
  return next === null || board?.agents?.[next]?.available === true;
};
function draw2() {
  if (!board)
    return;
  const active = section2().contains(document.activeElement) ? document.activeElement.dataset.control : undefined;
  const record = submitted?.record;
  const numbers = record?.numbers ?? [];
  const state = stateOf();
  section2().dataset.state = state;
  section2().setAttribute("aria-busy", String(busy));
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
  select.add(new Option("Default order", ""));
  for (const host of ["claude", "codex"]) {
    const option = new Option(host === "claude" ? "Claude" : "Codex", host);
    option.disabled = board.agents?.[host]?.available !== true;
    select.add(option);
  }
  select.value = chosenHost(record) ?? "";
  select.disabled = numbers.length > 0 || busy || !authoritative();
  select.addEventListener("change", () => {
    agent = select.value;
    draw2();
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
    const add = button(selected ? "In queue" : "Add", `add-${number}`, () => request({ kind: "add", number, step: card.step, expected: expected() }), selected || busy || !authoritative() || !submitted?.actions.add || !hostAvailable(chosenHost(record)) || Boolean(board.noRun));
    add.setAttribute("aria-label", `Add #${number} to queue`);
    item.append(copy, add);
    picker.append(item);
  }
  if (!available().length)
    picker.append(el("p", "", "No runnable issues are available."));
  content.append(waiting, picker);
  section2().replaceChildren(head, status, actions, content);
  if (open)
    restore(active);
}
function setupQueue(next) {
  options = next;
}
function setQueueOpen(value) {
  open = value;
  section2().hidden = !open;
  document.body.classList.toggle("queue-view-open", open);
  $("queue-open").setAttribute("aria-pressed", String(open));
  for (const button of document.querySelectorAll(".views button"))
    button.setAttribute("aria-pressed", String(!open && button.dataset.view === $("columns").dataset.view));
  if (open) {
    draw2();
    heading()?.focus();
  }
}
function drawQueue(next) {
  board = next;
  const before = submitted?.record?.numbers.length;
  if (board.queue) {
    accept(board.queue);
    if (!board.source.error && Object.values(board.queue.actions).some(Boolean))
      uncertain = false;
  }
  draw2();
  if (before !== undefined && submitted?.record && before > submitted.record.numbers.length)
    announce(`${submitted.record.numbers.length} issues remain in the queue`);
}

// engine/board/page/update-dialog.ts
var session = {
  get(key) {
    try {
      return sessionStorage.getItem(`celetis:update-${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null)
        sessionStorage.removeItem(`celetis:update-${key}`);
      else
        sessionStorage.setItem(`celetis:update-${key}`, value);
    } catch {}
  }
};
var readPending = () => {
  try {
    const value = JSON.parse(session.get("pending") ?? "null");
    if (value && (value.kind === "update" || value.kind === "restart") && typeof value.target === "string" && typeof value.instance === "string" && (value.recovery === null || typeof value.recovery === "string") && (value.deadline === null || typeof value.deadline === "number" && Number.isFinite(value.deadline)) && typeof value.reloaded === "boolean")
      return value;
  } catch {}
  return null;
};
var isRestartAnswer = (value) => {
  const answer = value;
  return typeof answer?.target === "string" && typeof answer.runtime?.revision === "string" && typeof answer.runtime.instance === "string";
};
var names = { claude: "Claude Code plugin", codex: "Codex plugin", engine: "Celetis engine" };
var reconnecting = false;
var isReconnecting = () => reconnecting;
var controls;
function setupUpdates() {
  if (controls)
    return controls;
  const dialog = $("update-dialog");
  const opener = $("update-open");
  const label = opener.querySelector(".label");
  opener.prepend(icon("refresh"));
  const title = $("update-title");
  const description = $("update-description");
  const revisions = $("update-revisions");
  const progress = $("update-progress");
  const live = $("update-status");
  const note = $("update-note");
  const diagnostic = $("update-error");
  const recovery = $("update-recovery");
  const later = $("update-later");
  const start = $("update-start");
  const check = $("update-check");
  let response = null;
  let offered = null;
  let pending = readPending();
  let deferred = session.get("deferred");
  let hidden = session.get("hidden");
  let restartShown = session.get("restart-shown");
  let returning = null;
  let refusal = null;
  let checkFailure = null;
  let checking = false;
  let submitting = null;
  let timedOut = false;
  let revisionKey = "";
  let announced = "";
  let announcing;
  let timer;
  let active;
  let epoch = 0;
  const contains = (target) => target instanceof Node && dialog.contains(target);
  const save = () => session.set("pending", pending ? JSON.stringify(pending) : null);
  const beginReconnect = () => {
    if (!pending)
      return;
    if (pending.deadline === null) {
      pending.deadline = Date.now() + 60000;
      save();
    }
    reconnecting = true;
    document.dispatchEvent(new Event("board-reconnect"));
  };
  if (pending)
    beginReconnect();
  const open = (isAutomatic = false) => {
    if (isAutomatic) {
      if (dialog.open)
        return;
      returning = opener;
      dialog.setAttribute("open", "");
    } else {
      returning = document.activeElement;
      if (!dialog.open)
        dialog.show();
      title.focus();
    }
    opener.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    const focused = contains(document.activeElement);
    if (response?.update.offer && !pending) {
      deferred = response.update.offer.id;
      session.set("deferred", deferred);
    } else if (pending) {
      hidden = `${pending.instance}:${pending.target}`;
      session.set("hidden", hidden);
    }
    dialog.close();
    draw();
    if (focused)
      (returning?.isConnected && !returning.hidden ? returning : opener).focus();
  };
  const dismiss = () => {
    if (!dialog.open)
      return false;
    close();
    return true;
  };
  controls = { contains, dismiss };
  const kindOf = () => submitting ?? pending?.kind ?? refusal?.kind ?? "update";
  const phaseOf = () => timedOut ? "timeout" : refusal ? refusal.kind === "restart" ? "restart-refused" : "update-failed" : submitting === "restart" ? "restarting" : pending ? reconnecting || pending.kind === "restart" ? "restarting" : "updating" : checking ? "checking" : checkFailure ? "check-failed" : response?.update.phase;
  const announce = (key, status) => {
    if (key === announced)
      return;
    announced = key;
    clearTimeout(announcing);
    if (live.textContent !== status)
      live.textContent = status;
    else {
      live.textContent = "";
      announcing = setTimeout(() => {
        live.textContent = status;
      }, 100);
    }
  };
  const draw = () => {
    const focused = document.activeElement;
    const update = response?.update;
    const phase = phaseOf();
    const kind = kindOf();
    const busy = phase === "updating" || phase === "restarting";
    const failed = phase === "update-failed" || phase === "restart-refused" || phase === "check-failed" || phase === "timeout";
    label.textContent = busy ? kind === "restart" ? "Restarting…" : "Update in progress" : phase === "checking" ? "Checking…" : phase === "check-failed" ? "Update check failed" : failed ? kind === "restart" ? "Restart needs attention" : "Update needs attention" : phase === "restart-needed" ? "Restart needed" : phase === "available" ? "Update available" : phase === "updated" ? "Update completed" : phase === "current" ? "Up to date" : "Check for updates";
    const name = `Celetis: ${label.textContent}`;
    opener.setAttribute("aria-label", name);
    opener.title = name;
    opener.classList.toggle("is-accent", phase === "available" || phase === "restart-needed");
    opener.setAttribute("aria-disabled", String(phase === "checking"));
    opener.setAttribute("aria-expanded", String(dialog.open));
    const isRestart = kind === "restart" || phase === "restart-needed";
    const target = pending?.target ?? (isRestart ? null : offered?.target) ?? update?.target ?? null;
    if (!phase || phase === "current") {
      if (phase === "current")
        announce(JSON.stringify([phase, target]), "Up to date");
      if (dialog.open)
        close();
      return;
    }
    title.textContent = {
      available: "A Celetis update is available",
      "restart-needed": "Restart the daemon",
      checking: "Checking for updates",
      updating: "Updating Celetis",
      restarting: "Restarting the daemon",
      updated: "Update completed",
      "update-failed": "The update did not finish",
      "restart-refused": "The daemon did not restart",
      "check-failed": "Cannot check for updates",
      timeout: "The daemon did not return"
    }[phase];
    description.textContent = {
      available: "Update the Celetis engine and the installed plugins. The daemon restarts when the update completes.",
      "restart-needed": "The daemon runs an older Celetis engine than the installed one. Restart the daemon to use the installed engine.",
      checking: "Checking the configured target and the installed Celetis parts.",
      updating: "The update is running. The daemon restarts when all parts are ready.",
      restarting: "This page reconnects when the new daemon answers.",
      updated: "The update completed. This daemon runs from a checkout, so it does not restart.",
      "update-failed": "The daemon has not restarted. Check again before a new attempt.",
      "restart-refused": "The daemon still runs its engine. Check again before a new attempt.",
      "check-failed": "You can keep using the board. Check again when the source is available.",
      timeout: `The ${kind} may have completed. This page could not reach the new daemon within 60 seconds.`
    }[phase];
    const rows = !target ? [] : isRestart ? [...response ? [["Daemon", response.runtime.revision]] : [], ["Installed", target]] : [
      ...(offered?.parts ?? []).map((part) => [names[part.part], part.installed]),
      ["Target", target]
    ];
    const key = JSON.stringify(rows);
    if (key !== revisionKey) {
      revisionKey = key;
      revisions.replaceChildren(...rows.flatMap(([name, revision]) => {
        const code = el("code", "", revision.slice(0, 12));
        code.title = revision;
        return [el("span", "", name), code];
      }));
    }
    revisions.hidden = phase === "check-failed" || phase === "checking";
    let status = "";
    if (phase === "restarting")
      status = "Reconnecting to the new daemon…";
    else if (phase === "restart-needed")
      status = "The daemon runs an older Celetis engine.";
    else if (phase === "updating") {
      const stage = update?.stage;
      status = stage ? `${stage.state === "started" ? "Updating" : "Completed"} ${names[stage.part]}…` : "Preparing the update…";
    } else if (phase === "checking")
      status = "Checking for updates…";
    else if (failed || phase === "updated")
      status = title.textContent ?? "";
    else
      status = "An update is available.";
    if (progress.textContent !== status)
      progress.textContent = status;
    announce(JSON.stringify([phase, kind, target, status]), status);
    progress.classList.toggle("is-busy", busy || phase === "checking");
    note.textContent = phase === "update-failed" && update ? [
      update.completed.length ? `Completed: ${update.completed.map((part) => names[part]).join(", ")}.` : "",
      update.incomplete.length ? `Incomplete: ${update.incomplete.map((part) => names[part]).join(", ")}.` : ""
    ].filter(Boolean).join(" ") : "Your agent sessions keep running in their tabs.";
    note.classList.toggle("update-failure", phase === "update-failed");
    diagnostic.textContent = failed ? checkFailure ?? refusal?.line ?? update?.error ?? "" : "";
    diagnostic.hidden = !diagnostic.textContent;
    recovery.textContent = failed && phase !== "restart-refused" ? pending?.recovery ?? update?.recovery ?? "" : "";
    recovery.hidden = !recovery.textContent;
    later.textContent = busy ? "Hide progress" : failed || phase === "updated" ? "Close" : "Later";
    start.hidden = phase !== "available" && phase !== "restart-needed";
    start.textContent = phase === "restart-needed" ? "Restart" : "Update and restart";
    start.disabled = submitting !== null || checking || phase === "available" && !update?.offer;
    check.hidden = !failed;
    check.disabled = checking;
    if (focused === start && start.hidden || focused === check && check.hidden)
      title.focus();
    opener.setAttribute("aria-expanded", String(dialog.open));
  };
  const expire = () => {
    if (!pending?.deadline || Date.now() < pending.deadline)
      return false;
    timedOut = true;
    clearTimeout(timer);
    active?.abort();
    draw();
    open(true);
    return true;
  };
  const accept = (next) => {
    if (expire())
      return;
    if (!pending && JSON.stringify(response) === JSON.stringify(next))
      return;
    const previousPhase = response?.update.phase;
    response = next;
    const update = next.update;
    if (update.offer)
      offered = update.offer;
    if (pending && next.runtime.revision === pending.target && next.runtime.instance !== pending.instance) {
      if (pending.reloaded) {
        pending = null;
        reconnecting = false;
        save();
        document.dispatchEvent(new Event("board-connected"));
      } else {
        pending.reloaded = true;
        save();
        location.reload();
        return;
      }
    }
    if (update.phase === "updating" || update.phase === "restarting") {
      refusal = null;
      if (!pending && update.target) {
        pending = {
          kind: update.completed.length || update.incomplete.length ? "update" : "restart",
          target: update.target,
          instance: next.runtime.instance,
          recovery: update.recovery,
          deadline: null,
          reloaded: false
        };
        save();
      }
      if (pending && update.recovery) {
        pending.recovery = update.recovery;
        save();
      }
    } else if ((update.phase === "update-failed" || update.phase === "updated") && next.runtime.instance === pending?.instance) {
      if (pending.kind === "restart")
        refusal = { kind: "restart", line: update.error ?? "" };
      pending = null;
      reconnecting = false;
      save();
      document.dispatchEvent(new Event("board-connected"));
    }
    if (pending) {
      if (update.phase === "updating" && update.target === pending.target && next.runtime.instance === pending.instance) {
        if (reconnecting) {
          pending.deadline = null;
          reconnecting = false;
          save();
          document.dispatchEvent(new Event("board-connected"));
        }
      } else
        beginReconnect();
    }
    if (expire())
      return;
    draw();
    if (update.phase === "available" && !pending && !refusal && !checking && update.offer?.id !== deferred)
      open(true);
    else if (phaseOf() === "restart-needed" && update.target !== restartShown) {
      restartShown = update.target;
      session.set("restart-shown", restartShown);
      open(true);
    } else if (pending && hidden !== `${pending.instance}:${pending.target}`)
      open(true);
    else if (update.phase === "update-failed" && previousPhase !== "update-failed")
      open(true);
    else if (update.phase === "updated" && previousPhase !== undefined && previousPhase !== "updated")
      open(true);
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!timedOut)
      timer = setTimeout(poll, pending ? 1000 : 5000);
  };
  const poll = async (forCheck = false) => {
    if (expire())
      return;
    const request = ++epoch;
    const controller = new AbortController;
    active = controller;
    const timeout = setTimeout(() => controller.abort(), Math.min(5000, pending?.deadline ? Math.max(1, pending.deadline - Date.now()) : 5000));
    try {
      const result = await fetch("/api/update", { cache: "no-store", signal: controller.signal });
      if (!result.ok)
        throw new Error("The board server does not answer.");
      const next = await result.json();
      if (!next.runtime || !next.update)
        throw new Error("The update status could not be read.");
      if (request === epoch) {
        if (forCheck)
          checking = false;
        accept(next);
        draw();
      }
    } catch {
      if (request !== epoch)
        return;
      if (forCheck || !pending && response?.update.phase === "checking") {
        checking = false;
        checkFailure ??= "The update status could not be read. Check again.";
      }
      if (pending) {
        beginReconnect();
      }
      draw();
    } finally {
      clearTimeout(timeout);
      if (request === epoch) {
        expire();
        schedule();
      }
    }
  };
  const stopPoll = () => {
    ++epoch;
    clearTimeout(timer);
    active?.abort();
  };
  opener.addEventListener("click", () => {
    const phase = phaseOf();
    if (phase === "checking")
      return;
    if (!phase || phase === "current") {
      requestCheck();
      return;
    }
    if (pending) {
      hidden = null;
      session.set("hidden", null);
    }
    open();
    draw();
  });
  later.addEventListener("click", () => close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (contains(document.activeElement))
      close();
  });
  const approve = async () => {
    if (submitting || checking || pending || !response?.update.offer)
      return;
    const offer = response.update.offer;
    stopPoll();
    pending = {
      kind: "update",
      target: offer.target,
      instance: response.runtime.instance,
      recovery: response.update.recovery,
      deadline: null,
      reloaded: false
    };
    hidden = null;
    refusal = null;
    submitting = "update";
    save();
    draw();
    const outcome = await post("/api/update/start", { offerId: offer.id }, "Update failed", { timeout: 1e4 });
    submitting = null;
    if (outcome.status === "rejected") {
      pending = null;
      reconnecting = false;
      refusal = { kind: "update", line: outcome.error };
      save();
      draw();
    } else
      beginReconnect();
    await poll();
  };
  const restart = async () => {
    if (submitting || checking || pending || phaseOf() !== "restart-needed" || !response)
      return;
    const shown = response;
    stopPoll();
    hidden = null;
    refusal = null;
    submitting = "restart";
    draw();
    const request = {};
    const outcome = await post("/api/update/restart", request, "Restart failed", { timeout: 1e4 });
    submitting = null;
    if (outcome.status !== "accepted" && outcome.error !== undefined) {
      refusal = { kind: "restart", line: outcome.error };
      draw();
    } else {
      const answer = outcome.status === "accepted" && isRestartAnswer(outcome.body) ? outcome.body : null;
      pending = {
        kind: "restart",
        target: answer?.target ?? shown.update.target ?? "",
        instance: answer?.runtime.instance ?? shown.runtime.instance,
        recovery: shown.update.recovery,
        deadline: null,
        reloaded: false
      };
      save();
      beginReconnect();
    }
    await poll();
  };
  start.addEventListener("click", () => void (phaseOf() === "restart-needed" ? restart() : approve()));
  const requestCheck = async () => {
    if (phaseOf() === "checking" || pending && !timedOut)
      return;
    if (timedOut) {
      pending = null;
      timedOut = false;
      reconnecting = false;
      save();
      document.dispatchEvent(new Event("board-connected"));
    }
    checking = true;
    refusal = null;
    checkFailure = null;
    stopPoll();
    draw();
    const result = await post("/api/update/check", {}, "Update check failed");
    if (!result)
      checkFailure = "The update check could not start. Check again.";
    await poll(true);
  };
  check.addEventListener("click", () => void requestCheck());
  draw();
  poll();
  return controls;
}

// engine/board/page/board.ts
var SUMMARY = [
  ["needs", "need you"],
  ["running", "running"],
  ["idle", "idle"],
  ["history", "landed"]
];
var COPY = { "no-progress": "command", "dirty-tree": "path" };
var ON_ISSUE = new Set(["blocked"]);
var LIVE = new Set(["works", "waits"]);
var GATES = {
  auto: "Auto mode of the daemon starts this step by itself"
};
var AUTO = {
  on: { tone: "ok", title: "Auto mode starts each auto step." },
  off: { tone: "off", title: "Auto mode is off: auto steps wait." },
  stopping: { tone: "off", title: "Auto mode stops after its current work." }
};
var STATUS_ICONS = {
  works: "works",
  starts: "works",
  waits: "target",
  "no-progress": "alert",
  "dirty-tree": "diff",
  blocked: "person",
  "quota-wait": "clock"
};
var FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
var QUEUE_LEVEL = "The queue starts this step at the start pair, with no override";
var data = null;
var selected = null;
var view = store.get("view") === "pipeline" ? "pipeline" : "now";
var isNotifyOn = store.get("notify") === "on";
var isKeysOn = store.get("keys") !== "off";
var openEpics = parseOpenEpics(store.get("open-epics") ?? "");
var isHistoryOpen = false;
var isQueueOpen = false;
var isServerDown = false;
var intakePending = false;
var seen = null;
var needsKeys = null;
var starting = null;
var startupWarnings = new Map;
var byKey = new Map;
var used = new Set;
var who2 = (card) => card.number === null ? card.title ? `human session "${card.title}"` : "a human session" : `#${card.number}`;
var canRunLater = (card) => card.sessionId === null && card.step && (card.state === null || card.state === "no-progress");
var copyWhat = (card) => card.act ? COPY[card.state] : null;
var onTracker = () => data.tracker ? ` on ${data.tracker}` : "";
var readAgain = () => data?.tracker ? `Read ${data.tracker} again` : "Read the issues again";
var act = async (path, value, failure, onDone) => {
  if (isReconnecting())
    return false;
  const isOk = await post(path, value, failure);
  if (isOk)
    onDone?.();
  await load();
  return isOk;
};
var intakeReason = () => {
  if (isReconnecting())
    return "The board is reconnecting";
  if (intakePending)
    return "An intake tab is opening";
  const readAt = Date.parse(data?.source.readAt ?? "");
  if (!data || isServerDown || data.source.error || !Number.isFinite(readAt) || Date.now() - readAt > 60000)
    return null;
  return defaultReason();
};
function drawIntake() {
  const button = $("intake");
  const reason = intakeReason();
  button.setAttribute("aria-disabled", String(reason !== null));
  button.setAttribute("aria-busy", String(intakePending));
  button.title = reason ?? "Open a fresh intake session";
  button.querySelector(".label").textContent = intakePending ? "Opening…" : "New intake";
  $("intake-reason").textContent = intakePending ? "" : reason ?? "";
  $("intake-reason").hidden = intakePending || reason === null;
}
async function openIntake() {
  if (intakeReason() !== null)
    return;
  intakePending = true;
  drawIntake();
  $("announce").textContent = "Opening an intake tab";
  try {
    const outcome = await post("/api/intake", {}, "New intake failed", { timeout: 1e4 });
    if (outcome.status === "accepted")
      $("announce").textContent = "Intake tab opened";
    else {
      const detail = outcome.status === "rejected" ? outcome.error : [
        outcome.error,
        "The launch outcome is unknown. Check Human sessions or herdr before pressing New intake again."
      ].filter(Boolean).join(" ");
      toast("New intake failed", { detail, isError: true });
      $("announce").textContent = `New intake failed. ${detail}`;
    }
  } finally {
    intakePending = false;
    drawIntake();
  }
}
var agentDisplay = (id) => agentOf({ agent: id })?.name ?? id;
var defaultReason = (work = "session") => {
  const next = data?.next;
  if (next?.kind === "wait")
    return work === "session" ? "Every included agent is limited. See the agent order." : null;
  const entry = next ? data?.agents?.[next.host] : undefined;
  return entry?.available === false ? cleanCause(entry.cause) : null;
};
var runReason = (agent, number) => {
  if (data?.noRun)
    return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === "me-gate" && record.numbers[0] === number && record.choice) {
    if (record.choice.kind === "default") {
      if (agent !== null)
        return "queue: recorded agent choice is the default order";
    } else {
      if (agent !== null && agent !== record.choice.host)
        return `queue: recorded agent choice is ${record.choice.host}`;
      agent = record.choice.host;
    }
  }
  const agents = data?.agents;
  if (agent) {
    const entry = agents?.[agent];
    if (entry && entry.available === false)
      return cleanCause(entry.cause);
    return null;
  }
  return defaultReason("run");
};
var runName = ({ step, effort, number }) => `Run ${step}${effort ? ` on ${effort.model} at ${effort.level}` : ""}, #${number}`;
var runAction = (card, agent = null) => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent, card.number);
  const name = agent ? `Run ${card.step}, #${card.number} with ${display}` : runName(card);
  return {
    id: agent ? `run:${agent}` : "run",
    label: agent ? `Run with ${display}` : "Run",
    icon: "run",
    busy: "Starting",
    name,
    title: reason ?? runTitle(card.step, data.flow, card.effort),
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
var levelEntries = (card) => {
  const { effort } = card;
  if (!effort || !(card.run || data?.noRun))
    return [];
  const record = data?.queue?.record;
  const reason = data?.noRun || (record?.state === "me-gate" && record.numbers[0] === card.number ? QUEUE_LEVEL : runReason(null, card.number));
  return [
    "rule",
    ...(data?.flow?.levels ?? []).map((level) => ({
      icon: level === effort.level ? "check" : "run",
      label: `Run at ${level}${level === effort.level ? ` (${levelSource(effort)})` : ""}`,
      title: reason ?? startTitle(card.step, effort, level),
      isDisabled: Boolean(reason),
      run: reason ? async () => toast(reason, { isError: true }) : async () => {
        if (await launch(card, "/api/run", undefined, level))
          toast(`Started the ${card.step} step of #${card.number} at ${level} in a new herdr tab`);
      }
    }))
  ];
};
var agentOrderEntry = {
  icon: "person",
  label: "Change the agent order",
  key: "",
  title: "Open the agent order in the footer",
  run: () => {
    const trigger = $("agent-picker").querySelector(".ap-trigger");
    if (trigger?.getAttribute("aria-expanded") !== "true")
      trigger?.click();
  }
};
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
      name: `Go to the pane of ${who2(card)}`,
      title: "Focus its pane in herdr (Enter)",
      run: () => act("/api/go", { sessionId: card.sessionId }, "Go failed", () => toast(`Focused the pane of ${who2(card)} in herdr`, { detail: "Switch to your terminal to see it." }))
    });
  }
  if (card.state === "quota-wait")
    list.push({
      id: "agent-order",
      label: "Agent order",
      icon: "person",
      name: `Show the agent order and Retry of #${card.number}`,
      title: "Show the usage limits and Retry in the agent order (Enter)",
      run: agentOrderEntry.run
    });
  if (card.state === "blocked") {
    const reason = data?.noRun || defaultReason();
    list.push({
      id: "assist",
      label: "Open agent",
      icon: "terminal",
      busy: "Starting",
      name: `Open agent for #${card.number}`,
      title: reason ?? "Open an assistance session in a new herdr tab (Enter)",
      isDisabled: Boolean(reason) || !card.assist,
      run: async () => {
        if (await launch(card, "/api/assist"))
          toast(`Opened an assistance session for #${card.number} in a new herdr tab`, {
            detail: "Switch to your terminal to see it."
          });
      }
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
      title: `Open the issue${onTracker()}${list.length === 0 ? " (Enter)" : ""}`,
      href: card.url
    });
  }
  const { noRun } = data;
  if (noRun && canRunLater(card)) {
    list.push({
      id: "blocked",
      label: "Run",
      icon: "run",
      name: runName(card),
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
  ...levelEntries(card),
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
var startLabel = (pair) => {
  const node = el("span", "start");
  node.title = startName(pair);
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", node.title);
  for (const [part, value] of [
    ["model", pair.model],
    ["level", pair.level]
  ]) {
    const segment = el("span", "start-part");
    segment.dataset.part = part;
    segment.dataset.source = pair.source[part];
    if (pair.source[part] === "pinned")
      segment.append(icon("pin"));
    segment.append(el("span", "", value));
    node.append(segment);
  }
  return node;
};
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
    if (card.effort)
      node.append(startLabel(card.effort));
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
  const levelled = levelEntries(card);
  const button = iconButton("chevron", levelled.length ? "Run with another agent or at another level" : "Run with another agent", (event) => openMenu(event.currentTarget, [...entries, ...levelled]));
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
  head.append(mark(card, Boolean(card.state)), id);
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
var storeOpenEpics = (change) => {
  const stored = store.get("open-epics");
  const next = new Set(stored === null ? openEpics : parseOpenEpics(stored));
  change(next);
  store.set("open-epics", JSON.stringify([...next].sort((a, b) => a - b)));
  openEpics = next;
};
var showOpenEpics = () => {
  for (const row of document.querySelectorAll(".epic-row")) {
    const isOpen = openEpics.has(Number(row.dataset.epic));
    row.setAttribute("aria-expanded", String(isOpen));
    $(row.getAttribute("aria-controls")).hidden = !isOpen;
  }
};
var setEpicOpen = (epic, isOpen) => {
  storeOpenEpics((open) => isOpen ? open.add(epic) : open.delete(epic));
  showOpenEpics();
};
var epicGroup = (epic, cards, scope) => {
  const id = `eg-${scope}-${epic.number}`;
  const isOpen = openEpics.has(epic.number);
  const row = el("button", "epic-row");
  row.type = "button";
  row.id = `${id}-row`;
  row.dataset.epic = String(epic.number);
  row.dataset.group = `${scope}-${epic.number}`;
  row.setAttribute("aria-expanded", String(isOpen));
  row.setAttribute("aria-controls", id);
  const count = el("span", "epic-count", String(cards.length));
  count.append(el("span", "sr-only", cards.length === 1 ? " issue" : " issues"));
  row.append(icon("chevron"), el("span", "epic-num", `#${epic.number}`), el("span", "epic-title", epic.title), count, unseenDot());
  row.addEventListener("click", () => setEpicOpen(epic.number, row.getAttribute("aria-expanded") !== "true"));
  const children = el("div", "epic-children");
  children.id = id;
  children.hidden = !isOpen;
  children.setAttribute("role", "group");
  children.setAttribute("aria-labelledby", row.id);
  children.append(...cards.map((card) => drawCard(card, "idle", { isCompact: true })));
  const node = el("div", "epic-group");
  node.dataset.epic = String(epic.number);
  node.append(row, children);
  return node;
};
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
  else if (key === "idle")
    body.append(...groupEpics(cards, () => true).map((item) => item.kind === "group" ? epicGroup(item.epic, item.cards, "idle") : drawCard(item.card, "idle", { isCompact: true })));
  else
    body.append(...cards.map((card) => drawCard(card, key)));
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
    body.append(...stage.cards.length ? groupEpics(stage.cards, (card) => where.get(card) === "idle").map((item) => item.kind === "group" ? epicGroup(item.epic, item.cards, `s${stage.key}`) : drawCard(item.card, where.get(item.card), { isCompact: true })) : [el("p", "stage-empty", "No issue at this step")]);
    section.append(head, body);
    sections.push(section);
  }
  return sections;
};
var isStop = (node) => !node.closest(".epic-children[hidden]");
var focusFirst = (selector) => {
  if (isQueueOpen)
    showQueue(false);
  const target = [...document.querySelectorAll(selector)].find(isStop);
  target?.focus();
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
};
var summary = (columns) => SUMMARY.map(([key, label]) => {
  const count = key === "history" ? data?.history?.entries.length ?? 0 : key === "needs" ? needsYou(columns).length : columns[key].length;
  const chip = el("button", `chip chip-${key}`);
  chip.type = "button";
  chip.classList.toggle("hot", key === "needs" && count > 0);
  chip.append(el("i", "dot"), el("b", "", String(count)), el("span", "", label));
  chip.addEventListener("click", () => {
    if (key === "history")
      return setHistory(true);
    if (view !== "now")
      setView("now");
    focusFirst(`${key === "needs" ? '.human-pill[data-wait="dialog"] .human-open, ' : ""}#col-${key} .card, #col-${key} .epic-row, #col-${key} .empty`);
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
var visualPresses = new Set;
var makeVisual = async (number) => {
  if (visualPresses.has(number))
    return;
  visualPresses.add(number);
  if (isHistoryOpen)
    drawHistory();
  await act("/api/visual", { number }, "Make visual failed");
  visualPresses.delete(number);
  if (isHistoryOpen)
    drawHistory();
};
var visualControl = (entry) => {
  const { number } = entry;
  const state = visualPresses.has(number) && entry.visual === "none" ? "starting" : entry.visual;
  let node;
  if (state === "ready") {
    node = Object.assign(el("a", "btn ghost history-action"), {
      href: `/visual/${entry.sha}`,
      target: "_blank",
      rel: "noreferrer"
    });
    node.append(icon("open"), el("span", "label", "Open visual"));
    node.setAttribute("aria-label", `Open the visual of #${number}`);
  } else if (state === "making") {
    node = el("span", "history-action history-making");
    node.setAttribute("role", "status");
    node.tabIndex = -1;
    node.title = `The tab #${number} visual makes the page`;
    node.append(icon("pending"), el("span", "", "Making…"));
  } else {
    node = el("button", "btn ghost history-action");
    node.type = "button";
    node.append(icon("diff"), el("span", "label", state === "starting" ? "Starting…" : "Make visual"));
    node.setAttribute("aria-label", `Make the visual of #${number}`);
    if (state === "starting")
      node.setAttribute("aria-busy", "true");
    else
      node.addEventListener("click", () => void makeVisual(number));
  }
  node.dataset.visual = String(number);
  return node;
};
var drawHistory = () => {
  const panel = $("panel");
  const active = panel.contains(document.activeElement) ? document.activeElement : null;
  const href = active?.getAttribute("href");
  const label = active?.getAttribute("aria-label");
  const visual = active?.dataset.visual;
  const scroll = panel.querySelector(".history-body")?.scrollTop ?? 0;
  const history = data?.history;
  const error = isServerDown ? SERVER_DOWN : data?.source.error;
  panel.dataset.state = "history";
  panel.setAttribute("aria-label", "Landed history");
  const head = el("div", "panel-head history-head");
  head.append(el("h2", "", history ? `Landed on ${history.trunk}` : "Landed history"), iconButton("close", "Close history (Esc)", () => setHistory(false)));
  const body = el("div", "history-body");
  if (!history)
    body.append(el("p", "history-note", error ? `Cannot read history: ${error}` : "Loading landed history…"));
  else {
    if (error) {
      const warning = el("p", "warning", `${error}. History shows the last good read.`);
      warning.setAttribute("role", "status");
      body.append(warning);
    }
    body.append(el("p", "history-note", "Latest 20 issues. A landing can later be reverted."));
    const list = el("ol", "history-list");
    for (const entry of history.entries) {
      const row = el("li", "history-row");
      const issue = link("history-number", `#${entry.number}`, entry.url);
      const title = link("history-title", entry.title, entry.url);
      const commit = link("history-sha", entry.sha.slice(0, 7), entry.commitUrl);
      commit.setAttribute("aria-label", `Commit ${entry.sha}`);
      commit.title = entry.sha;
      const time = el("time", "", new Date(entry.committedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }));
      time.dateTime = entry.committedAt;
      time.title = `Commit time: ${entry.committedAt}`;
      time.setAttribute("aria-label", time.title);
      const meta = el("span", "history-meta");
      const dot = el("span", "", "·");
      dot.setAttribute("aria-hidden", "true");
      meta.append(commit, dot, time);
      row.append(issue, title, meta, visualControl(entry));
      list.append(row);
    }
    body.append(history.entries.length ? list : el("p", "history-note", `No landed issues found on ${history.trunk}.`));
    body.append(link("history-more", `View ${history.trunk}`, history.url));
  }
  panel.replaceChildren(head, body);
  body.scrollTop = scroll;
  if (active) {
    const match = [...panel.querySelectorAll("a, button, [data-visual]")].find((node) => visual ? node.dataset.visual === visual : href ? node.getAttribute("href") === href && node.className === active.className && node.getAttribute("aria-label") === label : node.getAttribute("aria-label") === label);
    (match ?? panel.querySelector("button"))?.focus({ preventScroll: true });
  }
};
var setHistory = (isOpen) => {
  if (isOpen && isQueueOpen)
    showQueue(false);
  if (!isOpen)
    return closePanel();
  selected = null;
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  isHistoryOpen = true;
  $("history").setAttribute("aria-expanded", "true");
  document.body.classList.add("has-panel");
  $("panel").hidden = false;
  drawHistory();
  $("panel").querySelector("button")?.focus({ preventScroll: true });
  updateTail();
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
  const previousWarnings = startupWarnings;
  starting = now;
  startupWarnings = new Map(cards.flatMap((card) => card.number !== null && card.warning ? [[card.number, card.warning]] : []));
  if (before === null)
    return lines;
  for (const [number, warning] of startupWarnings)
    if (previousWarnings.get(number) !== warning)
      lines.push(`#${number}: ${warning}`);
  for (const [number, step] of now)
    if (!before.has(number))
      lines.push(step ? `#${number} is starting the ${step} step` : `#${number} is starting a session`);
  for (const [number, step] of before) {
    if (now.has(number))
      continue;
    const card = cards.find((other) => other.number === number);
    if (card?.sessionId)
      lines.push(step ? `#${number} started the ${step} step` : `#${number} opened a session`);
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
var daemonItem = (daemon) => {
  const { tone, title } = AUTO[daemon.auto];
  return { text: `auto ${daemon.auto}`, tone, title: `The daemon PID ${daemon.pid} runs. ${title}` };
};
var drawStatus = (source, isDown) => {
  const changed = isServerDown !== isDown;
  isServerDown = isDown;
  if (changed && isHistoryOpen)
    drawHistory();
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
  const terminal = data?.terminal;
  const terminalNode = $("terminal");
  terminalNode.dataset.tone = terminal?.ok === true ? "ok" : terminal?.ok === false ? "fail" : "wait";
  terminalNode.title = terminal?.error ? `herdr: ${terminal.error}` : "Run and Go use herdr";
  terminalNode.querySelector(".sb-text").textContent = terminal?.ok === true ? "up" : terminal?.ok === false ? "down" : "checking";
  const daemon = $("daemon");
  daemon.hidden = !data;
  if (data) {
    const item = daemonItem(data.daemon);
    daemon.dataset.tone = item.tone;
    daemon.title = item.title;
    daemon.replaceChildren(el("i", "dot"), el("span", "sb-name", "Daemon"), el("span", "sb-text", item.text));
  }
  if (data?.picker)
    picker.update(data.picker);
  document.body.toggleAttribute("data-stale", isDown);
  $("stale").hidden = !isDown && !source.error;
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
  $("panel").setAttribute("aria-label", "Card details");
  const focused = $("panel").contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
  $("panel").replaceChildren(...drawPanel(entry.card, panelContext(entry.card)));
  if (focused)
    ($("panel").querySelector(`[aria-label="${CSS.escape(focused)}"]`) ?? $("panel").querySelector(".panel-head > .icon-btn:last-child"))?.focus({ preventScroll: true });
};
var revealCard = (key) => {
  const group = document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.closest(".epic-children[hidden]");
  if (group)
    setEpicOpen(Number(group.closest(".epic-group")?.dataset.epic), true);
};
var openPanel = (key) => {
  if (isQueueOpen)
    showQueue(false);
  if (!byKey.has(key))
    return;
  revealCard(key);
  isHistoryOpen = false;
  $("history").setAttribute("aria-expanded", "false");
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
  const wasHistory = isHistoryOpen;
  isHistoryOpen = false;
  $("history").setAttribute("aria-expanded", "false");
  selected = null;
  document.body.classList.remove("has-panel");
  $("panel").hidden = true;
  $("panel").replaceChildren();
  for (const node of document.querySelectorAll("[data-key].is-selected"))
    node.classList.remove("is-selected");
  if (wasHistory)
    $("history").focus({ preventScroll: true });
  if (key) {
    revealCard(key);
    document.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  updateTail();
}
var reachable = (node) => node?.closest(".epic-children[hidden]")?.closest(".epic-group")?.querySelector(".epic-row") ?? node;
var drawBoard = (next) => {
  drawQueue(next);
  const active = document.activeElement;
  const holder = active?.closest?.(".human-pill, [data-key]");
  const target = (holder?.querySelector("[data-key]") ?? holder)?.dataset.key;
  const isGo = Boolean(active?.matches?.(".human-go"));
  const epicRow = active?.closest?.(".epic-row");
  const rowGroup = epicRow?.dataset.group;
  const rowKeys = [...epicRow?.closest(".epic-group")?.querySelectorAll("[data-key]") ?? []].map((node) => node.dataset.key);
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
  $("history-total").textContent = String(next.history?.entries.length ?? 0);
  if (isHistoryOpen)
    drawHistory();
  const board = $("columns");
  board.dataset.view = view;
  board.style.setProperty("--stages", String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle("is-calm", needs === 0);
  const bodies = () => board.querySelectorAll(".col[aria-labelledby] > .col-body");
  const scrolls = new Map([...bodies()].map((body) => [body.parentElement?.getAttribute("aria-labelledby"), body.scrollTop]));
  board.replaceChildren(...view === "pipeline" ? pipelineView(next.columns, next.flow) : COLUMNS.map((spec) => column(spec, next.columns[spec.key])));
  for (const body of bodies()) {
    const top = scrolls.get(body.parentElement?.getAttribute("aria-labelledby"));
    if (top !== undefined)
      body.scrollTop = top;
  }
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
    (go ?? reachable(node))?.focus({ preventScroll: true });
  }
  if (rowGroup) {
    const row = document.querySelector(`.epic-row[data-group="${CSS.escape(rowGroup)}"]`);
    const key = rowKeys.find((name) => document.querySelector(`[data-key="${CSS.escape(name)}"]`));
    const card = key ? document.querySelector(`[data-key="${CSS.escape(key)}"]`) : null;
    (row ?? reachable(card))?.focus({ preventScroll: true });
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
var showQueue = (open) => {
  isQueueOpen = open;
  if (open) {
    closePanel();
    setHistory(false);
  }
  setQueueOpen(open);
  if (!open)
    $("queue-open").focus();
};
var setView = (next) => {
  if (isQueueOpen)
    showQueue(false);
  view = next;
  store.set("view", next);
  for (const button of document.querySelectorAll(".views button"))
    button.setAttribute("aria-pressed", String(button.dataset.view === next));
  if (data)
    drawBoard(project(data));
};
var tick = () => {
  drawIntake();
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
  const columns = { needs: [], running: [], idle: [], human: [] };
  for (const [key, cards] of Object.entries(board.columns))
    for (const card of cards) {
      const launch = card.sessionId === null ? launches.get(card.number) : undefined;
      if (!launch)
        columns[key].push(card);
      else if (launch.phase !== "failed" && card.step === launch.step && (card.state === null || card.state === "no-progress" || card.state === "blocked" && launch.step === null))
        columns.running.unshift({
          ...card,
          state: "starts",
          act: null,
          assist: false,
          run: false,
          resume: false,
          go: false,
          warning: null,
          effort: null
        });
      else
        columns[key].push({ ...card, assist: false, run: false, resume: false });
    }
  return { ...board, columns };
};
var render = (canMove = true) => {
  drawIntake();
  const next = project(data);
  const cards = JSON.stringify([
    next.repo,
    next.noRun,
    next.agents,
    next.next,
    next.flow,
    next.tracker,
    next.columns,
    next.history,
    next.source.error,
    next.queue
  ]);
  if (cards === last) {
    drawQueue(next);
    return;
  }
  const layout = layoutOf(next);
  const isMove = lastLayout !== "" && layout !== lastLayout && !document.hidden;
  if (canMove && isMove && document.startViewTransition && !isCalm.matches)
    document.startViewTransition(() => drawBoard(project(data)));
  else
    drawBoard(next);
  last = cards;
  lastLayout = layout;
};
var launch = async (card, path, agent, effort) => {
  if (isReconnecting())
    return false;
  const number = card.number;
  const current = data && Object.values(project(data).columns).flat().find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === "/api/run" ? "run" : path === "/api/assist" ? "assist" : "resume"])
    return false;
  const reason = path === "/api/resume" ? data?.noRun : path === "/api/assist" ? data?.noRun || defaultReason() : runReason(agent ?? null, number);
  if (reason) {
    toast(reason, { isError: true });
    return false;
  }
  const entry = { step: current.step, phase: "pending" };
  launches.set(number, entry);
  render(false);
  if (document.activeElement === document.body)
    document.querySelector(`[data-key="${CSS.escape(keyOf(card))}"]`)?.focus({ preventScroll: true });
  const isOk = await post(path, {
    number,
    ...path === "/api/run" && agent ? { agent } : {},
    ...path === "/api/run" && effort ? { effort } : {}
  }, path === "/api/run" ? "Run failed" : path === "/api/assist" ? "Open agent failed" : "Resume failed");
  entry.phase = isOk ? "done" : "failed";
  settled = reads;
  render();
  load();
  return isOk;
};
var loadRequest;
document.addEventListener("board-reconnect", () => {
  drawIntake();
  loadRequest?.abort();
  if (data) {
    data = { ...data, queue: null };
    drawQueue(project(data));
  }
});
document.addEventListener("board-connected", () => {
  drawIntake();
  load();
});
async function load() {
  clearTimeout(timer);
  if (isReconnecting())
    return;
  loadRequest = new AbortController;
  const isLocal = hasRead && document.hidden;
  const read = ++reads;
  try {
    const response = await fetch(`/api/board${isLocal ? "?local=1" : ""}`, { signal: loadRequest.signal });
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
    if (!isReconnecting() && read > accepted && read > settled) {
      accepted = read;
      if (data)
        data = { ...data, queue: null };
      drawStatus(source, true);
      if (data)
        drawQueue(project(data));
    }
  }
  tick();
  timer = setTimeout(load, document.hidden ? 15000 : 5000);
}
var move = (across, down) => {
  const lists = [...document.querySelectorAll("#columns .col")].map((col) => [...col.querySelectorAll(".card[data-key], .epic-row")].filter(isStop));
  const current = document.activeElement?.closest?.(".card[data-key], .epic-row");
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
  { label: "Show the issue queue", icon: "stages", key: "", run: () => showQueue(true) },
  { label: readAgain(), icon: "refresh", key: "r", run: () => $("refresh").click() },
  {
    label: isHistoryOpen ? "Hide history" : "Show history",
    icon: "clock",
    key: "d",
    run: () => setHistory(!isHistoryOpen)
  },
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
            title: runTitle(card.step, data.flow, card.effort),
            run: async () => {
              if (await launch(card, "/api/run", id))
                toast(`Started the ${card.step} step of #${card.number} with ${display} in a new herdr tab`);
            }
          });
        }
      }
    }
  }
  for (const card of shown.history?.entries ?? [])
    if (card.url)
      items.push({
        group: "History",
        number: card.number,
        label: `Open the issue${onTracker()}`,
        context: card.title,
        icon: "open",
        tone: null,
        key: "",
        run: () => window.open(card.url, "_blank", "noopener,noreferrer")
      });
  items.push({ group: "Board", number: null, context: "", ...agentOrderEntry }, {
    group: "Board",
    number: null,
    label: view === "now" ? "Show the pipeline" : "Show what needs you now",
    context: "",
    icon: view === "now" ? "stages" : "board",
    key: "v",
    run: () => setView(view === "now" ? "pipeline" : "now")
  }, ...boardActions().map((action) => ({ group: "Board", number: null, context: "", ...action })), {
    group: "Board",
    number: null,
    label: "Expand all epic groups",
    context: "",
    icon: "chevron",
    key: "",
    run: () => {
      storeOpenEpics((open) => {
        for (const card of shown.columns.idle)
          if (card.epic)
            open.add(card.epic.number);
      });
      drawBoard(project(data));
    }
  }, {
    group: "Board",
    number: null,
    label: "Collapse all epic groups",
    context: "",
    icon: "chevron",
    key: "",
    run: () => {
      storeOpenEpics((open) => open.clear());
      drawBoard(project(data));
    }
  });
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
  d: () => setHistory(!isHistoryOpen),
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
var ROW_KEYS = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0)
};
var updates = setupUpdates();
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || updates.contains(event.target) || $("agent-picker").contains(event.target))
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
  if (event.key === "Escape" && !$("menu").matches(":popover-open") && updates.dismiss()) {
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && isHistoryOpen) {
    event.preventDefault();
    return setHistory(false);
  }
  if (event.key === "Escape" && selected) {
    event.preventDefault();
    return closePanel();
  }
  if (isQueueOpen && !["r", "d", "v", "?", "/"].includes(event.key))
    return;
  const card = document.activeElement?.matches?.(".card[data-key]") ? document.activeElement : null;
  const isRow = document.activeElement?.matches?.(".epic-row");
  const press = card && CARD_KEYS[event.key] || isRow && ROW_KEYS[event.key] || isKeysOn && KEYS[event.key];
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
addEventListener("storage", (event) => {
  if (event.key !== null && event.key !== store.key("open-epics"))
    return;
  const active = document.activeElement;
  openEpics = parseOpenEpics(event.newValue ?? "");
  showOpenEpics();
  if (active?.closest(".epic-children[hidden]"))
    reachable(active)?.focus({ preventScroll: true });
});
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
$("intake").prepend(icon("spark"));
$("intake").addEventListener("click", () => void openIntake());
drawIntake();
$("history").prepend(icon("clock"));
$("history").addEventListener("click", () => setHistory(!isHistoryOpen));
$("history-count").prepend(icon("clock"));
$("history-count").addEventListener("click", () => setHistory(true));
$("notify").addEventListener("click", toggleNotify);
$("board-more").append(icon("dots"));
$("board-more").addEventListener("click", () => openMenu($("board-more"), boardActions()));
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
setupQueue({
  back: () => showQueue(false),
  refresh: async () => {
    settled = reads;
    await load();
  }
});
$("queue-open").addEventListener("click", () => showQueue(!isQueueOpen));
var replaceOrder = async (order, expectedVersion) => {
  if (isReconnecting())
    throw new Error("the board is reconnecting");
  settled = reads;
  try {
    let response;
    try {
      response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order, expectedVersion }),
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw new Error(`${SERVER_DOWN}. Refresh before another change.`);
    }
    const body = await response.json().catch(() => null);
    if (response.ok && body && "order" in body)
      return body.order;
    if (response.status === 409 && body && "latest" in body)
      throw new OrderConflict(body.latest, body.error);
    throw new Error(body && "error" in body ? body.error : `the server answered ${response.status}`);
  } finally {
    settled = reads;
    load();
  }
};
var retryWait = async (number, waitId) => {
  const outcome = await post("/api/run", { number, waitId }, "Retry failed", { timeout: 150000 });
  settled = reads;
  load();
  if (outcome.status !== "accepted")
    throw new Error(outcome.error ?? SERVER_DOWN);
};
var picker = createAgentPicker($("agent-picker"), { replace: replaceOrder, retry: retryWait });
setupPalette();
setupMenu();
drawNotify();
drawHints(null);
setInterval(tick, 1000);
drawSkeleton();
drawStatus(source, false);
load();

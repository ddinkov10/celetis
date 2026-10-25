// engine/board/view.ts
var COLUMNS = [
  {
    key: "needs",
    name: "Needs you",
    note: "Answer, unblock, or run the next step",
    empty: ["Nothing needs you", "No agent waits, and no step is stuck."]
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
  { key: "ready", label: "Ready to run", short: "ready to run", states: null, isCompact: true }
];
var STATES = {
  works: "works",
  waits: "waits for you",
  unknown: "state unknown",
  starts: "starts",
  "dirty-tree": "dirty tree",
  "no-progress": "no progress"
};
var WAITS = { dialog: "waits for your answer", turn: "turn ended" };
var gateOf = (flow, step) => flow?.steps?.[step]?.gate ?? null;
var runTitle = (step, flow) => {
  const hint = flow?.steps?.[step]?.hint;
  return `Start the ${step} step${hint ? `. ${hint}` : ""} (Enter)`;
};
var AGENTS = {
  claude: ["Claude Code", "C"],
  opencode: ["OpenCode", "O"],
  codex: ["Codex", "X"]
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
  const [name, letter] = Object.hasOwn(AGENTS, card.agent) ? AGENTS[card.agent] : [card.agent, card.agent[0].toUpperCase()];
  return { name, letter };
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
var tone = (columns) => {
  if (columns.needs.length > 0)
    return "needs";
  return columns.running.some((card) => card.state === "works") ? "works" : "calm";
};
var BADGES = { needs: "#FF7A45", works: "#5EA2FF" };
var favicon = (badge) => {
  const dot = BADGES[badge] ? `<circle cx="24" cy="8" r="6" fill="${BADGES[badge]}" stroke="#18181B" stroke-width="2"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#18181B"/><rect x="7" y="7" width="7.5" height="18" rx="2.25" fill="#EEEEF0"/><rect x="17.5" y="7" width="7.5" height="11" rx="2.25" fill="#EEEEF0"/>${dot}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
var who = (card) => card.number === null ? "A session" : `#${card.number}`;
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
  const issues = cards.filter((card) => card.number !== null);
  const stages = (flow?.stages ?? []).map((stage, index) => ({
    ...stage,
    key: index,
    cards: issues.filter((card) => stage.steps.includes(card.step))
  }));
  const placed = new Set(stages.flatMap((stage) => stage.cards));
  return {
    stages,
    hold: issues.filter((card) => !placed.has(card)),
    loose: cards.filter((card) => card.number === null)
  };
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
      ...found.filter((item) => String(item.number) !== number)
    ];
  }
  const words = text.split(/\s+/);
  return items.filter((item) => words.every((word) => `${item.label} ${item.context ?? ""}`.toLowerCase().includes(word)));
};
export {
  AGENTS,
  COLUMNS,
  GROUPS,
  STATES,
  age,
  agentOf,
  cleanCause,
  diffText,
  favicon,
  filterItems,
  gateOf,
  groupNeeds,
  keyOf,
  laneTrack,
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
};

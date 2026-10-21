import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Label = { name: string }
type Comment = { body: string }
type Issue = {
  number: number
  title: string
  state: 'open' | 'closed'
  html_url: string
  labels: Label[]
  body: string | null
  comments: number | Comment[]
  updated_at: string
  closed_at: string | null
  pull_request?: unknown
}
type Resolved = { line: string; state?: 'ready' | 'blocked' | 'done'; reason?: string; act?: string }
type PrState = {
  headRefName: string
  number: number
  url: string
  isDraft: boolean
  checks: 'fail' | 'pending' | 'pass' | null
  review: 'changes' | 'approved' | 'required' | null
}

class ReadError extends Error {}

const usage = 'usage: scripts/celetis next-step <issue number> | --open | --json, e.g. scripts/celetis next-step 276'
const repo = 'repos/{owner}/{repo}'

function run(cmd: string[], cwd?: string) {
  const p = Bun.spawnSync(cmd, { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  return { code: p.exitCode, out: p.stdout.toString() }
}

async function gh<T = any>(endpoint: string, filter: string, paginate = true): Promise<T[]> {
  const args = ['gh', 'api', ...(paginate ? ['--paginate'] : []), endpoint, '--jq', filter]
  const p = Bun.spawn(args, { stdin: 'ignore', stdout: 'pipe', stderr: 'inherit' })
  const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited])
  if (code !== 0) throw new ReadError(endpoint)
  return out.split('\n').filter(Boolean).map(line => JSON.parse(line))
}

// RESOLVE encodes "Resolving an issue's state" in docs/issue-tracker.md; change them together.
function resolve(i: Issue & { comments: Comment[] }, n: string): Resolved {
  const labeled = (x: string) => i.labels.some(l => l.name === x)
  const commented = (p: string) => i.comments.some(c => c.body.startsWith(p))
  const headed = i.comments.map(c => c.body).filter(b => b.startsWith('## '))
  const refused = (headed.at(-1) ?? '').startsWith('## Landing refused')
  const blocked = (head: string, reason: string, act: string): Resolved =>
    ({ line: `stop #${n} ${head}. ${act}`, state: 'blocked', reason, act })
  if (i.state === 'closed')
    return labeled('wontfix') ? { line: `stop #${n} is closed as wontfix.` } : { line: `stop #${n} is finished.`, state: 'done' }
  if (labeled('needs-info')) return blocked('needs info', 'needs info', 'Answer the questions on the issue, then remove the label.')
  if (labeled('ready-for-human'))
    return blocked('is ready-for-human', refused ? 'landing refused' : 'ready for your step',
      'Do the human step (e.g. the hotfix ship checklist), then remove the label.')
  if (labeled('epic')) return { line: `stop #${n} is an epic. Each child runs its own flow.` }
  const skill =
    !['bug', 'enhancement', 'hotfix', 'chore'].some(labeled) ? 'triage'
    : labeled('enhancement') && !(i.body ?? '').startsWith('Spec:') ? 'feature'
    : labeled('bug') && !commented('## Root cause') ? 'bug'
    : labeled('chore') ? 'chore'
    : labeled('hotfix') ? 'hotfix'
    : !commented('## Plan') ? 'plan'
    : 'implement'
  return { line: `run /celetis:${skill} #${n}`, state: 'ready' }
}

const withComments = (issues: Issue[]) =>
  Promise.all(issues.map(async i => ({
    ...i,
    comments: i.comments === 0 ? [] : await gh(`${repo}/issues/${i.number}/comments?per_page=100`, '.[] | tojson'),
  })))

const openIssues = async () =>
  withComments(await gh<Issue>(`${repo}/issues?state=open&per_page=100`, '.[] | select(.pull_request | not) | tojson'))

async function prState(pr: any): Promise<PrState> {
  const sha = pr.head.sha
  const [runs, statuses, reviews] = await Promise.all([
    gh(`${repo}/commits/${sha}/check-runs?per_page=100`, '.check_runs[] | {status, conclusion} | tojson'),
    gh(`${repo}/commits/${sha}/status?per_page=100`, '.statuses[] | .state | tojson'),
    gh(`${repo}/pulls/${pr.number}/reviews?per_page=100`,
      '.[] | select(.state | IN("APPROVED", "CHANGES_REQUESTED", "DISMISSED")) | {user: .user.login, state} | tojson'),
  ])
  const checks =
    runs.length + statuses.length === 0 ? null
    : runs.some(r => ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'].includes(r.conclusion)) ||
      statuses.some(s => s === 'failure' || s === 'error') ? 'fail'
    : runs.some(r => r.status !== 'completed') || statuses.includes('pending') ? 'pending'
    : 'pass'
  const last = new Map<string, string>()
  for (const r of reviews) last.set(r.user, r.state)
  const states = [...last.values()]
  const review =
    states.includes('CHANGES_REQUESTED') ? 'changes'
    : states.includes('APPROVED') ? 'approved'
    : pr.requested_reviewers.length + pr.requested_teams.length > 0 ? 'required'
    : null
  return { headRefName: pr.head.ref, number: pr.number, url: pr.html_url, isDraft: pr.draft, checks, review }
}

const arg = process.argv[2]
const n = arg?.replace(/^#/, '') ?? ''
if (process.argv.length !== 3 || (arg !== '--open' && arg !== '--json' && !/^[0-9]+$/.test(n))) {
  console.error(usage)
  process.exit(2)
}

const git = run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'])
if (git.code !== 0) process.exit(git.code ?? 1)
const common = git.out.trim()
const main = dirname(common)
const config = Bun.spawnSync(['bash', '-c', '. "$1"; celetis_config_read "$2" >/dev/null', '_', join(import.meta.dir, 'celetis'), main],
  { stdin: 'ignore', stdout: 'ignore', stderr: 'inherit' })
if (config.exitCode !== 0) process.exit(config.exitCode ?? 1)

const dirty = (dir: string) => existsSync(dir) && run(['git', '-C', dir, 'status', '--porcelain']).out !== ''
const dirtyLine = (dir: string) => `stop the working tree is dirty: ${dir}; commit or stash first`
const lanes = (pattern: RegExp) => {
  const root = join(main, '.claude/worktrees')
  return existsSync(root) ? readdirSync(root).filter(d => pattern.test(d)).sort().map(d => join(root, d)) : []
}
// scripts/land.sh holds this lock while it runs. The line does not start with "stop #<n> ", so the runner keeps the session open.
function landing(n: string) {
  let pid: string
  try { pid = readFileSync(join(common, `celetis-flow/land-${n}.lock`), 'utf8').replace(/\n$/, '') } catch { return false }
  return /^[0-9]+$/.test(pid) && run(['ps', '-p', pid, '-o', 'command=']).out.includes('land.sh')
}
const landingLine = (n: string) => `stop the landing of #${n} runs; wait until scripts/celetis land ends`

async function json() {
  const since = new Date(Date.now() - 1209600_000).toISOString().slice(0, 10)
  const [open, closed, prs] = await Promise.all([
    openIssues(),
    gh<Issue>(`${repo}/issues?state=closed&since=${since}T00:00:00Z&per_page=100`, '.[] | select(.pull_request | not) | tojson')
      .then(list => list.filter(i => (i.closed_at ?? '') >= since).map(i => ({ ...i, comments: [] }))),
    gh(`${repo}/pulls?state=open&per_page=100`, '.[] | select(.head.ref | test("/[0-9]+-")) | tojson')
      .then(list => Promise.all(list.map(prState))),
  ])
  const issues = [...new Map([...closed, ...open].map(i => [i.number, i])).values()].sort((a, b) => a.number - b.number)
  const dirtyLanes = lanes(/^[0-9].*-/).filter(dirty)
  const rows = issues.flatMap(i => {
    const r = resolve(i, String(i.number))
    if (r.state === undefined) return []
    const label = i.labels.map(l => l.name)
    const pr = prs.find(p => p.headRefName.includes(`/${i.number}-`))
    const row: Record<string, unknown> = {
      number: i.number, title: i.title, url: i.html_url,
      type: label.includes('bug') ? 'bug' : label.includes('enhancement') ? 'feature' : label.includes('chore') ? 'chore' : label.includes('hotfix') ? 'hotfix' : null,
      updatedAt: i.updated_at, closedAt: i.closed_at, line: r.line, state: r.state, reason: r.reason ?? null, act: r.act ?? null,
      pr: pr ? { number: pr.number, url: pr.url, draft: pr.isDraft, checks: pr.checks, review: pr.review } : null,
    }
    const path = dirtyLanes.find(p => new RegExp(`/${i.number}-[^/]*$`).test(p))
    if (r.state !== 'done' && path) Object.assign(row, { state: 'dirty', path })
    return [row]
  })
  const noRun = dirty(main) ? `The main checkout is dirty: ${main}. Commit or stash first.` : null
  console.log(JSON.stringify({ noRun, issues: rows }, null, 2))
}

async function open() {
  const issues = (await openIssues()).sort((a, b) => a.number - b.number)
  const all = dirty(main) ? dirtyLine(main) : ''
  for (const i of issues) {
    const k = String(i.number)
    let line = resolve(i, k).line
    if (landing(k)) line = landingLine(k)
    const lane = lanes(new RegExp(`^${k}-`)).find(dirty)
    if (lane) line = dirtyLine(lane)
    console.log(`${k}\t${all || line}`)
  }
}

async function one(n: string) {
  const stop = [main, ...lanes(new RegExp(`^${n}-`))].find(dirty)
  if (stop) return console.log(dirtyLine(stop))
  if (landing(n)) return console.log(landingLine(n))
  const [issue] = await withComments(await gh<Issue>(`${repo}/issues/${n}`, 'tojson', false))
  console.log(resolve(issue, n).line)
}

const fallback = arg === '--json' ? 'stop cannot read the issues from GitHub'
  : arg === '--open' ? 'stop cannot read the open issues from GitHub'
  : `stop cannot read #${n} from GitHub`
try {
  await (arg === '--json' ? json() : arg === '--open' ? open() : one(n))
} catch (error) {
  if (!(error instanceof ReadError)) throw error
  console.log(fallback)
  process.exit(1)
}

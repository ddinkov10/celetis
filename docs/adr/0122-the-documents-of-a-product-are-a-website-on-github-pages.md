# The documents of a product are a Docusaurus website on GitHub Pages

## Date

2026-11-21

## Related

- [Issue #355](https://github.com/ddinkov10/celetis/issues/355): the spec (the body of the issue, `Spec: 2026-11-20`),
  with the design probes, the prior art, and the external facts. "The probe of the spec" in this record is a design
  probe of that spec. The captures of the look are in
  [this comment](https://github.com/ddinkov10/celetis/issues/355#issuecomment-7049993864).
- [The plan of #355](https://github.com/ddinkov10/celetis/issues/355#issuecomment-7050548648).
- [ADR-0116](0116-the-skill-document-writes-the-documents-that-the-readers-need.md), "Reconsider when": "The
  maintainers want the documents on a web page (#355) in a form that needs other homes." This design needs no other
  home: the site publishes the homes of `document`. Its decisions stay. The skill `docs-site` shares the homes of
  `document` through `plugins/celetis/references/procedures/document-homes.md`, and the rule of the homes is the same.
- [ADR-0095](0095-the-shared-agent-text-lives-in-references.md): the homes are a module because two skills read them.
  The text of the site files is in `plugins/celetis/skills/docs-site/site.md` because only one skill reads it.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): "The verify gate is the only check of this repository." and its
  paragraph "CI" stay true. `.github/workflows/test.yml` still has one job, `test`. The new workflow
  `.github/workflows/docs.yml` deploys the site after a landing and gates no landing (Decision 8).
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md), decision 1: "The repository root, `scripts/`, and
  `plugins/` have no package file" stays true. The site folder `website/` is none of these. Decision 3 stays: the gate
  checks and installs nothing, and it checks the install of `engine/` only.
- [ADR-0024](0024-the-config-read-runs-on-bun.md), Constraints and evidence: "A plugin has no install step". ADR-0115
  already replaced it in part. The folder `plugins/celetis/` still holds no package file and no install step. The skill
  runs `bun install` in `website/` of the product project.
- [ADR-0025](0025-the-toolchain-runs-on-typescript-and-bun.md), [ADR-0042](0042-one-celetis-program-for-both-hosts.md),
  and ADR-0115: "run no build" is the rule of the delivery of the plugin and the engine. A product project that asks
  for a site runs the build of its own site. No record clause says otherwise.
- [ADR-0119](0119-the-gate-tools-come-from-the-lockfile-of-the-engine.md), Constraints and evidence: TypeScript 7.0.2
  does not match a file of a `node_modules` folder at any depth with a `**` include. The probe below finds the same
  for `website/node_modules`.
- `website/`, `.github/workflows/docs.yml`, `plugins/celetis/skills/docs-site/SKILL.md`,
  `plugins/celetis/skills/docs-site/site.md`, and `fileRoles` of `scripts/verify.ts`.

## Supersedes

Only these clauses change. The records keep their historical text and evidence.

- [The engine pins its packages in a lockfile and checks the daemon protocol with Zod schemas](0115-the-engine-pins-its-packages-in-a-lockfile.md),
  in part: in "Decision", decision 7, the sentence "The packages are for the engine only." The site folder `website/`
  has its own manifest `website/package.json` and its own lockfile `website/bun.lock`. The sentence "Later children of
  the epic add schemas on this layer" stays.
- [The gate tools come from the lockfile of the engine](0119-the-gate-tools-come-from-the-lockfile-of-the-engine.md),
  in part: in "Consequences", "One lockfile holds each package pin of the repository". Now two lockfiles hold the
  package pins: `engine/bun.lock` and `website/bun.lock`. The rest of that bullet stays.
- [One Bun version for the project](0037-one-bun-version.md), in part: in "One source in the code", "Two places keep a
  literal" (ADR-0119 added `engine/package.json` as a third place). `.github/workflows/docs.yml` holds the literal
  `bun-version` too, because it is YAML and cannot import code. The gate keeps no workflow literal equal to `bunFloor`
  (Constraints and evidence below). The role "CI" of ADR-0037 names `test.yml` and stays true.

## Context

[ADR-0116](0116-the-skill-document-writes-the-documents-that-the-readers-need.md) made the skill `document`, which writes
the documents of a product as Markdown in the repository. Nothing published them. The maintainer asked for "what the big
products use to do that so it's clean concise and working" and said that the repository is meant to be public.
The readers want a site with a sidebar, a table of contents on each page, and the diagrams drawn, and the documents must
stay as `document` writes them: no front matter, no `title:` header, no renamed file.

## Constraints and evidence

- The probe of the spec built the unchanged documents of `docs/explanation/` with Docusaurus 3.10.2
  (`@docusaurus/preset-classic`, `@docusaurus/theme-mermaid`, React 19.2.0) under Bun 1.4.4 on macOS. The build needed
  `@mermaid-js/layout-elk` 1.0.2 as a direct dependency. VitePress 1.6.4 failed with
  `Element is missing end tag.`, because it compiles each page as a Vue template and the documents hold text such as
  `<command>`. Starlight 0.43.1 failed with `title: Required`, because it needs a `title:` header in each document.
- Docusaurus turns a link to a document of its docs plugin into a page link, and the hook
  `markdown.hooks.onBrokenMarkdownLinks` can return a new URL for another link
  ([the config reference](https://github.com/facebook/docusaurus/blob/v3.10.2/website/docs/api/docusaurus.config.js.mdx);
  [the links guide](https://github.com/facebook/docusaurus/blob/v3.10.2/website/docs/guides/markdown-features/markdown-features-links.mdx)).
- Docusaurus 3.10.2 reads each named export of `docusaurus.config.ts` as a config field and each named export of
  `sidebars.ts` as a sidebar. So the shared values are in a third file, `website/homes.ts`, and `githubUrl` and
  `fileLinks` are not exported.
- With `fileLinks` removed from the config, the build of the site fails (exit 1) with `Docusaurus found broken links!`:
  Docusaurus reads a link to a file that is not a document, for example `../../src/app.ts` or the folder `../../src`, as
  a link to a page of the site (`resolved as: /src/app.ts`). Probe: the config of this site, copied into a fixture of
  four documents with links to files and a folder outside `docs/`, and built once with the line
  `beforeDefaultRemarkPlugins: [fileLinks],` removed.
- The default `exclude` of the docs plugin drops `_*` files, `_*/` folders, and `__tests__/` folders, and its glob skips
  dot paths (read in `@docusaurus/utils/lib/globUtils.js` and `@docusaurus/plugin-content-docs/lib/docs.js` of 3.10.2).
  The config sets `exclude: []`, and `website/homes.ts` skips dot paths, so the sidebar and the pages count the same
  `.md` files. Probe on Bun 1.4.4 (macOS): `readdirSync(folder, { recursive: true })`, which `homes.ts` calls, lists
  `link/sub/a.md` for a symbolic link `link` to a folder. The glob of the docs plugin was not probed on a symbolic link.
- Two builds of the site of this repository on the machine of the maintainer (macOS, Bun 1.4.4) took 98 and 86 seconds.
  The probe of the spec measured about 60 seconds. `website/node_modules` holds about 1,260 packages: 757 MB in the
  probe of the spec, and 921 MB in a checkout after a local build (`du -sh`). Each figure is one sample.
- A build of the site of this repository with the line `A [broken link](missing-file.md) probe.` added to
  `docs/explanation/board.md` fails (exit 1) with `the link missing-file.md names no file`. The same build without the line passes: `index.html` of the overview holds
  `href="https://github.com/ddinkov10/celetis/blob/main/docs/adr/0122-the-documents-of-a-product-are-a-website-on-github-pages.md"`,
  and `explanation/` holds the five other pages.
- A diagram wider than the page column scales down to the column, and its text scales with it. Measured in a browser on
  macOS: with the default font size of Mermaid 12.3.0 (16 px), the diagram of the overview is 1763 px wide, and its
  text shows at 7.47 px in the column of a window 1440 px wide and at 3.11 px in the column of a window 375 px wide.
  With `themeVariables.fontSize` at `1.5rem`, the text shows at 10.15 px and 4.23 px, with no clipped label and no
  horizontal scroll of the page. The first two figures are from a test page with the `mermaid` package of
  `website/node_modules`, and the other two are from the built site of this repository. The built site was measured on
  three of its six diagrams, each a flowchart: the overview, `agent-text.md`, and `records.md`. Each figure is one
  sample.
- GitHub Pages is free for a public repository, and a private repository needs GitHub Pro, Team, or Enterprise
  ([what is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).
  This repository is private, on a plan that the session could not read. The probe did not run the deploy.
- Probes of the gate on the final configuration (macOS, Bun 1.4.4, `scripts/verify.ts`, in the checkout of #355):
  - With `website/node_modules`, `website/build`, and `website/.docusaurus` on disk, the gate passes. With the three
    folders moved away, it passes too. So the gate needs no site package.
  - `tsc -p tsconfig.runtime.json --listFilesOnly` lists three files of `website/`: `homes.ts`,
    `docusaurus.config.ts`, and `sidebars.ts`. It lists no file of `website/node_modules`, `website/build`, or
    `website/.docusaurus`.
  - A file `website/zz-probe.ts` with `import type { Config } from '@docusaurus/types';` passes the gate when
    `website/node_modules` is on disk, and fails it with `error TS2307: Cannot find module '@docusaurus/types'` when
    `website/node_modules` is absent. So a site file that imports a site package passes on a machine that ran
    `bun install` in `website/`, and fails on the CI runner and in a lane worktree. The site files import no site
    package for this reason.
  - Changing `bun-version: 1.4.4` of `.github/workflows/docs.yml` to `1.4.3` leaves the gate at `verify: PASS`. No
    check compares the literal with `bunFloor`.
  - Changing `runs-on` of `docs.yml` to `runs-onn` fails the gate: actionlint reports
    `"runs-on" section is missing in job "build"`. So actionlint checks `docs.yml`.
  - A line `A [broken link](missing-file.md) probe.` added to `docs/explanation/board.md` leaves the gate at
    `verify: PASS`. So the gate does not check the links of the documents of the site.
  - `scripts/` holds no mention of `site.md`. No check compares the files of `website/` with the fences of
    `plugins/celetis/skills/docs-site/site.md`.
- The probes did not build the site on Linux or Node, did not run the deploy, and did not run the skill on Codex: the
  usage limit of the Codex login stopped each Codex run.

## Decision

1. **The tool.** The site is Docusaurus 3.10.2 with the classic preset and `@docusaurus/theme-mermaid`.
   `website/package.json` is `private` and has the exact pins `@docusaurus/core`, `@docusaurus/preset-classic`, and
   `@docusaurus/theme-mermaid` 3.10.2, `@mermaid-js/layout-elk` 1.0.2, and `react` and `react-dom` 19.2.0.
   `website/bun.lock` locks them. No site package enters `engine/package.json`.
2. **The site reads the documents in place.** The docs plugin has `path: '../docs'`, an `include` glob for each home
   of `website/homes.ts`, `routeBasePath: '/'`, and `blog: false`. `markdown.format` is `detect`, so a `.md` file is
   CommonMark, not MDX. `markdown.mermaid` is `true`. A document gets its title from its first `#` heading. The sidebar
   is one autogenerated category for each home that holds a document, so a new document in a home shows with no edit of
   the site. The four homes are `explanation`, `tutorials`, `how-to`, and `reference`. The font size of a diagram,
   `themeConfig.mermaid.options.themeVariables.fontSize`, is `1.5rem`: a wide diagram scales down to the page column,
   and the default size then shows too small (Constraints and evidence). The limit: in a window 375 px wide, the text
   of the overview diagram stays near 4 px.
3. **The link rule.** One function `githubUrl` turns a relative link to an existing file or folder of the repository
   into `<repository>/blob/<branch>/<path>` (`tree` for a folder), with its fragment. The hook
   `markdown.hooks.onBrokenMarkdownLinks` and the remark plugin `fileLinks` both call it: the hook for a link to a `.md`
   or `.mdx` file that the docs plugin cannot resolve, and the plugin for a link to any other file or folder, which
   Docusaurus would read as a broken link to a page. A link to a missing file, or to a path outside the repository,
   throws. `onBrokenLinks` is `throw`. The module constants `repository` and `branch` of the config hold the URL of the
   repository and the branch, each once.
4. **The overview is the page `/`.** `parseFrontMatter` adds `slug: '/'` and `sidebar_position: 0` to the overview
   document of the first home, in memory. Without an overview, `/` shows the first document of the first published home.
   No document gets a header.
5. **GitHub Pages through a workflow.** `.github/workflows/docs.yml` runs on each push to `main` and on a manual start.
   The job `build` has `contents: read`, installs with `bun install --frozen-lockfile` and builds with
   `bun run --bun build` in `website/`, on Bun 1.4.4, and uploads `website/build`. The job `deploy` has
   `pages: write` and `id-token: write`, the environment `github-pages`, and `actions/deploy-pages@v5`. One concurrency
   group, `pages`, never cancels a running deploy. The workflow cannot turn on Pages: the maintainer sets
   **Pages → Source** to **GitHub Actions** once, and makes the repository public or moves it to a plan with Pages.
   The URL is `https://ddinkov10.github.io/celetis/`. The site is public.
6. **The skill `docs-site`.** The plugin has the skill `docs-site`, which only a person starts
   (`disable-model-invocation: true`, and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`). It reads
   the homes of the project, shows one plan, and writes nothing before the maintainer's yes. Then it writes
   `website/`, `.github/workflows/docs.yml`, and one line with the URL into the root `README.md`, runs `bun install` and
   one build in `website/`, and makes one local commit. It owns two paths, `website/` and `.github/workflows/docs.yml`,
   and it stops when either path holds another file of the product. It pushes nothing and changes no setting of the
   repository. The text of the six site files is in `plugins/celetis/skills/docs-site/site.md`, as one fenced block for
   each file, because the gate refuses TypeScript in `plugins/celetis/`. The homes of the documents are a module,
   `plugins/celetis/references/procedures/document-homes.md`, which `document` and `docs-site` both read.
7. **The gate and the setup install no site package.** `scripts/verify.ts` gives `website/bun.lock` and
   `website/.gitignore` a role, and Biome and strict types cover the TypeScript and JSON of `website/`, with no site
   package installed. `scripts/worktree-setup.ts` installs the packages of `engine/` only. A local build runs
   `bun install` in `website/` first.
8. **The site build is no check of a landing.** The landing requires the checks of the project, as before. `docs.yml`
   runs after the push to `main`. A broken link in a document fails its build, and the deploy does not run. The site
   then keeps its last good version, and the failure shows only in GitHub Actions.
9. **This repository.** The files of `website/` and the workflow are the output of the skill for this repository, with
   its values. The six documents of `docs/explanation/` are on the site, with the overview at `/`.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 4 Product neutrality: the skill names roles (the homes of the documents, the repository, the default branch),
  and each product project gives its own values.
- Hard limits and non-goals: none touched. The site build is not a check of the landing. The landing still requires the
  checks of the project.

## Alternatives considered

- **Starlight (Astro).** It has built-in search and half the size. It needs a `title:` header in each document, our own
  remark plugin for the outside links, and Astro says that Bun has rough edges. It failed on the unchanged documents.
- **VitePress.** It fails on the unchanged documents (Constraints and evidence).
- **A hosted service (Mintlify or GitBook).** There is no build work, but the site is on the service of another company,
  and a product project gains nothing from it.
- **Material for MkDocs, Zensical, Fumadocs, and Rspress.** The first two are Python, and Material ends on 2027-05-05.
  The other two need an app of our own around the documents.
- **A step of `document`.** It couples two concerns, and a project with documents from before the skill could not
  publish them alone. ADR-0116 says that `document` writes each document once and makes one local commit.
- **A command of the engine that bundles the site tool.** The engine pins two packages, and the CI of each product
  project would need the engine.
- **The site packages in `engine/package.json`.** Each lane worktree installs the engine with the worktree setup, so it
  would install the site packages too, and a user installation would carry them. The maintainer's anti-goal in the
  spec is that no lane worktree installs the site packages at its setup.

## Consequences

- A reader gets each document of a published home as a page with a sidebar, a table of contents, and its diagrams, and a
  new document needs no edit of the site.
- Each product project that runs the skill gets about 1,260 packages in `website/node_modules` after a local build, and
  a manifest and a lockfile that no step updates. A pin ages until a person changes it.
- The gate checks no build of the site, no deploy, and no match between `website/` and `site.md`. A document with a broken
  link lands, and the site fails after the landing. The failure shows only in GitHub Actions.
- A change of `bunFloor` needs a hand edit of the `bun-version` of `docs.yml`.
- The gate of a product project can refuse the new files, for example a check of each tracked TypeScript file or of each
  package. The skill cannot know that gate, and its report names the new files.
- A private repository on a plan with no Pages fails the deploy job. The build job and the local build still work.
- The build on a Linux runner and the deploy are not probed. The first run of `docs.yml` after the repository is public
  is the first proof.

## Reconsider when

- A later Docusaurus 3.x release or a Bun release changes how a build runs under Bun, or Docusaurus drops the hook
  `markdown.hooks.onBrokenMarkdownLinks`.
- The documents need search. The community plugin `@easyops-cn/docusaurus-search-local` is the first candidate.
- A product project needs versions of the documentation, translations, a blog, or a look of its own.
- TypeScript starts to match files of a `node_modules` folder with a `**` include, so `website/node_modules` enters the
  type check.
- The maintainers want a gate check that builds the site or compares `website/` with `site.md`.
- A product project needs homes outside `docs/`.

# External-facts lookup

The procedure that `specify`, `plan`, `bug`, `hotfix`, and `chore` cite to settle the
library, platform, and vendor facts a design, a plan, or a root cause depends on. Run it before
the step writes its document.

## When

Look up a fact when a claim depends on behavior the repo's code cannot show: a library API or its
behavior, a change between versions, a platform default, or a vendor service. Look up the specific
facts the change depends on, not the library in general. Work that depends on no such behavior
skips the lookup.

## Which version

Read the fact for the installed version; `AGENTS.md` of the project says how.

Many pins are ranges (`fastapi>=0.109.0`), so the pin is the fallback only when nothing is
installed. Read the latest release only when the change proposes an upgrade; then read both
versions and the changelog between them.

## Sources, in order

1. The docs the installed package ships, when `AGENTS.md` names them.
2. Context7: `resolve-library-id`, then `query-docs` with the library ID of the installed version,
   `/<org>/<project>/<version>`. When `resolve-library-id` lists no such version, go to source 3.
3. The selected host's web search and fetch tools on primary sources: the official docs, changelogs, release notes,
   and the source repository.

Discover deferred Context7 and web tools through the selected [host operations](hosts/entry.md)
before their first call; use only the tools actually available on that host.

## Record

Put every settled fact in an `## External facts` section of the document the step writes — the
spec, the root-cause report, the plan, or the `## External facts` issue comment of a dependency
bump — one line per fact:

```
- <package> <version> (installed|pinned|latest): <fact>. Source: <Context7 library id | URL | path>
```

`(installed)` marks a fact read from docs for the installed version; a fact read from the latest
docs is `(latest)`.

The next step reads that section and looks up only the facts it adds.

## Unsettled facts

When no lookup tool is available or the sources disagree, the fact stays an open risk:
`specify` names it under "Flag unverified premises as risks", and `plan` carries it under "Carry
unverified premises as risks". The step goes on without the fact.

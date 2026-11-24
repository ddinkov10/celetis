# The engine of a release installs from npm

## Date

2026-11-24

## Related

- [Issue #251](https://github.com/ddinkov10/celetis/issues/251): the intent and the spec (the body of the issue,
  `Spec: 2026-11-23`). It names "Risk 1" to "Risk 6", "Assumption A1", and the probe of "Design probes".
- [The plan of #251](https://github.com/ddinkov10/celetis/issues/251#issuecomment-7113251504): the tasks, the probes of
  the external facts, and the steps of the maintainer after the landing.
- [Issue #195](https://github.com/ddinkov10/celetis/issues/195): finding F21, which Assumption A1 narrows.
- [ADR-0118](0118-versioned-releases-and-a-pin-for-each-machine.md): the release tags, the ref of a part, and
  `celetis update --to <ref>` stay. The plugin parts keep their Git source and their refs, also at a release tag. The
  contract pair check stays, and this record raises no contract version.
- [ADR-0090](0090-a-contract-version-replaces-the-same-revision-rule.md) stays: the pair check runs on the package
  target before the question.
- [ADR-0115](0115-the-engine-pins-its-packages-in-a-lockfile.md) stays: a package install runs the same frozen install
  with `--ignore-scripts` in its staging folder. Its Consequence "`installEngine` finds the complete clone" stays true
  for a Git engine.
- [ADR-0091](0091-the-engine-is-one-name-and-the-folder-engine.md) and
  [ADR-0092](0092-the-check-for-a-removed-version-folder-reads-the-engine-entry.md) each name, in "Reconsider when", a
  release channel of #251 that installs the engine in another form than a Git clone. This record is that channel. The
  check of a removed version folder reads `engine/celetis`, which a package folder also holds, so it stays.
- [ADR-0111](0111-a-security-review-runs-security-audit-on-a-trust-boundary-change.md): the three files of
  `engine/lib/package/` are trust files, so the change needs its security review.
- [ADR-0029](0029-the-repository-keeps-no-tests.md): the build of this change added no tracked test.
- [ADR-0135](0135-github-actions-runs-only-the-documentation-deploy.md): its allowlist stays, and the new workflow
  fits it.

## Supersedes

- [Versioned releases and a pin for each machine](0118-versioned-releases-and-a-pin-for-each-machine.md), in part:
  - In "Decision", item 2, the engine row of the table: "the commit of the newest release tag of the source" is now
    `dist-tags.latest` of the package `celetis` on npm. In the same item, the words "or the commit of the release
    tag" of the third column hold for a Git part only: for the engine, a release form names a version on npm.
  - In "Decision", item 2, for the engine of a release only: "each part reads the tags of its own source" and "A part
    that follows a release on a source with no release tag is an `error` part". The engine of a release reads the
    registry of npm, and a package whose version is absent from the registry is the error. Both sentences still hold
    for each plugin part and for a Git engine.
  - In "Decision", item 3, "The engine at a tag", these sentences: "A version folder at a release tag is a detached
    clone at the commit of the tag."; "It holds the local tag, and no second file records the tag."; "The engine reads
    its ref from that folder: a release only when the local tag peels to `HEAD` and the plugin manifest names the
    version."; "The identity check compares the peeled commit of the tag on the source where it compared the head of a
    branch."; and "`celetis install` accepts a checkout on a branch or at a release tag, and refuses a detached
    checkout at another commit." The two last sentences of the item stay: `celetis --version` prints
    `<X.Y.Z> (<full revision>)` for a release, and the engine reads its release from the plugin manifest of its own
    folder.
  - In "Decision", item 4, for the engine of a release only: "On a source, `<ref>` names only the branch
    `refs/heads/<ref>` or the tag `refs/tags/<ref>`, and a release form names only the tag". For the engine,
    `--to v<X.Y.Z>` names a version on npm. The sentence still holds for each plugin part and for a Git engine.
  - In "Decision", item 4, the sentence "Before the question, the update checks the ref on each source, reads each
    target, and runs the pair check", for the engine only: a release form is read from the registry and checked against
    the tag of the fixed source. The sentence "a version folder has the name of its revision and holds one ref" stays
    true for a Git engine. A package folder holds its release.
  - In "Decision", item 5, the sentence "The engine installs the target, and its version folder holds the ref." A
    package folder holds a stamp and a record, and a Git folder holds the branch.
  - In "Consequences", the sentence "Publication through a package manager, GitHub Release objects, and release notes
    stay with #251, which can build on these tags." The package is published to npm. GitHub Release objects and release
    notes stay open.
- [One Celetis program for both hosts](0042-one-celetis-program-for-both-hosts.md), in part: in "The layout", the
  sentence "`<base>/.local/share/celetis/versions/<revision>/` is a Git clone of the source of the program, on its
  branch, at that revision" (as ADR-0118 changed it to "on a branch, or at a release tag"), and the sentence
  "`celetis install` installs the revision of the clean checkout that it runs from". A version folder is a Git clone on
  a branch, or an unpacked package. `celetis install` also installs the release that it runs from, when it runs from a
  package.
- [The engine is one name, and its folder is `engine/`](0091-the-engine-is-one-name-and-the-folder-engine.md), in part:
  in "Decision", item 2, the sentence "The version folder stays a full clone at
  `<base>/.local/share/celetis/versions/<revision>/`, and `celetis root` prints it." The path and `celetis root` stay.
  The folder is a full clone only for a Git engine.
- [GitHub Actions runs only the documentation deploy of this repository](0135-github-actions-runs-only-the-documentation-deploy.md),
  in part: in "Decision", item 3, the sentence "It is the only enabled workflow that a branch or a tag holds." The
  workflow `release.yml` of a release tag is a second one, so the title of that record is also superseded: the
  documentation deploy is not the only workflow that runs.

## Context

A machine with no Git credentials for this repository must install and update Celetis with published commands. The
engine installed only as a Git clone, and it had no published package. A probe of #251 showed that a package of the
engine runs through `bunx`, and that the Git identity of the engine is what stops it: `celetis --version` and
`celetis install` ended with exit 6 and a Git error, and made no version folder. The maintainer asked for "how the big
players do it", with the CLI and the plugins distributed separately, and chose an npm package that installs into the
version folders. The repository is public, so no credential is needed to read its tags.

## Constraints and evidence

The build ran on macOS with Bun 1.4.4 and npm 11.20.0, with a local registry, a local Git server, private homes, and
Claude Code 2.1.329 with a private configuration. The plan of #251 holds the probes of the external facts.

- `npm pack` of this tree with `files: ["engine", "plugins/celetis"]` gave 339 entries. Each entry has typeflag `0`, an
  empty ustar prefix, and a path of at most 89 bytes. The modes are `000644` and one `000755` (`engine/celetis`).
- `bun install --frozen-lockfile --production --ignore-scripts` in `engine/` of an unpacked package exits 0, and
  `engine/celetis --help` then exits 0.
- `Bun.Archive.extract` of Bun 1.4.4 refuses no unsafe entry. It rewrites `package/../x` and an absolute path into the
  target folder, and it skips hard links, devices, and FIFOs. `files()` lists only regular files. So it cannot give a
  refusal, and the engine has its own reader (`readArchive` of `engine/lib/package/archive.ts`). The one use of
  `Bun.Archive` is `scripts/package.ts`, which unpacks the `git archive` of the maintainer's own tag.
- `gunzipSync` with `maxOutputLength` throws `ERR_BUFFER_TOO_LARGE` past the limit, so a small tarball cannot expand
  without a bound.
- `claude` marketplace entries have the source types relative path, `github`, `url`, `git-subdir`, `npm`, `archive`, and
  `command`, and an `npm` source fails to load (Claude Code 2.1.329,
  [the marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md)). Codex takes a local
  path or a Git URL as a marketplace source, and npm is no marketplace source
  ([the Codex plugin documents](https://developers.openai.com/codex/plugins/build)). So the plugins stay on Git.
- Trusted publishing needs npm 11.5.1 or later, Node 22.14.0 or later, `id-token: write`, a GitHub-hosted runner, a
  publisher configured on npmjs.com, and a `repository.url` that matches the repository
  ([the npm documents](https://docs.npmjs.com/trusted-publishers)). A public package from a public repository gets
  provenance automatically
  ([the provenance documents](https://docs.npmjs.com/generating-provenance-statements)). The documents do not say that a
  package that does not exist yet can use trusted publishing for its first publish. A new publisher configuration
  expires after 2 days with no successful publish.
- `GET https://registry.npmjs.org/celetis` answered 404 on 2026-11-23, and `ddinkov10/celetis` was public with the release
  tag `v0.0.1`.
- On 2026-11-24, `actions/permissions/selected-actions` of the repository answered `github_owned_allowed: true`,
  `verified_allowed: false`, and `patterns_allowed: ["oven-sh/setup-bun@*"]`. `release.yml` uses
  `actions/checkout`, `actions/setup-node`, and `oven-sh/setup-bun`, each at a full commit SHA. The first two are
  GitHub-owned, and the ref of the third matches the pattern. So the workflow needs no action outside the allowlist
  of ADR-0135, item 1.
- The search of the record store for the literals of this change found other matches that stay out of "Supersedes".
  The wordings searched were "detached", "release tag", "newest release", "clone of the source", "Git clone",
  "version folder", "clean checkout", "revision of the program", "private repository", "is private", "release step",
  "package manager", "npm", "`--version`", and "workflow" with "only", "tag", or "enabled". ADR-0012, ADR-0020, and
  ADR-0122 name a private repository or a missing release step as evidence of their dates. ADR-0118 and ADR-0135
  already supersede their clauses on those two points. ADR-0104, ADR-0115, and ADR-0125 name the version folder or the
  Git-based install in a sentence that stays true. ADR-0091 and ADR-0092 hold the Git clone in "Constraints and
  evidence" and in "Reconsider when". ADR-0090 holds a rule that this record keeps.
- **Limits of the evidence.**
  - No run published to the real npm registry, and no run used Linux or Windows. The real OIDC publish, the
    provenance, and the first publish of a new package run only after the landing.
  - The read of the release tag uses no Git configuration file. So a Git value of the machine, for example
    `http.proxy`, does not apply to it. On Git for Windows, the read can lose the TLS settings of the system file. No
    Windows run checked this.
  - An actor who controls `PATH` can replace `git`. So the tag check is no defense against a compromised environment.
  - It is unobserved that `actions/checkout` makes the local ref `refs/tags/v<X.Y.Z>` on a tag push, and that the tree is
    clean after the gate in CI. `scripts/package.ts` refuses otherwise, so the job fails and changes nothing.
  - On 2026-11-24, the final review of #251 read the real registry: `GET https://registry.npmjs.org/celetis` answered
    404, so the read of the document returns no package. The abbreviated document of `zod` had no content encoding, and
    its version entries held `name`, `version`, and `dist.integrity`. With the name changed to `celetis`, it passed
    `parseDocument`, and `download` checked the sha512 of its real tarball. The integrity of a `celetis` version stays
    unobserved until the first publish. The engine refuses a version entry without a sha512 integrity.
  - The probes did not include the Codex plugin part of an update.

## Decision

1. **Two engine kinds.** The ref of a machine selects the source of its engine. A branch selects a Git clone, as before.
   A release selects an unpacked npm package with no `.git`. `EngineSource` of
   `engine/lib/install/installation.ts` is the union of `GitEngine` (source, branch, revision) and `PackageEngine`
   (version, revision, integrity). The state "a Git clone at a release tag" is gone for the engine: `celetis install`
   from a checkout accepts only a branch, and a version folder at a release tag gets an `error` part that names
   `bunx celetis@latest install`. There is no migration. The plugin parts keep their Git source and refs.
2. **The package.** The package is `celetis`, public, with the version of the release, `"license": "UNLICENSED"`, no
   lifecycle script, and the exact dependency pins of `engine/package.json`. It holds `engine/` and `plugins/celetis/`,
   because OpenCode reads its plugin text from the engine root. **Assumption A1:** this narrows finding F21 of #195,
   which listed only the engine. `scripts/package.ts` generates the root `package.json` and `engine/release.json`, and
   neither is a tracked file.
3. **The identity.** `engine/release.json` is the stamp: `version`, `revision` (the release commit), and `source`. The
   stamp cannot hold the hash of its own tarball, so the install writes `.celetis-package.json` in the version folder,
   outside the package files, with `version`, `revision`, and `integrity`. A package folder is valid only when its name
   equals the revision of its stamp, its stamp version equals the plugin manifest version, and its record equals its
   stamp. The check reads the version of each plugin manifest from the archive, so a package whose manifest names
   another version gets an `error` part before the question. `engineRevision` reads the stamp when the root has no `.git` entry.
4. **The one source.** The fixed source is `releaseSource` of `engine/lib/release/release.ts`, and the stamp must name it.
   The registry is `BUN_CONFIG_REGISTRY`, else `https://registry.npmjs.org`. No other environment value or stamp field
   changes either.
5. **The trust boundary.** The registry answer and the tarball are external input, and each parse comes before any write
   to a version folder. `engine/lib/package/registry.ts`, `archive.ts`, and `package.ts` are trust files.
   - The package document must have the name `celetis`, exact `X.Y.Z` versions, an https tarball URL (or one on the
     registry origin), and a sha512 integrity. A fetch follows no redirect, takes no content encoding, and has a size
     limit and a timeout.
   - `readArchive` accepts only regular files in a ustar archive, under `package/`, with the modes 644 and 755, a limit
     on the entry count and the unpacked size, and a safe path: no `.` or `..` segment, no `.git`, no Windows device
     name, no repeat that a case-insensitive file system folds, and no entry named as the install record.
   - The stamp must match Git: `refs/tags/v<version>` on `releaseSource` must peel to the revision of the stamp. The
     read uses `unattended` of `engine/lib/process/git.ts`: no Git configuration file, no inherited `GIT_` variable
     except the two TLS ones, no repository discovery, and no prompt. A mismatch or a failed read changes nothing.
   - A client check of the npm provenance attestation is out of scope.
   - A failed check leaves the installed engine and the launcher unchanged.
6. **The bootstrap and the update.** `bunx celetis@latest install` runs from a package, reads its stamp, and installs
   that version through the same verified path as an update. The `bunx` cache is never the installed engine. For a
   release machine, `celetis update` targets `dist-tags.latest`, and `celetis update --to v<X.Y.Z>` targets that
   version, in either direction. The question names the exact version, revision, and integrity. The apply reads the
   package document again and refuses a changed integrity, verifies the download, unpacks into a staging folder, runs the
   frozen install with `--ignore-scripts`, writes the record, checks the identity, and renames into
   `versions/<revision>`. No code of a target runs before the person confirms it.
7. **The release workflow.** `.github/workflows/release.yml` runs on a pushed tag `v<X.Y.Z>`. One job checks out the tag,
   runs the verify gate, and runs `scripts/package.ts`. The script packs the package with `npm pack` and reads that
   tarball with `readArchive`, so a tracked name that the install refuses stops the job before any publish. The job runs
   `npm publish` on that tarball through trusted publishing only when the last line of the script is
   `package: publish`. When npm already holds the version, the script reads the stamp of the published tarball: the same revision prints `package: published` and publishes nothing, also after a publish by hand,
   and another revision fails the job with exit 3. A failed publish leaves the tag, and `latest` stays at the older
   version. The workflow needs no action outside the allowlist of ADR-0135.
8. **The documents.** `plugins/celetis/README.md` gives the first install and the updates for both paths.
   `scripts/README.md`, "The release", gives the package step, the rerun, and the first publish by hand.
   `AGENTS.md` and `engine/board/README.md`, "The trust boundary", name the three trust files.

## Constitution

Read: `CONSTITUTION.md`, amended 2026-11-12.

- Serves: 1 Intent to release: Celetis ships as a published release to each machine.
- Serves: 3 Verified landing: the release workflow runs the verify gate on the tag that it publishes.
- Hard limits and non-goals: none touched. A person still confirms the exact target of an update.

## Alternatives considered

- **A plain global npm package.** It is the least code, but npm replaces files under a running daemon, and the engine
  loses its confirmed update. The maintainer chose the version folders.
- **Native binaries in platform packages.** This is the pattern of Codex, Biome, and Claude Code. The engine starts
  itself through Bun at about 25 call sites, so it needs a rewrite first. This record does not block it later.
- **`Bun.Archive.extract` for the unpack.** It refuses no unsafe entry (Constraints and evidence).
- **A plugin package on npm.** Claude Code fails to load an `npm` marketplace source, and Codex reads its catalog from
  Git.
- **A Git clone at a release tag, kept as the second engine kind.** It needs the Git read of a tag on a machine that
  can have no Git credentials, and the package gives the same release with one source of truth.
- **No tag check.** The stamp alone says what the package is. The check ties the stamp of the package to a tag of the public
  source, so a stamp cannot name a commit that no release has.
- **A separate job with the publish identity.** The plan mandates one job (see Consequences).
- **Homebrew, WinGet, or another registry, and a separate version number for the CLI and the plugins.** Non-goals of
  the spec.

## Consequences

- A machine with Bun and no GitHub credentials installs a release with one command and moves with a confirmed
  `celetis update`. A machine on a branch keeps its Git path.
- The three files of `engine/lib/package/` join the trust files, with their security review (ADR-0111).
- The publish identity (`id-token: write`) reaches each step of the one job: the engine packages, Biome, TypeScript,
  `actionlint`, and Claude Code of the gate. The installs are exact pins with `--ignore-scripts` and a hash-checked
  `actionlint`, but a hostile publish on npm is permanent. Node, which runs `npm publish`, is the major version 24 of
  `actions/setup-node`, not an exact pin. Each action ref is a full commit SHA, so a moved tag of an
  action does not change the job. A verify job with no `id-token` and a publish job that needs it would narrow this.
- A plugin tag can be newer than `latest` of npm until the job ends. The contract pair check stops an incompatible pair
  with no change.
- The first publish can need a hand step, and a version that is published by hand has no provenance. `scripts/README.md`
  gives the commands.
- Until the maintainer holds the npm name `celetis`, any npm user can register it. Then `bunx celetis@latest install`
  runs the code of that package before any check, and the update clients and `published` of `scripts/package.ts` accept
  its version of a public tag when it carries the real stamp. The window ends when the maintainer holds the name; the
  first publish, soon after the landing, takes it.
- A tag push of a person with write access runs `release.yml`. The trusted publisher on npm names the workflow file, so
  a workflow of another name cannot publish.

## Reconsider when

- npm cannot use a trusted publisher for the first publish of a new package, and the hand publish becomes routine.
- The registry serves no `dist.integrity`, or serves another form of it.
- The maintainer wants a native binary, or a client check of the provenance attestation.
- A second maintainer or a hostile step of the gate makes the one-job publish identity too wide.
- Git for Windows, or a proxy of a machine, fails the release-tag read.
- A host adds an npm marketplace source, so that the plugins can ship in the package too.

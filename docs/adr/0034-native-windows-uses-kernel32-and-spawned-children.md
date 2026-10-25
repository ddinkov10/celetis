# Native Windows uses kernel32 and spawned children

## Date

2026-10-26

## Related

- [Issue #125](https://github.com/ddinkov10/celetis/issues/125): the `## Root cause` spec, its
  decisions, and the plan.
- [ADR-0026](0026-the-board-resolves-executables-with-libc.md),
  [ADR-0028](0028-terminal-confirmed-native-plugin-updates.md),
  [ADR-0030](0030-the-installed-plugin-owns-the-entrypoint.md), and
  [ADR-0032](0032-shared-configuration-operation-snapshots.md).
- `engine/lib/windows.ts`, `engine/lib/update-lock.ts`, `engine/lib/process-identity.ts`,
  `engine/lib/process.ts`, `engine/lib/parallel.ts`, `engine/board/realpath.ts`,
  `engine/board/server.ts`, `scripts/install-tools.ts`, and `scripts/build.ts`.
- The [LockFileEx](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex),
  [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes),
  [job limit](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information),
  [pipeline chain operator](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pipeline_chain_operators),
  and [detached child](https://nodejs.org/api/child_process.html#optionsdetached) references.

## Supersedes

Only these clauses change. Accepted records keep their historical text and evidence.

- ADR-0026, Decision: "Use one unconditional wrapper of POSIX libc realpath in
  `board/realpath.ts`". The board now has one resolver for each platform: libc `realpath` on
  macOS and Linux, and Bun `fs.promises.realpath` on Windows.
- ADR-0032, Decision: "Replace the initial process before configuration reads", on Windows
  only. There, the launcher and the session starter spawn their target, wait, and exit with its
  status. `execve` stays on macOS and Linux.

The other clauses stay. ADR-0026 keeps the lazy binding, the NUL refusal, native errors, no
second resolver after a permission error, and the checks of `board/config.ts`. ADR-0028 keeps
terminal confirmation, updater-only serialization, open sessions, the deadline, and child
cleanup. ADR-0030 keeps the runtime basenames and the process and lock rules. ADR-0032 keeps one
operation that the named command creates after its start.

## Context

Each Windows entry stopped at its first POSIX-only interface. Each child Bun got
`--config=/dev/null`, which Bun on Windows refuses with `EINVAL`. The update lock bound libc
`flock` and `execve` when its module loaded, so each launcher command stopped. The board bound
libc `realpath`. `childEnv` read `PATH`, but PowerShell and herdr panes give `Path`. The board
wrote a POSIX Run line that Windows PowerShell 5.1 cannot parse. The runner and `next-step` read
lock owners with `ps -o`, which Windows does not have. Detached update children lived on after
the updater. The goal was each `bin/celetis.ts` command, the plugin update, the board, a board
Run, and the verify gate on native Windows, with macOS and Linux unchanged. The maintainer
decided that a board Run opens a herdr tab as on macOS, that update helpers stop when an update
stops, and that the board writes PowerShell commands.

## Constraints and evidence

The checks ran on Windows 11 Pro 10.0.26200 with Bun 1.4.4 and the pinned Bun 1.4.2, Claude
Code 2.1.310, Windows PowerShell 5.1, and herdr 0.9.2-preview. The probes stayed outside the
repository (ADR-0029).

- Bun 1.4.4 on Windows defines `process.execve`, and the call throws. Node documents that the
  call is not available on Windows. A Windows process cannot replace its own program.
- `LockFileEx` needs a handle with read or write access. Mode `'a'` fails with error 5, and
  `'a+'` works. Two shared locks succeed; an exclusive lock over a shared lock fails with
  error 33. A child that inherits the handle gets no access to the locked region. The lock goes
  when the process ends or closes the file.
- `bun.exe` exports `uv_get_osfhandle`, which gives the Windows handle of a descriptor. It is part
  of the libuv ABI that Node and Bun export for native addons. No document states it.
- `GetLastError` in a separate FFI call gave the expected errors 33, 5, and 87 on Bun 1.4.2 and
  1.4.4. Bun does not document that the value stays between two FFI calls.
- No documented Windows API gives the command line of another process.
  `NtQueryInformationProcess` is internal and can change. `GetProcessTimes` gives the creation
  `FILETIME`. `OpenProcess` with `PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE`, then
  `WaitForSingleObject(handle, 0)`, gives 258 for a live process and 0 for an ended one.
- An attached child ends when its parent is killed. A detached child gets its own console and
  lives on. The job object of libuv allows silent breakaway, so the node.exe of a `.cmd` shim
  (npm `claude.cmd` or `codex.cmd`) lived on after a killed updater while the lock was free.
- Windows has no POSIX mode 0111. Bun `realpath` on Windows resolved a file and gave `ENOENT` for
  a missing file.
- With no shell in its config, herdr 0.9.2-preview starts a pane as
  `powershell.exe -NoExit -Command …`. PowerShell 5.1 refuses `&&` and the POSIX quoted words.
  PowerShell reads `'`, U+2018, U+2019, U+201A, and U+201B as single quotes. `$LASTEXITCODE`
  keeps an old value when a call fails before a process starts; `$?` does not.
- PowerShell 5.1 writes the native command line itself. It drops an empty argument, and it
  passes an argument with `"`, or with a space and a trailing `\`, wrongly. A `.cmd` or `.bat`
  first item parses `&`, `^`, and `%` again.
- The pinned actionlint has a Windows `.zip`. The `tar` of Git Bash cannot read it;
  `%SystemRoot%\System32\tar.exe` can. `Bun.which` finds no file with no extension, such as a
  `bin/tsc` link. Bun 1.4.2 on Windows builds the same bytes and reports each mode as `666`.

## Decision

Select each Windows path with `process.platform === 'win32'`. Never select a primitive after a
failed call or by the presence of `process.execve`. Bind no native library when a module loads.
`engine/lib/windows.ts` binds `kernel32.dll` on its first call, and `uv_get_osfhandle` of
`process.execPath` on the first lock only. A failed bind stops the operation, with no fallback.

- **The update lock.** On Windows, `LockFileEx` locks 1 byte at offset 0 with no wait: shared
  for a reader, exclusive for the updater. Error 33 means busy; each other error stops. Lock
  files open with `'a+'` on each platform. The updater spawns each child attached and hidden,
  with no `CELETIS_UPDATE_FD` and no inherited lock descriptor. Right after `spawn`, it puts the
  child in a job object of its own, with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` and no breakaway.
  A stop terminates and closes the job. When the updater ends, the system closes the job, and
  the job ends the child tree with the updater.
- **Spawn and wait.** On Windows, the launcher and the session starter spawn their target with
  the same stdio and environment, ignore `SIGINT` and `SIGBREAK` while it runs, and exit with
  its status. So a Ctrl+C does not end the waiting parent, whose end would also end the child.
  The script process, not the launcher, writes each owner PID, as after `execve`.
- **Process identity.** On Windows, a runner or session row matches by PID and creation
  `FILETIME`. A process cannot change its program, so the pair identifies the writer. The land
  lock holds only a PID. `next-step` accepts a live landing when that PID runs and was created
  at or before the mtime of the lock file: a reused PID belongs to a process created later.
  An `OpenProcess` refusal reads as not running. A `GetProcessTimes` failure after an open
  stops. macOS and Linux keep `ps -p <pid> -o lstart=|stat=|command=` and the basename tests.
- **The board.** On Windows, `realpath` is Bun `fs.promises.realpath`; macOS and Linux keep
  libc. The Run and Resume line is for Windows PowerShell 5.1, the default pane shell of herdr:
  `$env:NAME='value'; …; & 'item' … <n>; if ($?) { exit }`. The quote doubles each of the five
  single-quote characters. The `$env:` pairs come from `childEnv({})` and appear only when the
  first item is `process.execPath`. `$?` gives the meaning of POSIX `&& exit`: the pane stays
  after a failed start, also when no process started.
- **Child Bun and `PATH`.** Each child Bun gets `--config=` with `os.devNull`. On Windows only,
  `childEnv` folds each other case of `PATH` into `PATH`, and an existing `PATH` value wins.
- **The verify gate.** On Windows, `scripts/install-tools.ts` extracts the actionlint `.zip`
  with `%SystemRoot%\System32\tar.exe`. No platform gets `tsc` or `biome` links; the gate finds
  them beside actionlint. `scripts/build.ts --check` compares bytes, and modes on macOS and Linux.
  `engine/lib/parallel.ts` spawns attached, hidden workers on Windows and stops them with
  `child.kill`. The Linux CI job stays the authority.

## Alternatives considered

- **WSL for the runtime or the gate:** herdr, its panes, and Claude run natively. The WSL Ubuntu
  24.04 of the check machine had no `gh` and no checkout. A gate or a landing there needs a new
  signed-in `gh`, which breaks the host-check rule of `AGENTS.md`. A private Linux Bun was added
  later for one POSIX probe only. The spec chose WSL for the gate of #125; the plan ran the gate
  natively for these reasons.
- **Test `process.execve`, or try libc and fall back:** Bun defines `execve` on Windows, and the
  call throws. A fallback after a failure gives one boundary two implementations (ADR-0026).
- **`NtQueryInformationProcess`, WMI, or `Get-CimInstance` for the command line:** the first is
  internal. The others add a process and a shell dependency to each lock read.
- **Detached update children, or only `child.kill`:** a detached child lives on after the
  updater. `child.kill` ends only the direct child, and the node.exe of a `.cmd` shim breaks
  away from the job of libuv.
- **A suspended spawn to close the assignment window:** `node:child_process` has no
  `CREATE_SUSPENDED`. `CreateProcessW` through FFI would reimplement spawn and its stdio.
- **`CreateFileW` handles for the lock:** this avoids the undocumented export, but it adds a
  second open path and handle ownership. It stays the design for the case that the export goes.
- **`; if ($LASTEXITCODE -eq 0) { exit }`, or the `&&` of PowerShell 7:** the first can close
  the pane after a failed start. The second does not parse in 5.1, the default pane shell.
- **A POSIX pane shell in the herdr config:** this is a machine setting outside the plugin, and
  the default pane shell stays PowerShell.

## Consequences

The launcher, the plugin update, the board, the runner, and the verify gate get a native Windows
path. macOS and Linux keep their behavior, apart from the lock mode `'a+'` and the removed
`tsc` and `biome` links. From Git Bash on Windows, the documented command form loads the
launcher. A PowerShell form of the commands for people, and its landing rule, are not part of
this decision.

The cost is a second native ABI: kernel32 struct offsets, handle ownership, and Windows error
numbers. These risks stay:

- `uv_get_osfhandle` is undocumented. A missing export stops the first lock with a clear error.
- A process that an update child starts before `AssignProcessToJobObject` is not in the job. The
  window is from microseconds to a few milliseconds. A descendant that asks for
  `CREATE_BREAKAWAY_FROM_JOB` gets access denied.
- A later Bun can reset the last error between two FFI calls. A busy lock then reads as an error.
- Access denied reads as not running. A process of another account, or a protected process,
  cannot be a lock owner of this account. A stale lock PID that such a process reuses thus
  reads as stale, not as an error.
- The land-lock test compares a file-system mtime with the process clock. A backward clock step,
  the clock of an SMB server, or the 2-second steps of FAT32 can make a live landing read as
  absent.
- A board config author must not use an empty item, an item with `"` or with a space and a
  trailing `\`, or a `.cmd` or `.bat` first item with `&`, `^`, or `%`. The Celetis items have
  none of these forms. The `$env:` values stay in the pane shell after a failed Run.

"Acceptance status" in `docs/celetis-flow.md` holds the Windows observations and the open checks.

## Reconsider when

- Bun documents a way to get the Windows handle of a descriptor, or `bun.exe` stops exporting
  `uv_get_osfhandle`. Then use that way or `CreateFileW`.
- Bun or `node:child_process` can spawn a child suspended or into a job object. Then close the
  assignment window.
- Bun documents, or breaks, the last error across FFI calls.
- A documented Windows API gives the command line of another process.
- herdr changes its default Windows pane shell, or PowerShell 7 becomes that shell.
- Bun on Windows reports file modes that the build check can compare.
- The supported Windows versions or architectures change.

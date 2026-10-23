# The board resolves executables with libc

## Date

2026-10-22

## Related

- ddinkov10/celetis#96.
- ADR-0020 and ADR-0025: the board's generic producer boundary and Bun runtime.
- `board/config.ts`, `board/realpath.ts`, and `board/realpath.test.ts`.
- The [realpath manual](https://man7.org/linux/man-pages/man3/realpath.3.html) and
  [Bun FFI reference](https://bun.sh/docs/runtime/ffi).

## Context

The board accepts a relative regular executable in the main checkout. Its trust rules require
execute permission. They require no source read permission. A valid native producer can have mode
0111. The TypeScript cutover must keep that producer valid for data, Run and Resume, including a
symlink whose canonical target stays in the main checkout.

Bun 1.4.2's realpath APIs add a read condition on macOS. They report EACCES for this file, so the
board reports that the producer does not exist. Accepting this result would change the contract.

## Constraints and evidence

The 2026-10-22 checks used private Bun 1.4.2 on macOS arm64 and Node 26.12.0 for the actual
`config.mjs` of the board from source pin `4fe5554c4c09ec522aae410afde6a298787a04a9`.

- The original config on Node accepts the mode-0111 producer and its symlink. Its returned data,
  Run and Resume lists name the canonical target. Reading the source fails EACCES; execution exits 0.
- Five standard Bun alternatives fail with EACCES: promise realpath, callback realpath, callback
  realpath.native, realpathSync and realpathSync.native. Direct execution still exits 0.
- A pinned-runtime prototype of libc `realpath(path, NULL)` resolves the execute-only file and
  its symlink, returns ENOENT for a missing path, and leaves source reads denied. The wrapper
  copies the returned CString before it calls libc free.
- The exact mode-0111 data/Run/Resume regression failed on correction base `b62e1d2` before the
  production correction. `board/realpath.test.ts` keeps that real filesystem and process check.
- The repository already uses Bun FFI for a native lock primitive. Its library selection pattern
  covers Darwin, glibc and musl. This check proves macOS locally; the Linux/macOS CI process subset
  owns execution of the same producer regression on both operating systems.
- The Bun floor check must precede stdin, product and Git work. Importing the native path module
  must not load a library. A library is bound only when canonicalization is first requested.

## Decision

Use one unconditional wrapper of POSIX libc realpath in `board/realpath.ts` for the board's
configured executable canonicalization. Use the existing supported-platform library selection
pattern. Let libc allocate the result with a NULL output pointer, copy its string, and free the
allocation in finally. Preserve native errno on failure. Refuse NUL before the C call.

Keep every later canonical main/lane boundary, regular-file, executable and control-character
check in `board/config.ts`. Resolve through this primitive on every call; select no alternate
resolver after a permission error. Keep runtime-declaration inspection separate: it must not
add a read condition to an already validated native executable.

## Alternatives considered

- **The five standard Bun APIs:** each failed the actual mode-0111 case on the pinned runtime.
- **Require readable producers or weaken canonical validation:** each changes a trust contract.
- **Use another resolver only after EACCES:** this gives path validation two implementations.
- **Resolve symlinks in TypeScript:** this duplicates a general operating-system path resolver.
- **Use an external command or shell helper:** this adds process and platform dependencies to a
  boundary that must work with the selected Bun and without obsolete compatibility programs.
- **Bundle a native addon or raise the Bun floor:** an addon adds a delivery/build dependency;
  no newer Bun floor was approved or proved to solve this case on both operating systems.

## Consequences

An execute-only native producer keeps the original contract. Canonicalization uses the operating
system's resolver, with no file-content read and no permission-error resolution fallback. The
board still validates the actual project executable before binding its declared Bun runtime.

The cost is a C ABI boundary, allocation ownership, platform library names and native errno.
Bun describes FFI as experimental. The wrapper stays small, lazy and strict; a missing supported
system primitive stops the operation. It adds no package install, compiler step or resolver
algorithm. Real 0111, symlink and error cases run in the Linux/macOS process subset and the full
suite. Local macOS proof does not claim that Linux or a live host/browser check ran.

## Reconsider when

- The supported Bun floor resolves mode-0111 files and symlinks through one standard API on both
  macOS and Linux, with the same canonical boundary and error behavior. Prove that regression
  before removing the native wrapper.
- The supported platform set changes, or a supported system loses the required libc symbols.
- Bun FFI changes its pointer, CString ownership or calling convention contract.

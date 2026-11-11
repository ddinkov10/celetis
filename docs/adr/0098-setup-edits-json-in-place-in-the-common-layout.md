# Setup edits JSON in place in the common layout

## Date

2026-11-11

## Related

- [Issue #292](https://github.com/ddinkov10/celetis/issues/292): the spec (the body of the issue), and the
  [plan comment](https://github.com/ddinkov10/celetis/issues/292#issuecomment-6795385346). In this record,
  "Design probes", "Approaches", "Prior art", and "Limits" name parts of the spec, and "V<k>", "S<k>", and "R<k>"
  name scenarios and probe cases of that plan. The runtime report of the build, a comment of the same issue, holds
  the result of each scenario and of each limit probe.
- [ADR-0071](0071-setup-reconciles-recorded-owned-wiring.md), Decision: "Unchanged committed repeats skip equal
  writes" and "Show every changed or deleted path, complete diff, new file and JSON formatting change before one
  final commit-and-push question". Both stay. This record adds that the setup record is compared by value, so a
  repeat with a record that the product formatted is also unchanged, and replaces no clause.
- [ADR-0017](0017-setup-writes-the-wiring-of-a-product-project.md), Constraints and evidence: "A rewrite of
  `.claude/settings.json` with `jq` can change lines of the product". It is evidence of its date, not a decision
  clause, so it stays out of `## Supersedes`. Its Decision, "in the form of the README", names the owned values,
  which stay.
- [ADR-0061](0061-setup-owns-a-marked-instruction-block.md), Consequences: the byte rule of the instruction file.
  This record applies the same rule to `.claude/settings.json` and changes no clause of it.
- [ADR-0029](0029-the-verify-gate-is-the-only-check.md): the probes run in a scratch folder, outside the checkout.
- `layoutJSON`, `jsonStyle`, and `editJSON` in `engine/lib/json-layout.ts`; `Setup.plan` and `Setup.planSettings`
  in `engine/setup.ts`; `plugins/celetis/docs/setup.md`, "Claude permissions: `.claude/settings.json`".

## Context

`setup write` and `setup try` wrote the setup record `.claude/celetis/wiring.json` and the shared file
`.claude/settings.json` with `JSON.stringify(value, null, indent)`. That form puts each array item on its own line;
Biome and Prettier put a short array on one line. So the gate of a product that format-checks JSON failed after
`setup write`, and in a `setup try` test lane the checks failed on a base that passes. In the setup session of
2026-11-11, that false base failure gave a wrong `## Baseline of the checks` proposal for `AGENTS.md`, and the
maintainer approved it before the agent found the cause (spec, "Problem"). Also, a record that the product had
formatted was written again on each run, because setup compared its bytes, and a change of an owned settings value
changed the layout, the CRLF line breaks, and the final newline of the whole product file.

## Constraints and evidence

- With `expand` `auto`, Biome 2.5.15 refuses the `JSON.stringify` form of both files and accepts the committed
  form of this repository; Prettier 3.6.2 with the `json` parser does the same. Biome with `expand` `always` and
  Prettier with `--parser json-stringify` do the reverse. Biome `{}` (tab indent) refuses a two-space file. A
  printer of "the common layout" at width 80 gave the committed bytes of both files exactly (spec, "Design
  probes").
- An array line of 80 columns stays on one line and one of 81 columns breaks, in both tools; a comma after the
  array counts, a tab of the indent counts as two columns, and a CJK character counts as two (plan, External
  facts). No fixed layout passes every configuration.
- A JSON file with no final line break fails both tools in every probed configuration; the spec keeps such a
  missing line break. The maintainer chose the V3 check of the result with one CRLF added (plan, acceptance
  coverage).
- `Buffer.toString('utf8')` turns an invalid byte into U+FFFD, and `JSON.parse` accepts that text, so an edit
  through a lossy decode can change a product byte that the plan does not see (plan, External facts).
- Setup validates the whole plan and every destination before its first write (ADR-0071).

## Decision

1. **One home of the layout.** `layoutJSON` prints each new JSON text: a non-empty object has one member per line
   at one indent unit deeper than its opening line; an array of scalars is on one line when the whole line, with
   the key before it and a comma after it, fits in 80 columns, else one item per line; an array with an object or
   an array among its items has one item per line; `{}` and `[]` stay on one line. `jsonStyle` reads the indent
   unit of the first indented line of the file (a tab, or one to seven spaces; a longer indent gives two spaces),
   else of the other JSON file of setup, else two spaces, and the line break of the file, CRLF only when its first
   line break is CRLF. A new file has LF and ends with one LF.
2. **The record.** Setup plans no write of `.claude/celetis/wiring.json` when it exists, no record is at
   `.claude/celetis-flow/wiring.json`, and its value is deep-equal to the new value. Else it writes the whole record
   in the common layout, with the indent unit of the current record, else of the planned `.claude/settings.json`,
   and the line break of the current record.
3. **`.claude/settings.json`.** `planSettings` keeps its reads, checks, warnings, ownership rules, and planned
   value. With no owned change, it writes nothing. With no file, it writes the value in the common layout. Else
   `editJSON` edits the text in place: an unchanged value keeps its text; an owned key of the settings form whose
   value changes is replaced whole; a container where setup adds or removes a member or an item is laid out
   again, each kept member and item keeping its own text, with new members after the kept ones; each other byte
   stays, also the text before and after the root value. A small scanner of the engine gives the positions; the
   input already passed `JSON.parse` and the duplicate-key check.
4. **The boundary.** Before an edit of an existing file, setup decodes its bytes with a fatal UTF-8 decoder, and
   after it, the edited text must parse to a value deep-equal to the planned value. Each failure stops before any
   write with a line that names `.claude/settings.json` and tells the owner to repair the file by hand.

The maintainer picked approach 1 of the spec on 2026-11-11, through the coordinator session: "#292 - 1". It
follows the edit of a concrete syntax tree in cargo add, uv, and Deno `deno add` (dprint jsonc-parser 0.32.1), and
Angular `JSONFile.modify`: each byte outside the edited part stays, and so does the line break of the file. Like
Deno, a new array of scalars goes on one line and a non-empty object on several lines, with the indent of the file.
Unlike Deno, which checks no width, and unlike jsonc-parser `modify`, whose one-item-per-line arrays Biome refuses,
the new text passes the default Biome and Prettier (spec, "Prior art").

## Alternatives considered

- **Run the formatter of the project** (approach 2; Nx `formatFiles`, `@changesets/format`). It is the only exact
  answer for every formatter, but it needs a new product-owned field, work for each adopter, product code at
  `setup write`, and the formatter in the test lane before the wiring commit; each product with no reference
  still needs approach 1. It can come later as a layer on top of this decision.
- **Keep the npm form, and each product adapts its formatter** (approach 3; Prettier `json-stringify`, Biome
  `expand: always`). The engine changes least, but the gate of each product fails until its maintainer adds an
  override for the two paths.
- **The vendored `yaml` CST for the positions.** `editConfig` and `ambiguousJSON` already use it, but its flow
  collections of JSON need the same layout rules on top; a scanner of the JSON grammar on text that already passed
  `JSON.parse` is shorter, and the deep-equal check holds for either.

## Consequences

- The gate of this repository and of a product with a default Biome (space indent) or Prettier configuration
  passes after `setup write` and in a `setup try` test lane (V1, V4, V5).
- A rerun that changes no JSON value writes no byte of either file, also for a record in a product layout (V2,
  V2b).
- In `.claude/settings.json`, the white space between the members or the items of a changed container is the one
  change outside the owned values; CRLF line breaks and a missing final line break stay (V3, V10).
- The formatter of a product can refuse the laid-out text when its rules differ. The limit probes observed three
  cases: Biome with `lineWidth` 120 refuses a deny array that setup splits at 84 columns (S7i); Biome
  `json.formatter.expand` `always` and Prettier `--parser json-stringify` refuse a new file of setup; Biome `{}`
  refuses a new file of setup, which has a two-space indent when no JSON file of setup has an indented line. The
  maintainer then formats those files once; a later run with no change of value keeps them.
- A record whose value changes is written whole, so a product layout of the record is lost at that change: a
  record in the `JSON.stringify` form gets its arrays on one line (limit probe d).
- A file that is not valid UTF-8 gets a new refusal when setup must edit it; with no owned change, it gets none
  (S6).

## Reconsider when

- A product needs another layout than the defaults of Biome and Prettier: add approach 2 as a layer on top.
- A version of Biome or Prettier prints another default JSON layout, for example another line width or another rule
  for arrays.
- `.claude/settings.json` accepts comments (JSONC), so `JSON.parse` no longer validates it.

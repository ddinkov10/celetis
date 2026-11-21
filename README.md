# celetis

Celetis is a software factory harness: the process and the runtime around coding agents that take each change of a product through its lifecycle.

- **The goal** is the full lifecycle, from intent to release.
- **Today** a change goes from intent to the trunk through one GitHub issue, which holds the result of each step. Each product project does its own release.

Celetis has two modules:

- **The plugin** holds the skills and the instructions that a person uses inline in an agent session. The goal is any agent; today the hosts are Claude Code and Codex.
- **The engine** has the command `celetis`, a daemon, and a board. The daemon runs the phases of the SDLC, from the triage of an issue to the landing, as autonomous workflows: each step runs in an agent session of its own, and in auto mode the daemon starts each next step that has the gate `auto` by itself, in the lanes that the project lists for auto mode, where the name `triage` stands for the issues with no lane (by default, each lane and each issue with no lane). A person starts the daemon, turns auto mode on, starts each step that has the gate `me`, and answers each question of a step.

Celetis fits different types of product. The plugin names roles, for example "the verify gate of the project", and each product project names its own parts: in its `.celetis.yaml`, with a `custom.<skill>` part for each skill that needs one, and in its `AGENTS.md`.

This repository holds:

- the plugin, in `plugins/celetis/`: the skills, the procedure modules, the principles, the step text, and the maintainer documents;
- the engine: the folder `engine/`, with its entry `engine/celetis`, described in [`engine/README.md`](engine/README.md);
- the records: `docs/adr/` and `.celetis/lessons/`;
- the host documents: `docs/hosts/`;
- the maintenance scripts: `scripts/`, described in [`scripts/README.md`](scripts/README.md).

[`plugins/celetis/README.md`](plugins/celetis/README.md) holds the install, the full loop, the skills, the commands, and the updates. [`plugins/celetis/docs/setup.md`](plugins/celetis/docs/setup.md) holds what setup writes, and [`plugins/celetis/docs/workflow.md`](plugins/celetis/docs/workflow.md) holds the steps of a run as a session and a person meet them. [`engine/board/README.md`](engine/board/README.md) holds the board.

## Documentation

The documents are also a website: https://ddinkov10.github.io/celetis/

- [About Celetis](docs/explanation/overview.md): What is Celetis, what are its parts, and where in the code is each part?
- [About the lifecycle of a change](docs/explanation/change-lifecycle.md): How does a request become a change on the trunk, and why is the issue the state store?
- [About the skills and the agent text](docs/explanation/agent-text.md): How do the skills, the procedure modules, and the principles steer an agent, and why one copy serves both hosts?
- [About the daemon and its runs](docs/explanation/daemon-and-runs.md): What does the daemon do, how does a run move from step to step, and what does auto mode change?
- [About the board](docs/explanation/board.md): What does the board show, and why does no card move by hand?
- [About the records](docs/explanation/records.md): Why does Celetis keep ADRs, lessons, and a constitution, and how does each one steer later work?

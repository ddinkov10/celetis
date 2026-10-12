---
name: probe
description: Throwaway skill for the risk probes of the plugin build; Task 8 removes it.
---
PROBE version 5
PROBE root ${CLAUDE_PLUGIN_ROOT}
Print each line of this skill that starts with PROBE, and nothing else. Run no tool.

!`cat .claude/agent-flow/custom/probe.md 2>/dev/null || true`

---
name: probe-top
description: Throwaway skill for the risk probes of the plugin build; the probe task removes it.
---
PROBE-TOP version 1
Print each line of this skill that starts with PROBE, and nothing else. Run no tool.

!`cat "$(git rev-parse --show-toplevel)/.claude/agent-flow/custom/probe.md" 2>/dev/null || true`

---
name: probe-write
description: Throwaway skill for the risk probes of the plugin build; the probe task removes it.
---
PROBE-WRITE version 1
Print each line of this skill that starts with PROBE, and nothing else. Run no tool.

!`touch probe-control-was-run && echo PROBE control ran`

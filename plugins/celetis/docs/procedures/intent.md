# The intent

The template that `intake` fills for a raw request, and that a lane fills when it gets free text
in place of an issue number (the lane start). Fill it from the source. Never invent a solution:
record the user's problem and wanted outcome in their own words.

## The template

```markdown
# Intent: <title>
**Who:** <user type>
**Problem:** <one paragraph, user's words, no solution>
**Repro:** <every replication input the source gives — site URL, script URL, username, password, steps; "n/a" if none>
**Done when:** <one observable outcome>
**Not now:** <one line>
**Source:** ticket / feedback / crash link
```

## Per type, still one template

- **bug / hotfix** — `Problem` = impact (what broke, who is affected); `Repro` = every
  replication input the source gives, verbatim.
- **feature / chore** — `Repro` = "n/a".
- **Vague ask** — when the user gives only a few words with no context ("improve X", "fix Y"),
  quote the request verbatim and label the gaps: `Problem: "The user said: 'Make the dashboard
  faster.' — no reproduction steps, impact, or desired outcome provided."` Do not invent
  symptoms, root causes, or consequences the user did not state.

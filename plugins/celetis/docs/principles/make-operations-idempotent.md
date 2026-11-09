# Make operations idempotent

## Applies when

An operation changes persistent state or can be retried after interruption.

## Rule

Define the intended result when the operation runs twice and when it resumes after an
interruption. Make repeated work reach that result without duplicate external effects or lost
data. Detect stale partial state and complete or safely remove it before it can become an
accepted result. Make recovery preserve valid data.

Use temporary data or another safe check under the project's rules. Do not repeat a real
external effect or interrupt a real operation when that check can cause harm.

## Check

Record the intended results of duplicate and interrupted runs. Show that both reach the intended
state or allow safe recovery, without duplicate effects, lost data, or accepted stale partial
state.

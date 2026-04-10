# MuninnDB — Persistent Memory

MuninnDB is the user's long-term memory system. It persists across sessions and
contains decisions, preferences, lessons, facts, project context, and behavioral
rules. It is available as an MCP server (`mcp__muninn__*` tools).

**Always use MuninnDB over local files for cross-session memory.**
The `.planning/STATE.md` file tracks GSD project state; MuninnDB tracks everything else.

## When to Use MuninnDB

Use MuninnDB when you discover something worth remembering beyond the current session:

- A **decision** was made → `mcp__muninn__muninn_decide`
- A **bug, gotcha, or non-obvious behavior** was found → type: lesson
- The user stated a **preference** → type: preference
- You learned something important about the **codebase** → type: fact
- A **task completed** with notable outcomes → type: event

Do NOT store transient GSD state (plan progress, phase status) in MuninnDB — that
belongs in `.planning/`. MuninnDB is for insights that transcend any single project plan.

## Session Start Recall

At the start of any session where `.planning/` exists, recall relevant project context:

```
mcp__muninn__muninn_recall(context="<project name> <current task>", vault="default")
```

This surfaces past decisions, gotchas, and preferences relevant to the work.

## Core Tools

| Tool | Purpose |
|------|---------|
| `mcp__muninn__muninn_remember` | Store one atomic memory (one concept per call) |
| `mcp__muninn__muninn_remember_batch` | Store multiple memories at once |
| `mcp__muninn__muninn_recall` | Search by semantic context |
| `mcp__muninn__muninn_where_left_off` | What happened recently (session resume) |
| `mcp__muninn__muninn_decide` | Record a decision with rationale |
| `mcp__muninn__muninn_evolve` | Update existing memory in place |
| `mcp__muninn__muninn_find_by_entity` | Find memories about a specific entity |

## Writing Good Memories

**Keep memories atomic.** One concept/decision/fact per memory call.

**Always provide:**
- `vault`: "default"
- `concept`: short label
- `content`: the full information
- `type`: fact | decision | preference | event | lesson | context | procedure
- `entities`: `[{name, type}]` for mentioned things

**Example:**
```
mcp__muninn__muninn_remember(
  vault="default",
  concept="builder uses RDTSC for timing on single-core tiles",
  content="On single-core tiles, use flux::timing::Instant (RDTSC-based) instead of Nanos::now() for latency measurement. Avoids clock_gettime syscall overhead.",
  type="lesson",
  entities=[{name: "builder", type: "project"}, {name: "flux::timing::Instant", type: "api"}]
)
```

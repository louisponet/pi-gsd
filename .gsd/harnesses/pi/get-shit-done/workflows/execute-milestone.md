# execute-milestone workflow

Execute all planned phases in the current milestone with scope guardian, UAT gates, and configurable recovery.

---

## Worktree Check (always first)

```bash
git worktree list
```

If not in an isolated worktree:
> "Large-scale milestone execution should run in an isolated worktree to protect your main branch. Create one now? (y/n, default: y)"

If yes: `Skill(skill="gsd-new-workspace", args="milestone-exec")`, then continue in the new worktree.
If no: warn once, proceed on current branch.

---

## Mode Selection (step 1 — always second)

Ask the user ONE binary question:

> **"How should I behave when I hit a doubt, error, or scope deviation?"**
>
> - **Interactive** — Stop and ask me; I'll guide you through it
> - **Silent** — Try to self-correct; only surface unrecoverable blockers

Store as `MODE` (interactive | silent). Do not ask again.

---

## Phase Discovery

```bash
pi-gsd-tools roadmap analyze --raw
pi-gsd-tools progress json --raw
```

Build execution queue: phases with ≥1 PLAN.md and status ≠ Complete, in roadmap order.

If queue is empty: "All phases are already complete. Run /gsd-audit-milestone." Stop.

---

## Per-Phase Execution Loop

For each pending phase `N`:

### A. Scope Pre-check (lightweight, one LLM call)

Read:
- `.planning/REQUIREMENTS.md`
- Phase goal + success criteria from ROADMAP.md

Prompt (internal): *"Does executing this phase risk implementing anything not covered by active requirements, or conflict with what previous phases delivered? Rate: low / medium / high. One sentence reason."*

- **low** — continue silently
- **medium** — log in scope-log, continue
- **high + interactive** — surface to user, ask: proceed / adjust phase goal / stop
- **high + silent** — log prominently, continue, include in final report

### B. Execute Phase

```
Skill(skill="gsd-execute-phase", args="${N}")
```

### C. Scope Post-audit (full, one LLM call)

Read new SUMMARY.md files from the phase directory.

Check:
1. **Undelivered must-haves** — PLAN.md `must_haves` entries absent from SUMMARY
2. **Scope creep** — files modified that are outside this phase's stated scope
3. **Requirement drift** — work done that has no matching REQUIREMENTS entry

Classify result as `SCOPE_STATUS`:
- **clean** — continue
- **drift** — log + warn, continue
- **violation** — trigger recovery (see §F)

### D. Verify

```
Skill(skill="gsd-verify-work", args="${N}")
```

Compute UAT pass rate = passing items / total items.
Default threshold: **80%**. Override with `--uat-threshold N`.

### E. Gate Check

| Condition | Interactive | Silent |
|-----------|-------------|--------|
| UAT pass rate < threshold | Ask: fix gaps now or continue? | → Recovery loop |
| Context remaining < 20% | Warn, ask: stop or continue? | → Write HANDOFF, stop |
| SCOPE_STATUS = violation | Surface details, ask | → Recovery loop |
| All gates pass | Continue to checkpoint | Continue to checkpoint |

### F. Recovery Loop

When triggered:

```
1. pi-gsd-tools validate health --repair
2. Self-correct: identify root cause, patch, re-run verification
3. Re-check gates
4. Gates pass → continue to checkpoint
5. Still failing:
   - Interactive: explain issue, ask user how to resolve, loop from step 2
   - Silent: write HANDOFF files (see §G), stop
```

### G. Hard Stop — HANDOFF Files

On unrecoverable stop, write two files matching original GSD pause-work convention:

**`.planning/HANDOFF.json`** (machine-readable, consumed by `/gsd-resume-work`):
```json
{
  "stopped_at": "ISO-timestamp",
  "phase": "N",
  "phase_name": "phase name",
  "stop_reason": "uat_failure | scope_violation | context_exhausted | unrecoverable_error",
  "uat_pass_rate": 75,
  "scope_status": "violation",
  "phases_completed": ["1", "2", "3"],
  "phases_remaining": ["N", "N+1"],
  "scope_log": ["note 1", "note 2"],
  "next_action": "Run /gsd-execute-milestone --from N to resume"
}
```

**`.planning/phases/NN-name/.continue-here.md`** (human-readable):
```markdown
---
phase: N
status: stopped
stop_reason: [reason]
last_updated: [timestamp]
---

## What happened
[Clear explanation of why execution stopped]

## State at stop
- UAT pass rate: X%
- Scope status: [clean/drift/violation]
- Scope notes: [any flags]

## How to resume
Run: /gsd-execute-milestone --from N
Or fix the specific issue first: [specific suggestion]
```

### H. Checkpoint (on success)

```bash
pi-gsd-tools state update current_phase ${N}
pi-gsd-tools state update last_activity $(date -u +%Y-%m-%d)
pi-gsd-tools commit "chore: complete phase ${N}" --files .planning/
```

Announce: `✓ Phase ${N} complete — UAT: ${pass_rate}%  Scope: ${scope_status}`

---

## Completion — Worktree Merge

When all phases are complete:

Ask the user:
> "All phases complete. Merge this worktree back to your main branch? (y/n, default: y)"

If yes:
```bash
git checkout main
git merge --no-ff milestone-exec -m "feat: complete milestone ${milestone_version}"
git worktree remove milestone-exec
```

If no: leave worktree open, inform user how to merge manually.

---

## Final Summary

```
━━ execute-milestone complete ━━━━━━━━━━━━━━━━━━━━━
✓ Phases executed: [list]
📊 Avg UAT pass:   [X]%
⚠ Scope flags:    [count — details above]
↳ Next: /gsd-audit-milestone
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Route to `/gsd-audit-milestone`.

# PRD: pi-gsd TODO Backlog — Fixes & Enhancements

**Created:** 2026-04-03  
**Status:** Ready for implementation  
**Hard constraint:** Full `.planning/` data format compatibility with GSD v1.30.0 at all times.

---

## 1. Introduction / Overview

pi-gsd is an unofficial TypeScript port of the Get Shit Done (GSD) v1.30.0 framework, distributed as a pi package. After the initial port and packaging work, a structured analysis session identified 7 bugs and enhancement items. This PRD covers all of them in implementation order.

The work is complete when:
- All 7 TODO items are implemented
- `ralphi check` (typecheck + build) passes
- The README feature comparison table is complete and honest (includes things we don't have yet)

---

## 2. Goals

- Fix all pi-specific bugs so GSD works correctly in pi (not just installs)
- Add runtime safety (Zod schemas) so LLM-written `.planning/` files are validated
- Tighten TypeScript types throughout the codebase
- Make skills context-efficient using pi-native toon output
- Make `/gsd-profile-user` aware of pi session history
- Keep full `.planning/` data portability between pi and all other harnesses

---

## 3. User Stories

---

### US-001: Fix skill execution_context paths

**Description:** As a pi user, I want GSD skills to load the correct workflow files so that skills actually work when I invoke them.

**Background:** All 130 `execution_context` blocks in the 57 skills hardcode `@.agent/get-shit-done/…` but pi installs GSD to `.pi/get-shit-done/…`. This means pi users' skills reference workflow files that don't exist at those paths.

**Acceptance Criteria:**
- [ ] All occurrences of `@.agent/get-shit-done/` in `skills/` replaced with `@.pi/get-shit-done/`
- [ ] No other harness paths (`.claude/`, `.gemini/`, `.opencode/`) remain in skills
- [ ] `grep -r "\.agent/get-shit-done" skills/` returns zero results
- [ ] `ralphi check` passes after change

---

### US-002a: Pi hook extension — postinstall wiring

**Description:** As a pi user, I want GSD's background hooks (context monitor, workflow guard, statusline, prompt guard, update checker) to actually fire during my pi sessions so that I get context warnings and workflow guidance.

**Background:** Pi uses TypeScript extensions for hooks (`pi.on(event, handler)`), not the command-based hook system that Claude Code uses. The GSD `.js` hook files are silently inert in pi. A TypeScript extension wrapping the hook logic must be installed into `.pi/extensions/`.

**Acceptance Criteria:**
- [ ] `scripts/postinstall.js` installs `.pi/extensions/gsd-hooks.ts` into the consumer project
- [ ] The extension registers for equivalent pi events:
  - `session_start` → runs `gsd-check-update.js` logic
  - `tool_before` (Write/Edit tools) → runs `gsd-workflow-guard.js` logic  
  - `tool_after` → runs `gsd-context-monitor.js` logic
- [ ] `.pi/settings.json` `extensions` array is updated to include the extension path
- [ ] Extension is non-blocking — failures are silent, never prevent tool execution
- [ ] `ralphi check` passes after change

---

### US-002b: `/gsd-setup-pi` skill

**Description:** As a pi user who installed via bun (where postinstall is sometimes skipped), I want a single command to wire up all GSD hooks and verify my setup so that I don't have silently broken hooks.

**Acceptance Criteria:**
- [ ] `skills/gsd-setup-pi/SKILL.md` exists and is loadable by pi
- [ ] Skill checks whether `.pi/extensions/gsd-hooks.ts` exists
- [ ] If missing: installs the extension and updates `settings.json`
- [ ] If present: confirms hooks are wired and reports status
- [ ] Skill ends by routing user to `/gsd-new-project` for first-time setups
- [ ] `ralphi check` passes after change

---

### US-003: Pi harness entry in HARNESS_CONFIG

**Description:** As a pi user running `/gsd-profile-user`, I want the generated profile file to be named `AGENTS.md` (not `CLAUDE.md`) and contain pi-appropriate branding so that the output matches pi conventions.

**Background:** `HARNESS_CONFIG` in `model-profiles.ts` has no `pi` entry. It falls back to `agent`, which generates `CLAUDE.md`-branded content with Claude Code references.

**Acceptance Criteria:**
- [ ] `src/lib/model-profiles.ts` has a `pi` entry in `HARNESS_CONFIG` with:
  - `cmdPrefix: "/gsd-"`
  - `runtimeName: "pi"`
  - Profile output file target: `AGENTS.md`
  - Provider sections referencing pi's multi-provider support
- [ ] All `bin/*/lib/model-profiles.cjs` files updated identically (Tier-1 byte-identical rule)
- [ ] `src/lib/profile-output.ts` generates `AGENTS.md` (not `CLAUDE.md`) for pi harness
- [ ] `node scripts/validate-model-profiles.cjs` passes
- [ ] `ralphi check` passes after change

---

### US-004: Toon output in skills

**Description:** As a pi user, I want `/gsd-progress`, `/gsd-stats`, and `/gsd-health` to render rich formatted output using pi's toon renderer so that I get better information density with lower token cost.

**Background:** `gsd-tools` already supports `--output toon`. Skills don't use it yet. Output must remain data-compatible (same underlying `.planning/` files) so users can switch to opencode or other harnesses without data loss.

**Acceptance Criteria:**
- [ ] `skills/gsd-progress/SKILL.md` instructs the agent to call `gsd-tools progress --output toon`
- [ ] `skills/gsd-stats/SKILL.md` instructs the agent to call `gsd-tools stats --output toon`
- [ ] `skills/gsd-health/SKILL.md` instructs the agent to call `gsd-tools validate health --output toon`
- [ ] Each skill includes fallback: if toon output fails, fall back to plain JSON
- [ ] No `.planning/` file format changes — only presentation layer changes
- [ ] `ralphi check` passes after change

---

### US-005 + US-006: Zod schemas and TypeScript types for `.planning/` structures

**Description:** As a developer or AI agent writing `.planning/` files, I want runtime validation with clear error messages so that schema deviations are caught early and auto-repaired where possible, rather than silently corrupting workflows mid-execution.

**Background:** LLMs generate `.planning/` files and sometimes deviate from schema (wrong field types, missing required fields, etc.). Currently `validate health` uses heuristics. Zod will provide schema-driven validation and repair. Zod schemas also export TypeScript types, replacing loose `Record<string, any>` typings throughout `src/lib/`.

**Acceptance Criteria:**
- [ ] `zod` added to `dependencies` in `package.json`
- [ ] Zod schemas defined for:
  - `STATE.md` frontmatter (all known fields, required vs optional)
  - `ROADMAP.md` phase entry structure
  - `PLAN.md` frontmatter
  - `UAT.md` checkpoint structure
  - `.planning/config.json`
- [ ] Schemas exported from `src/lib/schemas.ts`
- [ ] TypeScript types derived via `z.infer<>` and used throughout `src/lib/`
- [ ] `gsd-tools validate health` uses Zod schemas for validation
- [ ] `gsd-tools validate health --repair` uses schema defaults to patch missing/wrong fields
- [ ] Validation errors include field path + expected type + actual value
- [ ] All schemas preserve 100% compatibility with GSD v1.30.0 `.planning/` format
- [ ] `Record<string, any>` / untyped `unknown` casts audited and replaced where schemas exist
- [ ] `ralphi check` passes after change

---

### US-007: Pi session history ingestion for `/gsd-profile-user`

**Description:** As a pi user, I want `/gsd-profile-user` to analyse my actual pi session history so that my developer profile reflects my real coding patterns and preferences in pi.

**Background:** `profile-pipeline.ts` currently scans only `~/.claude/projects` for session history. Pi stores sessions in a different location and format.

**Acceptance Criteria:**
- [ ] Pi session storage path and JSONL format documented in code comments
- [ ] `cmdScanSessions` detects pi sessions alongside Claude sessions
- [ ] `cmdExtractMessages` can read pi JSONL session format
- [ ] `cmdProfileSample` samples from pi sessions correctly
- [ ] When run in pi (`--harness pi` or auto-detected), pi sessions are prioritised
- [ ] Existing Claude session reading is unaffected
- [ ] `ralphi check` passes after change

---

### US-008: README feature comparison table (final)

**Description:** As a user evaluating pi-gsd vs the original GSD, I want a side-by-side feature comparison table in README.md that is honest about what's implemented, what's pending, and what's unique to pi-gsd.

**Acceptance Criteria:**
- [ ] Table exists under a "Comparison with GSD v1.30.0" heading
- [ ] Every implemented TODO item reflected with ✔️ in the pi-gsd column
- [ ] Every remaining gap reflected honestly with ❌ or ⚠️
- [ ] Pi-native additions (toon output, TypeScript source, Zod validation) shown as ✔️ / ❌ vs GSD v1.30
- [ ] Table updated after each TODO item is completed

---

## 4. Functional Requirements

- **FR-1:** The `.planning/` directory structure, file formats, and frontmatter schemas must remain 100% compatible with GSD v1.30.0 at all times. A project started with the original GSD must work with pi-gsd without migration.
- **FR-2:** All Zod schemas must accept all valid GSD v1.30.0 `.planning/` files without error.
- **FR-3:** `ralphi check` (typecheck + build) must pass after every TODO item.
- **FR-4:** Tier-1 binary modules (`model-profiles.cjs` and others) must remain byte-identical across all 8 harnesses after any change.
- **FR-5:** Hook extension for pi must be non-blocking — hook failures must never prevent tool execution or break the agent session.
- **FR-6:** Skills output format changes (toon) must not change underlying `.planning/` data — only the presentation layer.

---

## 5. Non-Goals

- Do not add any new GSD commands or workflows beyond the 57 existing ones
- Do not change the `.planning/` data format
- Do not add multi-harness "auto-detection" magic — pi is the primary target
- Do not port the original GSD CJS modules to a new format (TypeScript port is done)
- Do not add a test suite (typecheck is the quality gate)

---

## 6. Technical Considerations

- **Implementation order:** #1 → #2a → #2b → #3 → #4 → #5+#6 → #7 → #8 (README update)
- **Zod version:** Use `zod@^3` (stable, widely compatible)
- **Pi extension API:** Extensions are TypeScript files using `pi.on(event, handler)` pattern. See pi docs in `/home/fulgidus/.bun/install/global/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md`
- **Tier-1 rule:** After any change to `model-profiles.ts`, regenerate and sync all `bin/*/lib/model-profiles.cjs` files
- **Pi session path:** Located at `~/.pi/sessions/` (verify before implementing #7)

---

## 7. Success Metrics

- `grep -r "\.agent/get-shit-done" skills/` → 0 results
- `ralphi check` passes clean after every item
- README comparison table has no ⬜ (unknown) entries — every row is honest ✔️, ❌, or ⚠️
- `node scripts/validate-model-profiles.cjs` passes after #3
- `zod` in `package.json` dependencies after #5

---

## 8. Open Questions

- **#2a:** Which exact pi extension events map to `PreToolUse`/`PostToolUse`/`SessionStart`? Needs verification against pi extension docs before implementing.
- **#7:** Exact path and JSONL schema of pi session files needs verification at implementation time.
- **#3:** Does `profile-output.ts` need a full harness-specific code path for pi, or is a targeted `AGENTS.md` rename sufficient?

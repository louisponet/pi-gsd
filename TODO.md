# pi-gsd TODO

Improvements confirmed after analysis session on 2026-04-03.
Format compatibility with original GSD v1.30.0 `.planning/` data is a hard constraint on all items.

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## #1 — Fix skill execution_context paths (BUG)

**Problem:** All 130 `execution_context` blocks in skills hardcode `@.agent/get-shit-done/…`
but pi installs GSD to `.pi/get-shit-done/…`. Pi users load workflow files from the wrong path.

**Fix:** Rewrite all 130 occurrences to `@.pi/get-shit-done/…`.

- [ ] Sed/script replace across all 57 skills
- [ ] Verify no other harness path references snuck in

---

## #2 — Hook registration for pi (BUG)

**Problem:** Pi uses TypeScript **extensions** for hooks (not command-based like Claude Code).
The GSD `.js` hook files are silently inert in pi — they never fire.

**Two-part fix:**

### #2a — postinstall: write hook entries into `.pi/settings.json`
Pi's settings.json does not support Claude-style `hooks` keys. Instead hooks must be
implemented as pi extensions. postinstall should install a generated `.pi/extensions/gsd-hooks.ts`
that wraps the GSD hook logic using pi's extension API (`pi.on(event, handler)`).

- [ ] Research which pi extension events map to GSD hook triggers
  - `PreToolUse` → `tool_before` (?)
  - `PostToolUse` → `tool_after` (?)
  - `SessionStart` → `session_start`
- [ ] Write `gsd-hooks.ts` pi extension template
- [ ] Wire postinstall to copy/generate it into `.pi/extensions/`
- [ ] Register it in `.pi/settings.json` `extensions` array

### #2b — `/gsd-setup-pi` skill
Fallback for when postinstall is skipped (bun installs, manual installs).
Interactive skill that checks hook wiring, repairs if needed, then routes to `/gsd-new-project`.

- [ ] Write `skills/gsd-setup-pi/SKILL.md`

---

## #3 — Pi harness entry in HARNESS_CONFIG

**Problem:** No `pi` key in `HARNESS_CONFIG`. Falls back to `agent`, producing
`CLAUDE.md`-branded profile output for pi users.

**Fix:** Add `pi` entry following pi conventions:
- Skills placement: pi skill system
- Data: `.planning/` (same as all harnesses)
- Profile output file: `AGENTS.md` (not `CLAUDE.md`)
- cmdPrefix: `/gsd-`

- [ ] Add `pi` entry to `src/lib/model-profiles.ts` `HARNESS_CONFIG`
- [ ] Add `pi` entry to all `bin/*/lib/model-profiles.cjs` (Tier-1, byte-identical)
- [ ] Update `profile-output.ts` / `profile-output.cjs` for pi branding
- [ ] Run `validate-model-profiles.cjs` after

---

## #4 — Toon output in skills (context optimization)

**Decision:** Skills may use `--output toon` and `--pick` for richer/more efficient output,
as long as the underlying data and `.planning/` files remain harness-neutral.
Users switching from pi to opencode (or back) must not lose any data.

- [ ] Update `/gsd-progress` skill to use `gsd-tools progress --output toon`
- [ ] Update `/gsd-stats` skill to use `gsd-tools stats --output toon`
- [ ] Update `/gsd-health` skill to pipe validate output through toon
- [ ] Verify graceful fallback if toon renderer unavailable

---

## #5 — Runtime validation with Zod (BUG PREVENTION)

**Rationale:** LLMs write `.planning/` files and can deviate from schema.
Silent corruption breaks workflows mid-execution. Adding Zod preserves full
format compatibility while catching deviations early.

- [ ] Add `zod` as production dependency
- [ ] Define Zod schemas for:
  - `STATE.md` frontmatter
  - `ROADMAP.md` phase entries
  - `PLAN.md` frontmatter
  - `UAT.md` structure
  - `config.json`
- [ ] Wire schemas into `gsd-tools validate health`
- [ ] Implement smarter `--repair` that uses schema to patch missing/wrong fields
- [ ] Export schemas as TypeScript types (replaces loose `Record<string, any>`)

---

## #6 — TypeScript types for .planning/ structures

Subsumed into #5. Zod schemas generate the TypeScript types automatically via `z.infer<>`.
Separate loose-typing cleanup may still be needed in places that don't touch .planning/ data.

- [ ] Audit `src/lib/*.ts` for remaining `Record<string, any>` / `unknown` casts
- [ ] Replace with Zod-inferred types where schemas exist
- [ ] Tighten remaining non-.planning/ types manually

---

## #7 — Pi session history ingestion for `/gsd-profile-user`

**Problem:** `profile-pipeline.ts` looks for Claude Code session history
(`~/.claude/projects`). Pi stores sessions differently.

- [ ] Locate pi session storage format and path
- [ ] Add pi session reader to `profile-pipeline.ts`
- [ ] Ensure `cmdScanSessions` detects and reads pi sessions
- [ ] Test with real pi session data

---

## Completed

- [x] Fix `/gsd:` → `/gsd-` prefix in all user-facing hook messages
- [x] Add pi harness to postinstall (installs to `.pi/`)
- [x] Add `.pi/AGENTS.md` and `.pi/settings.json` project config
- [x] Switch CI to npm Trusted Publishing (OIDC)
- [x] Fix CI Node.js 20 deprecation (checkout@v6, setup-node@v6)
- [x] Rewrite README (was describing a snapshot repo, not a package)

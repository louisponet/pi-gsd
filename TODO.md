# pi-gsd TODO

Improvements confirmed after analysis session on 2026-04-03.
Format compatibility with original GSD v1.30.0 `.planning/` data is a hard constraint on all items.

---

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## [x] #1 — Fix skill execution_context paths

Skills were referencing `@.agent/get-shit-done/…`. Migrated to `@.pi/gsd/…` to match
the `subdir: "gsd"` install target in postinstall. Confirmed 0 remaining `.agent/` refs.

---

## [x] #2a — Hook registration for pi (postinstall)

`postinstall.js` installs `.gsd/extensions/gsd-hooks.ts` into `.pi/extensions/` and
updates `.pi/settings.json` `extensions` array. Auto-discovered by pi — no manual wiring.
Source: `.gsd/extensions/gsd-hooks.ts`

---

## [x] #2b — `/gsd-setup-pi` skill

`skills/gsd-setup-pi/SKILL.md` exists. Fallback for bun/manual installs that skip postinstall.

---

## [x] #3 — Pi harness entry in HARNESS_CONFIG

`pi` key added to `HARNESS_CONFIG` in `src/lib/model-profiles.ts`.
Uses `AGENTS.md` output (not `CLAUDE.md`), `/gsd-` cmdPrefix, pi branding.

---

## [x] #4 — Toon output in skills (context optimization)

`/gsd-progress`, `/gsd-stats`, `/gsd-health` skills updated to use `--output toon`.
Decision: comparable outputs, harness-neutral data, users can switch freely.

---

## [x] #5 — Runtime validation with Zod

`src/lib/schemas.ts` (286 lines) defines Zod schemas for all `.planning/` structures.

Wired into:
- `src/lib/config.ts` — `PlanningConfig` type
- `src/lib/verify.ts` — `PlanningConfigSchema` in `validate health` (config.json)
- `src/lib/verify.ts` — `StateFrontmatterSchema` in `validate health` → new W011 warning

Smarter `--repair`:
- `config.json` missing/invalid → schema defaults fill all fields at once ✅
- `STATE.md` frontmatter invalid → flagged as W011, repair regenerates STATE.md ✅

---

## [~] #6 — TypeScript types for .planning/ structures

Fixed 18 of 25 `any` casts. Remaining 3 need bigger refactors (tracked below):

**Done:**
- `core.ts`: `output()` result: `any` → `unknown`
- `state.ts`: `buildStateFrontmatter` returns `Record<string, unknown>`
- `phase.ts`: `PhasePlanEntry` interface replaces `any[]`
- `roadmap.ts`: `RoadmapPhaseItem` interface with all actual fields
- `uat.ts`: `CurrentTest` interface; `parseCurrentTest` + `buildCheckpoint` typed
- `config.ts`: `parsedValue` → `unknown` (2 sites)
- `workstream.ts`: `WorkstreamStateInfo` interface
- `init.ts`: `withProjectRoot` params `Record<string,unknown>`
- `template.ts`: `FrontmatterObject` typed
- `profile-pipeline.ts`: `messages`/`samples` → `unknown[]`
- `frontmatter.ts`: `stack`, `items`, `parsedValue`, `mergeData` tightened

**Remaining (need dedicated PR):**
- [ ] `core.ts` `loadConfig` `parsed` + `get()` — deep config object, 20+ typed call sites; needs `PlanningConfigSchema.parse()` refactor
- [ ] `frontmatter.ts` `current` — YAML list parser; can be object OR scalar; needs recursive value type
- [ ] `profile-output.ts` `loadAnalysis` body — JSON blob from disk with dynamic shape

---

## [x] #7 — Pi session history ingestion for `/gsd-profile-user`

`profile-pipeline.ts` detects `--harness pi`, reads `~/.pi/agent/sessions/`,
lists pi sessions first as priority. Both harness types auto-detected.

---

## [x] Instant commands (gsd-hooks.ts)

- [x] `/gsd-progress` — formatted output + `setEditorText()` pivot affordance
- [x] `/gsd-stats` — formatted output + pivot
- [x] `/gsd-health [--repair]` — formatted health output
- [x] `/gsd-help` — instant command list
- [x] `/gsd-next` — deterministic auto-advance, zero LLM, pre-fills editor

---

## Completed (shipped)

- [x] Fix `/gsd:` → `/gsd-` prefix in all user-facing hook messages
- [x] Add pi harness to postinstall (installs to `.pi/`)
- [x] Add `.pi/AGENTS.md` and `.pi/settings.json` project config
- [x] Switch CI to npm Trusted Publishing (OIDC)
- [x] Fix CI Node.js 20 deprecation (checkout@v6, setup-node@v6)
- [x] Rewrite README with feature comparison table
- [x] Ralphi initialized (AGENTS.md, .ralphi/config.yaml, pre-commit hook)

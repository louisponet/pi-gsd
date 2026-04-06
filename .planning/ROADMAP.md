# Roadmap: pi-gsd v1.0 - WXP

**Milestone:** v1.0
**Requirements:** 44 total
**Phases:** 5
**Mode:** Standard granularity, Interactive

---

## Phase Summary

| Phase | Name                 | Goal                                                 | Requirements                    | Success Criteria |
| ----- | -------------------- | ---------------------------------------------------- | ------------------------------- | ---------------- |
| 1     | WXP Foundation       | Build the preprocessing engine and integrate into pi | WXP-01–14, INC-01–03, TST-01–03 | 5                |
| 2     | oclif Migration      | Replace commander.js with typed oclif commands       | CLI-01–06                       | 5                |
| 3     | Type Cleanup         | Eliminate every `any` from the codebase              | TYP-01–06                       | 5                |
| 4     | Workflow Conversion  | Convert all workflow files to use WXP directives     | WFL-01–05                       | 4                |
| 5     | Harness Distribution | Replace symlinks with copy-on-first-run              | HRN-01–07                       | 5                |

---

## Phase 1: WXP Foundation

**Goal:** Build the complete WXP preprocessing engine (`src/wxp/`) and wire it into the pi extension's context event so that workflow files can use XML directives to pre-inject computed data before the LLM receives the text.

**Requirements:** WXP-01, WXP-02, WXP-03, WXP-04, WXP-05, WXP-06, WXP-07, WXP-08, WXP-09, WXP-10, WXP-11, WXP-12, WXP-13, WXP-14, INC-01, INC-02, INC-03, TST-01, TST-02, TST-03

**Build order (within phase):**
1. `src/wxp/schema.ts` - Zod schemas (all other modules depend on this)
2. `src/wxp/variables.ts` - typed variable store
3. `src/wxp/security.ts` - trusted-path + allowlist enforcement
4. `src/wxp/parser.ts` - XML token extraction with code-fence skip
5. `src/wxp/shell.ts` - `<shell>` execFileSync execution
6. `src/wxp/conditions.ts` - `<if>/<equals>/<starts-with>`
7. `src/wxp/string-ops.ts` - `<string-op op="split">`
8. `src/wxp/arguments.ts` - `<gsd-arguments>` two-pass parser
9. `src/wxp/paste.ts` - `<gsd-paste>` replacement
10. `src/wxp/executor.ts` - `<gsd-execute>` block runner + resolution loop
11. `src/wxp/index.ts` - `processWxp()` main entry + error handling
12. `src/schemas/wxp.xsd` - XSD 1.1 canonical schema
13. Integration into `.gsd/extensions/gsd-hooks.ts`
14. `src/wxp/__tests__/` - vitest unit + integration tests

**`<gsd-include>` extensions (INC-01–03) build alongside parser.ts**

**Success criteria:**
1. A test workflow file containing `<gsd-execute><shell command="pi-gsd-tools">...</shell></gsd-execute>` and `<gsd-paste name="result" />` is processed by `processWxp()` and the paste tag is replaced with the shell output - confirmed by integration test
2. A document with WXP tags inside fenced code blocks passes through the preprocessor unchanged - the tags appear verbatim in the output (code-fence skip works correctly)
3. Any WXP processing failure (non-allowlisted command, undefined variable, untrusted path) produces zero LLM output and a visible error notification containing the full variable namespace and pending block state
4. `npm test` passes all vitest unit and integration tests with zero failures
5. `npm run typecheck` passes at zero errors for `src/wxp/` (all types Zod-inferred, zero `any`)

---

## Phase 2: oclif Migration

**Goal:** Migrate every `pi-gsd-tools` command from the commander.js monolith in `src/cli.ts` to typed oclif command classes in `src/commands/`, remove commander.js, and verify that all workflow XML shell calls continue to work.

**Requirements:** CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06

**Build order (within phase):**
1. Add `@oclif/core` dependency; keep commander.js in parallel during migration
2. Create `src/commands/` directory structure (subcommand groups)
3. Migrate commands one-by-one, highest-traffic first: `state`, `init`, `roadmap`, `phase`, `config`, `milestone`, `verify`, `validate`, `workstream`, `scaffold`, `commit`, `frontmatter`, `template`, `wxp`
4. Wire oclif run() entrypoint into `src/cli.ts` (replace commander router)
5. Add `wxp process` subcommand calling `processWxp()`
6. Remove commander.js dependency
7. Verify: run all workflow XML shell calls against new CLI

**Success criteria:**
1. `pi-gsd-tools state json` returns the same JSON output as before migration (functional parity confirmed)
2. `pi-gsd-tools --help` displays a structured command tree auto-generated from oclif class metadata (no manual help strings)
3. `pi-gsd-tools wxp process --input "<gsd-paste name='x' />"` calls the WXP engine and returns processed output
4. `commander` is absent from `package.json` dependencies and `node_modules`
5. A smoke test of all `<shell command="pi-gsd-tools">` invocations used across the most-trafficked workflows succeeds with the oclif-based CLI

---

## Phase 3: Type Cleanup

**Goal:** Eliminate every `any` from `src/`, `.gsd/extensions/`, and `src/wxp/`; replace `FrontmatterObject` with a proper recursive `YamlValue` type; enforce `no-explicit-any: error` in ESLint with zero exceptions.

**Requirements:** TYP-01, TYP-02, TYP-03, TYP-04, TYP-05, TYP-06

**Build order (within phase):**
1. Define `YamlValue` recursive type and update `FrontmatterObject` in `frontmatter.ts`
2. Fix all call sites broken by `FrontmatterObject` type change (use `unknown` + type guards at JSON.parse boundaries)
3. Fix `output.ts` `AnyValue = any` → `unknown` + type guards
4. Fix `config.ts` dynamic object access via Zod-inferred types
5. Fix `state.ts` `any` usage
6. Remove all `eslint-disable @typescript-eslint/no-explicit-any` comments
7. Add ESLint rule `@typescript-eslint/no-explicit-any: error`; verify CI passes

**Success criteria:**
1. `grep -rn ": any\|= any\|<any>\|as any" src/ --include="*.ts"` returns zero matches
2. `grep -rn "eslint-disable.*no-explicit-any" src/` returns zero matches
3. `npm run typecheck` passes with zero errors across the entire `src/` tree
4. ESLint with `no-explicit-any: error` passes with zero violations
5. `FrontmatterObject` is `Record<string, YamlValue>` where `YamlValue` is a proper recursive type covering all YAML primitives, arrays, and nested objects

---

## Phase 4: Workflow Conversion

**Goal:** Convert all GSD workflow files to use WXP directives, eliminating the need for the LLM to execute bash commands for setup. Start with `execute-phase.md` as the pilot to validate the full pipeline, then convert all remaining workflows.

**Requirements:** WFL-01, WFL-02, WFL-03, WFL-04, WFL-05

**Depends on:** Phase 1 (WXP engine must be complete), Phase 2 (oclif CLI must be available for `<shell>` calls)

**Build order (within phase):**
1. Backup and convert `execute-phase.md` (pilot) - validate full WXP pipeline end-to-end
2. Commit `.bak` file for pilot
3. Convert high-traffic workflows: `plan-phase.md`, `discuss-phase.md`, `new-project.md`, `new-milestone.md` - backup each
4. Convert all remaining workflows incrementally
5. Add `<gsd-version v="X.Y.Z" />` tag to all converted files
6. Add `do-not-update` flag support to version tag parser

**Success criteria:**
1. `/gsd-execute-phase 16` completes a full phase execution without the LLM issuing any `bash` or `run_bash` tool calls for setup (init/state/config data arrives pre-injected via `<gsd-paste>`)
2. `.bak` files for all converted workflows are committed to git and accessible via `git show HEAD~N:<path>`
3. All converted workflow files contain a `<gsd-version v="X.Y.Z" />` tag where X.Y.Z matches the published package version
4. A workflow file with `<gsd-version v="X.Y.Z" do-not-update />` is not overwritten when the harness copy-on-first-run runs for a newer package version

---

## Phase 5: Harness Distribution

**Goal:** Replace the fragile symlink-based harness distribution with a stable copy-on-first-run system, add version-aware update prompts, migrate existing symlinks, and publish the `pi-gsd-settings.json` security config schema.

**Requirements:** HRN-01, HRN-02, HRN-03, HRN-04, HRN-05, HRN-06, HRN-07

**Build order (within phase):**
1. Write copy-on-first-run logic in `gsd-hooks.ts` `session_start` handler
2. Add symlink detection: `lstatSync` check → if symlink, replace with real copy + log notification
3. Add version comparison: read `<gsd-version>` from project harness files, compare to package version
4. Implement update prompt handler (`y/n/pick/diff`)
5. Remove `ensureHarnessSymlink()` and all symlink-related code
6. Author `src/schemas/pi-gsd-settings.schema.json`
7. Implement global `~/.gsd/pi-gsd-settings.json` loading
8. Implement project-level `.pi/gsd/pi-gsd-settings.json` override merge

**Success criteria:**
1. On a fresh project (no `.pi/gsd/` directory), `session_start` populates `.pi/gsd/` with real file copies from the package harness (confirmed by `ls -la .pi/gsd/` showing files, not symlinks)
2. On a project from v1.12.x with symlinks at `.pi/gsd/`, the next session start replaces all symlinks with real files and displays a notification - confirmed by `ls -la .pi/gsd/` post-session
3. When the package version is newer than the project harness, the update prompt appears and each option (`y`/`n`/`pick`/`diff`) behaves correctly
4. `grep -r "ensureHarnessSymlink" .gsd/ src/` returns zero matches
5. A global `~/.gsd/pi-gsd-settings.json` with a custom `shellAllowlist` entry is respected by the WXP security module; a project-level `pi-gsd-settings.json` override takes precedence

---

## Requirement Coverage

| Requirement | Phase   |
| ----------- | ------- |
| WXP-01      | Phase 1 |
| WXP-02      | Phase 1 |
| WXP-03      | Phase 1 |
| WXP-04      | Phase 1 |
| WXP-05      | Phase 1 |
| WXP-06      | Phase 1 |
| WXP-07      | Phase 1 |
| WXP-08      | Phase 1 |
| WXP-09      | Phase 1 |
| WXP-10      | Phase 1 |
| WXP-11      | Phase 1 |
| WXP-12      | Phase 1 |
| WXP-13      | Phase 1 |
| WXP-14      | Phase 1 |
| INC-01      | Phase 1 |
| INC-02      | Phase 1 |
| INC-03      | Phase 1 |
| TST-01      | Phase 1 |
| TST-02      | Phase 1 |
| TST-03      | Phase 1 |
| CLI-01      | Phase 2 |
| CLI-02      | Phase 2 |
| CLI-03      | Phase 2 |
| CLI-04      | Phase 2 |
| CLI-05      | Phase 2 |
| CLI-06      | Phase 2 |
| TYP-01      | Phase 3 |
| TYP-02      | Phase 3 |
| TYP-03      | Phase 3 |
| TYP-04      | Phase 3 |
| TYP-05      | Phase 3 |
| TYP-06      | Phase 3 |
| WFL-01      | Phase 4 |
| WFL-02      | Phase 4 |
| WFL-03      | Phase 4 |
| WFL-04      | Phase 4 |
| WFL-05      | Phase 4 |
| HRN-01      | Phase 5 |
| HRN-02      | Phase 5 |
| HRN-03      | Phase 5 |
| HRN-04      | Phase 5 |
| HRN-05      | Phase 5 |
| HRN-06      | Phase 5 |
| HRN-07      | Phase 5 |

**Coverage:** 44/44 v1 requirements mapped ✓

---
*Roadmap created: 2026-04-06*

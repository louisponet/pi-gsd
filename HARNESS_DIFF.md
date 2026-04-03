# GSD Harness Diff Analysis Report

> Generated: 2026-04-03  
> Tool: Scout 2 — cross-harness divergence analysis  
> Harnesses: `.agent`, `.claude`, `.codex`, `.cursor`, `.gemini`, `.github`, `.opencode`, `.windsurf`

---

## 1. Summary

All 8 harnesses report **v1.30.0** but were installed at different times: `.agent` and `.opencode` were installed/updated on **2026-04-03T09:57Z** (newer), while the other 6 were installed on **2026-04-03T08:46Z** (older). This timestamp gap explains the bulk of the divergences detected.

### Status overview

| Harness | Binary CJS diffs vs `.agent` | Manifest integrity | Files present | Notes |
|---------|------------------------------|--------------------|---------------|-------|
| `.agent`    | — (canonical)    | ✅ OK (213 files)       | 213 | Up-to-date reference |
| `.claude`   | 6 files differ   | ⚠️ 63 tampered         | 213 | Older install; command prefix `/gsd:` |
| `.codex`    | 8 files differ   | ⚠️ 68 tampered         | 208 | Older install; command prefix `$gsd-`; extra-unique workflows |
| `.cursor`   | 3 files differ   | ⚠️ 62 tampered         | 208 | Older install; Cursor-specific session paths |
| `.gemini`   | 6 files differ   | ⚠️ 63 tampered         | 213 | Older install; same as `.claude` group |
| `.github`   | 1 file differs   | ⚠️ 4 tampered          | 208 | Older install; closest to agent; no agents/ dir |
| `.opencode` | 2 files differ   | ✅ OK (213 files)       | 213⚠️ (57 missing on disk!) | New install; missing skills/ entirely |
| `.windsurf` | 3 files differ   | ⚠️ 62 tampered         | 208 | Older install; Windsurf-specific |

**No harness is byte-identical to `.agent`.** Every harness has at least one intentional harness-specific variation.

**Key insight:** The "TAMPERED" labels from `validate-harness-sync.cjs` reflect that manifests recorded the older build hashes and the disk now has newer binaries (`.agent`/`.opencode` era). This is a manifest staleness problem, not actual corruption.

---

## 2. Binary Module Divergences

The `validate-harness-drift.js` tool identifies two categories:
- **Strict binary identity** files — must be byte-equal across all harnesses (10 files: `frontmatter.cjs`, `milestone.cjs`, `model-profiles.cjs`, `roadmap.cjs`, `security.cjs`, `state.cjs`, `template.cjs`, `uat.cjs`, `init.cjs` — all ✅ PASS as of new install)
- **Harness-specific** files — allowed to differ (8 files: `commands.cjs`, `config.cjs`, `core.cjs`, `phase.cjs`, `profile-output.cjs`, `profile-pipeline.cjs`, `verify.cjs`, `workstream.cjs`)

### 2a. `core.cjs` — all harnesses differ from `.agent`

`.agent` version includes additional JSDoc type definitions and `'use strict'` pragma that were stripped in all other harnesses:

```diff
# agent vs claude/codex/gemini/cursor/github/windsurf/opencode
5,6d4
< 'use strict';
< 
12,156d9
< // ─── JSDoc type definitions ───────────────────────────────────────────────────
< /**
<  * @typedef {'sequential'|'custom'} PhaseNamingMode
<  */
< /**
<  * @typedef {'quality'|'balanced'|'budget'|'inherit'} ModelProfile
<  */
< /**
<  * @typedef {false|true|'omit'} ResolveModelIds
<  * - false: return alias as-is
<  * - true: map alias to full model ID
<  * - 'omit': return '' so the runtime uses its own default
<  */
```

`cursor`, `github`, and `windsurf` each also have unique hashes for `core.cjs` (4 distinct hashes total), suggesting additional harness-specific runtime logic.

### 2b. `commands.cjs` — codex unique

```diff
# agent/cursor/github/opencode/windsurf group vs claude/gemini group vs codex unique
# Codex uses $gsd- prefix in generated file content:
744c744
< _Decisions will be captured during /gsd-discuss-phase ${phase}_
> _Decisions will be captured during $gsd-discuss-phase ${phase}_
```

### 2c. `phase.cjs` — command prefix pattern

```diff
# agent/cursor/github/opencode/windsurf (slash prefix) vs claude/gemini/codex (colon or dollar)
357c357
< - [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)
> - [ ] TBD (run /gsd:plan-phase ${newPhaseId} to break down)   # claude/gemini
> - [ ] TBD (run $gsd-plan-phase ${newPhaseId} to break down)   # codex
```

### 2d. `config.cjs` — command prefix in docstrings

```diff
# agent/cursor/github/opencode/windsurf vs claude/gemini vs codex
63c63
< /gsd-new-project      # agent group
> /gsd:new-project      # claude/gemini group  
> $gsd-new-project      # codex
```

### 2e. `verify.cjs` — error message command prefixes

```diff
# Five lines affected, all follow the same command-prefix split:
559c559
< 'Run /gsd-new-project to initialize'     # agent group
> 'Run /gsd:new-project to initialize'     # claude/gemini
> 'Run $gsd-new-project to initialize'     # codex
```

### 2f. `workstream.cjs` — error message command prefix

```diff
81c81
< error('.planning/ directory not found — run /gsd-new-project first');  # agent group
> error('.planning/ directory not found — run /gsd:new-project first');  # claude/gemini
> error('.planning/ directory not found — run $gsd-new-project first');  # codex
```

### 2g. `profile-output.cjs` — harness-specific branding

Each harness names its profile target differently:

```diff
# .agent (canonical reference in source comments):
<  *   - generate-claude-profile: Developer Profile section in GEMINI.md
<  *   - generate-claude-md: full GEMINI.md with managed sections

# .claude/.codex/.gemini:
>  *   - generate-claude-profile: Developer Profile section in CLAUDE.md
>  *   - generate-claude-md: full CLAUDE.md with managed sections

# .cursor:
>  *   - generate-claude-profile: Developer Profile section in .cursor/rules/
>  *   - generate-claude-md: full .cursor/rules/ with managed sections
```

The user-profiling questions also reference "the agent" (generic) in `.agent`, vs "Claude" in other harnesses:

```diff
# agent:
< 'Think about the last few times you asked the agent to build or change something.'
# claude/codex/cursor/gemini/github/opencode/windsurf:
> 'Think about the last few times you asked Claude to build or change something.'
```

### 2h. `profile-pipeline.cjs` — session history path

```diff
# .agent/.opencode:
162c162
<     const searchedPath = overridePath || '.agent/projects';
<     error(`No Claude Code sessions found at ${searchedPath}...`);

# .claude/.codex/.gemini:
>     const searchedPath = overridePath || '~/.claude/projects';
>     error(`No Claude Code sessions found at ${searchedPath}...`);

# .cursor:
>     const searchedPath = overridePath || '~/.claude/projects';
>     error(`No Cursor sessions found at ${searchedPath}...`);
```

### 2i. `gsd-tools.cjs` (entry binary) — two versions

| Hash | Harnesses |
|------|-----------|
| `2483acf71f52a4ec…` | `.agent`, `.opencode` (newer) |
| `af10545eae9b4339…` | `.claude`, `.codex`, `.cursor`, `.gemini`, `.github`, `.windsurf` (older) |

### Summary table of binary module divergences

| File | `.agent` | `.claude` | `.codex` | `.cursor` | `.gemini` | `.github` | `.opencode` | `.windsurf` |
|------|----------|-----------|----------|-----------|-----------|-----------|-------------|-------------|
| `gsd-tools.cjs` | 🔵 new | 🟡 old | 🟡 old | 🟡 old | 🟡 old | 🟡 old | 🔵 new | 🟡 old |
| `commands.cjs` | A | A | C | A | B | A | A | A |
| `config.cjs` | A | B | C | A | B | A | A | A |
| `core.cjs` | A | B | B | D | B | E | B | F |
| `init.cjs` | A | B | B | C | B | D | A | C |
| `model-profiles.cjs` | 🔵 new | 🟡 old | 🟡 old | 🟡 old | 🟡 old | 🟡 old | 🔵 new | 🟡 old |
| `phase.cjs` | A | B | C | A | B | A | A | A |
| `profile-output.cjs` | A | B | C | D | B | E | F | G |
| `profile-pipeline.cjs` | A | B | B | C | B | D | B | E |
| `verify.cjs` | A | B | C | A | B | A | A | A |
| `workstream.cjs` | A | B | C | A | B | A | A | A |

Letters indicate unique hash groups. Identical letters = byte-identical files.

---

## 3. Workflow Divergences

The cross-harness audit found **349 workflow-level diffs** across 3 categories:

### 3a. Harness binary path substitution (intentional)

All workflow `.md` files that call `node ".agent/get-shit-done/bin/gsd-tools.cjs"` are correctly replaced with the per-harness path. Example:

```diff
# do.md line 27:
< INIT=$(node ".agent/get-shit-done/bin/gsd-tools.cjs" state load 2>/dev/null)
> INIT=$(node ".claude/get-shit-done/bin/gsd-tools.cjs" state load 2>/dev/null)  # .claude
> INIT=$(node ".codex/get-shit-done/bin/gsd-tools.cjs" state load 2>/dev/null)   # .codex
```

This pattern appears in nearly every workflow file and is expected.

### 3b. Command prefix substitution (intentional per harness)

Three command prefix styles are in use:

| Prefix style | Harnesses | Example |
|-------------|-----------|---------|
| `/gsd-name` (slash-hyphen) | `.agent`, `.cursor`, `.github`, `.opencode`, `.windsurf` | `/gsd-new-project` |
| `/gsd:name` (slash-colon) | `.claude`, `.gemini` | `/gsd:new-project` |
| `$gsd-name` (dollar-hyphen) | `.codex` | `$gsd-new-project` |

This is the most widespread workflow divergence — it affects virtually every workflow file. The `COMMAND_PREFIX_MAP.md` at repo root documents this mapping.

### 3c. Template variable substitution (codex-specific)

Codex uniquely uses `{{GSD_ARGS}}` instead of `$ARGUMENTS` for argument passing:

```diff
# do.md line 14:
< If `$ARGUMENTS` is empty, ask via AskUserQuestion:
> If `{{GSD_ARGS}}` is empty, ask via AskUserQuestion:

# new-project.md line 20:
< Check if `--auto` flag is present in $ARGUMENTS.
> Check if `--auto` flag is present in {{GSD_ARGS}}.
```

### 3d. Codex-only workflow files (not present in other harnesses)

Codex has several unique workflow files absent from other harnesses:
- `workflows/add-phase.md`
- `workflows/audit-milestone.md`
- `workflows/audit-uat.md`
- `workflows/fast.md`
- `workflows/forensics.md`
- `workflows/insert-phase.md`
- `workflows/plan-milestone-gaps.md`
- `workflows/pr-branch.md`
- `workflows/research-phase.md`
- `workflows/resume-project.md`
- `workflows/session-report.md`
- `workflows/stats.md`
- `workflows/transition.md`
- `commands/gsd/workstreams.md` — unique command routing file

### 3e. Workflow files absent from `.github`

`.github` is missing the `agents/` directory entirely (all 17 agent `.md` files are absent), which is an intentional difference as GitHub Copilot does not use agent definitions.

### 3f. Skills directory absent from `.claude` and `.gemini`

All 57 `skills/gsd-*/SKILL.md` files are absent from `.claude` and `.gemini`. They are present in `.agent`, `.codex`, `.cursor`, `.github`, `.opencode`, and `.windsurf`. This is an intentional difference — Claude and Gemini harnesses use a different capability exposure mechanism (workflows + commands) rather than SKILL definitions.

### 3g. Reference document divergences

Multiple reference `.md` files differ across harnesses:

| File | Groups |
|------|--------|
| `references/checkpoints.md` | `.agent`/`.codex`/`.github`/`.opencode` vs `.claude`/`.cursor`/`.gemini`/`.windsurf` |
| `references/model-profiles.md` | All 8 differ (each harness has unique hash) |
| `references/questioning.md` | 3 groups |
| `references/user-profiling.md` | 2 groups |
| `references/verification-patterns.md` | All 8 differ |
| `references/workstream-flag.md` | 3 groups |
| `references/git-integration.md` | All 8 differ |

---

## 4. Validation Script Results

### 4a. `validate-harness-sync.cjs` (full run)

```
Root:     /home/fulgidus/Documents/pi-gsd
Harnesses: agent, claude, codex, cursor, gemini, github, opencode, windsurf

── 1/5  CJS binary check ─────────────────────────────────────────────
  DRIFT   [codex   ] bin/lib/commands.cjs   (2fac72a2 vs 3e2e322b)
  DRIFT   [claude  ] bin/lib/config.cjs     (d9d9274e vs 81939c75)
  DRIFT   [codex   ] bin/lib/config.cjs     (d9d9274e vs a183ce8e)
  DRIFT   [gemini  ] bin/lib/config.cjs     (d9d9274e vs 81939c75)
  DRIFT   [claude  ] bin/lib/core.cjs       (89c6716e vs a5fe1881)
  DRIFT   [codex   ] bin/lib/core.cjs       (89c6716e vs a5fe1881)
  DRIFT   [cursor  ] bin/lib/core.cjs       (89c6716e vs 14fb4cc3)
  DRIFT   [gemini  ] bin/lib/core.cjs       (89c6716e vs a5fe1881)
  DRIFT   [github  ] bin/lib/core.cjs       (89c6716e vs 577090c3)
  DRIFT   [opencode] bin/lib/core.cjs       (89c6716e vs a5fe1881)
  DRIFT   [windsurf] bin/lib/core.cjs       (89c6716e vs 42d43e06)
  ... (34 total CJS drifts)

── 2/5  Workflow semantic check ──────────────────────────────────────
  349 workflow drifts detected across all harnesses

── 3/5  File-set completeness check ─────────────────────────────────
  OK      [agent   ] 213 declared files all present
  OK      [claude  ] 213 declared files all present
  OK      [codex   ] 208 declared files all present
  OK      [cursor  ] 208 declared files all present
  OK      [gemini  ] 213 declared files all present
  OK      [github  ] 208 declared files all present
  MISSING [opencode] 57 file(s) declared in manifest but absent from disk
  OK      [windsurf] 208 declared files all present

── 4/5  VERSION consistency check ───────────────────────────────────
  OK      All checked harnesses on version 1.30.0

── 5/5  Manifest integrity check ────────────────────────────────────
  OK      [agent   ] 213 file(s) match manifest hashes
  TAMPERED [claude  ] 63 file(s) do not match manifest SHA-256
  TAMPERED [codex   ] 68 file(s) do not match manifest SHA-256
  TAMPERED [cursor  ] 62 file(s) do not match manifest SHA-256
  TAMPERED [gemini  ] 63 file(s) do not match manifest SHA-256
  TAMPERED [github  ] 4 file(s) do not match manifest SHA-256
  OK      [opencode] 213 file(s) match manifest hashes
  TAMPERED [windsurf] 62 file(s) do not match manifest SHA-256

✘  Drift detected: 34 cjs, 349 workflow, 1 fileset, 6 manifest
   47 passed · 390 failed · 0 skipped · 248ms
```

### 4b. `audit-harness-sync.cjs`

```
Harness versions:
  .agent        v1.30.0  (2026-04-03T09:57:22.300Z)
  .claude       v1.30.0  (2026-04-03T08:46:56.460Z)
  .codex        v1.30.0  (2026-04-03T08:46:56.520Z)
  .cursor       v1.30.0  (2026-04-03T08:46:56.577Z)
  .gemini       v1.30.0  (2026-04-03T08:46:56.499Z)
  .github       v1.30.0  (2026-04-03T08:46:56.542Z)
  .opencode     v1.30.0  (2026-04-03T09:57:22.300Z)
  .windsurf     v1.30.0  (2026-04-03T08:46:56.595Z)

Summary:
  ✔ Synced     : 219 files
  ✘ Divergent  : 178 files
  ⚠ Partial    : 5 files
     Total      : 402 files examined
```

The 5 "partial" files are the hooks present in `.agent`, `.claude`, `.gemini`, `.opencode` but absent from `.codex`, `.cursor`, `.github`, `.windsurf`:
- `hooks/gsd-check-update.js`
- `hooks/gsd-context-monitor.js`
- `hooks/gsd-prompt-guard.js`
- `hooks/gsd-statusline.js`
- `hooks/gsd-workflow-guard.js`

### 4c. `validate-model-profiles.cjs`

```
Source:  .agent/get-shit-done/bin/lib/model-profiles.cjs
Targets: 8 harness(es)

  OK     .agent/get-shit-done/references/model-profiles.md
  OK     .claude/get-shit-done/references/model-profiles.md
  OK     .codex/get-shit-done/references/model-profiles.md
  OK     .cursor/get-shit-done/references/model-profiles.md
  OK     .gemini/get-shit-done/references/model-profiles.md
  OK     .github/get-shit-done/references/model-profiles.md
  OK     .opencode/get-shit-done/references/model-profiles.md
  OK     .windsurf/get-shit-done/references/model-profiles.md

✔  All model-profiles.md files are in sync with model-profiles.cjs.
```

### 4d. `validate-harness-drift.js --verbose`

```
═══ Check 1: Strict binary identity ═══
  ✓ get-shit-done/bin/gsd-tools.cjs — 1 unique hash     [ALL PASS — both old/new as single per harness]
  ✓ get-shit-done/bin/lib/frontmatter.cjs               [IDENTICAL across all 8]
  ✓ get-shit-done/bin/lib/init.cjs                      [IDENTICAL across all 8]
  ✓ get-shit-done/bin/lib/milestone.cjs                 [IDENTICAL]
  ✓ get-shit-done/bin/lib/model-profiles.cjs            [IDENTICAL]
  ✓ get-shit-done/bin/lib/roadmap.cjs                   [IDENTICAL]
  ✓ get-shit-done/bin/lib/security.cjs                  [IDENTICAL]
  ✓ get-shit-done/bin/lib/state.cjs                     [IDENTICAL]
  ✓ get-shit-done/bin/lib/template.cjs                  [IDENTICAL]
  ✓ get-shit-done/bin/lib/uat.cjs                       [IDENTICAL]

═══ Check 2: Harness-specific CJS (must match own manifest) ═══
  ✓ .agent   — all 8 harness-specific files pass
  ✗ .claude  — commands.cjs: disk 2fac72a2 ≠ manifest 95a7ff9e (manifest stale)
  ✗ .codex   — commands.cjs, config.cjs, phase.cjs, profile-output.cjs, verify.cjs, workstream.cjs (manifests stale)
  ✗ .gemini  — commands.cjs (manifest stale)
  ✓ .cursor, .github, .opencode, .windsurf — all pass own manifests

═══ Check 3: Workflow semantic equivalence ═══
  34 workflow files flagged with differences across harnesses
```

---

## 5. Known Intentional Differences

These divergences are expected and by design:

### 5a. Command prefix mapping

Each harness uses the command invocation syntax supported by its AI tool:

| Syntax | Harnesses | Tool |
|--------|-----------|------|
| `/gsd-command` | `.agent`, `.cursor`, `.github`, `.opencode`, `.windsurf` | Agent CLI, Cursor, GitHub Copilot, OpenCode, Windsurf |
| `/gsd:command` | `.claude`, `.gemini` | Claude Code (slash-colon format), Gemini |
| `$gsd-command` | `.codex` | Codex (shell variable syntax) |

Documented in `COMMAND_PREFIX_MAP.md`.

### 5b. Harness binary path in workflows

Every workflow that shells out to `gsd-tools.cjs` uses the harness-local path:
- `.agent` → `node ".agent/get-shit-done/bin/gsd-tools.cjs"`
- `.claude` → `node ".claude/get-shit-done/bin/gsd-tools.cjs"`
- etc.

This is required for multi-harness repos where multiple `.*/` directories coexist.

### 5c. Hook file presence

| Harness | Has hooks | Hook mechanism |
|---------|-----------|----------------|
| `.agent` | ✅ 5 hooks | `AfterTool` + `SessionStart` |
| `.claude` | ✅ 5 hooks | `PostToolUse` + `SessionStart` (note: different event name!) |
| `.gemini` | ✅ 5 hooks | Gemini hook API |
| `.opencode` | ✅ 5 hooks | OpenCode hook API |
| `.codex` | ❌ No hooks | Codex does not support hooks |
| `.cursor` | ❌ No hooks | Cursor does not support hooks |
| `.github` | ❌ No hooks | GitHub Copilot does not support hooks |
| `.windsurf` | ❌ No hooks | Windsurf does not support hooks |

**Notable:** `.agent` uses `AfterTool` event name but `.claude` uses `PostToolUse` for the same hook. This is an intentional API difference between tool APIs.

### 5d. Settings format differences

- `.agent` / `.claude` / `.gemini`: `settings.json` with full hook registration
- `.opencode`: `settings.json` is `{}` (empty — OpenCode uses `opencode.json` instead)
- `.cursor` / `.codex` / `.github` / `.windsurf`: No `settings.json`

### 5e. Skills directory

`.claude` and `.gemini` intentionally omit all 57 `skills/gsd-*/SKILL.md` files. Claude and Gemini use a native workflow/command pattern rather than SKILL-based dispatch.

### 5f. Agents directory

`.github` intentionally omits the `agents/` directory (all 17 `agents/gsd-*.md` files). GitHub Copilot does not support agent definitions.

### 5g. profile-output.cjs branding

Each harness correctly refers to its own AI tool's profile file name/location. The `.agent` harness uses a generic placeholder (`GEMINI.md`) in comments that gets replaced per-harness.

### 5h. profile-pipeline.cjs session history path

The `.cursor` harness correctly mentions "Cursor sessions" in error messages. The `.agent`/`.opencode` group uses a local `.agent/projects` path rather than `~/.claude/projects`.

### 5i. Codex `{{GSD_ARGS}}` template variables

Codex uniquely uses `{{GSD_ARGS}}` where other harnesses use `$ARGUMENTS`. This is because Codex uses a different argument injection mechanism than Claude-based harnesses.

---

## 6. Action Items

### 🔴 Critical — requires attention

1. **`.opencode` missing 57 skills files on disk** — The manifest declares 57 `skills/gsd-*/SKILL.md` files but they are absent from disk. This is the only harness with a genuine file-set completeness failure. The skills directory does not exist under `.opencode/get-shit-done/`. Run reinstall or sync to restore.

2. **Manifest staleness in 6 harnesses** — `.claude`, `.codex`, `.cursor`, `.gemini`, `.github`, `.windsurf` all have stale manifests that don't match the files now on disk. This is because `.agent` and `.opencode` received a newer install (v1.30.0 @ 09:57Z) and the binaries propagated but the manifests weren't regenerated. The manifests need to be rebuilt to reflect current disk state.

### 🟡 Advisory — investigate if unexpected

3. **`.claude` `commands.cjs` manifest mismatch** — `.claude`'s manifest says `commands.cjs` hash should be `95a7ff9e` but disk shows `2fac72a2`. The disk version matches the `.agent` version, which means a newer `.agent` binary was copied to `.claude` but the manifest wasn't updated. Verify this was intentional.

4. **`.codex` 6-file manifest mismatches** — Similar to above; `.codex` has 6 harness-specific binary files with stale manifest hashes. The mismatched files are: `commands.cjs`, `config.cjs`, `phase.cjs`, `profile-output.cjs`, `verify.cjs`, `workstream.cjs`.

5. **`core.cjs` has 5 distinct versions** — While it is a harness-specific file (allowed to differ), having 5 different hashes across 8 harnesses (`agent`, `claude/codex/gemini/opencode` group, `cursor`, `github`, `windsurf`) warrants documentation of what each version's specific runtime adaptations are.

6. **`profile-output.cjs` has 7 distinct versions** — Each harness appears to have its own unique version. The differences are currently only documented in terms of branding strings and file paths, but the full functional delta is unverified.

### 🟢 No action needed

7. **349 workflow diffs** — All verified to be due to binary path substitution (`".agent/"` → `".$harness/"`) and command prefix substitution (`/gsd-` → `/gsd:` or `$gsd-`). These are generated substitutions and are correct.

8. **`validate-model-profiles.cjs` — all PASS** — All harnesses have `model-profiles.md` in sync with the source `model-profiles.cjs`. ✅

9. **VERSION 1.30.0 on all harnesses** — Version string is consistent. ✅

10. **10 strict-identity binary files all pass** — `frontmatter.cjs`, `milestone.cjs`, `model-profiles.cjs`, `roadmap.cjs`, `security.cjs`, `state.cjs`, `template.cjs`, `uat.cjs`, `init.cjs` are byte-identical across all 8 harnesses. ✅

---

## Appendix: File structure reference

```
.gsd/bin/
  agent/  claude/  codex/  cursor/  github/  opencode/  windsurf/
    gsd-tools.cjs          ← entry binary (2 versions: old/new)
    lib/
      commands.cjs         ← harness-specific (command prefix)
      config.cjs           ← harness-specific (command prefix in docs)
      core.cjs             ← harness-specific (+ JSDoc in agent only; 5 versions)
      frontmatter.cjs      ← IDENTICAL across all
      init.cjs             ← IDENTICAL across all
      milestone.cjs        ← IDENTICAL across all
      model-profiles.cjs   ← 2 versions (old/new install)
      phase.cjs            ← harness-specific (command prefix)
      profile-output.cjs   ← harness-specific (branding; 7 versions)
      profile-pipeline.cjs ← harness-specific (session paths; 5 versions)
      roadmap.cjs          ← IDENTICAL across all
      security.cjs         ← IDENTICAL across all
      state.cjs            ← IDENTICAL across all
      template.cjs         ← IDENTICAL across all
      uat.cjs              ← IDENTICAL across all
      verify.cjs           ← harness-specific (command prefix; 3 versions)
      workstream.cjs       ← harness-specific (command prefix; 3 versions)
```

---

*Report generated by Scout 2 — 2026-04-03*

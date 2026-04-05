# PRD: WXP — Workflow XML Preprocessor

> **Version:** 1.0 draft
> **Author:** pi-gsd contributors
> **Date:** 2026-04-06
> **Status:** Draft

---

## 1. Problem Statement

pi-gsd workflow files currently embed raw bash commands that the LLM must execute via tool calls. This wastes tokens (the LLM runs `pi-gsd-tools init execute-phase "16"` as a bash command, parses the output, then continues), is provider-dependent (different LLMs handle bash differently), and creates a security surface (the LLM executes arbitrary shell commands).

The `<gsd-include>` system (v1.12) solved file injection but not command execution. Workflow files still instruct the LLM to run CLI commands for setup, state queries, and conditional logic — all of which can and should be handled programmatically before the LLM sees the text.

Additionally:
- `pi-gsd-tools` uses commander.js with loose typing and manual arg parsing
- Remaining `any` type aliases exist throughout the codebase
- Harness file distribution relies on fragile symlinks

---

## 2. Solution: WXP (Workflow XML Preprocessor)

A preprocessing engine that runs in the pi extension's `context` event, after template expansion and `<gsd-include>` injection, but before the LLM receives the messages.

WXP parses XML directives embedded in workflow files, executes them programmatically (shell commands, conditionals, string operations), stores results in a typed variable namespace, and replaces `<gsd-paste>` tags with computed values. The LLM receives clean text with all setup data pre-injected.

### 2.1 Processing Pipeline

```
User types /gsd-execute-phase 16
  │
  ├─ pi expands prompt template
  │   → <gsd-include path="..." /> + $ARGUMENTS
  │
  ├─ context event fires
  │   │
  │   ├─ Phase 1: <gsd-include> resolution (existing)
  │   │   → file contents injected inline
  │   │
  │   ├─ Phase 2: <gsd-arguments> parsing
  │   │   → $ARGUMENTS split into typed named variables
  │   │
  │   ├─ Phase 3: <gsd-execute> blocks
  │   │   → shell commands run, conditionals evaluated
  │   │   → results stored in variable namespace
  │   │
  │   ├─ Phase 4: <gsd-paste> replacement
  │   │   → variable values injected into text
  │   │
  │   └─ Phase 5: cleanup
  │       → all WXP XML tags stripped from final text
  │       → LLM receives clean markdown + pre-computed data
  │
  └─ LLM processes the fully prepared context
```

---

## 3. XML Tag Specification

### 3.1 `<gsd-include>`

**Status:** Implemented (v1.12). Stays as-is.

```xml
<gsd-include path=".pi/gsd/workflows/execute-phase.md" />
<gsd-include path=".pi/gsd/references/ui-brand.md" select="tag:core" />
<gsd-include path=".pi/gsd/references/ui-brand.md" select="heading:Anti-Patterns" />
<gsd-include path=".pi/gsd/references/ui-brand.md" select="lines:1-50" />
```

**Selectors:** `tag:NAME`, `heading:TEXT`, `lines:N-M`
**Valid chains:** `tag|heading`, `tag|lines`, `heading|tag`, `heading|lines`
**Invalid:** `lines` in any chain, 3+ segments
**On failure:** abort, red error notification.

### 3.2 `<gsd-arguments>`

Defines the typed argument schema for the workflow. Appears once per file, at the top.

```xml
<gsd-arguments>
  <settings>
    <keep-extra-args />     <!-- or <strict-args /> -->
    <delimiters>
      <delimiter type="string" value="\n" />
    </delimiters>
  </settings>
  <arg name="phase" type="number" />
  <arg name="auto-chain-active" type="flag" flag="--auto" optional />
  <arg name="user-text" type="string" optional />
</gsd-arguments>
```

**Arg types:** `string`, `number`, `boolean`, `flag`
- `flag`: boolean derived from presence of `flag="--flagname"` in $ARGUMENTS
- `optional`: absence is not an error; variable is `null`

**Settings:**
- `<keep-extra-args />`: extra positional args stored in `_extra` variable
- `<strict-args />`: extra args → error
- `<delimiters>`: how to split $ARGUMENTS (default: whitespace)

### 3.3 `<gsd-execute>`

Contains programmatic operations. Can appear multiple times. Executes top-to-bottom.

```xml
<gsd-execute>
  <shell command="pi-gsd-tools">
    <args>
      <arg string="init" />
      <arg string="execute-phase" />
      <arg name="phase" wrap='"' />
    </args>
    <outs>
      <out type="string" name="init" />
    </outs>
  </shell>
</gsd-execute>
```

#### 3.3.1 `<shell>`

Runs a CLI command. Only allowlisted executables permitted (see §5 Security).

**Attributes:**
- `command`: executable name (must be in allowlist)

**Children:**
- `<args>`: ordered list of arguments
  - `<arg string="literal" />`: literal string argument
  - `<arg name="varname" />`: variable reference
  - `<arg name="varname" wrap='"' />`: variable wrapped in quotes
- `<outs>`: output capture
  - `<out type="string" name="varname" />`: capture stdout into variable
  - `<suppress-errors />`: suppress stderr (equivalent to `2>/dev/null`)

**Behaviour:**
- No piped input. Ever.
- Timeout: 30 seconds per command.
- Non-zero exit + no `<suppress-errors />` → abort with error.
- Non-zero exit + `<suppress-errors />` → variable is empty string.

#### 3.3.2 `<if>`

Conditional execution.

```xml
<if>
  <condition>
    <equals>
      <left name="auto-chain-active" />
      <right type="boolean" value="false" />
    </equals>
  </condition>
  <then>
    <!-- operations -->
  </then>
</if>
```

**Condition operators (v1):**
- `<equals>`: strict equality
- `<starts-with>`: string prefix check

**Operands:**
- `<left name="varname" />` / `<right name="varname" />`: variable reference
- `<left type="string" value="..." />` / `<right type="boolean" value="true" />`: literal

#### 3.3.3 `<string-op>`

String manipulation.

```xml
<string-op op="split">
  <args>
    <arg name="init" />
    <arg type="string" value="@file:" />
  </args>
  <outs>
    <out type="string" name="init-file" />
  </outs>
</string-op>
```

**Operations (v1):** `split` only.
**Future (v2+):** `replace`, `trim`, `join`, `substring`.

### 3.4 `<gsd-paste>`

Injects a variable's value into the text.

```xml
<gsd-paste name="init" />
<gsd-paste name="agent-skills" />
<gsd-paste name="plan-index" />
```

**Rules:**
- Must appear AFTER the `<gsd-execute>` that populates the variable.
- Undefined variable → abort with error.
- The tag is replaced with the variable's string value.

---

## 4. Schema Validation

### 4.1 XSD 1.1

Canonical schema definition at `src/wxp/schema/wxp.xsd`. Defines:
- All tag names and nesting rules
- Attribute types and required/optional
- Content models for each element

Published alongside the package for external tooling / IDE support.

### 4.2 Zod (Runtime)

TypeScript Zod schemas at `src/wxp/schema.ts`. Validate the parsed XML AST before execution:
- Argument type correctness
- Selector chain validity
- Shell command allowlist enforcement
- Variable reference resolution (no undefined pastes)
- Condition operator type compatibility

All types are inferred from Zod schemas via `z.infer<>`. Zero `any`.

---

## 5. Security

### 5.1 Trusted File Locations

WXP tags are only processed in files loaded from:
1. **Package harness:** `<pkg>/.gsd/harnesses/pi/get-shit-done/`
2. **Project harness:** `<project>/.pi/gsd/` (copied from package, user-customisable)
3. **Override config:** `<project>/.pi/gsd/pi-gsd-settings.json` `trustedPaths` array

Files from `.planning/` are NEVER processed for WXP tags. The LLM can write to `.planning/` — if it could embed `<gsd-execute>` blocks there, it could execute arbitrary code via the engine.

### 5.2 Shell Command Allowlist

Only these executables are permitted in `<shell command="...">`:

```
pi-gsd-tools
git
node
cat
ls
echo
```

Any other executable → abort with error. No exceptions. Configurable via `pi-gsd-settings.json` `shellAllowlist` array (can only ADD, never remove the defaults).

### 5.3 No Piped Input

`<shell>` commands receive arguments only via `<args>`. No stdin piping, no heredocs, no shell metacharacters. The engine calls `execFileSync(command, args)` — never `execSync(string)`.

### 5.4 Timeout

30-second hard timeout per `<shell>` command. Configurable via `pi-gsd-settings.json` `shellTimeoutMs`.

---

## 6. Harness File Distribution

### 6.1 Replace Symlinks with Copy-on-First-Run

On `session_start`, the extension:
1. Checks if `<project>/.pi/gsd/` exists
2. If not: copies ALL files from `<pkg>/.gsd/harnesses/pi/get-shit-done/` into `<project>/.pi/gsd/`
3. If yes: compares file list. Copies MISSING files only. Never overwrites.
4. Version check: if `<pkg>` version is newer than last install, prompts:
   `"pi-gsd updated to vX.Y.Z. Update workflow files? (y/n/diff)"`
   - `y`: overwrites all harness files
   - `n`: keeps existing, records skip
   - `diff`: shows changed files, user picks per-file

### 6.2 Remove Symlink Logic

Delete `ensureHarnessSymlink()` and all symlink-related code. Symlinks are fragile (worktrees break them, build scripts nuke them). Copies are stable and user-customisable.

---

## 7. oclif Migration

### 7.1 Scope

Migrate `pi-gsd-tools` from commander.js to [oclif](https://oclif.io/):
- Each command becomes a class in `src/commands/`
- Typed flags and args via oclif decorators
- Built-in help generation
- Plugin architecture for future extensibility

### 7.2 Command Structure

```
pi-gsd-tools
├── state          (json | update | get | patch | ...)
├── progress       (json)
├── stats          (json)
├── roadmap        (get-phase | analyze | update-plan-progress)
├── phase          (add | insert | remove | complete | next-decimal)
├── milestone      (complete)
├── verify         (plan-structure | phase-completeness | ...)
├── validate       (health | consistency | agents)
├── template       (select | fill)
├── frontmatter    (get | set | merge | validate)
├── init           (execute-phase | plan-phase | new-project | ...)
├── config         (get | set | set-model-profile | new-project)
├── workstream     (create | list | status | complete | set | get)
├── scaffold
├── commit
├── generate-model-profiles-md
└── ...
```

### 7.3 Typing

All command args and flags are typed via oclif's `Flags` and `Args` utilities. No `parseNamedArgs()` manual parsing. No `Record<string, any>`.

---

## 8. Type Cleanup

### 8.1 Zero `any` Policy

Every `any` in the codebase is eliminated:
- `FrontmatterObject = Record<string, any>` → proper recursive YAML value type
- All `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments → removed
- WXP engine built with Zod-inferred types from day one
- oclif commands typed via framework decorators

### 8.2 Audit

Full grep for `any` across `src/`, `.gsd/extensions/`, and new `src/wxp/`. Zero remaining when done.

---

## 9. Architecture

```
src/
├── wxp/                          ← NEW: Workflow XML Preprocessor
│   ├── index.ts                  ← main entry: processWxp(text, cwd, vars) → string
│   ├── parser.ts                 ← XML tag extraction from markdown
│   ├── arguments.ts              ← <gsd-arguments> parsing + $ARGUMENTS splitting
│   ├── executor.ts               ← <gsd-execute> block runner
│   ├── shell.ts                  ← <shell> command execution (execFileSync, allowlist)
│   ├── conditions.ts             ← <if>/<equals>/<starts-with> evaluation
│   ├── string-ops.ts             ← <string-op> operations
│   ├── variables.ts              ← typed variable store (get/set/resolve)
│   ├── paste.ts                  ← <gsd-paste> replacement
│   ├── security.ts               ← trusted path validation, allowlist enforcement
│   ├── schema.ts                 ← Zod schemas for all WXP types
│   └── schema/
│       └── wxp.xsd               ← XSD 1.1 canonical schema
├── commands/                     ← NEW: oclif command classes
│   ├── state.ts
│   ├── progress.ts
│   ├── ...
│   └── index.ts
├── lib/                          ← existing domain modules (cleaned up)
│   ├── core.ts
│   ├── state.ts
│   ├── ...
│   └── schemas.ts
├── cli.ts                        ← oclif entrypoint (replaces commander router)
└── output.ts
```

---

## 10. Migration Path

### Phase 1: Foundation (no breaking changes)
1. Create `src/wxp/` directory structure
2. Implement parser, variable store, security module
3. Implement `<gsd-arguments>` parsing
4. Implement `<shell>` execution with allowlist
5. Implement `<if>` / `<equals>` / `<starts-with>`
6. Implement `<string-op op="split">`
7. Implement `<gsd-paste>` replacement
8. XSD 1.1 schema + Zod runtime schemas
9. Wire into `context` event after `<gsd-include>` phase
10. Unit tests for each module

### Phase 2: oclif migration (breaking: CLI interface)
1. Add oclif dependency
2. Migrate commands one-by-one from cli.ts switch/case to oclif classes
3. Typed flags and args
4. Remove commander.js dependency
5. Verify all workflow `<shell command="pi-gsd-tools">` calls still work

### Phase 3: Workflow conversion
1. Convert `execute-phase.md` as the pilot (highest-value workflow)
2. Convert remaining high-traffic workflows: `plan-phase.md`, `discuss-phase.md`, `new-project.md`
3. Convert remaining workflows incrementally

### Phase 4: Type cleanup
1. Eliminate all `any` across codebase
2. `FrontmatterObject` → proper recursive type
3. Audit + CI lint rule: `no-explicit-any` with zero exceptions

### Phase 5: Harness distribution overhaul
1. Replace symlinks with copy-on-first-run
2. Version-aware update prompting
3. Remove all symlink code

---

## 11. Success Criteria

- [ ] `/gsd-execute-phase 16` runs with zero LLM bash commands for setup
- [ ] All pi-gsd-tools init/state/config calls happen via `<gsd-execute>` blocks
- [ ] `<gsd-paste>` injects pre-computed data that the LLM consumes directly
- [ ] XSD schema validates all WXP tags at parse time
- [ ] Zod schemas enforce runtime type safety
- [ ] Zero `any` in codebase
- [ ] `pi-gsd-tools` runs via oclif with typed commands
- [ ] Harness files are copied (not symlinked), user-customisable, version-tracked
- [ ] No shell command executes without allowlist approval
- [ ] No `.planning/` file is ever processed for WXP tags

---

## 12. Non-Goals (v1)

- GUI/TUI for WXP debugging (use notifications)
- `<for-each>`, `<regex>`, `<json-parse>`, `<map>`, `<reduce>` (v2)
- `<string-op>` operations beyond `split` (v2)
- Remote file includes (URLs in `<gsd-include>`)
- Plugin system for custom WXP tags

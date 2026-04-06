# pi-gsd

> **Unofficial port of [Get Shit Done](https://github.com/gsd-build/get-shit-done) v1.30.0 for [pi](https://github.com/mariozechner/pi-coding-agent)**

[![npm version](https://img.shields.io/npm/v/pi-gsd.svg)](https://www.npmjs.com/package/pi-gsd)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

GSD is a structured software-delivery framework for AI coding agents. It wraps any AI coding session with a six-step phase lifecycle, slash commands, specialised subagents, background hooks, and model profiles — all backed by a git-committed `.planning/` directory that survives context resets.

---

## Install

```sh
pi install npm:pi-gsd
# or globally
npm install -g pi-gsd
```

Then start your first project:

```
/gsd-new-project
```

---

## What You Get

| Artifact       | Count | Description |
|----------------|------:|-------------|
| Skills         |    57 | `/gsd-*` slash commands loaded automatically |
| CLI binary     |     1 | `pi-gsd-tools` — state, scaffolding, model routing |
| WXP engine     |     1 | Pre-processor that eliminates LLM bash round-trips |
| Workflow files |    58 | Fully WXP-converted; 49 with active data injection |
| Hooks          |     1 | TypeScript extension: context monitor, WXP pipeline |

---

## The GSD Workflow

```
/gsd-new-project
  └─► /gsd-discuss-phase <N>
        └─► /gsd-plan-phase <N>
              └─► /gsd-execute-phase <N>
                    └─► /gsd-verify-work <N>
                          └─► /gsd-validate-phase <N>
                                └─► (next phase or /gsd-complete-milestone)
```

All project state lives in `.planning/` — committed to git, survives `/clear` and context resets.

---

## WXP — Workflow XML Preprocessor

v2.0 introduces WXP: an XML preprocessing engine that runs in the pi extension's `context` event, **before the LLM sees the message**. Workflow files embed XML directives that execute shell commands, evaluate conditions, iterate arrays, and inject the results — so the LLM receives clean, data-rich context with zero bash tool calls for setup.

### What it replaces

Before:
```bash
# The LLM was instructed to run this as a tool call
INIT=$(pi-gsd-tools init execute-phase "16")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

After (WXP runs this before the LLM ever sees the file):
```xml
<gsd-arguments>
  <arg name="phase" type="number" />
  <arg name="auto-chain-active" type="flag" flag="--auto" optional />
</gsd-arguments>

<gsd-execute>
  <shell command="pi-gsd-tools">
    <args>
      <arg string="init" /><arg string="execute-phase" /><arg name="phase" wrap='"' />
    </args>
    <outs><out type="string" name="init" /></outs>
  </shell>
  <if>
    <condition>
      <starts-with><left name="init" /><right type="string" value="@file:" /></starts-with>
    </condition>
    <then>
      <string-op op="split">
        <args><arg name="init" /><arg type="string" value="@file:" /></args>
        <outs><out type="string" name="init-file" /></outs>
      </string-op>
      <shell command="cat">
        <args><arg name="init-file" wrap='"' /></args>
        <outs><out type="string" name="init" /></outs>
      </shell>
    </then>
  </if>
</gsd-execute>

Phase init data: <gsd-paste name="init" />
```

### WXP element reference

| Element | Purpose |
|---------|---------|
| `<gsd-arguments>` | Parse `$ARGUMENTS` into typed named variables (two-pass: flags first, then positionals) |
| `<gsd-execute>` | Container for executable operations; removed from document after execution |
| `<shell command="...">` | Run an allowlisted command via `execFileSync`; `<args>/<outs>/<suppress-errors>` children |
| `<if><condition>...<then>...<else>` | Conditional execution with full condition expression support |
| `<for-each var="..." item="...">` | Iterate an array variable; optional `<where>` filter and `<sort-by>` |
| `<json-parse src="..." path="$.key" out="...">` | Extract a scalar or array from a JSON variable |
| `<string-op op="split">` | Split a variable on a delimiter; `<args>/<outs>` children |
| `<read-file path="..." out="...">` | Read any accessible file into a variable |
| `<write-file path="..." src="...">` | Create a new file from a variable (create-only, never overwrites) |
| `<display msg="..." level="info">` | Emit `ctx.ui.notify()` with `{varname}` interpolation; LLM never sees it |
| `<gsd-paste name="...">` | Inline-replace with a variable's value; undefined variable aborts processing |
| `<gsd-include path="..." include-arguments>` | Inject a trusted file; `include-arguments` pipes `$ARGUMENTS` into the include |
| `<gsd-version v="..." do-not-update>` | Version tag; `do-not-update` prevents harness auto-overwrite |

### Condition operators

Binary (all take `<left>` and `<right>` operands with `name=` or `type= value=`):
`equals` · `not-equals` · `starts-with` · `contains` · `less-than` · `greater-than` · `less-than-or-equal` · `greater-than-or-equal`

Add `type="number"` to either operand for numeric coercion.

Logical grouping (recursive, arbitrarily nestable): `<and>` · `<or>`

### Security

- WXP only processes files from trusted harness paths (package + project); `.planning/` files are **never** processed regardless of configuration
- `<shell>` is limited to an allowlist: `pi-gsd-tools git node cat ls echo find` (extensible via `pi-gsd-settings.json`)
- `<write-file>` is create-only and cannot target trusted harness paths
- Configurable via `~/.gsd/pi-gsd-settings.json` (global) or `.pi/gsd/pi-gsd-settings.json` (project)

Schema: `src/schemas/wxp.zod.ts` (Zod runtime) · `src/schemas/wxp.xsd` (XSD 1.1 canonical)

---

## CLI: `pi-gsd-tools`

```sh
pi-gsd-tools state json                     # dump STATE.md as JSON
pi-gsd-tools roadmap analyze --raw          # analyse ROADMAP.md
pi-gsd-tools progress json --raw            # progress summary
pi-gsd-tools validate health --repair       # check + auto-repair .planning/
pi-gsd-tools stats json                     # project statistics
pi-gsd-tools phase add "description"        # add a phase
pi-gsd-tools commit "message" --files a b   # commit with tracking
pi-gsd-tools wxp process --input "<gsd-paste name='x' />"  # run WXP directly

# Output formatting
pi-gsd-tools state json --output toon       # toon renderer
pi-gsd-tools state json --pick phase        # extract a field (JSONPath)
```

All commands are typed oclif classes — run `pi-gsd-tools --help` or `pi-gsd-tools <command> --help` for the full reference.

---

## Model Profiles

| Profile    | Description |
|------------|-------------|
| `quality`  | Maximum reasoning — Opus/Pro for all decision agents |
| `balanced` | Default — Sonnet/Flash tier |
| `budget`   | Cheapest available model per agent |
| `inherit`  | Use the session's current model everywhere |

Switch: `/gsd-set-profile <profile>`

---

## v2.0 vs v1.x

| | v1.x | v2.0 |
|--|:---:|:---:|
| WXP preprocessing engine | ❌ | ✅ |
| Zero LLM bash calls for setup | ❌ | ✅ |
| `<for-each>` + `<json-parse>` loops | ❌ | ✅ |
| `<display>` deterministic notifications | ❌ | ✅ |
| `<read-file>` / `<write-file>` | ❌ | ✅ |
| `<and>` / `<or>` condition nesting | ❌ | ✅ |
| Typed oclif CLI (was commander.js) | ❌ | ✅ |
| Zero `any` in codebase | ❌ | ✅ |
| `YamlValue` recursive frontmatter types | ❌ | ✅ |
| Copy-on-first-run harness (was symlinks) | ❌ | ✅ |
| Correct `_auto_chain_active` lifecycle | ❌ | ✅ |
| 116 vitest tests | ❌ | ✅ |

## v1.x vs GSD v1.30.0

| Feature | gsd v1.30 | pi-gsd |
|--------:|:---------:|:------:|
| `.planning/` data format | ✔️ | ✔️ |
| Workstreams | ✔️ | ✔️ |
| 4 model profiles | ✔️ | ✔️ |
| 18 subagents | ✔️ | ✔️ |
| 57 GSD skills | ✔️ | ✔️ |
| pi harness (`.pi/`) | ❌ | ✔️ |
| Background hooks | ❌ | ✔️ |
| Instant commands (no LLM) | ❌ | ✔️ |
| `<gsd-include>` context injection | ❌ | ✔️ |
| TypeScript source | ❌ | ✔️ |
| Runtime validation (Zod) | ❌ | ✔️ |

---

## Development

```sh
npm run typecheck    # zero-error TS check
npm run build        # bundle → dist/pi-gsd-tools.js
npm run check        # typecheck + build
npm test             # vitest (116 tests)
npm run lint         # ESLint no-explicit-any: error
node scripts/validate-model-profiles.cjs
```

---

## License

MIT — unofficial port. Original GSD by [Get Shit Done](https://github.com/gsd-build/get-shit-done).

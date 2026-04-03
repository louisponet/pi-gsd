# pi-gsd

Unofficial TypeScript port of [Get Shit Done](https://github.com/get-shit-done-cc/get-shit-done) v1.30.0.
A pi package that distributes GSD workflows, skills, and tooling across 8 AI coding harnesses.

## Commands

After ANY code change, run:

```bash
npm run typecheck
```

Before any publish or release:

```bash
npm run build && node scripts/build-harnesses.js --clean
node scripts/validate-model-profiles.cjs
node scripts/validate-harness-sync.cjs
```

Individual commands:

- `npm run typecheck` — Type-check TypeScript (no emit)
- `npm run build` — Bundle `src/cli.ts` → `dist/gsd-tools.js` (minified CJS)
- `npm run dev` — Watch mode build
- `npm run build:harnesses` — Assemble `.gsd/harnesses/` for publish
- `node scripts/validate-model-profiles.cjs` — Confirm model-profiles.md ↔ .cjs sync
- `node scripts/validate-harness-sync.cjs` — Full 5-check cross-harness integrity suite
- `node scripts/audit-harness-sync.cjs` — File hash comparison across harnesses

## Conventions

- **Tier-1 modules are byte-identical** across all 8 harnesses: `frontmatter.cjs`, `milestone.cjs`, `model-profiles.cjs`, `roadmap.cjs`, `security.cjs`, `state.cjs`, `template.cjs`, `uat.cjs`, `init.cjs`
- **Tier-2 modules** vary by harness — always edit via canonical source in `.gsd/bin/<harness>/lib/`, never directly in `.<harness>/get-shit-done/bin/lib/`
- **Hook files are hardlinked** — `.gsd/hooks/`, `.agent/hooks/`, `.claude/hooks/`, `.gemini/hooks/`, `.opencode/hooks/` share a single inode. Editing one edits all. Never copy them.
- **Command prefix rule** — `/gsd:<name>` (colon) is a Claude/Gemini internal dispatch mechanism only. Use `/gsd-<name>` (hyphen) everywhere else — in artefacts, error messages, ROADMAP entries.
- **Published files** — only `skills/`, `dist/`, `scripts/postinstall.js` ship. Do not add harness runtime dirs to `package.json` `files` field.
- **Never touch** — `*.lock`, `.env*`, `.git/hooks/*`
- **After ANY change to `model-profiles.cjs`** — run `validate-model-profiles.cjs` and stage updated markdown files

## Directory Structure

```
src/
├── cli.ts              # CLI entry point (~9k lines, lazy-loaded command router)
├── output.ts           # --output toon / --pick JSONPath formatting
└── lib/                # All domain modules (state, roadmap, phase, verify, ...)
skills/                 # 57 GSD skill definitions — published to npm
scripts/                # Build pipeline + cross-harness audit/validation tooling
.gsd/                   # Canonical hook source + per-harness CJS binary copies
  ├── hooks/            # Hardlink anchor for all 5 hook files
  └── bin/<harness>/    # Per-harness lib overrides (core.cjs, profile-output.cjs)
dist/                   # Build output (gitignored)
```

## Testing

No automated test suite. Validation is done via:

1. `npm run typecheck` — compile-time correctness
2. `node scripts/validate-harness-sync.cjs` — cross-harness integrity
3. `node scripts/validate-model-profiles.cjs` — model profile sync

## Key Files

- `TODO.md` — confirmed improvement backlog
- `HARNESS_DIFF.md` — cross-harness diff analysis
- `HOOKS_ARCHITECTURE.md` — hardlink model and hook install pipeline
- `COMMAND_PREFIX_MAP.md` — complete command inventory

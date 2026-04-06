# pi-gsd

pi-gsd - TypeScript port of GSD (get-shit-done-cc) v1.30.0 for pi.
A pi package that distributes GSD workflows, skills, and tooling for pi.

## Commands

After ANY code change, run:

```bash
npm run typecheck
```

Before any publish or release:

```bash
npm run build
node scripts/validate-model-profiles.cjs
```

Individual commands:

- `npm run typecheck` - Type-check TypeScript (no emit)
- `npm run build` - Bundle `src/cli.ts` → `dist/pi-gsd-tools.js` (minified CJS)
- `npm run dev` - Watch mode build
- `npm run build:harnesses` - Assemble `.gsd/harnesses/` for publish
- `node scripts/validate-model-profiles.cjs` - Confirm model-profiles.md ↔ .cjs sync
- 

## Conventions

- **CJS modules** in `.gsd/bin/pi/lib/` are the canonical source - never edit assembled output directly
- **Hook files** in `.gsd/hooks/` are the canonical source for the pi extension
- **Hook files are hardlinked** - `.gsd/hooks/`, `.agent/hooks/`, `.claude/hooks/`, `.gemini/hooks/`, `.opencode/hooks/` share a single inode. Editing one edits all. Never copy them.
- **Command prefix rule** - `/gsd:<name>` (colon) is a Claude/Gemini internal dispatch mechanism only. Use `/gsd-<name>` (hyphen) everywhere else - in artefacts, error messages, ROADMAP entries.
- **Published files** - only `skills/`, `dist/`, `scripts/postinstall.js` ship. Do not add harness runtime dirs to `package.json` `files` field.
- **Never touch** - `*.lock`, `.env*`, `.git/hooks/*`
- **After ANY change to `model-profiles.cjs`** - run `validate-model-profiles.cjs` and stage updated markdown files

## Directory Structure

```
src/
├── cli.ts              # CLI entry point (~9k lines, lazy-loaded command router)
├── output.ts           # --output toon / --pick JSONPath formatting
└── lib/                # All domain modules (state, roadmap, phase, verify, ...)
skills/                 # 57 GSD skill definitions - published to npm
scripts/                # Build pipeline + cross-harness audit/validation tooling
.gsd/                   # Canonical hook source + per-harness CJS binary copies
  ├── hooks/            # Hardlink anchor for all 5 hook files
  └── bin/<harness>/    # Per-harness lib overrides (core.cjs, profile-output.cjs)
dist/                   # Build output (gitignored)
```

## Testing

No automated test suite. Validation is done via:

1. `npm run typecheck` - compile-time correctness
2. 
3. `node scripts/validate-model-profiles.cjs` - model profile sync

## Key Files

- `TODO.md` - confirmed improvement backlog
- `HARNESS_DIFF.md` - cross-harness diff analysis
- `HOOKS_ARCHITECTURE.md` - hardlink model and hook install pipeline
- `COMMAND_PREFIX_MAP.md` - complete command inventory

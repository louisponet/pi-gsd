/**
 * model-profiles.ts - MODEL_PROFILES data + resolution + markdown generation.
 *
 * This is the single source of truth for model profiles. The markdown reference
 * file at `gsd/references/model-profiles.md (pi) or get-shit-done/references/model-profiles.md (other harnesses)` is auto-generated from
 * this data via:
 *
 *   node dist/gsd-tools.js generate-model-profiles-md [--harness <name>]
 *
 * Do NOT edit `references/model-profiles.md` by hand - changes will be overwritten.
 */

export type ModelAlias = "opus" | "sonnet" | "haiku" | "inherit";
export type ProfileKey = "quality" | "balanced" | "budget";
export type AgentName = string;

export interface AgentProfile {
    quality: ModelAlias;
    balanced: ModelAlias;
    budget: ModelAlias;
}

export const MODEL_PROFILES: Record<AgentName, AgentProfile> = {
    "gsd-planner": { quality: "opus", balanced: "opus", budget: "sonnet" },
    "gsd-roadmapper": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
    "gsd-executor": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
    "gsd-phase-researcher": {
        quality: "opus",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-project-researcher": {
        quality: "opus",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-research-synthesizer": {
        quality: "sonnet",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-debugger": { quality: "opus", balanced: "sonnet", budget: "sonnet" },
    "gsd-codebase-mapper": {
        quality: "sonnet",
        balanced: "haiku",
        budget: "haiku",
    },
    "gsd-verifier": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
    "gsd-plan-checker": {
        quality: "sonnet",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-integration-checker": {
        quality: "sonnet",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-nyquist-auditor": {
        quality: "sonnet",
        balanced: "sonnet",
        budget: "haiku",
    },
    "gsd-ui-researcher": { quality: "opus", balanced: "sonnet", budget: "haiku" },
    "gsd-ui-checker": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
    "gsd-ui-auditor": { quality: "sonnet", balanced: "sonnet", budget: "haiku" },
};

export const VALID_PROFILES: ProfileKey[] = Object.keys(
    MODEL_PROFILES["gsd-planner"],
) as ProfileKey[];

// ─── Pi harness constants (pi-only) ─────────────────────────────────────────

const PI_CMD_PREFIX = "/gsd-";
const PI_RUNTIME = "pi";


export function getAgentToModelMapForProfile(
    profile: ProfileKey,
): Record<AgentName, ModelAlias> {
    const result: Record<AgentName, ModelAlias> = {};
    for (const [agent, profiles] of Object.entries(MODEL_PROFILES)) {
        result[agent] = profiles[profile];
    }
    return result;
}

/**
 * Formats an agent→model map as a human-readable table string.
 */
export function formatAgentToModelMapAsTable(
    map: Record<AgentName, ModelAlias>,
): string {
    const agentWidth = Math.max(
        "Agent".length,
        ...Object.keys(map).map((a) => a.length),
    );
    const modelWidth = Math.max(
        "Model".length,
        ...Object.values(map).map((m) => m.length),
    );
    const sep = "─".repeat(agentWidth + 2) + "┼" + "─".repeat(modelWidth + 2);
    const header =
        " " + "Agent".padEnd(agentWidth) + " │ " + "Model".padEnd(modelWidth);
    let table = header + "\n" + sep + "\n";
    for (const [agent, model] of Object.entries(map)) {
        table +=
            " " + agent.padEnd(agentWidth) + " │ " + model.padEnd(modelWidth) + "\n";
    }
    return table;
}

/**
 * Generate the full `references/model-profiles.md` content.
 */
export function generateModelProfilesMd(): string {
    const runtimeName = PI_RUNTIME;
    const cmdPrefix = PI_CMD_PREFIX;

    const profiles = VALID_PROFILES;
    const agents = Object.keys(MODEL_PROFILES);

    const headerCols = [
        "Agent",
        ...profiles.map((p) => "`" + p + "`"),
        "`inherit`",
    ];
    const headerRow = "| " + headerCols.join(" | ") + " |";
    const sepRow =
        "|" + headerCols.map((col) => "-".repeat(col.length + 2)).join("|") + "|";
    const tableRows = agents.map((agent) => {
        const vals = profiles.map((p) => MODEL_PROFILES[agent][p]);
        return "| " + [agent, ...vals, "inherit"].join(" | ") + " |";
    });
    const profileTable = [headerRow, sepRow, ...tableRows].join("\n");

    const settingsCmd = `${cmdPrefix}settings`;
    const setProfileCmd = `${cmdPrefix}set-profile <profile>`;

    return `<!-- AUTO-GENERATED - do not edit by hand.
     Source of truth: src/lib/model-profiles.ts
     Regenerate with: pi-gsd-tools generate-model-profiles-md
-->
# Model Profiles

Model profiles control which ${runtimeName} model each GSD agent uses. This allows balancing quality vs token spend, or inheriting the currently selected session model.

## Profile Definitions

${profileTable}

## Profile Philosophy

**quality** - Maximum reasoning power
- Opus for all decision-making agents
- Sonnet for read-only verification
- Use when: quota available, critical architecture work

**balanced** (default) - Smart allocation
- Opus only for planning (where architecture decisions happen)
- Sonnet for execution and research (follows explicit instructions)
- Sonnet for verification (needs reasoning, not just pattern matching)
- Use when: normal development, good balance of quality and cost

**budget** - Minimal Opus usage
- Sonnet for anything that writes code
- Haiku for research and verification
- Use when: conserving quota, high-volume work, less critical phases

**inherit** - Follow the current session model
- All agents resolve to \`inherit\`
- Best when you switch models interactively (for example OpenCode \`/model\`)
- **Required when using non-Anthropic providers** (OpenRouter, local models, etc.) - otherwise GSD may call Anthropic models directly, incurring unexpected costs
- Use when: you want GSD to follow your currently selected runtime model

## Using pi with Other Providers

pi supports any provider via its settings. Set the \`inherit\` profile when using non-default models to ensure GSD routes subagents through your active session model.

To assign different models to different agents, add \`model_overrides\` with model IDs your runtime recognizes:

\`\`\`json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
\`\`\`

The same tiering logic applies: stronger models for planning and debugging, cheaper models for execution and mapping.

## Using Non-Default Providers (OpenRouter, Local)

If you're using pi with OpenRouter or a local model, set the \`inherit\` profile to prevent GSD from calling specific model APIs directly:

\`\`\`bash
# Via settings command
${settingsCmd}
# → Select "Inherit" for model profile

# Or manually in .planning/config.json
{
  "model_profile": "inherit"
}
\`\`\`

Without \`inherit\`, GSD's default \`balanced\` profile spawns specific Anthropic models (\`opus\`, \`sonnet\`, \`haiku\`) for each agent type, which can result in additional API costs through your non-Anthropic provider.

## Resolution Logic

Orchestrators resolve model before spawning:

\`\`\`
1. Read .planning/config.json
2. Check model_overrides for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call
\`\`\`

## Per-Agent Overrides

Override specific agents without changing the entire profile:

\`\`\`json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
\`\`\`

Overrides take precedence over the profile. Valid values: \`opus\`, \`sonnet\`, \`haiku\`, \`inherit\`, or any fully-qualified model ID (e.g., \`"o3"\`, \`"openai/o3"\`, \`"google/gemini-2.5-pro"\`).

## Switching Profiles

Runtime: \`${setProfileCmd}\`

Per-project default: Set in \`.planning/config.json\`:
\`\`\`json
{
  "model_profile": "balanced"
}
\`\`\`

## Design Rationale

**Why Opus for gsd-planner?**
Planning involves architecture decisions, goal decomposition, and task design. This is where model quality has the highest impact.

**Why Sonnet for gsd-executor?**
Executors follow explicit PLAN.md instructions. The plan already contains the reasoning; execution is implementation.

**Why Sonnet (not Haiku) for verifiers in balanced?**
Verification requires goal-backward reasoning - checking if code *delivers* what the phase promised, not just pattern matching. Sonnet handles this well; Haiku may miss subtle gaps.

**Why Haiku for gsd-codebase-mapper?**
Read-only exploration and pattern extraction. No reasoning required, just structured output from file contents.

**Why \`inherit\` instead of passing \`opus\` directly?**
pi's \`"opus"\` alias maps to a specific model version. Organizations may block older opus versions while allowing newer ones. GSD returns \`"inherit"\` for opus-tier agents, causing them to use whatever opus version the user has configured in their session. This avoids version conflicts and silent fallbacks to Sonnet.

**Why \`inherit\` profile?**
Some runtimes (including OpenCode) let users switch models at runtime (\`/model\`). The \`inherit\` profile keeps all GSD subagents aligned to that live selection.
`;
}

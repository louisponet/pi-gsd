import { extractCodeFenceRegions, inDeadZone } from "./parser.js";
import type { VariableStore } from "./variables.js";

export class WxpPasteError extends Error {
  constructor(
    public readonly variableName: string,
    public readonly variableSnapshot: Record<string, string>,
  ) {
    super(
      `<gsd-paste name="${variableName}" /> references undefined variable '${variableName}'`,
    );
    this.name = "WxpPasteError";
  }
}

/**
 * Replace all <gsd-paste name="X" /> tags in content with variable values.
 * - Tags inside code fences are NOT replaced.
 * - If any referenced variable is undefined → throws WxpPasteError (no partial output).
 * - Replacement is right-to-left to preserve indices.
 */
export function applyPaste(content: string, vars: VariableStore): string {
  const deadZones = extractCodeFenceRegions(content);
  const pasteRe = /<gsd-paste\s+name="([^"]+)"\s*\/>/g;

  const matches: Array<{ index: number; full: string; name: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = pasteRe.exec(content)) !== null) {
    if (!inDeadZone(m.index, deadZones)) {
      matches.push({ index: m.index, full: m[0], name: m[1] });
    }
  }

  // Validate all before replacing anything (atomic — no partial output)
  for (const match of matches) {
    if (vars.get(match.name) === undefined) {
      throw new WxpPasteError(match.name, vars.snapshot());
    }
  }

  // Replace right-to-left
  let result = content;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const value = vars.get(match.name) as string;
    result =
      result.slice(0, match.index) + value + result.slice(match.index + match.full.length);
  }

  return result;
}

import type { ArgumentsNode, Arg } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WxpArgumentsError";
  }
}

export function parseArguments(
  node: ArgumentsNode,
  rawArguments: string,
  vars: VariableStore,
): void {
  let tokens: string[];
  if (node.settings.delimiters.length > 0) {
    const delim = node.settings.delimiters[0].value;
    const unescaped = delim === "\\n" ? "\n" : delim;
    tokens = rawArguments.split(unescaped).map((t) => t.trim()).filter(Boolean);
  } else {
    tokens = rawArguments.trim().split(/\s+/).filter(Boolean);
  }

  const consumed = new Set<number>();

  // ── Pass 1: flags ─────────────────────────────────────────────────────────
  for (const argDef of node.args.filter((a: Arg) => a.type === "flag")) {
    const flagToken = argDef.flag ?? `--${argDef.name}`;
    const idx = tokens.indexOf(flagToken);
    if (idx === -1) {
      vars.set(argDef.name!, "false", undefined);
    } else {
      vars.set(argDef.name!, "true", undefined);
      consumed.add(idx);
    }
  }

  // ── Pass 2: positionals ────────────────────────────────────────────────────
  const positionals = node.args.filter((a: Arg) => a.type !== "flag");
  const remaining = tokens.filter((_, i) => !consumed.has(i));
  let tokenIdx = 0;

  for (let i = 0; i < positionals.length; i++) {
    const argDef = positionals[i];
    const isLast = i === positionals.length - 1;

    if (tokenIdx >= remaining.length) {
      if (!argDef.optional) {
        throw new WxpArgumentsError(
          `Missing required argument '${argDef.name}' (type: ${argDef.type})`,
        );
      }
      vars.set(argDef.name!, "", undefined);
      continue;
    }

    if (argDef.type === "string" && isLast) {
      vars.set(argDef.name!, remaining.slice(tokenIdx).join(" "), undefined);
      tokenIdx = remaining.length;
    } else if (argDef.type === "number") {
      const raw = remaining[tokenIdx++];
      const num = Number(raw);
      if (isNaN(num)) {
        throw new WxpArgumentsError(
          `Argument '${argDef.name}' expected a number, got '${raw}'`,
        );
      }
      vars.set(argDef.name!, String(num), undefined);
    } else if (argDef.type === "boolean") {
      const raw = remaining[tokenIdx++].toLowerCase();
      if (raw !== "true" && raw !== "false") {
        throw new WxpArgumentsError(
          `Argument '${argDef.name}' expected true/false, got '${raw}'`,
        );
      }
      vars.set(argDef.name!, raw, undefined);
    } else {
      vars.set(argDef.name!, remaining[tokenIdx++] ?? "", undefined);
    }
  }

  const extra = remaining.slice(tokenIdx).join(" ");
  if (extra) {
    if (node.settings.strictArgs) {
      throw new WxpArgumentsError(`Unexpected extra arguments: '${extra}'.`);
    }
    if (node.settings.keepExtraArgs) {
      vars.set("_extra", extra, undefined);
    }
  }
}

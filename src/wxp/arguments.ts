import type { XmlNode } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WxpArgumentsError";
  }
}

export function parseArguments(node: XmlNode, rawArguments: string, vars: VariableStore): void {
  const settingsNode = node.children.find((c) => c.tag === "settings");
  const keepExtraArgs = settingsNode?.children.some((c) => c.tag === "keep-extra-args") ?? false;
  const strictArgs    = settingsNode?.children.some((c) => c.tag === "strict-args")     ?? false;

  const delimContainer = settingsNode?.children.find((c) => c.tag === "delimiters");
  const firstDelim = delimContainer?.children.find((c) => c.tag === "delimiter");

  let tokens: string[];
  if (firstDelim) {
    const raw = firstDelim.attrs["value"] ?? "";
    const sep = raw === "\\n" ? "\n" : raw;
    tokens = rawArguments.split(sep).map((t) => t.trim()).filter(Boolean);
  } else {
    tokens = rawArguments.trim().split(/\s+/).filter(Boolean);
  }

  const argDefs = node.children.filter((c) => c.tag === "arg");
  const consumed = new Set<number>();

  // ── Pass 1: flags ──────────────────────────────────────────────────────────
  for (const def of argDefs.filter((a) => a.attrs["type"] === "flag")) {
    const flagToken = def.attrs["flag"] ?? `--${def.attrs["name"]}`;
    const idx = tokens.indexOf(flagToken);
    const name = def.attrs["name"];
    if (!name) continue;
    if (idx === -1) {
      vars.set(name, "false", undefined);
    } else {
      vars.set(name, "true", undefined);
      consumed.add(idx);
    }
  }

  // ── Pass 2: positionals ────────────────────────────────────────────────────
  const positionals = argDefs.filter((a) => a.attrs["type"] !== "flag");
  const remaining   = tokens.filter((_, i) => !consumed.has(i));
  let tokenIdx = 0;

  for (let i = 0; i < positionals.length; i++) {
    const def    = positionals[i];
    const name   = def.attrs["name"];
    const type   = def.attrs["type"] ?? "string";
    const isLast = i === positionals.length - 1;
    if (!name) continue;

    if (tokenIdx >= remaining.length) {
      if (!("optional" in def.attrs)) {
        throw new WxpArgumentsError(`Missing required argument '${name}' (type: ${type})`);
      }
      vars.set(name, "", undefined);
      continue;
    }

    if (type === "string" && isLast) {
      vars.set(name, remaining.slice(tokenIdx).join(" "), undefined);
      tokenIdx = remaining.length;
    } else if (type === "number") {
      const raw = remaining[tokenIdx++];
      const num = Number(raw);
      if (isNaN(num)) throw new WxpArgumentsError(`Argument '${name}' expected a number, got '${raw}'`);
      vars.set(name, String(num), undefined);
    } else if (type === "boolean") {
      const raw = remaining[tokenIdx++].toLowerCase();
      if (raw !== "true" && raw !== "false") {
        throw new WxpArgumentsError(`Argument '${name}' expected true/false, got '${raw}'`);
      }
      vars.set(name, raw, undefined);
    } else {
      vars.set(name, remaining[tokenIdx++] ?? "", undefined);
    }
  }

  const extra = remaining.slice(tokenIdx).join(" ");
  if (extra) {
    if (strictArgs)    throw new WxpArgumentsError(`Unexpected extra arguments: '${extra}'`);
    if (keepExtraArgs) vars.set("_extra", extra, undefined);
  }
}

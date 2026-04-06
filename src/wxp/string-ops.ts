import type { XmlNode } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";
import { resolveArgNode } from "./shell.js";

export class WxpStringOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WxpStringOpError";
  }
}

export function executeStringOp(node: XmlNode, vars: VariableStore): void {
  const op = node.attrs["op"];
  if (op !== "split") throw new WxpStringOpError(`<string-op> only op="split" is supported in v1`);

  const argsContainer = node.children.find((c) => c.tag === "args");
  const outsContainer = node.children.find((c) => c.tag === "outs");

  if (!argsContainer || !outsContainer) {
    throw new WxpStringOpError(`<string-op> requires <args> and <outs>`);
  }

  const args = argsContainer.children.filter((c) => c.tag === "arg");
  const outs = outsContainer.children.filter((c) => c.tag === "out");

  const srcArg   = args[0];
  const delimArg = args[1];

  if (!srcArg) throw new WxpStringOpError(`<string-op op="split"> requires at least 2 <arg> children`);

  const source = resolveArgNode(srcArg, vars);
  if (srcArg.attrs["name"] && vars.get(srcArg.attrs["name"]) === undefined) {
    throw new WxpStringOpError(`string-op split: source variable '${srcArg.attrs["name"]}' is not defined`);
  }

  const delimiter = delimArg ? resolveArgNode(delimArg, vars) : "";
  const parts = source.split(delimiter);

  // Each <out> gets one part starting from index 1 (part after the delimiter prefix)
  outs.forEach((out, i) => {
    const name = out.attrs["name"];
    if (name) vars.set(name, parts[i + 1] ?? parts[i] ?? "", undefined);
  });
}

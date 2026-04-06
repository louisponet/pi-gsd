import type { StringOpNode, Arg } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpStringOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WxpStringOpError";
  }
}

/**
 * Execute <string-op op="split">.
 *
 * args[0]: source — <arg name="varname" /> (variable) or <arg type="string" value="..." /> (literal)
 * args[1]: delimiter — <arg type="string" value="..." />
 *
 * Each <out name="x" /> gets one part from the split result.
 * Primary use: split "@file:/some/path" on "@file:" → outs[0] = "/some/path" (parts[1])
 */
export function executeStringOp(node: StringOpNode, vars: VariableStore): void {
  if (node.args.length < 2) {
    throw new WxpStringOpError(`<string-op op="split"> requires at least 2 <arg> children`);
  }

  const srcArg: Arg = node.args[0];
  const delimArg: Arg = node.args[1];

  // Resolve source: variable ref (name=) or typed literal (type= value=)
  const source = srcArg.name !== undefined
    ? vars.get(srcArg.name)
    : srcArg.value;

  if (source === undefined) {
    throw new WxpStringOpError(
      `string-op split: source variable '${srcArg.name}' is not defined`,
    );
  }

  // Resolve delimiter: always a typed literal <arg type="string" value="..." />
  const delimiter = delimArg.value !== undefined
    ? delimArg.value
    : (delimArg.name !== undefined ? (vars.get(delimArg.name) ?? "") : "");

  const parts = source.split(delimiter);

  // Each <out> gets one part starting from index 1 (the part AFTER the delimiter prefix)
  node.outs.forEach((out, i) => {
    vars.set(out.name, parts[i + 1] ?? parts[i] ?? "", undefined);
  });
}

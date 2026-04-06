import { execFileSync } from "node:child_process";
import { checkAllowlist } from "./security.js";
import type { ShellNode, WxpSecurityConfig, Arg } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpShellError extends Error {
  constructor(
    public readonly node: ShellNode,
    public readonly stderr: string,
    public readonly variableSnapshot: Record<string, string>,
    message: string,
  ) {
    super(message);
    this.name = "WxpShellError";
  }
}

/** Resolve a single <arg> in a shell <args> context. */
function resolveArg(arg: Arg, vars: VariableStore): string {
  if (arg.string !== undefined) {
    // <arg string="literal" />
    return arg.string;
  }
  if (arg.name !== undefined) {
    // <arg name="varname" wrap='"' />
    const raw = vars.get(arg.name) ?? "";
    return arg.wrap ? `${arg.wrap}${raw}${arg.wrap}` : raw;
  }
  if (arg.type !== undefined && arg.value !== undefined) {
    // <arg type="string" value="..." />
    return arg.value;
  }
  return "";
}

export function executeShell(
  node: ShellNode,
  vars: VariableStore,
  config: WxpSecurityConfig,
): void {
  const check = checkAllowlist(node.command, config);
  if (!check.ok) {
    throw new WxpShellError(node, "", vars.snapshot(), check.reason);
  }

  const resolvedArgs = node.args.map((arg) => resolveArg(arg, vars));
  const outVars = node.outs.filter((o) => o.name !== undefined) as Array<{ type?: string; name: string }>;

  let stdout = "";
  try {
    stdout = execFileSync(node.command, resolvedArgs, {
      encoding: "utf8",
      timeout: config.shellTimeoutMs,
      windowsHide: true,
    }).trim();
  } catch (err) {
    if (node.suppressErrors) {
      for (const out of outVars) vars.set(out.name, "", undefined);
      return;
    }
    const e = err as { stderr?: string; message?: string };
    const stderr = (e.stderr ?? e.message ?? String(err)).trim();
    throw new WxpShellError(
      node, stderr, vars.snapshot(),
      `Shell '${node.command} ${resolvedArgs.join(" ")}' failed: ${stderr}`,
    );
  }

  if (outVars.length > 0) {
    vars.set(outVars[0].name, stdout, undefined);
  }
}

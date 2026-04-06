import { execFileSync } from "node:child_process";
import { checkAllowlist } from "./security.js";
import type { WxpSecurityConfig, XmlNode } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpShellError extends Error {
  constructor(
    public readonly command: string,
    public readonly stderr: string,
    public readonly variableSnapshot: Record<string, string>,
    message: string,
  ) {
    super(message);
    this.name = "WxpShellError";
  }
}

/** Resolve a single <arg> node to its string value. */
export function resolveArgNode(arg: XmlNode, vars: VariableStore): string {
  if (arg.attrs["string"] !== undefined) return arg.attrs["string"];
  if (arg.attrs["name"] !== undefined) {
    const raw = vars.resolve(arg.attrs["name"]) ?? "";
    const wrap = arg.attrs["wrap"];
    return wrap ? `${wrap}${raw}${wrap}` : raw;
  }
  if (arg.attrs["value"] !== undefined) return arg.attrs["value"];
  return "";
}

export function executeShell(
  node: XmlNode,
  vars: VariableStore,
  config: WxpSecurityConfig,
): void {
  const command = node.attrs["command"] ?? "";
  const check = checkAllowlist(command, config);
  if (!check.ok) {
    throw new WxpShellError(command, "", vars.snapshot(), check.reason);
  }

  const argsContainer = node.children.find((c) => c.tag === "args");
  const outsContainer = node.children.find((c) => c.tag === "outs");

  const resolvedArgs = argsContainer
    ? argsContainer.children.filter((c) => c.tag === "arg").map((a) => resolveArgNode(a, vars))
    : [];

  const suppressErrors = outsContainer
    ? outsContainer.children.some((c) => c.tag === "suppress-errors")
    : false;

  const outVars = outsContainer
    ? outsContainer.children
        .filter((c) => c.tag === "out" && c.attrs["name"])
        .map((c) => c.attrs["name"] as string)
    : [];

  let stdout = "";
  try {
    stdout = execFileSync(command, resolvedArgs, {
      encoding: "utf8",
      timeout: config.shellTimeoutMs,
      windowsHide: true,
    }).trim();
  } catch (err) {
    if (suppressErrors) {
      for (const name of outVars) vars.set(name, "", undefined);
      return;
    }
    const e = err as { stderr?: string; message?: string };
    const stderr = (e.stderr ?? e.message ?? String(err)).trim();
    throw new WxpShellError(
      command,
      stderr,
      vars.snapshot(),
      `Shell '${command} ${resolvedArgs.join(" ")}' failed: ${stderr}`,
    );
  }

  if (outVars.length > 0) vars.set(outVars[0], stdout, undefined);
}

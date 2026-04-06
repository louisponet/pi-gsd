import path from "node:path";
import type { WxpSecurityConfig, TrustedPathEntry } from "../schemas/wxp.zod.js";

export const DEFAULT_SHELL_ALLOWLIST: readonly string[] = [
  "pi-gsd-tools",
  "git",
  "node",
  "cat",
  "ls",
  "echo",
  "find",
] as const;

export type SecurityCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Resolve a TrustedPathEntry to an absolute path given the project root and package root.
 */
export function resolveTrustedEntry(
  entry: TrustedPathEntry,
  projectRoot: string,
  pkgRoot: string,
): string {
  switch (entry.position) {
    case "project":
      return path.resolve(projectRoot, entry.path);
    case "pkg":
      return path.resolve(pkgRoot, entry.path);
    case "absolute":
      return path.resolve(entry.path);
  }
}

/**
 * Returns ok=true only if filePath resolves into a trusted path.
 * Hard invariant: .planning/ is NEVER trusted regardless of config.
 */
export function checkTrustedPath(
  filePath: string,
  config: WxpSecurityConfig,
  projectRoot: string,
  pkgRoot: string,
): SecurityCheckResult {
  const resolved = path.resolve(filePath);
  const planningSegment = `${path.sep}.planning`;

  // Hard invariant: .planning/ is never processed
  if (
    resolved.includes(`${planningSegment}${path.sep}`) ||
    resolved.endsWith(planningSegment)
  ) {
    return {
      ok: false,
      reason: ".planning/ files are never processed by WXP (hard security invariant)",
    };
  }

  // Check untrusted paths first (they override trusted)
  for (const entry of config.untrustedPaths) {
    const untrustedAbs = resolveTrustedEntry(entry, projectRoot, pkgRoot);
    if (resolved.startsWith(untrustedAbs + path.sep) || resolved === untrustedAbs) {
      return { ok: false, reason: `File '${filePath}' is in an explicitly untrusted path: ${untrustedAbs}` };
    }
  }

  // Check trusted paths
  for (const entry of config.trustedPaths) {
    const trustedAbs = resolveTrustedEntry(entry, projectRoot, pkgRoot);
    if (resolved.startsWith(trustedAbs + path.sep) || resolved === trustedAbs) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    reason: `File '${filePath}' is not in a trusted WXP path.`,
  };
}

/**
 * Returns ok=true only if the bare command name is allowlisted and not banned.
 */
export function checkAllowlist(
  command: string,
  config: WxpSecurityConfig,
): SecurityCheckResult {
  const bare = path.basename(command);

  // Banlist overrides allowlist
  if (config.shellBanlist.includes(bare)) {
    return { ok: false, reason: `Command '${bare}' is explicitly banned by WXP security config.` };
  }

  if (config.shellAllowlist.includes(bare)) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `Command '${bare}' is not in the WXP shell allowlist. Allowed: ${config.shellAllowlist.join(", ")}`,
  };
}

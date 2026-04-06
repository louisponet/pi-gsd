import fs from "node:fs";
import path from "node:path";
import { extractWxpTags, spliceContent, extractCodeFenceRegions, inDeadZone } from "./parser.js";
import { buildOperation } from "./ast.js";
import { createVariableStore } from "./variables.js";
import { parseArguments } from "./arguments.js";
import { executeBlock } from "./executor.js";
import { applyPaste, WxpPasteError } from "./paste.js";
import { checkTrustedPath, checkAllowlist } from "./security.js";
import type { WxpSecurityConfig, WxpOperation } from "../schemas/wxp.zod.js";

export { WxpExecutionError } from "./executor.js";
export { WxpShellError } from "./shell.js";
export { WxpPasteError } from "./paste.js";
export { WxpStringOpError } from "./string-ops.js";
export { WxpArgumentsError } from "./arguments.js";

const MAX_ITERATIONS = 50;

export class WxpProcessingError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly cause: Error,
    public readonly variableSnapshot: Record<string, string>,
    public readonly pendingOperations: string[],
    public readonly completedOperations: string[],
  ) {
    super(
      [
        `WXP Processing Error`,
        `File: ${filePath}`,
        `Error: ${cause.message}`,
        `Variable Namespace: ${JSON.stringify(variableSnapshot, null, 2)}`,
        `Pending Operations: [${pendingOperations.join(", ")}]`,
        `Completed Operations: [${completedOperations.join(", ")}]`,
      ].join("\n"),
    );
    this.name = "WxpProcessingError";
  }
}

/**
 * Main WXP entry point.
 *
 * Resolution loop (PRD §3.5):
 * Each iteration:
 *   1. Process <gsd-include> tags (not done) → inject content, mark done
 *   2. Process <gsd-arguments> block (not done) → parse $ARGUMENTS into vars, mark done
 *   3. Process <gsd-execute> blocks (not done) → execute children, mark done
 *      - <if> branches: false branch marked done+false; true branch children left for next iter
 *   4. Apply <gsd-paste> replacements
 * Repeat until no new unprocessed tags, or 50-iteration cap.
 *
 * Any failure → WxpProcessingError (no partial output, no LLM fallback).
 */
export function processWxp(
  content: string,
  filePath: string,
  config: WxpSecurityConfig,
  projectRoot: string,
  pkgRoot: string,
  rawArguments = "",
): string {
  // Security: verify file is from a trusted path
  const pathCheck = checkTrustedPath(filePath, config, projectRoot, pkgRoot);
  if (!pathCheck.ok) {
    const err = new Error(pathCheck.reason);
    throw new WxpProcessingError(filePath, err, {}, [], []);
  }

  const vars = createVariableStore();
  const completedOps: string[] = [];
  let current = content;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const tagsBefore = extractWxpTags(current);
    const activeTags = tagsBefore.filter(
      (t) => t.node.tag !== "gsd-version" && !t.node.attrs["done"],
    );

    if (activeTags.length === 0) break;

    const pendingBefore = activeTags.map((t) => t.node.tag);

    try {
      // ── 1. Process <gsd-include> ─────────────────────────────────────────
      let didWork = false;
      for (const tag of extractWxpTags(current)) {
        if (tag.node.tag !== "gsd-include" || tag.node.attrs["done"]) continue;
        if (inDeadZone(tag.start, extractCodeFenceRegions(current))) continue;

        const incPath = tag.node.attrs["path"];
        if (!incPath) continue;

        const absPath = path.resolve(path.dirname(filePath), incPath);
        const pathCheck2 = checkTrustedPath(absPath, config, projectRoot, pkgRoot);
        if (!pathCheck2.ok) throw new Error(`Include rejected: ${pathCheck2.reason}`);

        const included = fs.readFileSync(absPath, "utf8");
        const stem = path.basename(absPath, path.extname(absPath));

        // INC-02: arg mappings
        for (const mapping of tag.node.children
          .flatMap((c) => (c.tag === "gsd-arguments" ? c.children : []))
          .filter((c) => c.tag === "arg" && c.attrs["name"] && c.attrs["as"])) {
          const val = vars.get(mapping.attrs["name"]);
          if (val !== undefined) vars.set(mapping.attrs["as"], val, stem);
        }

        const appendArgs = tag.node.attrs["include-arguments"] !== undefined
          ? `\n${rawArguments}`
          : "";

        // Replace the tag span with included content, mark done
        current = spliceContent(current, tag.start, tag.end, included + appendArgs);
        completedOps.push("gsd-include");
        didWork = true;
        break; // Re-scan after each include (content changed)
      }
      if (didWork) continue;

      // ── 2. Process <gsd-arguments> ───────────────────────────────────────
      for (const tag of extractWxpTags(current)) {
        if (tag.node.tag !== "gsd-arguments" || tag.node.attrs["done"]) continue;
        if (inDeadZone(tag.start, extractCodeFenceRegions(current))) continue;

        const op = buildOperation(tag.node)[0];
        if (op?.type === "arguments") {
          parseArguments(op, rawArguments, vars);
          completedOps.push("gsd-arguments");
        }
        // Mark done by removing the tag from content
        current = spliceContent(current, tag.start, tag.end, "");
        didWork = true;
        break;
      }
      if (didWork) continue;

      // ── 3. Process <gsd-execute> blocks ──────────────────────────────────
      for (const tag of extractWxpTags(current)) {
        if (tag.node.tag !== "gsd-execute" || tag.node.attrs["done"]) continue;
        if (inDeadZone(tag.start, extractCodeFenceRegions(current))) continue;

        const ops = tag.node.children.flatMap(buildOperation);
        const block = { type: "execute" as const, children: ops };
        executeBlock(block, vars, config);
        completedOps.push("gsd-execute");
        // Remove the execute block from content
        current = spliceContent(current, tag.start, tag.end, "");
        didWork = true;
        break;
      }
      if (didWork) continue;

      // ── 4. Apply <gsd-paste> replacements ────────────────────────────────
      const afterPaste = applyPaste(current, vars);
      if (afterPaste !== current) {
        current = afterPaste;
        completedOps.push("gsd-paste");
        continue;
      }

      // No progress made
      break;
    } catch (err) {
      if (err instanceof WxpProcessingError) throw err;
      const e = err instanceof Error ? err : new Error(String(err));
      throw new WxpProcessingError(filePath, e, vars.snapshot(), pendingBefore, completedOps);
    }
  }

  return current;
}

/**
 * Process WXP tags in pre-validated content (path check already done by caller).
 */
export function processWxpTrustedContent(
  content: string,
  virtualFilePath: string,
  config: WxpSecurityConfig,
  projectRoot: string,
  pkgRoot: string,
  rawArguments = "",
): string {
  // Build a config that trusts the virtual path's directory
  const trustedConfig: WxpSecurityConfig = {
    ...config,
    trustedPaths: [
      ...config.trustedPaths,
      { position: "absolute", path: path.dirname(path.resolve(virtualFilePath)) },
    ],
  };
  return processWxp(content, virtualFilePath, trustedConfig, projectRoot, pkgRoot, rawArguments);
}

/**
 * Read the <gsd-version> tag from workflow file content.
 * Used by harness copy-on-first-run to check do-not-update (WFL-05).
 */
export function readWorkflowVersionTag(
  content: string,
): { version: string; doNotUpdate: boolean } | null {
  const m = /<gsd-version\s+v="([^"]+)"(\s+do-not-update)?\s*\/>/.exec(content);
  if (!m) return null;
  return { version: m[1], doNotUpdate: Boolean(m[2]) };
}

void checkAllowlist; // exported via security.ts, referenced here for completeness

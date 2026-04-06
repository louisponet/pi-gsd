import fs from "node:fs";
import path from "node:path";
import { executeShell, WxpShellError, resolveArgNode } from "./shell.js";
import { executeStringOp } from "./string-ops.js";
import { evaluateCondition, evaluateWhere, evaluateCondExprNode, CONDITION_OPS } from "./conditions.js";
import { resolveTrustedEntry } from "./security.js";
import type { XmlNode, WxpExecContext } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

export class WxpExecutionError extends Error {
  constructor(
    public readonly cause: Error,
    public readonly variableSnapshot: Record<string, string>,
    message: string,
  ) {
    super(message);
    this.name = "WxpExecutionError";
  }
}

// ─── <display> ───────────────────────────────────────────────────────────────

function execDisplay(node: XmlNode, vars: VariableStore, ctx: WxpExecContext): void {
  const msg = (node.attrs["msg"] ?? "").replace(
    /\{([^}]+)\}/g,
    (_, name: string) => vars.resolve(name) ?? "",
  );
  const level = node.attrs["level"];
  ctx.onDisplay(msg, level === "warning" || level === "error" ? level : "info");
}

// ─── <json-parse> ────────────────────────────────────────────────────────────

function execJsonParse(node: XmlNode, vars: VariableStore): void {
  const src  = node.attrs["src"]  ?? "";
  const out  = node.attrs["out"]  ?? "";
  const pathStr = node.attrs["path"];

  const jsonStr = vars.get(src);
  if (jsonStr === undefined) throw new Error(`<json-parse>: source variable '${src}' is not defined`);

  let parsed: unknown;
  try { parsed = JSON.parse(jsonStr); } catch {
    throw new Error(`<json-parse>: '${src}' does not contain valid JSON`);
  }

  if (pathStr) {
    const parts = pathStr.replace(/^\$\.?/, "").split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON traversal
    let cur: any = parsed;
    for (const key of parts) {
      if (cur === null || typeof cur !== "object") throw new Error(`<json-parse>: path '${pathStr}' not found`);
      cur = cur[key];
    }
    parsed = cur;
  }

  if (Array.isArray(parsed)) {
    vars.setArray(out, parsed.map((item) => typeof item === "string" ? item : JSON.stringify(item)));
  } else if (parsed !== null && typeof parsed === "object") {
    vars.set(out, JSON.stringify(parsed), undefined);
  } else {
    vars.set(out, parsed === undefined || parsed === null ? "" : String(parsed), undefined);
  }
}

// ─── <read-file> ─────────────────────────────────────────────────────────────

function execReadFile(node: XmlNode, vars: VariableStore): void {
  const filePath = node.attrs["path"] ?? "";
  const out      = node.attrs["out"]  ?? "";
  const content  = fs.readFileSync(path.resolve(filePath), "utf8");
  vars.set(out, content, undefined);
}

// ─── <write-file> ────────────────────────────────────────────────────────────

function execWriteFile(node: XmlNode, vars: VariableStore, ctx: WxpExecContext): void {
  const filePath = node.attrs["path"] ?? "";
  const src      = node.attrs["src"]  ?? "";
  const resolved = path.resolve(filePath);

  // Create-only: never overwrite
  if (fs.existsSync(resolved)) {
    throw new Error(`<write-file>: '${filePath}' already exists (create-only, never overwrites)`);
  }

  // Reject writes targeting trusted harness paths
  for (const entry of ctx.config.trustedPaths) {
    const abs = resolveTrustedEntry(entry, ctx.projectRoot, ctx.pkgRoot);
    if (resolved.startsWith(abs + path.sep) || resolved === abs) {
      throw new Error(`<write-file>: cannot write to trusted harness path '${filePath}'`);
    }
  }

  const content = vars.get(src) ?? "";
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, "utf8");
}

// ─── <for-each> ──────────────────────────────────────────────────────────────

function execForEach(node: XmlNode, vars: VariableStore, ctx: WxpExecContext): void {
  const varName  = node.attrs["var"]  ?? "";
  const itemName = node.attrs["item"] ?? "";

  const whereNode  = node.children.find((c) => c.tag === "where");
  const sortByNode = node.children.find((c) => c.tag === "sort-by");
  const bodyNodes  = node.children.filter((c) => c.tag !== "where" && c.tag !== "sort-by");

  let items = vars.getArray(varName);
  if (!items) return; // Missing array is not an error — may be conditional

  // Filter
  if (whereNode) {
    items = items.filter((itemJson) => {
      vars.set(itemName, itemJson, undefined);
      return evaluateWhere(whereNode, vars);
    });
  }

  // Sort
  if (sortByNode) {
    const key   = sortByNode.attrs["key"]   ?? "";
    const type  = sortByNode.attrs["type"]  ?? "string";
    const order = sortByNode.attrs["order"] ?? "asc";

    items = [...items].sort((aJson, bJson) => {
      vars.set(itemName, aJson, undefined);
      const aVal = vars.resolve(`${itemName}.${key}`) ?? vars.resolve(key) ?? "";
      vars.set(itemName, bJson, undefined);
      const bVal = vars.resolve(`${itemName}.${key}`) ?? vars.resolve(key) ?? "";

      const cmp = type === "number"
        ? Number(aVal) - Number(bVal)
        : aVal.localeCompare(bVal);
      return order === "desc" ? -cmp : cmp;
    });
  }

  for (const itemJson of items) {
    vars.set(itemName, itemJson, undefined);
    for (const child of bodyNodes) executeNode(child, vars, ctx);
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function executeNode(node: XmlNode, vars: VariableStore, ctx: WxpExecContext): void {
  switch (node.tag) {
    case "shell":      executeShell(node, vars, ctx.config); break;
    case "string-op":  executeStringOp(node, vars);          break;
    case "json-parse": execJsonParse(node, vars);             break;
    case "read-file":  execReadFile(node, vars);              break;
    case "write-file": execWriteFile(node, vars, ctx);        break;
    case "display":    execDisplay(node, vars, ctx);          break;
    case "for-each":   execForEach(node, vars, ctx);          break;

    case "if": {
      const branch   = evaluateCondition(node, vars);
      const thenNode = node.children.find((c) => c.tag === "then");
      const elseNode = node.children.find((c) => c.tag === "else");
      const taken    = branch ? thenNode : elseNode;
      if (taken) for (const child of taken.children) executeNode(child, vars, ctx);
      break;
    }

    case "gsd-execute":
      executeBlock(node, vars, ctx);
      break;

    default:
      // paste, arguments, include, version — handled by resolution loop in index.ts
      break;
  }
}

/** Execute all children of a container node (<gsd-execute>, <then>, <else>). */
export function executeBlock(node: XmlNode, vars: VariableStore, ctx: WxpExecContext): void {
  try {
    for (const child of node.children) executeNode(child, vars, ctx);
  } catch (err) {
    if (err instanceof WxpShellError || err instanceof Error) {
      throw new WxpExecutionError(err, vars.snapshot(), `Execution failed: ${err.message}`);
    }
    throw err;
  }
}

// Re-export for conditions used outside executor (index.ts for-each where clause)
export { evaluateCondExprNode, CONDITION_OPS };

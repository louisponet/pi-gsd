/**
 * ast.ts — Converts raw XmlNode trees into typed WXP AST nodes.
 *
 * <arg> is <arg> everywhere. Context determines what its attributes mean.
 */

import {
  ArgSchema,
  OutSchema,
  ArgumentsSettingsSchema,
} from "../schemas/wxp.zod.js";
import type {
  XmlNode,
  WxpOperation,
  ShellNode,
  StringOpNode,
  IfNode,
  ArgumentsNode,
  IncludeNode,
  VersionTag,
  ExecuteBlock,
  PasteNode,
  ConditionExpr,
  Arg,
  Out,
} from "../schemas/wxp.zod.js";

export class WxpAstError extends Error {
  constructor(message: string, public readonly node: XmlNode) {
    super(`WXP AST error at <${node.tag}>: ${message}`);
    this.name = "WxpAstError";
  }
}

// ─── <arg> ────────────────────────────────────────────────────────────────────

function parseArg(node: XmlNode): Arg {
  return ArgSchema.parse({
    string: node.attrs["string"],
    name: node.attrs["name"],
    wrap: node.attrs["wrap"],
    type: node.attrs["type"],
    value: node.attrs["value"],
    flag: node.attrs["flag"],
    optional: "optional" in node.attrs ? true : undefined,
    as: node.attrs["as"],
  });
}

// ─── <out> ────────────────────────────────────────────────────────────────────

function parseOut(node: XmlNode): Out {
  return OutSchema.parse({
    type: node.attrs["type"],
    name: node.attrs["name"],
  });
}

// ─── <shell> ─────────────────────────────────────────────────────────────────

function buildShellNode(node: XmlNode): ShellNode {
  const command = node.attrs["command"];
  if (!command) throw new WxpAstError(`requires command="..."`, node);

  const argsContainer = node.children.find((c) => c.tag === "args");
  const outsContainer = node.children.find((c) => c.tag === "outs");

  const args: Arg[] = argsContainer
    ? argsContainer.children.filter((c) => c.tag === "arg").map(parseArg)
    : [];

  const outs: Out[] = outsContainer
    ? outsContainer.children.filter((c) => c.tag === "out").map(parseOut)
    : [];

  const suppressErrors = outsContainer
    ? outsContainer.children.some((c) => c.tag === "suppress-errors")
    : false;

  return { type: "shell", command, args, outs, suppressErrors };
}

// ─── <string-op> ─────────────────────────────────────────────────────────────

function buildStringOpNode(node: XmlNode): StringOpNode {
  const op = node.attrs["op"];
  if (op !== "split") throw new WxpAstError(`only op="split" is supported in v1`, node);

  const argsContainer = node.children.find((c) => c.tag === "args");
  const outsContainer = node.children.find((c) => c.tag === "outs");

  if (!argsContainer || !outsContainer) {
    throw new WxpAstError(`requires <args> and <outs> children`, node);
  }

  return {
    type: "string-op",
    op: "split",
    args: argsContainer.children.filter((c) => c.tag === "arg").map(parseArg),
    outs: outsContainer.children.filter((c) => c.tag === "out").map(parseOut),
  };
}

// ─── <if> condition ───────────────────────────────────────────────────────────

function buildConditionExpr(node: XmlNode): ConditionExpr {
  // node.tag is "equals" or "starts-with"
  const leftNode = node.children.find((c) => c.tag === "left");
  const rightNode = node.children.find((c) => c.tag === "right");

  if (!leftNode || !rightNode) {
    throw new WxpAstError(`<${node.tag}> requires <left> and <right>`, node);
  }

  const left = parseArg(leftNode); // <left> has same attribute set as <arg>
  const right = parseArg(rightNode);

  if (node.tag === "equals") return { op: "equals", left, right };
  if (node.tag === "starts-with") return { op: "starts-with", left, right };
  throw new WxpAstError(`unknown condition operator`, node);
}

function buildIfNode(node: XmlNode): IfNode {
  const condContainer = node.children.find((c) => c.tag === "condition");
  if (!condContainer) throw new WxpAstError(`requires <condition>`, node);

  const exprNode = condContainer.children.find(
    (c) => c.tag === "equals" || c.tag === "starts-with",
  );
  if (!exprNode) throw new WxpAstError(`<condition> requires <equals> or <starts-with>`, condContainer);

  const condition = buildConditionExpr(exprNode);

  const thenContainer = node.children.find((c) => c.tag === "then");
  const elseContainer = node.children.find((c) => c.tag === "else");

  return {
    type: "if",
    condition,
    then: thenContainer ? thenContainer.children.flatMap(buildOperation) : [],
    else: elseContainer ? elseContainer.children.flatMap(buildOperation) : undefined,
  };
}

// ─── <gsd-arguments> ─────────────────────────────────────────────────────────

function buildArgumentsNode(node: XmlNode): ArgumentsNode {
  const settingsNode = node.children.find((c) => c.tag === "settings");

  const keepExtraArgs = settingsNode?.children.some((c) => c.tag === "keep-extra-args") ?? false;
  const strictArgs = settingsNode?.children.some((c) => c.tag === "strict-args") ?? false;
  const delimContainer = settingsNode?.children.find((c) => c.tag === "delimiters");
  const delimiters = delimContainer
    ? delimContainer.children
        .filter((c) => c.tag === "delimiter" && c.attrs["type"] === "string")
        .map((c) => ({ type: "string" as const, value: c.attrs["value"] ?? "" }))
    : [];

  const settings = ArgumentsSettingsSchema.parse({ keepExtraArgs, strictArgs, delimiters });
  const args = node.children.filter((c) => c.tag === "arg").map(parseArg);

  return { type: "arguments", settings, args };
}

// ─── <gsd-include> ───────────────────────────────────────────────────────────

function buildIncludeNode(node: XmlNode): IncludeNode {
  const p = node.attrs["path"];
  if (!p) throw new WxpAstError(`requires path="..."`, node);

  // Arg mappings come from a <gsd-arguments> child: <arg name="x" as="y" />
  const argMappingsContainer = node.children.find((c) => c.tag === "gsd-arguments");
  const argMappings = argMappingsContainer
    ? argMappingsContainer.children.filter((c) => c.tag === "arg").map(parseArg)
    : [];

  return {
    type: "include",
    path: p,
    select: node.attrs["select"],
    includeArguments: "include-arguments" in node.attrs,
    argMappings,
  };
}

// ─── Generic dispatcher ───────────────────────────────────────────────────────

export function buildOperation(node: XmlNode): WxpOperation[] {
  switch (node.tag) {
    case "shell":
      return [buildShellNode(node)];
    case "string-op":
      return [buildStringOpNode(node)];
    case "if":
      return [buildIfNode(node)];
    case "gsd-arguments":
      return [buildArgumentsNode(node)];
    case "gsd-paste":
      return [{ type: "paste", name: node.attrs["name"] ?? "" } satisfies PasteNode];
    case "gsd-include":
      return [buildIncludeNode(node)];
    case "gsd-version":
      return [{ type: "version", v: node.attrs["v"] ?? "", doNotUpdate: "do-not-update" in node.attrs } satisfies VersionTag];
    case "gsd-execute":
      return [{ type: "execute", children: node.children.flatMap(buildOperation) } satisfies ExecuteBlock];
    default:
      return [];
  }
}

import type { XmlNode } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

const BINARY_OPS = new Set([
  "equals", "not-equals", "starts-with", "contains",
  "less-than", "greater-than", "less-than-or-equal", "greater-than-or-equal",
]);

export const CONDITION_OPS = new Set([...BINARY_OPS, "and", "or"]);

function resolveOperand(node: XmlNode, vars: VariableStore): string {
  if (node.attrs["name"]) return vars.resolve(node.attrs["name"]) ?? "";
  if (node.attrs["value"] !== undefined) return node.attrs["value"];
  return "";
}

function isNumeric(node: XmlNode): boolean {
  return node.attrs["type"] === "number";
}

function evalBinary(node: XmlNode, vars: VariableStore): boolean {
  const leftNode  = node.children.find((c) => c.tag === "left");
  const rightNode = node.children.find((c) => c.tag === "right");
  if (!leftNode || !rightNode) return false;

  const numeric = isNumeric(leftNode) || isNumeric(rightNode);
  if (numeric) {
    const l = Number(resolveOperand(leftNode, vars));
    const r = Number(resolveOperand(rightNode, vars));
    switch (node.tag) {
      case "equals":                return l === r;
      case "not-equals":            return l !== r;
      case "less-than":             return l < r;
      case "greater-than":          return l > r;
      case "less-than-or-equal":    return l <= r;
      case "greater-than-or-equal": return l >= r;
      default:                      return false;
    }
  }

  const l = resolveOperand(leftNode, vars);
  const r = resolveOperand(rightNode, vars);
  switch (node.tag) {
    case "equals":                return l === r;
    case "not-equals":            return l !== r;
    case "starts-with":           return l.startsWith(r);
    case "contains":              return l.includes(r);
    case "less-than":             return Number(l) < Number(r);
    case "greater-than":          return Number(l) > Number(r);
    case "less-than-or-equal":    return Number(l) <= Number(r);
    case "greater-than-or-equal": return Number(l) >= Number(r);
    default:                      return false;
  }
}

export function evaluateCondExprNode(node: XmlNode, vars: VariableStore): boolean {
  if (node.tag === "and") {
    return node.children.filter((c) => CONDITION_OPS.has(c.tag)).every((c) => evaluateCondExprNode(c, vars));
  }
  if (node.tag === "or") {
    return node.children.filter((c) => CONDITION_OPS.has(c.tag)).some((c) => evaluateCondExprNode(c, vars));
  }
  return evalBinary(node, vars);
}

/** Evaluate the condition of an <if> node. */
export function evaluateCondition(ifNode: XmlNode, vars: VariableStore): boolean {
  const condContainer = ifNode.children.find((c) => c.tag === "condition");
  if (!condContainer) return false;
  const exprNode = condContainer.children.find((c) => CONDITION_OPS.has(c.tag));
  return exprNode ? evaluateCondExprNode(exprNode, vars) : false;
}

/** Evaluate a <where> node's condition. */
export function evaluateWhere(whereNode: XmlNode, vars: VariableStore): boolean {
  const exprNode = whereNode.children.find((c) => CONDITION_OPS.has(c.tag));
  return exprNode ? evaluateCondExprNode(exprNode, vars) : true;
}

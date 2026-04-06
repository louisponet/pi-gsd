import type { IfNode, ConditionExpr, Arg } from "../schemas/wxp.zod.js";
import type { VariableStore } from "./variables.js";

/** Resolve an <arg>-as-operand: name= is variable ref, type+value= is literal. */
function resolveOperand(op: Arg, vars: VariableStore): string {
  if (op.name !== undefined) return vars.get(op.name) ?? "";
  if (op.value !== undefined) return op.value;
  return "";
}

function evaluateExpr(expr: ConditionExpr, vars: VariableStore): boolean {
  const left = resolveOperand(expr.left, vars);
  const right = resolveOperand(expr.right, vars);
  switch (expr.op) {
    case "equals": return left === right;
    case "starts-with": return left.startsWith(right);
  }
}

export function evaluateCondition(node: IfNode, vars: VariableStore): boolean {
  return evaluateExpr(node.condition, vars);
}

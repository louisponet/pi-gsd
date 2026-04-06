import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateCondExprNode } from "../conditions.js";
import { createVariableStore } from "../variables.js";
import { x } from "./helpers.js";

// Build an <if> node with a condition expression node inside <condition>
function ifNode(condExpr: ReturnType<typeof x>) {
  return x("if", {}, [x("condition", {}, [condExpr])]);
}

function eq(leftAttrs: Record<string, string>, rightAttrs: Record<string, string>) {
  return x("equals", {}, [x("left", leftAttrs), x("right", rightAttrs)]);
}

function sw(leftAttrs: Record<string, string>, rightAttrs: Record<string, string>) {
  return x("starts-with", {}, [x("left", leftAttrs), x("right", rightAttrs)]);
}

describe("evaluateCondition", () => {
  it("equals: true when variable matches", () => {
    const vars = createVariableStore();
    vars.set("mode", "silent");
    expect(evaluateCondition(
      ifNode(eq({ name: "mode" }, { type: "string", value: "silent" })),
      vars,
    )).toBe(true);
  });

  it("equals: false when variable does not match", () => {
    const vars = createVariableStore();
    vars.set("mode", "interactive");
    expect(evaluateCondition(
      ifNode(eq({ name: "mode" }, { type: "string", value: "silent" })),
      vars,
    )).toBe(false);
  });

  it("starts-with: true when value starts with prefix", () => {
    const vars = createVariableStore();
    vars.set("init", "@file:/tmp/foo.json");
    expect(evaluateCondition(
      ifNode(sw({ name: "init" }, { type: "string", value: "@file:" })),
      vars,
    )).toBe(true);
  });

  it("equals with boolean literal", () => {
    const vars = createVariableStore();
    vars.set("auto-chain-active", "false");
    expect(evaluateCondition(
      ifNode(eq({ name: "auto-chain-active" }, { type: "boolean", value: "false" })),
      vars,
    )).toBe(true);
  });

  it("returns false (not throws) when variable is undefined", () => {
    const vars = createVariableStore();
    expect(evaluateCondition(
      ifNode(eq({ name: "missing" }, { type: "string", value: "x" })),
      vars,
    )).toBe(false);
  });
});

describe("evaluateCondExprNode — and/or", () => {
  it("and: all children must be true", () => {
    const vars = createVariableStore();
    vars.set("a", "1"); vars.set("b", "2");
    expect(evaluateCondExprNode(x("and", {}, [
      eq({ name: "a" }, { value: "1" }),
      eq({ name: "b" }, { value: "2" }),
    ]), vars)).toBe(true);

    expect(evaluateCondExprNode(x("and", {}, [
      eq({ name: "a" }, { value: "1" }),
      eq({ name: "b" }, { value: "99" }),
    ]), vars)).toBe(false);
  });

  it("or: any child true is sufficient", () => {
    const vars = createVariableStore();
    vars.set("x", "hello");
    expect(evaluateCondExprNode(x("or", {}, [
      eq({ name: "x" }, { value: "nope" }),
      eq({ name: "x" }, { value: "hello" }),
    ]), vars)).toBe(true);
  });

  it("not-equals", () => {
    const vars = createVariableStore();
    vars.set("status", "complete");
    expect(evaluateCondExprNode(
      x("not-equals", {}, [x("left", { name: "status" }), x("right", { value: "pending" })]),
      vars,
    )).toBe(true);
  });

  it("less-than with numeric coercion", () => {
    const vars = createVariableStore();
    vars.set("n", "3");
    expect(evaluateCondExprNode(
      x("less-than", {}, [x("left", { name: "n", type: "number" }), x("right", { type: "number", value: "5" })]),
      vars,
    )).toBe(true);
  });
});

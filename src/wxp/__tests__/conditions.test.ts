import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../conditions.js";
import { createVariableStore } from "../variables.js";
import type { IfNode } from "../../schemas/wxp.zod.js";

describe("evaluateCondition", () => {
  it("equals: true when variable matches", () => {
    const vars = createVariableStore();
    vars.set("mode", "silent");
    const node: IfNode = {
      type: "if",
      condition: { op: "equals", left: { name: "mode" }, right: { type: "string", value: "silent" } },
      then: [],
    };
    expect(evaluateCondition(node, vars)).toBe(true);
  });

  it("equals: false when variable does not match", () => {
    const vars = createVariableStore();
    vars.set("mode", "interactive");
    const node: IfNode = {
      type: "if",
      condition: { op: "equals", left: { name: "mode" }, right: { type: "string", value: "silent" } },
      then: [],
    };
    expect(evaluateCondition(node, vars)).toBe(false);
  });

  it("starts-with: true when value starts with prefix", () => {
    const vars = createVariableStore();
    vars.set("init", "@file:/tmp/foo.json");
    const node: IfNode = {
      type: "if",
      condition: { op: "starts-with", left: { name: "init" }, right: { type: "string", value: "@file:" } },
      then: [],
    };
    expect(evaluateCondition(node, vars)).toBe(true);
  });

  it("equals with boolean literal: false when flag is false", () => {
    const vars = createVariableStore();
    vars.set("auto-chain-active", "false");
    const node: IfNode = {
      type: "if",
      condition: { op: "equals", left: { name: "auto-chain-active" }, right: { type: "boolean", value: "false" } },
      then: [],
    };
    expect(evaluateCondition(node, vars)).toBe(true);
  });

  it("returns false (not throws) when variable is undefined", () => {
    const vars = createVariableStore();
    const node: IfNode = {
      type: "if",
      condition: { op: "equals", left: { name: "missing" }, right: { type: "string", value: "x" } },
      then: [],
    };
    expect(evaluateCondition(node, vars)).toBe(false);
  });
});

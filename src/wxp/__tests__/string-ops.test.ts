import { describe, it, expect } from "vitest";
import { executeStringOp, WxpStringOpError } from "../string-ops.js";
import { createVariableStore } from "../variables.js";
import type { StringOpNode } from "../../schemas/wxp.zod.js";

describe("executeStringOp split", () => {
  it("splits @file: prefix and stores remainder", () => {
    const vars = createVariableStore();
    vars.set("init", "@file:/tmp/gsd-init.json");
    const node: StringOpNode = {
      type: "string-op",
      op: "split",
      args: [{ name: "init" }, { type: "string", value: "@file:" }],
      outs: [{ type: "string", name: "init-file" }],
    };
    executeStringOp(node, vars);
    expect(vars.get("init-file")).toBe("/tmp/gsd-init.json");
  });

  it("throws WxpStringOpError when source variable is undefined", () => {
    const vars = createVariableStore();
    const node: StringOpNode = {
      type: "string-op",
      op: "split",
      args: [{ name: "missing" }, { type: "string", value: "@file:" }],
      outs: [{ type: "string", name: "out" }],
    };
    expect(() => executeStringOp(node, vars)).toThrow(WxpStringOpError);
  });
});

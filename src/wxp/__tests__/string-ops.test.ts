import { describe, it, expect } from "vitest";
import { executeStringOp, WxpStringOpError } from "../string-ops.js";
import { createVariableStore } from "../variables.js";
import { x } from "./helpers.js";

function splitNode(srcName: string, delimiter: string, outName: string) {
  return x("string-op", { op: "split" }, [
    x("args", {}, [x("arg", { name: srcName }), x("arg", { type: "string", value: delimiter })]),
    x("outs", {}, [x("out", { type: "string", name: outName })]),
  ]);
}

describe("executeStringOp split", () => {
  it("splits @file: prefix and stores remainder", () => {
    const vars = createVariableStore();
    vars.set("init", "@file:/tmp/gsd-init.json");
    executeStringOp(splitNode("init", "@file:", "init-file"), vars);
    expect(vars.get("init-file")).toBe("/tmp/gsd-init.json");
  });

  it("throws WxpStringOpError when source variable is undefined", () => {
    const vars = createVariableStore();
    expect(() => executeStringOp(splitNode("missing", "@file:", "out"), vars)).toThrow(WxpStringOpError);
  });
});

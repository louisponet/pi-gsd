import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn().mockReturnValue("ok\n"),
}));

import { createVariableStore } from "../variables.js";
import { executeBlock } from "../executor.js";
import { evaluateCondExprNode } from "../conditions.js";
import type { WxpExecContext } from "../../schemas/wxp.zod.js";
import { execFileSync } from "node:child_process";
import { x } from "./helpers.js";

const makeCtx = (onDisplay = vi.fn()): WxpExecContext => ({
  config: {
    trustedPaths: [],
    untrustedPaths: [],
    shellAllowlist: ["pi-gsd-tools", "git", "echo", "cat", "node", "ls", "find"],
    shellBanlist: [],
    shellTimeoutMs: 30_000,
  },
  projectRoot: "/project",
  pkgRoot: "/pkg",
  onDisplay,
});

function exec(...children: ReturnType<typeof x>[]) {
  return x("gsd-execute", {}, children);
}

describe("conditions — new operators", () => {
  it("not-equals: true when values differ", () => {
    const vars = createVariableStore();
    vars.set("status", "complete");
    expect(evaluateCondExprNode(
      x("not-equals", {}, [x("left", { name: "status" }), x("right", { value: "pending" })]),
      vars,
    )).toBe(true);
  });

  it("less-than (numeric)", () => {
    const vars = createVariableStore();
    vars.set("n", "3");
    expect(evaluateCondExprNode(
      x("less-than", {}, [x("left", { name: "n", type: "number" }), x("right", { type: "number", value: "5" })]),
      vars,
    )).toBe(true);
  });

  it("greater-than-or-equal", () => {
    const vars = createVariableStore();
    vars.set("n", "5");
    expect(evaluateCondExprNode(
      x("greater-than-or-equal", {}, [x("left", { name: "n", type: "number" }), x("right", { type: "number", value: "5" })]),
      vars,
    )).toBe(true);
  });

  it("contains", () => {
    const vars = createVariableStore();
    vars.set("init", "@file:/tmp/out.json");
    expect(evaluateCondExprNode(
      x("contains", {}, [x("left", { name: "init" }), x("right", { value: "@file:" })]),
      vars,
    )).toBe(true);
  });

  it("<and>: all children must be true", () => {
    const vars = createVariableStore();
    vars.set("a", "1"); vars.set("b", "2");
    expect(evaluateCondExprNode(x("and", {}, [
      x("equals", {}, [x("left", { name: "a" }), x("right", { value: "1" })]),
      x("equals", {}, [x("left", { name: "b" }), x("right", { value: "2" })]),
    ]), vars)).toBe(true);
    expect(evaluateCondExprNode(x("and", {}, [
      x("equals", {}, [x("left", { name: "a" }), x("right", { value: "1" })]),
      x("equals", {}, [x("left", { name: "b" }), x("right", { value: "99" })]),
    ]), vars)).toBe(false);
  });

  it("<or>: any child true is sufficient", () => {
    const vars = createVariableStore();
    vars.set("x", "hello");
    expect(evaluateCondExprNode(x("or", {}, [
      x("equals", {}, [x("left", { name: "x" }), x("right", { value: "nope" })]),
      x("equals", {}, [x("left", { name: "x" }), x("right", { value: "hello" })]),
    ]), vars)).toBe(true);
  });

  it("nested <and> inside <or>", () => {
    const vars = createVariableStore();
    vars.set("status", "pending"); vars.set("phase", "3");
    expect(evaluateCondExprNode(x("or", {}, [
      x("equals", {}, [x("left", { name: "status" }), x("right", { value: "complete" })]),
      x("and", {}, [
        x("equals", {}, [x("left", { name: "status" }), x("right", { value: "pending" })]),
        x("greater-than-or-equal", {}, [x("left", { name: "phase", type: "number" }), x("right", { type: "number", value: "2" })]),
      ]),
    ]), vars)).toBe(true);
  });
});

describe("<display>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits via onDisplay with {varname} interpolation", () => {
    const onDisplay = vi.fn();
    const vars = createVariableStore();
    vars.set("phase", "3"); vars.set("phase-name", "WXP Foundation");
    executeBlock(exec(x("display", { msg: "GSD ► PHASE {phase} — {phase-name}", level: "info" })), vars, makeCtx(onDisplay));
    expect(onDisplay).toHaveBeenCalledWith("GSD ► PHASE 3 — WXP Foundation", "info");
  });

  it("resolves dot-notation {item.status}", () => {
    const onDisplay = vi.fn();
    const vars = createVariableStore();
    vars.set("phase", JSON.stringify({ status: "complete", name: "Test" }));
    executeBlock(exec(x("display", { msg: "Status: {phase.status}" })), vars, makeCtx(onDisplay));
    expect(onDisplay).toHaveBeenCalledWith("Status: complete", "info");
  });
});

describe("<json-parse>", () => {
  it("extracts a top-level key", () => {
    const vars = createVariableStore();
    vars.set("data", JSON.stringify({ phase_number: "3" }));
    executeBlock(exec(x("json-parse", { src: "data", path: "$.phase_number", out: "phase" })), vars, makeCtx());
    expect(vars.get("phase")).toBe("3");
  });

  it("extracts an array for <for-each>", () => {
    const vars = createVariableStore();
    vars.set("progress", JSON.stringify({ phases: [{ number: "1" }, { number: "2" }] }));
    executeBlock(exec(x("json-parse", { src: "progress", path: "$.phases", out: "phases" })), vars, makeCtx());
    const arr = vars.getArray("phases");
    expect(arr).toHaveLength(2);
    expect(JSON.parse(arr![0]).number).toBe("1");
  });
});

describe("<for-each>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("iterates array and runs body for each item", () => {
    const onDisplay = vi.fn();
    const vars = createVariableStore();
    vars.setArray("items", [JSON.stringify({ name: "Alpha" }), JSON.stringify({ name: "Beta" })]);
    executeBlock(exec(
      x("for-each", { var: "items", item: "item" }, [
        x("display", { msg: "Item: {item.name}", level: "info" }),
      ]),
    ), vars, makeCtx(onDisplay));
    expect(onDisplay).toHaveBeenCalledTimes(2);
    expect(onDisplay).toHaveBeenNthCalledWith(1, "Item: Alpha", "info");
    expect(onDisplay).toHaveBeenNthCalledWith(2, "Item: Beta", "info");
  });

  it("<where> filters items", () => {
    const onDisplay = vi.fn();
    const vars = createVariableStore();
    vars.setArray("phases", [
      JSON.stringify({ number: "1", status: "complete" }),
      JSON.stringify({ number: "2", status: "pending" }),
      JSON.stringify({ number: "3", status: "pending" }),
    ]);
    executeBlock(exec(
      x("for-each", { var: "phases", item: "phase" }, [
        x("where", {}, [
          x("not-equals", {}, [x("left", { name: "phase.status" }), x("right", { value: "complete" })]),
        ]),
        x("display", { msg: "{phase.number}" }),
      ]),
    ), vars, makeCtx(onDisplay));
    expect(onDisplay).toHaveBeenCalledTimes(2);
    expect(onDisplay).toHaveBeenNthCalledWith(1, "2", "info");
  });

  it("<sort-by> sorts numerically", () => {
    const onDisplay = vi.fn();
    const vars = createVariableStore();
    vars.setArray("phases", [
      JSON.stringify({ number: "3" }), JSON.stringify({ number: "1" }), JSON.stringify({ number: "2" }),
    ]);
    executeBlock(exec(
      x("for-each", { var: "phases", item: "phase" }, [
        x("sort-by", { key: "number", type: "number", order: "asc" }),
        x("display", { msg: "{phase.number}" }),
      ]),
    ), vars, makeCtx(onDisplay));
    expect(onDisplay).toHaveBeenNthCalledWith(1, "1", "info");
    expect(onDisplay).toHaveBeenNthCalledWith(3, "3", "info");
  });

  it("missing array is silently skipped", () => {
    const vars = createVariableStore();
    expect(() => executeBlock(exec(
      x("for-each", { var: "nonexistent", item: "x" }, []),
    ), vars, makeCtx())).not.toThrow();
  });
});

describe("variables — dot notation and arrays", () => {
  it("resolve dot-notation accesses JSON property", () => {
    const vars = createVariableStore();
    vars.set("item", JSON.stringify({ status: "complete", number: "5" }));
    expect(vars.resolve("item.status")).toBe("complete");
    expect(vars.resolve("item.number")).toBe("5");
  });

  it("setArray/getArray round-trips", () => {
    const vars = createVariableStore();
    vars.setArray("arr", ["a", "b", "c"]);
    expect(vars.getArray("arr")).toEqual(["a", "b", "c"]);
  });

  it("getArray falls back to parsing JSON scalar", () => {
    const vars = createVariableStore();
    vars.set("data", JSON.stringify(["x", "y"]));
    expect(vars.getArray("data")).toEqual(["x", "y"]);
  });
});

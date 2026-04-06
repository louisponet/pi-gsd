import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn().mockReturnValue("exec-output\n"),
}));

import { executeBlock, WxpExecutionError } from "../executor.js";
import { createVariableStore } from "../variables.js";
import type { WxpExecContext } from "../../schemas/wxp.zod.js";
import { x } from "./helpers.js";

const makeCtx = (): WxpExecContext => ({
  config: {
    trustedPaths: [],
    untrustedPaths: [],
    shellAllowlist: ["git", "pi-gsd-tools", "node", "cat", "ls", "echo", "find"],
    shellBanlist: [],
    shellTimeoutMs: 30_000,
  },
  projectRoot: "/project",
  pkgRoot: "/pkg",
  onDisplay: () => {},
});

// Build a <gsd-execute> container
function exec(...children: ReturnType<typeof x>[]) {
  return x("gsd-execute", {}, children);
}

describe("executeBlock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("executes a shell child and stores result", () => {
    const vars = createVariableStore();
    executeBlock(exec(
      x("shell", { command: "git" }, [
        x("args", {}, [x("arg", { string: "status" })]),
        x("outs", {}, [x("out", { type: "string", name: "out" })]),
      ]),
    ), vars, makeCtx());
    expect(vars.get("out")).toBe("exec-output");
  });

  it("evaluates if/condition/equals and executes then-branch when true", () => {
    const vars = createVariableStore();
    vars.set("auto-chain-active", "false");
    executeBlock(exec(
      x("if", {}, [
        x("condition", {}, [
          x("equals", {}, [
            x("left", { name: "auto-chain-active" }),
            x("right", { type: "boolean", value: "false" }),
          ]),
        ]),
        x("then", {}, [
          x("shell", { command: "git" }, [
            x("args", {}, []),
            x("outs", {}, [x("out", { type: "string", name: "branch" })]),
          ]),
        ]),
      ]),
    ), vars, makeCtx());
    expect(vars.get("branch")).toBe("exec-output");
  });

  it("skips then-branch when condition is false", () => {
    const vars = createVariableStore();
    vars.set("auto-chain-active", "true");
    executeBlock(exec(
      x("if", {}, [
        x("condition", {}, [
          x("equals", {}, [
            x("left", { name: "auto-chain-active" }),
            x("right", { type: "boolean", value: "false" }),
          ]),
        ]),
        x("then", {}, [
          x("shell", { command: "git" }, [
            x("args", {}, []),
            x("outs", {}, [x("out", { type: "string", name: "branch" })]),
          ]),
        ]),
      ]),
    ), vars, makeCtx());
    expect(vars.get("branch")).toBeUndefined();
  });

  it("wraps errors in WxpExecutionError", () => {
    const vars = createVariableStore();
    expect(() => executeBlock(exec(
      x("shell", { command: "bash" }, [x("args", {}, []), x("outs", {}, [])]),
    ), vars, makeCtx())).toThrow(WxpExecutionError);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn().mockReturnValue("mocked-output\n"),
}));

import { executeShell, WxpShellError } from "../shell.js";
import { createVariableStore } from "../variables.js";
import type { ShellNode, WxpSecurityConfig } from "../../schemas/wxp.zod.js";
import { execFileSync } from "node:child_process";

const cfg: WxpSecurityConfig = {
  trustedPaths: [],
  untrustedPaths: [],
  shellAllowlist: ["pi-gsd-tools", "git", "node", "cat", "ls", "echo", "find"],
  shellBanlist: [],
  shellTimeoutMs: 30_000,
};

describe("executeShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (execFileSync as Mock).mockReturnValue("mocked-output\n");
  });

  it("executes allowlisted command and stores stdout in out variable", () => {
    const vars = createVariableStore();
    const node: ShellNode = {
      type: "shell",
      command: "pi-gsd-tools",
      args: [{ string: "state" }, { string: "json" }],
      outs: [{ type: "string", name: "state" }],
      suppressErrors: false,
    };
    executeShell(node, vars, cfg);
    expect(vars.get("state")).toBe("mocked-output");
  });

  it("throws WxpShellError for non-allowlisted command (no process spawned)", () => {
    const vars = createVariableStore();
    const node: ShellNode = {
      type: "shell",
      command: "bash",
      args: [],
      outs: [],
      suppressErrors: false,
    };
    expect(() => executeShell(node, vars, cfg)).toThrow(WxpShellError);
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it("resolves variable args correctly", () => {
    const vars = createVariableStore();
    vars.set("phase", "16");
    const node: ShellNode = {
      type: "shell",
      command: "pi-gsd-tools",
      args: [
        { string: "init" },
        { string: "execute-phase" },
        { name: "phase", wrap: '"' },
      ],
      outs: [{ type: "string", name: "init" }],
      suppressErrors: false,
    };
    executeShell(node, vars, cfg);
    expect(execFileSync).toHaveBeenCalledWith(
      "pi-gsd-tools",
      ["init", "execute-phase", '"16"'],
      expect.objectContaining({ timeout: 30_000 }),
    );
  });

  it("suppress-errors: stores empty string on failure instead of throwing", () => {
    (execFileSync as Mock).mockImplementationOnce(() => {
      throw Object.assign(new Error("exit 1"), { stderr: "error msg" });
    });
    const vars = createVariableStore();
    const node: ShellNode = {
      type: "shell",
      command: "pi-gsd-tools",
      args: [{ string: "agent-skills" }, { string: "gsd-executor" }],
      outs: [{ type: "string", name: "skills" }],
      suppressErrors: true,
    };
    expect(() => executeShell(node, vars, cfg)).not.toThrow();
    expect(vars.get("skills")).toBe("");
  });
});

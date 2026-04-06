import { describe, it, expect } from "vitest";
import { parseArguments, WxpArgumentsError } from "../arguments.js";
import { createVariableStore } from "../variables.js";
import type { ArgumentsNode } from "../../schemas/wxp.zod.js";

describe("parseArguments — two-pass (PRD §3.2)", () => {
  it("extracts flag and assigns positional", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: false, strictArgs: false, delimiters: [] },
      args: [
        { name: "phase", type: "number" },
        { name: "auto-chain-active", type: "flag", flag: "--auto", optional: true },
      ],
    };
    parseArguments(node, "1 --auto", vars);
    expect(vars.get("phase")).toBe("1");
    expect(vars.get("auto-chain-active")).toBe("true");
  });

  it("absent flag defaults to false", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: false, strictArgs: false, delimiters: [] },
      args: [{ name: "dry-run", type: "flag", flag: "--dry-run", optional: true }],
    };
    parseArguments(node, "", vars);
    expect(vars.get("dry-run")).toBe("false");
  });

  it("greedy last string consumes all remaining tokens", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: false, strictArgs: false, delimiters: [] },
      args: [
        { name: "phase", type: "number" },
        { name: "auto", type: "flag", flag: "--auto", optional: true },
        { name: "user-text", type: "string", optional: true },
      ],
    };
    parseArguments(node, "1 --auto fix the login bug", vars);
    expect(vars.get("phase")).toBe("1");
    expect(vars.get("auto")).toBe("true");
    expect(vars.get("user-text")).toBe("fix the login bug");
  });

  it("throws on missing required positional", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: false, strictArgs: false, delimiters: [] },
      args: [{ name: "phase", type: "number" }],
    };
    expect(() => parseArguments(node, "", vars)).toThrow(WxpArgumentsError);
  });

  it("number type: throws on NaN", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: false, strictArgs: false, delimiters: [] },
      args: [{ name: "phase", type: "number" }],
    };
    expect(() => parseArguments(node, "notanumber", vars)).toThrow(WxpArgumentsError);
  });

  it("keep-extra-args stores extra in _extra", () => {
    const vars = createVariableStore();
    const node: ArgumentsNode = {
      type: "arguments",
      settings: { keepExtraArgs: true, strictArgs: false, delimiters: [] },
      args: [{ name: "phase", type: "number" }],
    };
    parseArguments(node, "1 extra stuff", vars);
    expect(vars.get("_extra")).toBe("extra stuff");
  });
});

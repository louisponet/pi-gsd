import { describe, it, expect } from "vitest";
import { parseArguments, WxpArgumentsError } from "../arguments.js";
import { createVariableStore } from "../variables.js";
import { x } from "./helpers.js";

// Build a <gsd-arguments> XmlNode from a declarative spec
function argsNode(opts: {
    keep?: boolean;
    strict?: boolean;
    args: Array<{ name: string; type: string; flag?: string; optional?: boolean }>;
}) {
    const settingsChildren = [];
    if (opts.keep) settingsChildren.push(x("keep-extra-args"));
    if (opts.strict) settingsChildren.push(x("strict-args"));

    const argNodes = opts.args.map((a) => {
        const attrs: Record<string, string> = { name: a.name, type: a.type };
        if (a.flag) attrs["flag"] = a.flag;
        if (a.optional) attrs["optional"] = "";
        return x("arg", attrs);
    });

    return x("gsd-arguments", {}, [
        x("settings", {}, settingsChildren),
        ...argNodes,
    ]);
}

describe("parseArguments - two-pass (PRD §3.2)", () => {
    it("extracts flag and assigns positional", () => {
        const vars = createVariableStore();
        parseArguments(argsNode({
            args: [
                { name: "phase", type: "number" },
                { name: "auto-chain-active", type: "flag", flag: "--auto", optional: true },
            ],
        }), "1 --auto", vars);
        expect(vars.get("phase")).toBe("1");
        expect(vars.get("auto-chain-active")).toBe("true");
    });

    it("absent flag defaults to false", () => {
        const vars = createVariableStore();
        parseArguments(argsNode({
            args: [{ name: "dry-run", type: "flag", flag: "--dry-run", optional: true }],
        }), "", vars);
        expect(vars.get("dry-run")).toBe("false");
    });

    it("greedy last string consumes all remaining tokens", () => {
        const vars = createVariableStore();
        parseArguments(argsNode({
            args: [
                { name: "phase", type: "number" },
                { name: "auto", type: "flag", flag: "--auto", optional: true },
                { name: "user-text", type: "string", optional: true },
            ],
        }), "1 --auto fix the login bug", vars);
        expect(vars.get("phase")).toBe("1");
        expect(vars.get("auto")).toBe("true");
        expect(vars.get("user-text")).toBe("fix the login bug");
    });

    it("throws on missing required positional", () => {
        const vars = createVariableStore();
        expect(() => parseArguments(argsNode({
            args: [{ name: "phase", type: "number" }],
        }), "", vars)).toThrow(WxpArgumentsError);
    });

    it("number type: throws on NaN", () => {
        const vars = createVariableStore();
        expect(() => parseArguments(argsNode({
            args: [{ name: "phase", type: "number" }],
        }), "notanumber", vars)).toThrow(WxpArgumentsError);
    });

    it("keep-extra-args stores extra in _extra", () => {
        const vars = createVariableStore();
        parseArguments(argsNode({
            keep: true,
            args: [{ name: "phase", type: "number" }],
        }), "1 extra stuff", vars);
        expect(vars.get("_extra")).toBe("extra stuff");
    });
});

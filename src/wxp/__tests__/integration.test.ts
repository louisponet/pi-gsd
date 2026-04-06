import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import path from "node:path";

vi.mock("node:child_process", () => ({
    execFileSync: vi.fn().mockReturnValue("shell-output\n"),
}));

import { processWxp, WxpProcessingError } from "../index.js";
import type { WxpSecurityConfig } from "../../schemas/wxp.zod.js";
import { execFileSync } from "node:child_process";

const PROJECT_ROOT = "/project";
const PKG_ROOT = "/pkg";
const TRUSTED_DIR = "/project/.pi/gsd/workflows";
const VIRTUAL_FILE = path.join(TRUSTED_DIR, "test.md");

const cfg: WxpSecurityConfig = {
    trustedPaths: [{ position: "absolute", path: TRUSTED_DIR }],
    untrustedPaths: [],
    shellAllowlist: ["pi-gsd-tools", "git", "node", "cat", "ls", "echo", "find"],
    shellBanlist: [],
    shellTimeoutMs: 30_000,
};

describe("processWxp - integration (TST-02)", () => {
    beforeEach(() => {
        (execFileSync as Mock).mockReturnValue("shell-output\n");
    });

    it("Fixture 1: shell output captured and paste tag replaced", () => {
        const content = [
            "<gsd-execute>",
            "  <shell command=\"pi-gsd-tools\">",
            "    <args><arg string=\"state\" /><arg string=\"json\" /></args>",
            "    <outs><out type=\"string\" name=\"state\" /></outs>",
            "  </shell>",
            "</gsd-execute>",
            "State: <gsd-paste name=\"state\" />",
        ].join("\n");

        const result = processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT);
        expect(result).toContain("State: shell-output");
        expect(result).not.toMatch(/<gsd-paste/);
        expect(result).not.toMatch(/<gsd-execute>/);
    });

    it("Fixture 2: <gsd-paste> inside code fence is unchanged (WXP-01)", () => {
        const content = [
            "Example:",
            "```",
            '<gsd-paste name="x" />',
            "```",
        ].join("\n");
        // No variables - would throw WxpProcessingError if paste ran outside fence
        const result = processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT);
        expect(result).toContain('<gsd-paste name="x" />');
    });

    it("Fixture 3: if/starts-with condition branches correctly", () => {
        const content = [
            "<gsd-arguments>",
            '  <arg name="auto-chain-active" type="flag" flag="--auto" optional />',
            "</gsd-arguments>",
            "<gsd-execute>",
            "  <if>",
            "    <condition><equals>",
            '      <left name="auto-chain-active" />',
            '      <right type="boolean" value="false" />',
            "    </equals></condition>",
            "    <then>",
            '      <shell command="pi-gsd-tools">',
            '        <args><arg string="config-set" /><arg string="workflow._auto_chain_active" /><arg name="auto-chain-active" /></args>',
            "        <outs><suppress-errors /></outs>",
            "      </shell>",
            "    </then>",
            "  </if>",
            "</gsd-execute>",
        ].join("\n");

        (execFileSync as Mock).mockReturnValue("ok\n");
        // Without --auto flag: auto-chain-active = false → condition true → shell runs
        const result = processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT, "");
        expect(execFileSync).toHaveBeenCalled();
        expect(result.trim()).toBe("");
    });

    it("Fixture 5: variable collision gets owner-prefixed", async () => {
        const { createVariableStore } = await import("../variables.js");
        const store = createVariableStore();
        store.set("result", "from-a", "file-a");
        store.set("result", "from-b", "file-b");
        expect(store.get("result")).toBeUndefined();
        expect(store.get("file-a:result")).toBe("from-a");
        expect(store.get("file-b:result")).toBe("from-b");
    });

    it("Fixture 6a: untrusted path throws WxpProcessingError", () => {
        expect(() =>
            processWxp("content", "/untrusted/file.md", cfg, PROJECT_ROOT, PKG_ROOT),
        ).toThrow(WxpProcessingError);
    });

    it("Fixture 6b: .planning/ path throws WxpProcessingError", () => {
        expect(() =>
            processWxp("content", "/project/.planning/STATE.md", cfg, PROJECT_ROOT, PKG_ROOT),
        ).toThrow(WxpProcessingError);
    });

    it("Fixture 6c: undefined paste variable throws WxpProcessingError", () => {
        const content = '<gsd-paste name="missing" />';
        expect(() =>
            processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT),
        ).toThrow(WxpProcessingError);
    });

    it("Fixture 6d: non-allowlisted command throws WxpProcessingError", () => {
        const content = [
            "<gsd-execute>",
            '  <shell command="bash">',
            '    <args><arg string="-c" /><arg string="echo hi" /></args>',
            "    <outs><out type=\"string\" name=\"out\" /></outs>",
            "  </shell>",
            "</gsd-execute>",
        ].join("\n");
        expect(() =>
            processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT),
        ).toThrow(WxpProcessingError);
    });

    it("WxpProcessingError contains variable namespace", () => {
        try {
            processWxp('<gsd-paste name="gone" />', VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT);
        } catch (err) {
            expect(err).toBeInstanceOf(WxpProcessingError);
            expect((err as WxpProcessingError).message).toContain("Variable Namespace");
        }
    });

    it("Fixture 7: output contains zero <gsd-* tags outside code fences (TST-03)", () => {
        const content = [
            "<gsd-execute>",
            '  <shell command="echo">',
            '    <args><arg string="hello" /></args>',
            '    <outs><out type="string" name="val" /></outs>',
            "  </shell>",
            "</gsd-execute>",
            '<gsd-paste name="val" />',
            "",
            "```",
            '<gsd-paste name="val" />',
            "```",
        ].join("\n");

        (execFileSync as Mock).mockReturnValue("hello\n");
        const result = processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT);
        const withoutFences = result.replace(/^```[^\n]*\n[\s\S]*?^```/gm, "FENCE");
        expect(withoutFences.match(/<gsd-(?!-)[^>]*>/g)).toBeNull();
    });

    it("gsd-version tags are informational and do not cause errors", () => {
        const content = '<gsd-version v="1.12.4" />\n# Hello';
        const result = processWxp(content, VIRTUAL_FILE, cfg, PROJECT_ROOT, PKG_ROOT);
        expect(result).toContain("# Hello");
    });
});

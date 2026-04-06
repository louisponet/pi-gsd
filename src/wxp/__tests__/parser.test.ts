import { describe, it, expect } from "vitest";
import { extractWxpTags, extractCodeFenceRegions } from "../parser.js";
import { executeNode } from "../executor.js";
import { createVariableStore } from "../variables.js";
import type { WxpExecContext } from "../../schemas/wxp.zod.js";
import { x } from "./helpers.js";

const ctx: WxpExecContext = {
  config: {
    trustedPaths: [],
    untrustedPaths: [],
    shellAllowlist: ["pi-gsd-tools", "git", "cat", "ls", "echo", "node", "find"],
    shellBanlist: [],
    shellTimeoutMs: 30_000,
  },
  projectRoot: "/project",
  pkgRoot: "/pkg",
  onDisplay: () => {},
};

describe("extractCodeFenceRegions", () => {
  it("returns empty for content with no fences", () => {
    expect(extractCodeFenceRegions("hello world")).toEqual([]);
  });

  it("identifies a fenced region", () => {
    const content = "before\n```\ncode\n```\nafter";
    const regions = extractCodeFenceRegions(content);
    expect(regions).toHaveLength(1);
    expect(content.slice(regions[0][0], regions[0][1])).toContain("code");
  });
});

describe("extractWxpTags — code-fence skip (WXP-01)", () => {
  it("does NOT parse <gsd-paste> inside a code fence", () => {
    const content = "before\n```\n<gsd-paste name=\"x\" />\n```\nafter";
    const pastes = extractWxpTags(content).filter((t) => t.node.tag === "gsd-paste");
    expect(pastes).toHaveLength(0);
  });

  it("DOES parse <gsd-paste> outside a code fence", () => {
    const content = 'text\n<gsd-paste name="x" />\nmore';
    const pastes = extractWxpTags(content).filter((t) => t.node.tag === "gsd-paste");
    expect(pastes).toHaveLength(1);
    expect(pastes[0].node.attrs["name"]).toBe("x");
  });
});

describe("extractWxpTags — gsd-execute with shell children", () => {
  it("parses nested shell/args/outs structure", () => {
    const content = [
      "<gsd-execute>",
      "  <shell command=\"pi-gsd-tools\">",
      "    <args><arg string=\"init\" /><arg string=\"execute-phase\" /><arg name=\"phase\" wrap='\"' /></args>",
      "    <outs><out type=\"string\" name=\"init\" /></outs>",
      "  </shell>",
      "</gsd-execute>",
    ].join("\n");

    const tags = extractWxpTags(content);
    expect(tags).toHaveLength(1);
    expect(tags[0].node.tag).toBe("gsd-execute");

    const shell = tags[0].node.children.find((c) => c.tag === "shell");
    expect(shell).toBeDefined();
    expect(shell?.attrs["command"]).toBe("pi-gsd-tools");

    const args = shell?.children.find((c) => c.tag === "args");
    expect(args?.children.filter((c) => c.tag === "arg")).toHaveLength(3);

    const outs = shell?.children.find((c) => c.tag === "outs");
    expect(outs?.children.find((c) => c.tag === "out")?.attrs["name"]).toBe("init");
  });
});

describe("extractWxpTags — gsd-arguments", () => {
  it("parses typed positionals and flag with settings", () => {
    const content = [
      "<gsd-arguments>",
      "  <settings><keep-extra-args /></settings>",
      "  <arg name=\"phase\" type=\"number\" />",
      "  <arg name=\"auto\" type=\"flag\" flag=\"--auto\" optional />",
      "  <arg name=\"user-text\" type=\"string\" optional />",
      "</gsd-arguments>",
    ].join("\n");

    const tags = extractWxpTags(content);
    expect(tags[0].node.tag).toBe("gsd-arguments");
    const argDefs = tags[0].node.children.filter((c) => c.tag === "arg");
    expect(argDefs).toHaveLength(3);
    expect(argDefs.find((a) => a.attrs["type"] === "flag")?.attrs["flag"]).toBe("--auto");
    expect(tags[0].node.children.find((c) => c.tag === "settings")
      ?.children.some((c) => c.tag === "keep-extra-args")).toBe(true);
  });
});

describe("extractWxpTags — gsd-include", () => {
  it("parses self-closing include", () => {
    const content = `<gsd-include path="other.md" />`;
    const tags = extractWxpTags(content);
    expect(tags[0].node.attrs["path"]).toBe("other.md");
  });

  it("parses include-arguments attribute", () => {
    const content = `<gsd-include path="other.md" include-arguments />`;
    expect("include-arguments" in extractWxpTags(content)[0].node.attrs).toBe(true);
  });

  it("parses include with arg mappings (INC-02)", () => {
    const content = [
      `<gsd-include path="other.md">`,
      `  <gsd-arguments>`,
      `    <arg name="my-phase" as="phase" />`,
      `  </gsd-arguments>`,
      `</gsd-include>`,
    ].join("\n");
    const tag = extractWxpTags(content)[0];
    const mappingArg = tag.node.children
      .find((c) => c.tag === "gsd-arguments")
      ?.children.find((c) => c.tag === "arg");
    expect(mappingArg?.attrs["name"]).toBe("my-phase");
    expect(mappingArg?.attrs["as"]).toBe("phase");
  });
});

describe("extractWxpTags — gsd-version", () => {
  it("parses version tag", () => {
    const tag = extractWxpTags(`<gsd-version v="1.12.4" />`)[0];
    expect(tag.node.attrs["v"]).toBe("1.12.4");
  });

  it("parses do-not-update", () => {
    const tag = extractWxpTags(`<gsd-version v="1.0.0" do-not-update />`)[0];
    expect("do-not-update" in tag.node.attrs).toBe(true);
  });
});

describe("if node with PRD condition structure — executed directly", () => {
  it("evaluates equals with left/right operands and runs then-branch", () => {
    const vars = createVariableStore();
    vars.set("auto-chain-active", "false");
    const displayed: string[] = [];
    const testCtx = { ...ctx, onDisplay: (m: string) => displayed.push(m) };

    executeNode(x("if", {}, [
      x("condition", {}, [
        x("equals", {}, [
          x("left", { name: "auto-chain-active" }),
          x("right", { type: "boolean", value: "false" }),
        ]),
      ]),
      x("then", {}, [
        x("display", { msg: "condition was true" }),
      ]),
    ]), vars, testCtx);

    expect(displayed).toContain("condition was true");
  });
});

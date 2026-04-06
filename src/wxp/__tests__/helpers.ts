import { describe, it, expect } from "vitest";
import type { XmlNode } from "../../schemas/wxp.zod.js";

// ─── XmlNode builder helper ───────────────────────────────────────────────────
export function x(
  tag: string,
  attrs: Record<string, string> = {},
  children: XmlNode[] = [],
): XmlNode {
  return { tag, attrs, children, selfClosing: children.length === 0 && !attrs["__open"] };
}

describe("x() helper sanity", () => {
  it("builds a self-closing node", () => {
    const node = x("arg", { string: "hello" });
    expect(node.tag).toBe("arg");
    expect(node.attrs["string"]).toBe("hello");
    expect(node.selfClosing).toBe(true);
  });

  it("builds a node with children", () => {
    const node = x("args", {}, [x("arg", { string: "a" })]);
    expect(node.children).toHaveLength(1);
    expect(node.selfClosing).toBe(false);
  });
});

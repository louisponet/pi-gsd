/**
 * parser.ts - Recursive-descent XML parser for WXP markdown documents.
 *
 * Parses WXP tags embedded in markdown. Code-fence regions are dead zones
 * where no tags are processed (WXP-01).
 */

import type { XmlNode } from "../schemas/wxp.zod.js";

// ─── Code-fence skip ──────────────────────────────────────────────────────────

export function extractCodeFenceRegions(content: string): Array<[number, number]> {
    const regions: Array<[number, number]> = [];
    const re = /^```[^\n]*\n[\s\S]*?^```/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
        regions.push([m.index, m.index + m[0].length]);
    }
    return regions;
}

export function inDeadZone(pos: number, regions: Array<[number, number]>): boolean {
    return regions.some(([s, e]) => pos >= s && pos < e);
}

// ─── Attribute parser ─────────────────────────────────────────────────────────

/**
 * Parse XML attribute string into a Record.
 * Handles: key="value", key='value', bare-key (boolean attribute)
 */
export function parseAttrs(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    // Match key="val", key='val', or bare key
    const re = /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s/>]*)))?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const key = m[1];
        const val = m[2] ?? m[3] ?? m[4] ?? ""; // empty string = boolean attribute
        attrs[key] = val;
    }
    return attrs;
}

// ─── Recursive XML tokeniser ──────────────────────────────────────────────────

interface ParseResult {
    node: XmlNode;
    end: number; // index in content after closing tag
}

/**
 * Parse a single XML element starting at `pos` in `content`.
 * Uses a proper attribute-aware regex so self-closing `/>` is correctly detected.
 */
function parseElement(content: string, pos: number): ParseResult | null {
    if (content[pos] !== "<") return null;

    // Proper attribute pattern: each attr is name or name=value (quoted or unquoted)
    // This ensures the `/` in `/>` is NOT consumed by the attrs group.
    const tagRe = /^<([a-zA-Z0-9_:-]+)((?:\s+[a-zA-Z0-9_:-]+(?:=(?:"[^"]*"|'[^']*'|[^\s/>]*))?)*)?\s*(\/??>)/;
    const slice = content.slice(pos);
    const m = tagRe.exec(slice);
    if (!m) return null;

    const tag = m[1];
    const rawAttrs = (m[2] ?? "").trim();
    const closing = m[3];
    const attrs = parseAttrs(rawAttrs);

    if (closing === "/>") {
        // Self-closing
        return {
            node: { tag, attrs, children: [], selfClosing: true },
            end: pos + m[0].length,
        };
    }

    // Opening tag - find matching closing tag, handling nesting
    let cursor = pos + m[0].length;
    const children: XmlNode[] = [];
    const closeTag = `</${tag}>`;

    while (cursor < content.length) {
        // Look for next < to check if it's a child element or closing tag
        const nextOpen = content.indexOf("<", cursor);
        if (nextOpen === -1) break;

        // Check for closing tag
        if (content.startsWith(closeTag, nextOpen)) {
            return {
                node: { tag, attrs, children, selfClosing: false },
                end: nextOpen + closeTag.length,
            };
        }

        // Check for comment <!-- ... -->
        if (content.startsWith("<!--", nextOpen)) {
            const commentEnd = content.indexOf("-->", nextOpen + 4);
            cursor = commentEnd !== -1 ? commentEnd + 3 : content.length;
            continue;
        }

        // Try to parse child element
        const child = parseElement(content, nextOpen);
        if (child) {
            children.push(child.node);
            cursor = child.end;
        } else {
            cursor = nextOpen + 1;
        }
    }

    // Unclosed tag - return what we have
    return {
        node: { tag, attrs, children, selfClosing: false },
        end: cursor,
    };
}

// ─── Top-level WXP tag extraction ────────────────────────────────────────────

const WXP_TOP_TAGS = new Set([
    "gsd-execute",
    "gsd-arguments",
    "gsd-paste",
    "gsd-include",
    "gsd-version",
]);

export interface WxpTagMatch {
    node: XmlNode;
    /** Start index in original content */
    start: number;
    /** End index (exclusive) in original content */
    end: number;
}

/**
 * Extract all top-level WXP tags from markdown content.
 * Skips code-fence regions.
 * Returns matches in document order.
 */
export function extractWxpTags(content: string): WxpTagMatch[] {
    const deadZones = extractCodeFenceRegions(content);
    const matches: WxpTagMatch[] = [];

    // Scan for < characters that could start a WXP tag
    const tagStartRe = /<(gsd-[a-zA-Z0-9_-]+)/g;
    let m: RegExpExecArray | null;

    while ((m = tagStartRe.exec(content)) !== null) {
        const pos = m.index;
        if (inDeadZone(pos, deadZones)) continue;

        const tagName = m[1];
        if (!WXP_TOP_TAGS.has(tagName)) continue;

        const result = parseElement(content, pos);
        if (!result) continue;

        matches.push({ node: result.node, start: pos, end: result.end });
        // Advance regex past this element to avoid re-scanning its contents
        tagStartRe.lastIndex = result.end;
    }

    return matches;
}

// ─── Specific node extractors ─────────────────────────────────────────────────

/** Replace a WXP tag span in content with a replacement string. */
export function spliceContent(
    content: string,
    start: number,
    end: number,
    replacement: string,
): string {
    return content.slice(0, start) + replacement + content.slice(end);
}

/** Remove all unprocessed WXP tags from content (final strip step). */
export function stripWxpTags(content: string): string {
    const deadZones = extractCodeFenceRegions(content);
    const tags = extractWxpTags(content);

    // Strip right-to-left to preserve indices
    let result = content;
    let offset = 0;
    for (const tag of tags) {
        if (inDeadZone(tag.start, deadZones)) continue;
        const adjustedStart = tag.start + offset;
        const adjustedEnd = tag.end + offset;
        result = result.slice(0, adjustedStart) + result.slice(adjustedEnd);
        offset += -(tag.end - tag.start);
    }
    return result;
}

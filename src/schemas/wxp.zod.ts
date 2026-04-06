/**
 * src/schemas/wxp.zod.ts — Zod runtime schemas for the WXP engine.
 *
 * Mirrors the XML vocabulary exactly: one schema per element type.
 * The same element (e.g. <arg>) has one schema regardless of where it appears.
 * Context determines interpretation; the schema just validates the XML attributes.
 */
import { z } from "zod";

// ─── <arg> ────────────────────────────────────────────────────────────────────
// Used in: <gsd-arguments>, <shell><args>, <string-op><args>, <gsd-include><gsd-arguments>

/** Valid type values across all <arg> usage contexts */
export const ArgTypeSchema = z.enum(["string", "number", "boolean", "flag"]);
export type ArgType = z.infer<typeof ArgTypeSchema>;

/** Valid type values for <out> elements (v1: string only) */
export const OutTypeSchema = z.enum(["string"]);
export type OutType = z.infer<typeof OutTypeSchema>;

export const ArgSchema = z.object({
  /** Literal string value (shell args: <arg string="execute-phase" />) */
  string: z.string().optional(),
  /** Variable reference (<arg name="phase" />) */
  name: z.string().optional(),
  /** Wrap variable value in this char before passing (<arg name="x" wrap='"' />) */
  wrap: z.string().optional(),
  /** Type annotation */
  type: ArgTypeSchema.optional(),
  /** Literal value for typed inline args (<arg type="string" value="@file:" />) */
  value: z.string().optional(),
  /** Flag token to match in $ARGUMENTS (<arg name="auto" type="flag" flag="--auto" />) */
  flag: z.string().optional(),
  /** Marks this arg as optional in gsd-arguments */
  optional: z.boolean().optional(),
  /** Variable rename for gsd-include arg-mapping (<arg name="local" as="phase" />) */
  as: z.string().optional(),
});

export type Arg = z.infer<typeof ArgSchema>;

// ─── <out> ────────────────────────────────────────────────────────────────────
// Used in: <shell><outs>, <string-op><outs>

export const OutSchema = z.object({
  type: OutTypeSchema,
  name: z.string(),
});

export type Out = z.infer<typeof OutSchema>;

// ─── <delimiter> ─────────────────────────────────────────────────────────────

export const DelimiterSchema = z.object({
  type: z.literal("string"),
  value: z.string(),
});

export type Delimiter = z.infer<typeof DelimiterSchema>;

// ─── <gsd-arguments> settings children ───────────────────────────────────────

export const ArgumentsSettingsSchema = z.object({
  keepExtraArgs: z.boolean().default(false),
  strictArgs: z.boolean().default(false),
  delimiters: z.array(DelimiterSchema).default([]),
});

export type ArgumentsSettings = z.infer<typeof ArgumentsSettingsSchema>;

// ─── <gsd-arguments> ─────────────────────────────────────────────────────────

export const ArgumentsNodeSchema = z.object({
  type: z.literal("arguments"),
  settings: ArgumentsSettingsSchema.default({}),
  args: z.array(ArgSchema).default([]),
});

export type ArgumentsNode = z.infer<typeof ArgumentsNodeSchema>;

// ─── <shell> ─────────────────────────────────────────────────────────────────

export const ShellNodeSchema = z.object({
  type: z.literal("shell"),
  command: z.string(),
  args: z.array(ArgSchema).default([]),
  outs: z.array(OutSchema).default([]),
  suppressErrors: z.boolean().default(false),
});

export type ShellNode = z.infer<typeof ShellNodeSchema>;

// ─── <string-op> ─────────────────────────────────────────────────────────────

export const StringOpNodeSchema = z.object({
  type: z.literal("string-op"),
  op: z.literal("split"),
  args: z.array(ArgSchema),
  outs: z.array(OutSchema),
});

export type StringOpNode = z.infer<typeof StringOpNodeSchema>;

// ─── Condition operands: <left> and <right> use the same attribute set as <arg> ─

export const OperandSchema = ArgSchema; // <left> and <right> have the same attrs as <arg>
export type Operand = z.infer<typeof OperandSchema>;

// ─── Condition expressions ────────────────────────────────────────────────────

export const ConditionEqualsSchema = z.object({
  op: z.literal("equals"),
  left: OperandSchema,
  right: OperandSchema,
});

export const ConditionStartsWithSchema = z.object({
  op: z.literal("starts-with"),
  left: OperandSchema,
  right: OperandSchema,
});

export const ConditionExprSchema = z.discriminatedUnion("op", [
  ConditionEqualsSchema,
  ConditionStartsWithSchema,
]);

export type ConditionExpr = z.infer<typeof ConditionExprSchema>;

// ─── <if> (recursive — forward-declared) ────────────────────────────────────

export interface IfNode {
  type: "if";
  condition: ConditionExpr;
  then: WxpOperation[];
  else?: WxpOperation[];
}

// ─── <gsd-execute> ────────────────────────────────────────────────────────────

export interface ExecuteBlock {
  type: "execute";
  children: WxpOperation[];
}

// ─── <gsd-paste> ─────────────────────────────────────────────────────────────

export const PasteNodeSchema = z.object({
  type: z.literal("paste"),
  name: z.string(),
});

export type PasteNode = z.infer<typeof PasteNodeSchema>;

// ─── <gsd-include> ───────────────────────────────────────────────────────────

export const IncludeNodeSchema = z.object({
  type: z.literal("include"),
  path: z.string(),
  select: z.string().optional(),
  includeArguments: z.boolean().default(false),
  /** Arg mappings from <gsd-arguments><arg name="x" as="y" /></gsd-arguments> child */
  argMappings: z.array(ArgSchema).default([]),
});

export type IncludeNode = z.infer<typeof IncludeNodeSchema>;

// ─── <gsd-version> ───────────────────────────────────────────────────────────

export const VersionTagSchema = z.object({
  type: z.literal("version"),
  v: z.string(),
  doNotUpdate: z.boolean().default(false),
});

export type VersionTag = z.infer<typeof VersionTagSchema>;

// ─── Top-level WXP operation union ───────────────────────────────────────────

export type WxpOperation =
  | ShellNode
  | StringOpNode
  | IfNode
  | ExecuteBlock
  | PasteNode
  | IncludeNode
  | VersionTag
  | ArgumentsNode;

// ─── Variable store entry ─────────────────────────────────────────────────────

export const WxpVariableSchema = z.object({
  name: z.string(),
  value: z.string(),
  owner: z.string().optional(),
});

export type WxpVariable = z.infer<typeof WxpVariableSchema>;

// ─── <XmlNode> (parser intermediate representation) ──────────────────────────

export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  selfClosing: boolean;
}

// ─── Security config ──────────────────────────────────────────────────────────
// trustedPaths/untrustedPaths use structured entries (PRD §5)

export const TrustedPathEntrySchema = z.object({
  position: z.enum(["project", "pkg", "absolute"]),
  path: z.string(),
});

export const WxpSecurityConfigSchema = z.object({
  trustedPaths: z.array(TrustedPathEntrySchema),
  untrustedPaths: z.array(TrustedPathEntrySchema).default([]),
  shellAllowlist: z.array(z.string()),
  shellBanlist: z.array(z.string()).default([]),
  shellTimeoutMs: z.number().default(30_000),
});

export type TrustedPathEntry = z.infer<typeof TrustedPathEntrySchema>;
export type WxpSecurityConfig = z.infer<typeof WxpSecurityConfigSchema>;

// Per-tool handler registry — the seam Unit 4 fills in.
//
// Each entry takes the validated tool arguments plus the caller's resolved
// identity and returns either structured data or an error string. Unit 4
// replaces every stub below with a call into the exact same kitchen-repo /
// planner / approvals / consent functions the web UI and WhatsApp commands
// already use — no new business logic, just a third caller of it.

import type { McpIdentity } from "./context";
import { MCP_TOOLS } from "./tools";

export type ToolResult = { data: unknown } | { error: string };
export type ToolHandler = (args: Record<string, unknown>, identity: McpIdentity) => Promise<ToolResult>;

const notWired: ToolHandler = async (_args, _identity) => ({
  error: "This tool isn't wired to the backend yet (MCP Unit 4).",
});

export const HANDLERS: Record<string, ToolHandler> = Object.fromEntries(
  MCP_TOOLS.map((t) => [t.name, notWired])
);

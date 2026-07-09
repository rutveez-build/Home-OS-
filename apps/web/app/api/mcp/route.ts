// MCP server endpoint — Streamable HTTP, stateless (Vercel serverless has
// no persistent memory across invocations, so sessionIdGenerator is left
// undefined per the SDK's documented stateless mode).
//
// This file owns protocol plumbing AND the permission gate: it registers
// the tools from lib/mcp/tools.ts, resolves the caller's identity
// (lib/mcp/context.ts), enforces each tool's declared Action via
// lib/permissions.ts BEFORE dispatching, then hands off to
// lib/mcp/handlers.ts. Enforcing here — once, centrally — means a future
// handler can't forget the check; it never runs without having already
// passed it.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { resolveIdentity, type McpIdentity } from "@/lib/mcp/context";
import { HANDLERS } from "@/lib/mcp/handlers";
import { can, deniedReply } from "@/lib/permissions";

export const runtime = "nodejs";

function buildServer(): McpServer {
  const server = new McpServer({ name: "Home OS", version: "0.1.0" });

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputShape },
      async (args, extra) => {
        const identity = extra.authInfo?.extra as McpIdentity | undefined;
        if (!identity) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Not authenticated — this connector isn't linked to a household yet." }],
          };
        }
        if (tool.action && !can(identity.role, tool.action)) {
          return { isError: true, content: [{ type: "text" as const, text: deniedReply(tool.action) }] };
        }
        const result = await HANDLERS[tool.name](args, identity);
        if ("error" in result) {
          return { isError: true, content: [{ type: "text" as const, text: result.error }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }] };
      }
    );
  }
  return server;
}

// Stateless mode requires a fresh transport per request (the SDK enforces
// this — reusing one throws "Stateless transport cannot be reused across
// requests"). Registering 12 tool schemas is cheap, no I/O, so rebuilding
// the server per request costs nothing worth optimizing away.
async function handle(req: Request): Promise<Response> {
  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const identity = await resolveIdentity(req);
  const authInfo: AuthInfo | undefined = identity
    ? { token: "", clientId: identity.familyId, scopes: [], extra: identity }
    : undefined;
  return transport.handleRequest(req, { authInfo });
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
export async function DELETE(req: Request) { return handle(req); }

// MCP server endpoint — Streamable HTTP, stateless (Vercel serverless has
// no persistent memory across invocations, so sessionIdGenerator is left
// undefined per the SDK's documented stateless mode).
//
// This file owns protocol plumbing only: register the tools from
// lib/mcp/tools.ts, resolve the caller's identity (lib/mcp/context.ts),
// dispatch to lib/mcp/handlers.ts, format the result. It does not itself
// decide what a tool does or who's allowed to call it — those seams are
// filled in by Units 3 and 4.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { resolveIdentity, type McpIdentity } from "@/lib/mcp/context";
import { HANDLERS } from "@/lib/mcp/handlers";

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

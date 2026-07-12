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
import { MCP_TOOLS } from "@/lib/mcp/tools";
import { resolveIdentity, type McpIdentity } from "@/lib/mcp/context";
import { HANDLERS } from "@/lib/mcp/handlers";
import { can, deniedReply } from "@/lib/permissions";

export const runtime = "nodejs";

// identity is resolved once in handle() before this is ever called — every
// tool call for this request closes over the same, already-authenticated
// caller, so there's no per-call auth branch to forget.
function buildServer(identity: McpIdentity): McpServer {
  const server = new McpServer({ name: "Home OS", version: "0.1.0" });

  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputShape },
      async (args) => {
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
// requests"). Registering the tool schemas is cheap, no I/O, so rebuilding
// the server per request costs nothing worth optimizing away.
async function handle(req: Request): Promise<Response> {
  const identity = await resolveIdentity(req);

  // A real 401 + WWW-Authenticate is what makes OAuth-capable clients
  // (ChatGPT, claude.ai) discover /.well-known/oauth-protected-resource and
  // drive the /authorize consent flow on their own — without it, they have
  // no signal to ever attempt auth and just surface the eventual tool-call
  // error as dead-end text. Static bearer-token clients (Claude Code, Codex)
  // are unaffected: they already send a valid token, so identity resolves
  // and this branch never runs for them.
  if (!identity) {
    const origin = new URL(req.url).origin;
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      },
    });
  }

  const server = buildServer(identity);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  return transport.handleRequest(req);
}

export async function POST(req: Request) { return handle(req); }
export async function GET(req: Request) { return handle(req); }
export async function DELETE(req: Request) { return handle(req); }

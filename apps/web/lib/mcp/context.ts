// Identity resolution for MCP calls.
//
// The web UI trusts a signed session cookie (lib/session.ts); WhatsApp
// trusts the provider's phone number. MCP clients (ChatGPT, Claude, Codex)
// carry neither — they send a per-household bearer token in the
// Authorization header, minted from the web app (lib/mcp/token.ts).

import type { FamilyRole } from "@/db/schema";

export type McpIdentity = { userId: string; familyId: string; role: FamilyRole };

export async function resolveIdentity(req: Request): Promise<McpIdentity | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const bearer = header.slice("Bearer ".length).trim();
  if (!bearer) return null;

  // Lazy import avoids a require cycle (token.ts -> permissions/audit, no
  // cycle back to context.ts, but keeps this file dependency-light for
  // anything that only needs the McpIdentity type).
  const { verifyToken } = await import("./token");
  return verifyToken(bearer);
}

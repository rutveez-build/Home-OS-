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
  // Scheme name is case-insensitive per RFC 7235 — some OAuth clients build
  // this header straight from the token_type our own /api/oauth/token
  // returns, so a case-sensitive check here would silently reject a
  // perfectly valid token over a casing difference.
  if (!header || !/^bearer\s+/i.test(header)) return null;
  const bearer = header.replace(/^bearer\s+/i, "").trim();
  if (!bearer) return null;

  // Lazy import avoids a require cycle (token.ts -> permissions/audit, no
  // cycle back to context.ts, but keeps this file dependency-light for
  // anything that only needs the McpIdentity type).
  const { verifyToken } = await import("./token");
  return verifyToken(bearer);
}

// Identity resolution for MCP calls — the seam Unit 3 fills in.
//
// The web UI trusts a signed session cookie (lib/session.ts); WhatsApp
// trusts the provider's phone number. MCP clients (ChatGPT, Claude, Codex)
// carry neither — they send a bearer token in the Authorization header, one
// per household, minted from the web app.
//
// Until Unit 3 builds that token system, this resolves nothing and every
// tool call fails closed with "not authenticated". That's deliberate: an MCP
// server with no real auth must refuse everything, not fall back to some
// implicit default household.

export type McpIdentity = { userId: string; familyId: string; role: string };

export async function resolveIdentity(_req: Request): Promise<McpIdentity | null> {
  return null;
}

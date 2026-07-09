// Dynamic Client Registration (RFC 7591). No auth required — this is the
// standard self-registration step ChatGPT/claude.ai take the first time they
// see our authorization_server metadata, before ever touching a household.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerClient, isAcceptableRedirectUri } from "@/lib/oauth/clients";

export const runtime = "nodejs";

const Body = z.object({
  redirect_uris: z.array(z.string()).min(1).max(10),
  client_name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "redirect_uris is required" }, { status: 400 });
  }
  if (!parsed.data.redirect_uris.every(isAcceptableRedirectUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be https, or http on localhost/127.0.0.1" },
      { status: 400 }
    );
  }

  const client = await registerClient({
    clientName: parsed.data.client_name ?? "Unnamed MCP client",
    redirectUris: parsed.data.redirect_uris,
  });

  return NextResponse.json({
    client_id: client.id,
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  });
}

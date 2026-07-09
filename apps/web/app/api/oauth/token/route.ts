// Token endpoint: exchanges a one-time code (+ PKCE verifier) for a real
// Home OS access token. That token IS a household_tokens row — mintToken()
// is the exact function the Connect screen's "Create" button already calls,
// so verify/revoke/audit downstream needs zero changes for OAuth-issued tokens.
import { NextRequest, NextResponse } from "next/server";
import { consumeCode } from "@/lib/oauth/codes";
import { getClient } from "@/lib/oauth/clients";
import { mintToken } from "@/lib/mcp/token";

export const runtime = "nodejs";

function oauthError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await req.json().catch(() => ({})) : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());

  const grantType = String(body.grant_type ?? "");
  if (grantType !== "authorization_code") {
    return oauthError("unsupported_grant_type", 400);
  }

  const code = String(body.code ?? "");
  const clientId = String(body.client_id ?? "");
  const redirectUri = String(body.redirect_uri ?? "");
  const codeVerifier = String(body.code_verifier ?? "");
  if (!code || !clientId || !redirectUri || !codeVerifier) {
    return oauthError("invalid_request", 400);
  }

  const consumed = await consumeCode({ code, clientId, redirectUri, codeVerifier });
  if (!consumed) return oauthError("invalid_grant", 400);

  const client = await getClient(consumed.clientId);
  const { token } = await mintToken({
    familyId: consumed.familyId,
    mintedByUserId: consumed.userId,
    label: client?.clientName ?? "OAuth client",
  });

  return NextResponse.json(
    { access_token: token, token_type: "bearer" },
    { headers: { "cache-control": "no-store" } }
  );
}

// Dynamic client registration (RFC 7591) — public clients only, no secret.
// ChatGPT and claude.ai self-register on first connect and reuse the
// returned client_id afterward; ours is a thin store, no approval step.

import { db } from "@/db/client";
import { oauthClients, type OAuthClient } from "@/db/schema";
import { eq } from "drizzle-orm";

const MAX_REDIRECT_URIS = 10;

export function isAcceptableRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  // Loopback redirects are the one documented exception (native/CLI OAuth
  // clients, MCP inspector) — http is fine there, nowhere else.
  if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) return true;
  return false;
}

export async function registerClient(args: { clientName: string; redirectUris: string[] }): Promise<OAuthClient> {
  const [client] = await db
    .insert(oauthClients)
    .values({ clientName: args.clientName, redirectUris: args.redirectUris.slice(0, MAX_REDIRECT_URIS) })
    .returning();
  return client;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const client = await db.query.oauthClients.findFirst({ where: eq(oauthClients.id, clientId) });
  return client ?? null;
}

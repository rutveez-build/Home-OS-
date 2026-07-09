// Authorization endpoint: self-contained login + consent HTML, no client JS.
// GET renders the form; POST handles a login submission or a consent
// decision, both against the exact same params so nothing has to be
// threaded through a separate page. On approve, redirects to redirect_uri
// with a one-time code (lib/oauth/codes.ts); the token exchange
// (api/oauth/token) is what actually mints a household_tokens row.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { familiesForUser } from "@/db/repo";
import { getClient } from "@/lib/oauth/clients";
import { issueCode } from "@/lib/oauth/codes";
import { SESSION_COOKIE, sealSession, sessionUserId } from "@/lib/session";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";

type OAuthParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function page(title: string, body: string): NextResponse {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — ${escapeHtml(brand.name)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f7f5f2; color: #1a1a1a; display: flex;
         min-height: 100dvh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
  .card { max-width: 380px; width: 100%; background: #fff; border-radius: 20px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  h1 { font-size: 19px; margin: 0 0 6px; }
  p { font-size: 14px; line-height: 1.5; color: #555; margin: 0 0 16px; }
  label { display: block; font-size: 12.5px; font-weight: 600; margin: 12px 0 4px; }
  input[type=email], input[type=password] { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px;
         border: 1px solid #ddd; font-size: 14px; }
  button { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 12px; font-size: 14px;
         font-weight: 600; cursor: pointer; }
  .primary { background: #d9622b; color: #fff; }
  .ghost { background: #f0eee9; color: #333; margin-top: 8px; }
  .error { background: #fdeceb; color: #b3261e; padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; }
  .perms { font-size: 13px; color: #444; margin: 14px 0; padding-left: 18px; }
  .perms li { margin-bottom: 4px; }
  .redirect-note { font-size: 12px; color: #888; margin-top: -6px; }
</style></head>
<body><div class="card">${body}</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function hiddenFields(p: OAuthParams): string {
  return [
    ["response_type", p.responseType],
    ["client_id", p.clientId],
    ["redirect_uri", p.redirectUri],
    ["state", p.state],
    ["code_challenge", p.codeChallenge],
    ["code_challenge_method", p.codeChallengeMethod],
  ]
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join("\n");
}

function renderLogin(p: OAuthParams, clientName: string, error?: string): NextResponse {
  return page(
    "Sign in",
    `<h1>Sign in to ${escapeHtml(brand.name)}</h1>
     <p>${escapeHtml(clientName)} wants to connect to your household. Sign in first.</p>
     ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
     <form method="post">
       <input type="hidden" name="_step" value="login">
       ${hiddenFields(p)}
       <label for="email">Email</label>
       <input type="email" id="email" name="email" required autofocus>
       <label for="password">Password</label>
       <input type="password" id="password" name="password" required>
       <button class="primary" type="submit">Sign in</button>
     </form>`
  );
}

function renderConsent(p: OAuthParams, clientName: string, familyName: string): NextResponse {
  // The redirect host is the one fact here an attacker can't spoof (it was
  // checked against what this client_id actually registered) — shown
  // separately from the self-asserted display name so a mismatch is visible
  // ("ChatGPT" claiming it'll send you to some-other-domain.example is the tell).
  const redirectHost = new URL(p.redirectUri).host;
  return page(
    "Connect",
    `<h1>${escapeHtml(clientName)} wants to connect</h1>
     <p>This will let it act on your <strong>${escapeHtml(familyName)}</strong> household on ${escapeHtml(brand.name)} —
     always through the same approval gates as the web app.</p>
     <p class="redirect-note">After you approve, you'll be sent back to: <strong>${escapeHtml(redirectHost)}</strong> — make sure that's really where ${escapeHtml(clientName)} runs before continuing.</p>
     <ul class="perms">
       <li>Read household details, meal plan, shopping list, feedback</li>
       <li>Update preferences and draft meal plans</li>
       <li>Draft (and, with your ok, send) the cook message</li>
       <li>Cannot place orders, cannot act for any other household</li>
     </ul>
     <form method="post">
       <input type="hidden" name="_step" value="consent">
       <input type="hidden" name="decision" value="approve">
       ${hiddenFields(p)}
       <button class="primary" type="submit">Approve</button>
     </form>
     <form method="post">
       <input type="hidden" name="_step" value="consent">
       <input type="hidden" name="decision" value="deny">
       ${hiddenFields(p)}
       <button class="ghost" type="submit">Cancel</button>
     </form>`
  );
}

function renderError(message: string): NextResponse {
  return page("Can't connect", `<h1>Can't connect</h1><p>${escapeHtml(message)}</p>`);
}

// Validates client_id + redirect_uri + PKCE shape. Returns either the parsed
// params, or a Response to send back directly (rendered error — never a
// redirect, since redirect_uri isn't provably safe to send anyone to yet).
async function validate(params: URLSearchParams): Promise<{ ok: true; params: OAuthParams; clientName: string } | { ok: false; res: NextResponse }> {
  const clientId = params.get("client_id") ?? "";
  const client = clientId ? await getClient(clientId) : null;
  if (!client) return { ok: false, res: renderError("Unknown client_id — the connector may need to reconnect from scratch.") };

  const redirectUri = params.get("redirect_uri") ?? "";
  if (!client.redirectUris.includes(redirectUri)) {
    return { ok: false, res: renderError("redirect_uri doesn't match what this connector registered.") };
  }

  const responseType = params.get("response_type") ?? "";
  const state = params.get("state") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const codeChallengeMethod = params.get("code_challenge_method") ?? "";

  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    // Rendered, not redirected: "redirect_uri is registered" only means someone
    // ran /register with it, not that it's trustworthy (registration is
    // deliberately open, same as every MCP server ChatGPT/Claude auto-connect
    // to). A live redirect here would turn our own domain into an open
    // redirector for anyone who self-registers an arbitrary https URL and
    // sends a malformed request — no session or consent needed to trigger it.
    // A spec-correct client never actually hits this branch, so there's no
    // real cost to erroring inline instead.
    return { ok: false, res: renderError("This connector sent a request Home OS doesn't recognize (bad response_type or PKCE parameters).") };
  }

  return {
    ok: true,
    clientName: client.clientName,
    params: { responseType, clientId, redirectUri, state, codeChallenge, codeChallengeMethod },
  };
}

export async function GET(req: NextRequest) {
  const v = await validate(req.nextUrl.searchParams);
  if (!v.ok) return v.res;

  const userId = await sessionUserId();
  if (!userId) return renderLogin(v.params, v.clientName);

  const fams = await familiesForUser(userId);
  if (!fams.length) return renderError("No household set up yet — finish onboarding in the app first, then reconnect.");

  return renderConsent(v.params, v.clientName, fams[0].family.name);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params = new URLSearchParams();
  for (const key of ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method"]) {
    params.set(key, String(form.get(key) ?? ""));
  }
  const v = await validate(params);
  if (!v.ok) return v.res;

  const step = String(form.get("_step") ?? "");

  if (step === "login") {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return renderLogin(v.params, v.clientName, "Wrong email or password.");
    }
    const fams = await familiesForUser(user.id);
    if (!fams.length) return renderError("No household set up yet — finish onboarding in the app first, then reconnect.");

    const res = renderConsent(v.params, v.clientName, fams[0].family.name);
    res.cookies.set(SESSION_COOKIE, sealSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  }

  if (step === "consent") {
    const userId = await sessionUserId();
    if (!userId) return renderLogin(v.params, v.clientName, "Your session expired — sign in again.");

    const decision = String(form.get("decision") ?? "");
    const back = new URL(v.params.redirectUri);
    if (v.params.state) back.searchParams.set("state", v.params.state);

    if (decision !== "approve") {
      back.searchParams.set("error", "access_denied");
      return NextResponse.redirect(back.toString(), 302);
    }

    const fams = await familiesForUser(userId);
    if (!fams.length) return renderError("No household set up yet — finish onboarding in the app first, then reconnect.");

    const code = await issueCode({
      clientId: v.params.clientId,
      familyId: fams[0].family.id,
      userId,
      redirectUri: v.params.redirectUri,
      codeChallenge: v.params.codeChallenge,
    });
    back.searchParams.set("code", code);
    return NextResponse.redirect(back.toString(), 302);
  }

  return renderError("Unrecognized request.");
}

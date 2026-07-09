// RFC 9728 protected resource metadata — /api/mcp's 401 WWW-Authenticate
// header points here, and this points at our own authorization server.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}

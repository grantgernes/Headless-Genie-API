import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.WORKATO_API_KEY;
  const genieId = process.env.WORKATO_GENIE_ID;
  const idpUserId = process.env.WORKATO_IDP_USER_ID;
  const apiBase = process.env.WORKATO_API_BASE ?? "https://genie-api.workato.com/api/v1";

  if (!apiKey || !genieId || !idpUserId) {
    return NextResponse.json(
      { error: "Missing WORKATO_API_KEY, WORKATO_GENIE_ID, or WORKATO_IDP_USER_ID" },
      { status: 500 }
    );
  }

  const { conversationId, message } = await req.json();
  if (!conversationId || !message) {
    return NextResponse.json({ error: "conversationId and message are required" }, { status: 400 });
  }

  const url = `${apiBase}/genies/${genieId}/chat/conversations/${conversationId}/messages`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-IDP-User-ID": idpUserId,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ message, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Upstream error", status: upstream.status, body: text },
      { status: upstream.status || 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

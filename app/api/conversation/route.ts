import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
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

  const url = `${apiBase}/genies/${genieId}/chat/conversations`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-IDP-User-ID": idpUserId,
      "Content-Type": "application/json",
    },
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Failed to create conversation", status: upstream.status, body: text },
      { status: upstream.status }
    );
  }

  try {
    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Non-JSON upstream response", body: text }, { status: 502 });
  }
}

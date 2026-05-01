import { NextRequest, NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog-server";
import { generateShareToken, hashShareToken } from "@/lib/sharing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api-errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation } = await supabase
    .from("generations")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (generation.status !== "complete") {
    return NextResponse.json({ error: "Generation not yet complete" }, { status: 400 });
  }

  let token = generateShareToken();
  let tokenHash = hashShareToken(token);
  let insertError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    token = generateShareToken();
    tokenHash = hashShareToken(token);
    const { error } = await supabase.from("share_invites").insert({
      token_hash: tokenHash,
      generation_id: id,
      created_by: user.id,
    });
    insertError = error;
    if (!error) break;
  }

  if (insertError) return serverError(insertError, { route: "POST /api/generations/[id]/invites", userId: user.id });

  captureServerEvent({
    distinctId: user.id,
    event: "private_share_invite_created",
    properties: { generation_id: id },
  });

  return NextResponse.json({ token, tokenHash });
}

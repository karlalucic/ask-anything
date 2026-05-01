import { NextRequest, NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog-server";
import { generateShareToken } from "@/lib/sharing";
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

  const { data: existing } = await supabase
    .from("share_links")
    .select("token")
    .eq("generation_id", id)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("generations")
      .update({ visibility: "public" })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ token: existing.token, visibility: "public" });
  }

  let token = generateShareToken();
  let insertError: { message?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    token = generateShareToken();
    const { error } = await supabase.from("share_links").insert({
      token,
      generation_id: id,
      created_by: user.id,
    });
    insertError = error;
    if (!error) break;
  }

  if (insertError) return serverError(insertError, { route: "POST /api/generations/[id]/public-link (insert)", userId: user.id });

  const { error: visibilityError } = await supabase
    .from("generations")
    .update({ visibility: "public" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (visibilityError) return serverError(visibilityError, { route: "POST /api/generations/[id]/public-link (visibility)", userId: user.id });

  captureServerEvent({
    distinctId: user.id,
    event: "public_share_link_created",
    properties: { generation_id: id },
  });

  return NextResponse.json({ token, visibility: "public" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation } = await supabase
    .from("generations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("generation_id", id)
    .is("revoked_at", null);

  const { error } = await supabase
    .from("generations")
    .update({ visibility: "private" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return serverError(error, { route: "DELETE /api/generations/[id]/public-link", userId: user.id });

  return NextResponse.json({ ok: true, visibility: "private" });
}

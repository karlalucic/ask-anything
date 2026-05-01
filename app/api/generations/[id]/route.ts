import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import { captureServerEvent } from "@/lib/posthog-server";
import { serverError } from "@/lib/api-errors";

const patchSchema = z.object({ title: z.string().min(1).max(200) });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation, error } = await supabase
    .from("generations")
    .select("*, chapters(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .order("idx", { referencedTable: "chapters", ascending: true })
    .single();

  if (error || !generation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ generation: toGenerationWithChapters(generation) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const { error } = await supabase
    .from("generations")
    .update({ title: parsed.data.title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return serverError(error, { route: "PATCH /api/generations/[id]", userId: user.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: gen } = await supabase
    .from("generations")
    .select("audio_path, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (gen.audio_path) {
    await supabase.storage.from("audio").remove([gen.audio_path]);
  }

  const { error } = await supabase.from("generations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return serverError(error, { route: "DELETE /api/generations/[id]", userId: user.id });

  captureServerEvent({
    distinctId: user.id,
    event: "generation_deleted",
    properties: { generation_id: id },
  });

  return NextResponse.json({ ok: true });
}

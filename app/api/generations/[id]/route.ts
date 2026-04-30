import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toGenerationWithChapters } from "@/lib/supabase/mappers";
import { captureServerEvent } from "@/lib/posthog-server";

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

  const { title } = await req.json();
  if (!title || typeof title !== "string") return NextResponse.json({ error: "title is required" }, { status: 400 });

  const { error } = await supabase
    .from("generations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  captureServerEvent({
    distinctId: user.id,
    event: "generation_deleted",
    properties: { generation_id: id },
  });

  return NextResponse.json({ ok: true });
}

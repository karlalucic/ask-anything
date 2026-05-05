import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog-server";
import { serverError } from "@/lib/api-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (generationError) {
    return serverError(generationError, {
      route: "POST /api/generations/[id]/library-hidden (access)",
      userId: user.id,
    });
  }

  if (!generation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("library_hidden_items")
    .upsert(
      {
        user_id: user.id,
        generation_id: id,
        hidden_at: new Date().toISOString(),
      },
      { onConflict: "user_id,generation_id" },
    );

  if (error) {
    return serverError(error, {
      route: "POST /api/generations/[id]/library-hidden",
      userId: user.id,
    });
  }

  captureServerEvent({
    distinctId: user.id,
    event: "generation_hidden_from_library",
    properties: { generation_id: id },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  visibility: z.enum(["private", "public"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
  if (parsed.data.visibility === "public" && generation.status !== "complete") {
    return NextResponse.json({ error: "Generation not yet complete" }, { status: 400 });
  }

  const { error } = await supabase
    .from("generations")
    .update({ visibility: parsed.data.visibility })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.visibility === "private") {
    await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("generation_id", id)
      .is("revoked_at", null);
  }

  return NextResponse.json({ ok: true, visibility: parsed.data.visibility });
}

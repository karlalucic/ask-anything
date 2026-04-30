import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tokenHash: string }> },
) {
  const { id, tokenHash } = await params;
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

  const { error } = await supabase
    .from("share_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("generation_id", id)
    .eq("token_hash", tokenHash)
    .eq("created_by", user.id)
    .is("revoked_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

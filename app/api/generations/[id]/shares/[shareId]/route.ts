import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api-errors";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("generation_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("generation_id", id)
    .eq("owner_id", user.id)
    .is("revoked_at", null);

  if (error) return serverError(error, { route: "DELETE /api/generations/[id]/shares/[shareId]", userId: user.id });
  return NextResponse.json({ ok: true });
}

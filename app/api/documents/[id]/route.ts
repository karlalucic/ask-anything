import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: doc } = await supabase
    .from("user_documents")
    .select("storage_path, kind")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.kind === "pdf" && doc.storage_path) {
    await supabase.storage.from("user-docs").remove([doc.storage_path]);
  }

  await supabase.from("user_documents").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

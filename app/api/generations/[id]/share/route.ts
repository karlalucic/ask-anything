import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify owner
  const { data: gen } = await supabase
    .from("generations")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gen.status !== "complete") return NextResponse.json({ error: "Generation not yet complete" }, { status: 400 });

  // Return existing active token if present
  const { data: existing } = await supabase
    .from("share_links")
    .select("token")
    .eq("generation_id", id)
    .is("revoked_at", null)
    .single();

  if (existing) return NextResponse.json({ token: existing.token });

  const token = generateToken();
  await supabase.from("share_links").insert({
    token,
    generation_id: id,
    created_by: user.id,
  });

  return NextResponse.json({ token });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("generation_id", id)
    .is("revoked_at", null);

  return NextResponse.json({ ok: true });
}

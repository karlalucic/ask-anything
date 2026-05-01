import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api-errors";
import { hashShareToken } from "@/lib/sharing";

const bodySchema = z.object({
  rating: z.union([z.literal(-1), z.literal(1)]),
  note: z.string().max(1000).optional(),
  shareToken: z.string().optional(),
});

async function hasValidShareToken(generationId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const serviceClient = createSupabaseServiceClient();
  const { data: link } = await serviceClient
    .from("share_links")
    .select("generation_id, generations!inner(status, visibility)")
    .eq("token_hash", hashShareToken(token))
    .eq("generation_id", generationId)
    .is("revoked_at", null)
    .eq("generations.status", "complete")
    .eq("generations.visibility", "public")
    .single();

  return Boolean(link);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Validate access: either owner session or valid share token
  if (user) {
    const { data: gen } = await supabase
      .from("generations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!gen && !(await hasValidShareToken(id, parsed.data.shareToken))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else if (parsed.data.shareToken) {
    if (!(await hasValidShareToken(id, parsed.data.shareToken))) {
      return NextResponse.json({ error: "Invalid share token" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createSupabaseServiceClient();
  const { error } = await serviceClient.from("feedback").insert({
    generation_id: id,
    user_id: user?.id ?? null,
    rating: parsed.data.rating,
    note: parsed.data.note ?? null,
  });

  if (error) return serverError(error, { route: "POST /api/generations/[id]/feedback", userId: user?.id });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
  return admins.includes(email);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 1000);

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("feedback")
    .select("id, generation_id, user_id, rating, note, created_at, generations(topic, duration, voice)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format === "csv") {
    const header = "id,generation_id,user_id,rating,note,created_at,topic,duration,voice\n";
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const gen = r.generations as { topic?: string; duration?: string; voice?: string } | null;
      return [r.id, r.generation_id, r.user_id ?? "", r.rating, JSON.stringify(r.note ?? ""), r.created_at, gen?.topic ?? "", gen?.duration ?? "", gen?.voice ?? ""].join(",");
    }).join("\n");
    return new NextResponse(header + rows, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="feedback.csv"' },
    });
  }

  return NextResponse.json({ feedback: data });
}

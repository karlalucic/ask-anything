import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { serverError } from "@/lib/api-errors";

const querySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  const { format, limit } = parsed.data;

  const serviceClient = createSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("feedback")
    .select("id, generation_id, user_id, rating, note, created_at, generations(topic, duration, voice)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return serverError(error, { route: "GET /api/admin/feedback", userId: user?.id });

  if (format === "csv") {
    const header = "id,generation_id,user_id,rating,note,created_at,topic,duration,voice\n";
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const gen = r.generations as { topic?: string; duration?: string; voice?: string } | null;
      return [r.id, r.generation_id, r.user_id ?? "", r.rating, r.note ?? "", r.created_at, gen?.topic ?? "", gen?.duration ?? "", gen?.voice ?? ""].map(csvCell).join(",");
    }).join("\n");
    return new NextResponse(header + rows, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="feedback.csv"' },
    });
  }

  return NextResponse.json({ feedback: data });
}

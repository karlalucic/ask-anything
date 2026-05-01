import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog-server";
import { serverError } from "@/lib/api-errors";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

const urlBodySchema = z.object({
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), "Only http(s) URLs are allowed"),
  title: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });

    const docId = crypto.randomUUID();
    const storagePath = `${user.id}/${docId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("user-docs")
      .upload(storagePath, file, { contentType: "application/pdf" });

    if (uploadError) return serverError(uploadError, { route: "POST /api/documents (pdf)", userId: user.id });

    const { data, error } = await supabase.from("user_documents").insert({
      id: docId,
      user_id: user.id,
      kind: "pdf",
      storage_path: storagePath,
      title: file.name,
      bytes: file.size,
    }).select("id, title, kind, bytes, created_at").single();

    if (error) return serverError(error, { route: "POST /api/documents (pdf insert)", userId: user.id });
    captureServerEvent({
      distinctId: user.id,
      event: "document_uploaded",
      properties: { kind: "pdf", bytes: file.size, document_id: data.id },
    });
    return NextResponse.json({ document: data });
  }

  // URL submission
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = urlBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  const { url, title } = parsed.data;

  const { data, error } = await supabase.from("user_documents").insert({
    user_id: user.id,
    kind: "url",
    source_url: url,
    title: title ?? url,
  }).select("id, title, kind, source_url, created_at").single();

  if (error) return serverError(error, { route: "POST /api/documents (url)", userId: user.id });
  captureServerEvent({
    distinctId: user.id,
    event: "document_uploaded",
    properties: { kind: "url", document_id: data.id },
  });
  return NextResponse.json({ document: data });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_documents")
    .select("id, title, kind, source_url, storage_path, bytes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return serverError(error, { route: "GET /api/documents", userId: user.id });
  return NextResponse.json({ documents: data });
}

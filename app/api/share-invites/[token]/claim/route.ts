import { NextRequest, NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog-server";
import { hashShareToken } from "@/lib/sharing";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/api-errors";

type InviteRow = {
  token_hash: string;
  generation_id: string;
  created_by: string;
  claimed_by: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
};

type GenerationRow = {
  id: string;
  status: string;
  user_id: string;
};

async function ensureShare({
  generationId,
  ownerId,
  sharedWith,
  createdBy,
}: {
  generationId: string;
  ownerId: string;
  sharedWith: string;
  createdBy: string;
}) {
  const serviceClient = createSupabaseServiceClient();
  const { data: existing } = await serviceClient
    .from("generation_shares")
    .select("id")
    .eq("generation_id", generationId)
    .eq("shared_with", sharedWith)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) return null;

  const { error } = await serviceClient.from("generation_shares").insert({
    generation_id: generationId,
    owner_id: ownerId,
    shared_with: sharedWith,
    created_by: createdBy,
  });

  if (error && error.code !== "23505") return error;
  return null;
}

async function hasActiveShare(generationId: string, sharedWith: string): Promise<boolean> {
  const serviceClient = createSupabaseServiceClient();
  const { data } = await serviceClient
    .from("generation_shares")
    .select("id")
    .eq("generation_id", generationId)
    .eq("shared_with", sharedWith)
    .is("revoked_at", null)
    .maybeSingle();

  return Boolean(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashShareToken(token);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createSupabaseServiceClient();
  const { data: invite } = await serviceClient
    .from("share_invites")
    .select("token_hash, generation_id, created_by, claimed_by, claimed_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || (invite as InviteRow).revoked_at) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const inviteRow = invite as InviteRow;
  const { data: generation } = await serviceClient
    .from("generations")
    .select("id, status, user_id")
    .eq("id", inviteRow.generation_id)
    .single();

  if (!generation || (generation as GenerationRow).status !== "complete") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const generationRow = generation as GenerationRow;
  if (generationRow.user_id === user.id) {
    return NextResponse.json({ ok: true, generationId: generationRow.id });
  }

  if (inviteRow.claimed_by && inviteRow.claimed_by !== user.id) {
    return NextResponse.json({ error: "Invite already claimed" }, { status: 410 });
  }

  let claimedNow = false;
  if (!inviteRow.claimed_by) {
    const { data: claimed } = await serviceClient
      .from("share_invites")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("claimed_by", null)
      .is("revoked_at", null)
      .select("token_hash")
      .maybeSingle();

    if (!claimed) {
      const { data: latest } = await serviceClient
        .from("share_invites")
        .select("claimed_by")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!latest || latest.claimed_by !== user.id) {
        return NextResponse.json({ error: "Invite already claimed" }, { status: 410 });
      }
    } else {
      claimedNow = true;
    }
  }

  if (inviteRow.claimed_by === user.id || !claimedNow) {
    const stillHasAccess = await hasActiveShare(generationRow.id, user.id);
    if (!stillHasAccess) {
      return NextResponse.json({ error: "Access has been revoked" }, { status: 410 });
    }
    return NextResponse.json({ ok: true, generationId: generationRow.id });
  }

  const shareError = await ensureShare({
    generationId: generationRow.id,
    ownerId: generationRow.user_id,
    sharedWith: user.id,
    createdBy: inviteRow.created_by,
  });

  if (shareError) return serverError(shareError, { route: "POST /api/share-invites/[token]/claim", userId: user.id });

  captureServerEvent({
    distinctId: user.id,
    event: "private_share_invite_claimed",
    properties: { generation_id: generationRow.id },
  });

  return NextResponse.json({ ok: true, generationId: generationRow.id });
}

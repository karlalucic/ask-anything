import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  display_name: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const serviceClient = createSupabaseServiceClient();
  const [{ data: shares, error: sharesError }, { data: invites, error: invitesError }] = await Promise.all([
    serviceClient
      .from("generation_shares")
      .select("id, shared_with, created_at, revoked_at")
      .eq("generation_id", id)
      .eq("owner_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("share_invites")
      .select("token_hash, created_at, claimed_by, claimed_at, revoked_at")
      .eq("generation_id", id)
      .eq("created_by", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (sharesError) return NextResponse.json({ error: sharesError.message }, { status: 500 });
  if (invitesError) return NextResponse.json({ error: invitesError.message }, { status: 500 });

  const profileIds = Array.from(new Set([
    ...(shares ?? []).map((share) => share.shared_with as string),
    ...(invites ?? []).map((invite) => invite.claimed_by as string | null).filter(Boolean) as string[],
  ]));

  let profilesById = new Map<string, ProfileRow>();
  if (profileIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, display_name")
      .in("id", profileIds);

    profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile as ProfileRow]));
  }

  return NextResponse.json({
    shares: (shares ?? []).map((share) => {
      const sharedWith = share.shared_with as string;
      return {
        id: share.id,
        sharedWith,
        recipientDisplayName: profilesById.get(sharedWith)?.display_name ?? null,
        createdAt: share.created_at,
        revokedAt: share.revoked_at,
      };
    }),
    invites: (invites ?? []).map((invite) => {
      const claimedBy = invite.claimed_by as string | null;
      return {
        tokenHash: invite.token_hash,
        createdAt: invite.created_at,
        claimedAt: invite.claimed_at,
        revokedAt: invite.revoked_at,
        claimedBy,
        claimedByDisplayName: claimedBy ? profilesById.get(claimedBy)?.display_name ?? null : null,
      };
    }),
  });
}

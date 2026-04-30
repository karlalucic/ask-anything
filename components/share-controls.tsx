"use client";

import { useCallback, useState } from "react";
import { Copy, LinkIcon, Lock, RefreshCw, Users, X } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

type Visibility = "private" | "public";

type ShareRow = {
  id: string;
  sharedWith: string;
  recipientDisplayName: string | null;
  createdAt: string;
};

type InviteRow = {
  tokenHash: string;
  createdAt: string;
  claimedAt: string | null;
  claimedByDisplayName: string | null;
};

type SharesResponse = {
  shares: ShareRow[];
  invites: InviteRow[];
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url);
}

export function ShareControls({
  generationId,
  initialVisibility,
}: {
  generationId: string;
  initialVisibility: Visibility;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshShares = useCallback(async () => {
    const res = await fetch(`/api/generations/${generationId}/shares`);
    if (!res.ok) return;
    const json = (await res.json()) as SharesResponse;
    setShares(json.shares ?? []);
    setInvites(json.invites ?? []);
  }, [generationId]);

  async function createOrCopyPublicLink() {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/generations/${generationId}/public-link`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not create public link.");
      setLoading(false);
      return;
    }
    const { token } = await res.json();
    await copyUrl(`${window.location.origin}/s/${token}`);
    setVisibility("public");
    setMessage("Public link copied.");
    posthog.capture("public_share_link_copied", { generation_id: generationId });
    setLoading(false);
  }

  async function disablePublicLink() {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/generations/${generationId}/public-link`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not make this private.");
      setLoading(false);
      return;
    }
    setVisibility("private");
    setMessage("Public link revoked.");
    setLoading(false);
  }

  async function createInvite() {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/generations/${generationId}/invites`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not create invite.");
      setLoading(false);
      return;
    }
    const { token } = await res.json();
    await copyUrl(`${window.location.origin}/claim/${token}`);
    setMessage("Invite link copied.");
    posthog.capture("private_share_invite_copied", { generation_id: generationId });
    await refreshShares();
    setLoading(false);
  }

  async function revokeInvite(tokenHash: string) {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/generations/${generationId}/invites/${tokenHash}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not revoke invite.");
      setLoading(false);
      return;
    }
    await refreshShares();
    setMessage("Invite revoked.");
    setLoading(false);
  }

  async function revokeShare(shareId: string) {
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/generations/${generationId}/shares/${shareId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not revoke access.");
      setLoading(false);
      return;
    }
    await refreshShares();
    setMessage("Access revoked.");
    setLoading(false);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          void refreshShares();
        }}
        type="button"
      >
        <Users aria-hidden />
        Share
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 px-4 py-20 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="liquid-glass ml-auto w-full max-w-md rounded-xl p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-normal leading-snug text-white">Share podcast</h2>
                <p className="mt-1 text-xs text-white/40">{visibility === "public" ? "Anyone with the public link can listen." : "Only you and claimed invites can listen."}</p>
              </div>
              <Button variant="ghost" size="icon-sm" type="button" onClick={() => setOpen(false)} aria-label="Close">
                <X aria-hidden />
              </Button>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
                  <LinkIcon aria-hidden className="size-4" />
                  Public link
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={createOrCopyPublicLink} disabled={loading}>
                    <Copy aria-hidden />
                    {visibility === "public" ? "Copy link" : "Create link"}
                  </Button>
                  {visibility === "public" && (
                    <Button size="sm" variant="ghost" type="button" onClick={disablePublicLink} disabled={loading}>
                      <Lock aria-hidden />
                      Make private
                    </Button>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Users aria-hidden className="size-4" />
                    Account invites
                  </div>
                  <Button size="xs" variant="outline" type="button" onClick={createInvite} disabled={loading}>
                    <Copy aria-hidden />
                    Copy invite
                  </Button>
                </div>

                <div className="space-y-2">
                  {invites.length === 0 && shares.length === 0 ? (
                    <p className="text-sm text-white/35">No account invites or shared recipients yet.</p>
                  ) : (
                    <>
                      {shares.map((share) => (
                        <div key={share.id} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/70">{share.recipientDisplayName ?? "Shared recipient"}</p>
                            <p className="text-xs text-white/30">Accepted {formatDate(share.createdAt)}</p>
                          </div>
                          <Button size="icon-xs" variant="ghost" type="button" onClick={() => revokeShare(share.id)} disabled={loading} aria-label="Revoke access">
                            <X aria-hidden />
                          </Button>
                        </div>
                      ))}
                      {invites.map((invite) => (
                        <div key={invite.tokenHash} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white/70">
                              {invite.claimedAt ? `Claimed by ${invite.claimedByDisplayName ?? "recipient"}` : "Invite pending"}
                            </p>
                            <p className="text-xs text-white/30">Created {formatDate(invite.createdAt)}</p>
                          </div>
                          {!invite.claimedAt && (
                            <Button size="icon-xs" variant="ghost" type="button" onClick={() => revokeInvite(invite.tokenHash)} disabled={loading} aria-label="Revoke invite">
                              <X aria-hidden />
                            </Button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </section>

              {(message || error) && (
                <p className={error ? "text-sm text-red-300" : "text-sm text-white/45"}>{error || message}</p>
              )}

              <Button size="sm" variant="ghost" type="button" onClick={refreshShares} disabled={loading}>
                <RefreshCw aria-hidden />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

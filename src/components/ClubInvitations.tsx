"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Invitation = {
  invitation_id: string;
  club_id: string;
  club_name: string;
  inviter_username: string | null;
  created_at: string;
};

export default function ClubInvitations() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc(
      "get_my_book_club_invitations"
    );

    if (loadError) {
      setError("Couldn't load your invitations: " + loadError.message);
      return;
    }

    setInvitations((data ?? []) as Invitation[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(invitation: Invitation) {
    if (busyId) return;
    setBusyId(invitation.invitation_id);
    setError("");

    const { data, error: acceptError } = await supabase.rpc(
      "accept_book_club_invitation",
      { p_invitation_id: invitation.invitation_id }
    );

    setBusyId(null);

    if (acceptError) {
      setError(acceptError.message);
      await load();
      return;
    }

    router.push(`/book-clubs/${(data as string) ?? invitation.club_id}`);
  }

  async function decline(invitation: Invitation) {
    if (busyId) return;
    setBusyId(invitation.invitation_id);
    setError("");

    const { error: declineError } = await supabase.rpc(
      "decline_book_club_invitation",
      { p_invitation_id: invitation.invitation_id }
    );

    setBusyId(null);

    if (declineError) {
      setError(declineError.message);
      await load();
      return;
    }

    setInvitations((current) =>
      current.filter((item) => item.invitation_id !== invitation.invitation_id)
    );
  }

  if (invitations.length === 0 && !error) return null;

  return (
    <section className="mb-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
      <h2 className="font-serif text-2xl">
        Club invitations ({invitations.length})
      </h2>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {invitations.map((invitation) => (
          <li
            key={invitation.invitation_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F8F3EB] p-4"
          >
            <div>
              <p className="font-medium">{invitation.club_name}</p>
              <p className="text-sm text-[#8C7D6A]">
                Invited by {invitation.inviter_username ?? "a friend"}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void accept(invitation)}
                disabled={busyId !== null}
                className="rounded-full bg-[#65795A] px-4 py-2 text-sm text-white hover:bg-[#536849] disabled:opacity-50"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => void decline(invitation)}
                disabled={busyId !== null}
                className="rounded-full border border-[#D8CCBA] px-4 py-2 text-sm text-[#75634D] hover:bg-[#EEE6D9] disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Invitation = {
  id: string;
  club_id: string;
  inviter_id: string;
  status: string;
  book_clubs: {
    id: string;
    name: string;
    description: string | null;
  } | null;
};

export default function BookClubInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadInvitations() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setMessage("Please sign in to view your invitations.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("book_club_invitations")
      .select(`
        id,
        club_id,
        inviter_id,
        status,
        book_clubs (
          id,
          name,
          description
        )
      `)
      .eq("invitee_id", authData.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setInvitations((data ?? []) as unknown as Invitation[]);
    }

    setLoading(false);
  }

  async function respondToInvitation(
    invitationId: string,
    accept: boolean
  ) {
    setMessage("");

    const { error } = await supabase.rpc(
      accept
        ? "accept_book_club_invitation"
        : "decline_book_club_invitation",
      { p_invitation_id: invitationId }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      accept
        ? "You joined the book club!"
        : "Invitation declined."
    );

    await loadInvitations();
  }

  useEffect(() => {
    loadInvitations();
  }, []);

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-6 py-12 text-[#514536]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/book-clubs"
          className="text-sm text-[#8C7D6A] hover:text-[#65795A]"
        >
          ← Back to book clubs
        </Link>

        <h1 className="mt-6 font-serif text-4xl">
          Your invitations
        </h1>

        <p className="mt-3 text-[#8C7D6A]">
          Book clubs your friends have invited you to join.
        </p>

        {message && (
          <p className="mt-5 rounded-xl bg-white p-4 text-sm">
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-8">Loading invitations...</p>
        ) : invitations.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
            You don't have any pending invitations.
          </p>
        ) : (
          <div className="mt-8 space-y-4">
            {invitations.map((invitation) => (
              <section
                key={invitation.id}
                className="rounded-2xl border border-[#E4D9C8] bg-white/80 p-6"
              >
                <h2 className="font-serif text-2xl">
                  {invitation.book_clubs?.name ?? "Book club"}
                </h2>

                {invitation.book_clubs?.description && (
                  <p className="mt-2 text-sm text-[#8C7D6A]">
                    {invitation.book_clubs.description}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      respondToInvitation(invitation.id, true)
                    }
                    className="rounded-full bg-[#65795A] px-5 py-2 text-sm text-white hover:bg-[#536849]"
                  >
                    Accept
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      respondToInvitation(invitation.id, false)
                    }
                    className="rounded-full border border-[#D8CCBA] px-5 py-2 text-sm text-[#75634D] hover:bg-[#EEE6D9]"
                  >
                    Decline
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Club = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_token: string;
};

type Member = {
  user_id: string;
  role: string;
  joined_at: string;
};

type Friend = { id: string; username: string };

function BookClubDetailsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClub() {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const userId = authData.user.id;
      setCurrentUserId(userId);

      const { data: clubData, error: clubError } = await supabase
        .from("book_clubs")
        .select("id, name, description, created_by, invite_token")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (clubError || !clubData) {
        setMessage(
          "We couldn't find this club, or you don't have permission to view it."
        );
        setLoading(false);
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("book_club_members")
        .select("user_id, role, joined_at")
        .eq("club_id", id)
        .order("joined_at", { ascending: true });

      if (cancelled) return;

      if (memberError) {
        setMessage(memberError.message);
        setLoading(false);
        return;
      }

      setClub(clubData as Club);
      setMembers((memberData ?? []) as Member[]);

      // Accepted friendships in either direction.
      const { data: friendshipData, error: friendshipError } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (cancelled) return;

      if (friendshipError) {
        setMessage(friendshipError.message);
        setLoading(false);
        return;
      }

      const friendIds = (friendshipData ?? []).map((friendship) =>
        friendship.requester_id === userId
          ? friendship.addressee_id
          : friendship.requester_id
      ) as string[];

      if (friendIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", friendIds)
          .order("username", { ascending: true });

        if (cancelled) return;

        if (profileError) {
          setMessage(profileError.message);
          setLoading(false);
          return;
        }

        setFriends((profileData ?? []) as Friend[]);
      } else {
        setFriends([]);
      }

      setLoading(false);
    }

    void loadClub();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  async function copyInviteLink() {
    if (!club) return;

    const link = `${window.location.origin}/book-clubs/join?token=${club.invite_token}`;

    try {
      await navigator.clipboard.writeText(link);
      setMessage("Invitation link copied!");
    } catch {
      setMessage("Couldn't copy automatically. Please copy the link below.");
      setShowLink(true);
    }
  }

  async function inviteFriend(friend: Friend) {
    setMessage("");

    const { error } = await supabase.rpc("invite_book_club_friend", {
      p_club_id: id,
      p_friend_id: friend.id,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(`Invitation sent to ${friend.username}!`);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF7F1] p-8 text-[#493D32]">
        Loading club...
      </main>
    );
  }

  if (!club) {
    return (
      <main className="min-h-screen bg-[#FAF7F1] p-8 text-[#493D32]">
        <p>{message || "Club unavailable."}</p>
        <Link href="/book-clubs" className="mt-4 inline-block underline">
          Back to Book Clubs
        </Link>
      </main>
    );
  }

  const isOwner = club.created_by === currentUserId;

  const invitableFriends = friends.filter(
    (friend) => !members.some((member) => member.user_id === friend.id)
  );

  function memberName(member: Member) {
    if (member.user_id === currentUserId) return "You";
    const friend = friends.find((item) => item.id === member.user_id);
    return friend ? friend.username : `Member ${member.user_id.slice(0, 8)}`;
  }

  return (
    <main className="min-h-screen bg-[#FAF7F1] px-5 py-10 text-[#493D32] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/book-clubs" className="text-sm text-[#75634D] underline">
          ← Back to Book Clubs
        </Link>

        <header className="mt-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8C7D6A]">
            {isOwner ? "Your book club" : "Book club"}
          </p>
          <h1 className="mt-2 font-serif text-4xl">{club.name}</h1>
          {club.description && (
            <p className="mt-3 text-[#75634D]">{club.description}</p>
          )}
        </header>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-[#D8CCBA] bg-white p-4 text-sm"
          >
            {message}
          </p>
        )}

        {isOwner && (
          <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
            <h2 className="font-serif text-2xl">Invite with a link</h2>
            <p className="mt-2 text-sm text-[#8C7D6A]">
              Share this link with anyone you want to join your club.
            </p>
            <button
              type="button"
              onClick={() => void copyInviteLink()}
              className="mt-4 rounded-full bg-[#65795A] px-5 py-3 text-sm text-white hover:bg-[#536849]"
            >
              Copy invitation link
            </button>

            {showLink && (
              <p className="mt-3 break-all text-sm text-[#75634D]">
                {`${window.location.origin}/book-clubs/join?token=${club.invite_token}`}
              </p>
            )}
          </section>
        )}

        {isOwner && (
          <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
            <h2 className="font-serif text-2xl">Invite your friends</h2>
            <p className="mt-2 text-sm text-[#8C7D6A]">
              Invite your friends to read along with you.
            </p>

            {invitableFriends.length === 0 ? (
              <p className="mt-5 text-sm text-[#8C7D6A]">
                No friends available to invite right now.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {invitableFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-[#F8F3EB] p-4"
                  >
                    <span className="text-sm font-medium">
                      {friend.username}
                    </span>

                    <button
                      type="button"
                      onClick={() => void inviteFriend(friend)}
                      className="rounded-full bg-[#65795A] px-4 py-2 text-sm text-white transition hover:bg-[#536849]"
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6">
          <h2 className="font-serif text-2xl">Members</h2>
          <p className="mt-2 text-sm text-[#8C7D6A]">
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>

          <div className="mt-5 space-y-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between rounded-xl bg-[#F8F3EB] p-4"
              >
                <span className="text-sm">{memberName(member)}</span>
                <span className="text-xs text-[#8C7D6A]">
                  {member.role === "owner" ? "Club owner" : "Member"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function BookClubDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#FAF7F1] p-8 text-[#493D32]">
          Loading club...
        </main>
      }
    >
      <BookClubDetailsContent />
    </Suspense>
  );
}
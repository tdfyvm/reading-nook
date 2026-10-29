"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Person = { id: string; username: string };

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [profile, setProfile] = useState<Person | null>(null);
  const [friends, setFriends] = useState<Person[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [bookCount, setBookCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");
    setMemberSince(
      new Date(user.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", user.id)
      .maybeSingle();

    setProfile((profileData as Person | null) ?? null);

    const { count } = await supabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    setBookCount(count ?? 0);

    const { data: rows, error: rowsError } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status");

    if (rowsError) {
      setError("Couldn't load your friends: " + rowsError.message);
      setLoading(false);
      return;
    }

    const list = rows ?? [];

    setPendingCount(
      list.filter(
        (row) => row.status === "pending" && row.addressee_id === user.id
      ).length
    );

    const friendIds = list
      .filter((row) => row.status === "accepted")
      .map((row) =>
        row.requester_id === user.id ? row.addressee_id : row.requester_id
      ) as string[];

    if (friendIds.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", friendIds)
        .order("username");

      setFriends((people ?? []) as Person[]);
    } else {
      setFriends([]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;

    const username = usernameInput.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError(
        "Usernames are 3 to 20 characters: lowercase letters, numbers and underscores."
      );
      return;
    }

    if (profile && username === profile.username) {
      setEditing(false);
      setError("");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const query = profile
      ? supabase
          .from("profiles")
          .update({ username })
          .eq("id", userId)
          .select("id, username")
          .single()
      : supabase
          .from("profiles")
          .insert({ id: userId, username })
          .select("id, username")
          .single();

    const { data, error: saveError } = await query;

    setBusy(false);

    if (saveError || !data) {
      setError(
        saveError?.code === "23505"
          ? "That username is already taken."
          : (saveError?.message ?? "Couldn't save your username.")
      );
      return;
    }

    setProfile(data as Person);
    setEditing(false);
    setMessage("Your username was updated.");
  }

  async function logOut() {
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setBusy(false);
      setError("Couldn't log out: " + signOutError.message);
      return;
    }

    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#F8F5EE] px-6 py-10 text-[#453B32]">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-[#806b55] transition hover:text-[#4b3828]"
        >
          ← Back to my bookshelf
        </Link>

        <header className="mb-8 mt-6">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#9B866A]">
            The Reading Nook
          </p>
          <h1 className="font-serif text-4xl">My profile</h1>
        </header>

        {loading ? (
          <p>Opening your profile...</p>
        ) : (
          <div className="space-y-6">
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="text-sm text-green-800">
                {message}
              </p>
            )}

            <section className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
              <h2 className="font-serif text-2xl">Account</h2>

              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-[#8C7D6A]">Login (email)</dt>
                  <dd className="mt-1 font-medium">{email || "Unknown"}</dd>
                </div>

                <div>
                  <dt className="text-[#8C7D6A]">Username</dt>
                  <dd className="mt-1">
                    {editing || !profile ? (
                      <form onSubmit={saveUsername} className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={usernameInput}
                            onChange={(event) =>
                              setUsernameInput(event.target.value)
                            }
                            placeholder="e.g. bookworm_anna"
                            maxLength={20}
                            autoFocus
                            className="w-full rounded-xl border border-[#DCCFBD] px-4 py-2 outline-none focus:border-[#8B6F47]"
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="rounded-xl bg-[#6D5940] px-4 py-2 text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          {profile && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(false);
                                setError("");
                              }}
                              className="rounded-xl border border-[#DCCFBD] px-4 py-2"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#8C7D6A]">
                          3 to 20 characters: lowercase letters, numbers and
                          underscores. Friends find you by this name.
                        </p>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{profile.username}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUsernameInput(profile.username);
                            setEditing(true);
                            setMessage("");
                            setError("");
                          }}
                          className="text-xs underline"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </dd>
                </div>

                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  <div>
                    <dt className="text-[#8C7D6A]">Books on my shelf</dt>
                    <dd className="mt-1 font-medium">{bookCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8C7D6A]">Member since</dt>
                    <dd className="mt-1 font-medium">{memberSince}</dd>
                  </div>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl">
                  Friends ({friends.length})
                </h2>
                <Link href="/friends" className="text-sm underline">
                  Manage friends
                </Link>
              </div>

              {pendingCount > 0 && (
                <p className="mt-2 text-sm text-[#9B6A1F]">
                  You have {pendingCount} friend{" "}
                  {pendingCount === 1 ? "request" : "requests"} waiting.{" "}
                  <Link href="/friends" className="underline">
                    Take a look
                  </Link>
                </p>
              )}

              {friends.length === 0 ? (
                <p className="mt-3 text-sm italic text-[#786956]">
                  No friends yet.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {friends.map((friend) => (
                    <li key={friend.id}>
                      <Link
                        href={`/friends/${friend.id}`}
                        className="inline-block rounded-full border border-[#E5D8C5] bg-[#FAF5ED] px-4 py-2 text-sm hover:bg-white"
                      >
                        {friend.username}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-dashed border-[#DCCFBD] p-6">
              <h2 className="font-serif text-2xl">Reading challenges</h2>
              <p className="mt-2 text-sm italic text-[#8C7D6A]">Coming soon.</p>
            </section>

            <section className="rounded-2xl border border-dashed border-[#DCCFBD] p-6">
              <h2 className="font-serif text-2xl">Book clubs</h2>
              <p className="mt-2 text-sm italic text-[#8C7D6A]">Coming soon.</p>
            </section>

            <section className="pt-2">
              <button
                type="button"
                onClick={() => void logOut()}
                disabled={busy}
                className="rounded-full border border-[#D8CCBA] px-5 py-3 text-sm text-[#75634D] transition hover:bg-[#EEE6D9] disabled:opacity-50"
              >
                Log out
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
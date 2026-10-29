"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

type Person = { id: string; username: string };

export default function FriendsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Person | null>(null);
  const [shareBookshelf, setshareBookShelf] = useState(false);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [searchName, setSearchName] = useState("");
  const [found, setFound] = useState<Person | null>(null);
  const [searched, setSearched] = useState(false);

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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, username, share_bookshelf")
      .eq("id", user.id)
      .maybeSingle();

    setMyProfile((profileData as Person | null) ?? null);
    setshareBookShelf(Boolean(profileData?.share_bookshelf));

    const { data: rows, error: rowsError } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .order("created_at", { ascending: false });

    if (rowsError) {
      setError("Couldn't load your friends: " + rowsError.message);
      setLoading(false);
      return;
    }

    const list = (rows ?? []) as Friendship[];
    setFriendships(list);

    const otherIds = list.map((row) =>
      row.requester_id === user.id ? row.addressee_id : row.requester_id
    );

    if (otherIds.length > 0) {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", otherIds);

      const map: Record<string, string> = {};
      (people ?? []).forEach((person) => {
        map[person.id as string] = person.username as string;
      });
      setNames(map);
    } else {
      setNames({});
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;

    const username = newUsername.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError(
        "Usernames are 3 to 20 characters: lowercase letters, numbers and underscores."
      );
      return;
    }

    setBusy(true);
    setError("");

    const { data, error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId, username })
      .select("id, username")
      .single();

    setBusy(false);

    if (insertError || !data) {
      setError(
        insertError?.code === "23505"
          ? "That username is already taken."
          : (insertError?.message ?? "Couldn't save your username.")
      );
      return;
    }

    setMyProfile(data as Person);
    setNewUsername("");
  }

    async function toggleShare(next: boolean) {
    if (!userId || busy) return;

    setBusy(true);
    setError("");

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ share_bookshelf: next })
      .eq("id", userId);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setshareBookShelf(next);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const name = searchName.trim().toLowerCase();
    if (!name) return;

    setBusy(true);
    setError("");
    setMessage("");
    setFound(null);
    setSearched(false);

    const { data, error: searchError } = await supabase.rpc(
      "find_user_by_username",
      { p_username: name }
    );

    setBusy(false);

    if (searchError) {
      setError("Couldn't search right now: " + searchError.message);
      return;
    }

    setFound(((data ?? []) as Person[])[0] ?? null);
    setSearched(true);
  }

  async function sendRequest(person: Person) {
    if (!userId || busy) return;

    const existing = friendships.some(
      (row) =>
        row.requester_id === person.id || row.addressee_id === person.id
    );

    if (existing) {
      setError(
        "You already have a request or friendship with this person. Check the lists below."
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: person.id });

    setBusy(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "You already have a request or friendship with this person."
          : insertError.message
      );
      return;
    }

    setMessage(`Request sent to ${person.username}.`);
    setFound(null);
    setSearched(false);
    setSearchName("");
    await load();
  }

  async function accept(row: Friendship) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", row.id);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  async function removeRow(row: Friendship, confirmText?: string) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;

    setBusy(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", row.id);

    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setFriendships((current) => current.filter((item) => item.id !== row.id));
  }

  function nameOf(row: Friendship) {
    const otherId =
      row.requester_id === userId ? row.addressee_id : row.requester_id;
    return names[otherId] ?? "Unknown user";
  }

  const incoming = friendships.filter(
    (row) => row.status === "pending" && row.addressee_id === userId
  );
  const sent = friendships.filter(
    (row) => row.status === "pending" && row.requester_id === userId
  );
  const friends = friendships.filter((row) => row.status === "accepted");

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
          <h1 className="font-serif text-4xl">Friends</h1>
        </header>

        {loading ? (
          <p>Loading your friends...</p>
        ) : (
          <div className="space-y-8">
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

            {!myProfile ? (
              <section className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
                <h2 className="font-serif text-2xl">Choose a username</h2>
                <p className="mt-2 text-sm text-[#786956]">
                  Friends find you by this name. Pick one you&apos;re happy to
                  share. Your email stays private.
                </p>

                <form onSubmit={createProfile} className="mt-4 flex gap-2">
                  <input
                    value={newUsername}
                    onChange={(event) => setNewUsername(event.target.value)}
                    placeholder="e.g. bookworm_anna"
                    maxLength={20}
                    className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>
              </section>
            ) : (
              <>
                <p className="text-sm text-[#786956]">
                  Your username: <strong>{myProfile.username}</strong>. Share it
                  with friends so they can find you.
                </p>
                                <section className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={shareBookshelf}
                      onChange={(event) => void toggleShare(event.target.checked)}
                      disabled={busy}
                      className="mt-1 accent-[#6D5940]"
                    />
                    <span>
                      <span className="font-medium">
                        Let my friends see my bookshelf
                      </span>
                      <span className="mt-1 block text-sm text-[#786956]">
                        Friends see titles, covers, status, ratings, genres and
                        reading dates. Your personal notes always stay private.
                      </span>
                    </span>
                  </label>
                </section>

                <section className="rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
                  <h2 className="font-serif text-2xl">Add a friend</h2>

                  <form onSubmit={search} className="mt-4 flex gap-2">
                    <input
                      value={searchName}
                      onChange={(event) => setSearchName(event.target.value)}
                      placeholder="Their exact username"
                      className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
                    />
                    <button
                      type="submit"
                      disabled={busy || !searchName.trim()}
                      className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
                    >
                      Search
                    </button>
                  </form>

                  {searched && !found && (
                    <p className="mt-3 text-sm text-[#786956]">
                      No one found with that username. Check the spelling.
                    </p>
                  )}

                  {found && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-3">
                      <span className="font-medium">{found.username}</span>
                      <button
                        type="button"
                        onClick={() => void sendRequest(found)}
                        disabled={busy}
                        className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm hover:bg-white disabled:opacity-50"
                      >
                        Send friend request
                      </button>
                    </div>
                  )}
                </section>

                {incoming.length > 0 && (
                  <section>
                    <h2 className="mb-3 font-serif text-2xl">
                      Requests for you ({incoming.length})
                    </h2>
                    <ul className="space-y-2">
                      {incoming.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5D8C5] bg-white/80 p-3"
                        >
                          <span className="font-medium">{nameOf(row)}</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void accept(row)}
                              disabled={busy}
                              className="rounded-lg bg-[#6D5940] px-3 py-2 text-sm text-white disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeRow(row)}
                              disabled={busy}
                              className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section>
                  <h2 className="mb-3 font-serif text-2xl">
                    My friends ({friends.length})
                  </h2>
                  {friends.length === 0 ? (
                    <p className="text-sm italic text-[#786956]">
                      No friends yet. Search for a username above.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {friends.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5D8C5] bg-white/80 p-3"
                        >
                                                    <Link
                            href={`/friends/${
                              row.requester_id === userId
                                ? row.addressee_id
                                : row.requester_id
                            }`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {nameOf(row)} →
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              void removeRow(
                                row,
                                `Remove ${nameOf(row)} from your friends?`
                              )
                            }
                            disabled={busy}
                            className="text-xs text-red-700 underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {sent.length > 0 && (
                  <section>
                    <h2 className="mb-3 font-serif text-2xl">
                      Requests I sent ({sent.length})
                    </h2>
                    <ul className="space-y-2">
                      {sent.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-[#E5D8C5] bg-white/80 p-3"
                        >
                          <span>
                            {nameOf(row)}{" "}
                            <span className="text-sm text-[#8C7D6A]">
                              (waiting for a reply)
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => void removeRow(row)}
                            disabled={busy}
                            className="text-xs text-red-700 underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
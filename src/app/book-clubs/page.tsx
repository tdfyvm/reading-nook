
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BookClub = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_token: string;
};

export default function BookClubsPage() {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadClubs() {
    setLoading(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setMessage("Please sign in to use Book Clubs.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("book_club_members")
      .select(`
        club_id,
        book_clubs (
          id,
          name,
          description,
          created_by,
          invite_token
        )
      `)
      .eq("user_id", authData.user.id);

    if (error) {
      setMessage(error.message);
      setCurrentUserId(authData.user.id);
      setLoading(false);
      return;
    }

    const loadedClubs = (data ?? [])
      .map((row: any) => row.book_clubs)
      .filter(Boolean) as BookClub[];

    setClubs(loadedClubs);
    setLoading(false);
  }

  useEffect(() => {
    void loadClubs();
  }, []);

  async function createClub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");

    const { data, error } = await supabase.rpc("create_book_club", {
      p_name: name,
      p_description: description || null,
    });

    if (error) {
      setMessage(error.message);
      setCreating(false);
      return;
    }

    setName("");
    setDescription("");
    setMessage("Your book club has been created!");
    setCreating(false);
    await loadClubs();
  }

  return (
    <main className="min-h-screen bg-[#FAF7F1] px-5 py-10 text-[#493D32] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-[#75634D] underline underline-offset-4"
        >
          ← Back to your library
        </Link>

        <header className="mt-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8C7D6A]">
            The Reading Nook
          </p>
          <h1 className="mt-2 font-serif text-4xl">Book Clubs</h1>
          <p className="mt-3 max-w-2xl text-[#75634D]">
            A little corner to read, share and discover books together.
          </p>
        </header>

        {message && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-[#D8CCBA] bg-white/80 p-4 text-sm"
          >
            {message}
          </p>
        )}

        <section className="mt-8 rounded-2xl border border-[#E4D9C8] bg-white/80 p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Create a book club</h2>
          <p className="mt-2 text-sm text-[#8C7D6A]">
            You’ll be the owner of the club you create.
          </p>

          <form onSubmit={createClub} className="mt-6 space-y-4">
            <div>
              <label htmlFor="club-name" className="mb-2 block text-sm">
                Club name
              </label>
              <input
                id="club-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. Sunday Chapter Club"
                className="w-full rounded-xl border border-[#D8CCBA] bg-[#FFFEFC] px-4 py-3 outline-none focus:border-[#9A8064]"
              />
            </div>

            <div>
              <label htmlFor="club-description" className="mb-2 block text-sm">
                Description (optional)
              </label>
              <textarea
                id="club-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What would you like your club to be about?"
                className="w-full rounded-xl border border-[#D8CCBA] bg-[#FFFEFC] px-4 py-3 outline-none focus:border-[#9A8064]"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-[#65795A] px-6 py-3 text-sm text-white transition hover:bg-[#536849] disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create club"}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-2xl">Your clubs</h2>

          {loading ? (
            <p className="mt-4 text-sm text-[#8C7D6A]">
              Loading your clubs...
            </p>
          ) : clubs.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D8CCBA] p-8 text-center">
              <p className="font-serif text-xl">Your reading circle starts here.</p>
              <p className="mt-2 text-sm text-[#8C7D6A]">
                Create your first club above. Your clubs will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/book-clubs/${club.id}`}

                  className="rounded-2xl border border-[#E4D9C8] bg-white/80 p-6"
                >
                  <p className="text-xs uppercase tracking-wider text-[#8C7D6A]">
                    {club.created_by === currentUserId ? "Your club" : "Member"}
                  </p>
                  <h3 className="mt-2 font-serif text-xl">{club.name}</h3>
                  {club.description && (
                    <p className="mt-2 text-sm text-[#75634D]">
                      {club.description}
                    </p>
                  )}
                  <p className="mt-4 text-xs text-[#8C7D6A]">
                    Club created successfully
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

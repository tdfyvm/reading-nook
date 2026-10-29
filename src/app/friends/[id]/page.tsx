"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Reading = { start_date: string; end_date: string | null };

type FriendBook = {
  id: string;
  title: string;
  author: string;
  status: string;
  rating: number;
  genre: string | null;
  cover_id: number | null;
  custom_cover_url: string | null;
  total_pages: number | null;
  current_page: number;
  readings: Reading[];
};

const FILTERS = ["All books", "Reading", "Rereading", "Read", "Want to read"];

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function coverSrc(book: FriendBook) {
  if (book.custom_cover_url) return book.custom_cover_url;
  if (book.cover_id != null && book.cover_id > 0) {
    return `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`;
  }
  return null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-1 text-sm"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className="relative inline-block" aria-hidden="true">
            <span className="text-[#D8CEBD]">★</span>
            <span
              className="absolute inset-y-0 left-0 overflow-hidden text-[#AA8650]"
              style={{ width: `${fill * 100}%` }}
            >
              ★
            </span>
          </span>
        );
      })}
    </div>
  );
}

function FriendShelfContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const friendId = params.id;

  const [username, setUsername] = useState("");
  const [books, setBooks] = useState<FriendBook[]>([]);
  const [filter, setFilter] = useState("All books");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", friendId)
        .maybeSingle();

      const { data, error: rpcError } = await supabase.rpc(
        "get_friend_bookshelf",
        { p_friend_id: friendId }
      );

      if (cancelled) return;

      setUsername((profile?.username as string | undefined) ?? "");

      if (rpcError) {
        setError(
          "You can only see a bookshelf if you're friends and they've chosen to share it."
        );
      } else {
        setBooks((data ?? []) as FriendBook[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [friendId, router]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return books.filter((book) => {
      const matchesStatus = filter === "All books" || book.status === filter;
      const matchesSearch =
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [books, filter, search]);

  return (
    <main className="min-h-screen bg-[#F8F5EE] px-6 py-10 text-[#453B32]">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/friends"
          className="text-sm text-[#806b55] transition hover:text-[#4b3828]"
        >
          ← Back to friends
        </Link>

        <header className="mb-8 mt-6">
          <p className="mb-2 text-sm uppercase tracking-[0.2em] text-[#9B866A]">
            The Reading Nook
          </p>
          <h1 className="font-serif text-4xl">
            {username ? `${username}'s bookshelf` : "Friend's bookshelf"}
          </h1>
          {!loading && !error && (
            <p className="mt-2 text-sm text-[#8C7D6A]">
              {books.length} {books.length === 1 ? "book" : "books"}. View
              only.
            </p>
          )}
        </header>

        {loading ? (
          <p>Opening the bookshelf...</p>
        ) : error ? (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    filter === item
                      ? "border-[#75634D] bg-[#75634D] text-white"
                      : "border-[#E3D8C8] bg-white/50 text-[#837461] hover:bg-[#EEE6D9]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a book or author..."
              className="mb-6 w-full max-w-sm rounded-full border border-[#E4D9C8] bg-white/70 px-4 py-3 text-sm outline-none focus:border-[#9B866A]"
            />

            {visible.length === 0 ? (
              <p className="text-sm italic text-[#8C7D6A]">No books found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((book) => {
                  const src = coverSrc(book);

                  return (
                    <article
                      key={book.id}
                      className="rounded-2xl border border-[#EBE2D5] bg-white/70 p-4"
                    >
                      <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-xl bg-[#E8DDCC] shadow-inner">
                        {src ? (
                          <>
                            <img
                              src={src}
                              alt=""
                              aria-hidden="true"
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 h-full w-full scale-125 object-cover blur-xl"
                              loading="lazy"
                            />
                            <div
                              className="absolute inset-0 bg-black/10"
                              aria-hidden="true"
                            />
                            <img
                              src={src}
                              alt={`Cover of ${book.title}`}
                              referrerPolicy="no-referrer"
                              className="relative h-full w-full object-contain drop-shadow-lg"
                              loading="lazy"
                            />
                          </>
                        ) : (
                          <span className="p-4 text-center font-serif text-xl text-[#554536]">
                            {book.title}
                          </span>
                        )}
                      </div>

                      <div className="px-1 pt-4">
                        <span className="rounded-full bg-[#F0E9DC] px-3 py-1 text-xs text-[#83715A]">
                          {book.status}
                        </span>
                        <h2 className="mt-2 font-serif text-xl font-medium">
                          {book.title}
                        </h2>
                        <p className="mt-1 text-sm text-[#968672]">
                          {book.author}
                        </p>

                        {book.genre && (
                          <span className="mt-3 inline-block rounded-full bg-[#E8E1D4] px-3 py-1 text-xs text-[#75634D]">
                            {book.genre}
                          </span>
                        )}

                        {book.rating > 0 && (
                          <div className="mt-3">
                            <Stars rating={book.rating} />
                          </div>
                        )}

                        {book.readings.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#9B866A]">
                              Reading dates
                            </p>
                            <ul className="mt-1 space-y-1 text-sm text-[#756B5D]">
                              {book.readings.map((reading, index) => (
                                <li key={index}>
                                  {formatDate(reading.start_date)} →{" "}
                                  {reading.end_date ? (
                                    formatDate(reading.end_date)
                                  ) : (
                                    <em className="text-[#8C7D6A]">
                                      still reading
                                    </em>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function FriendShelfPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8F5EE] p-8 text-[#453B32]">
          Opening the bookshelf...
        </main>
      }
    >
      <FriendShelfContent />
    </Suspense>
  );
}
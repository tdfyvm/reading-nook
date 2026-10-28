"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Recommendation = {
  id: string;
  title: string;
  author: string | null;
  cover_id: number | null;
  position: number;
};

type SearchResult = {
  key: string;
  title: string;
  author: string | null;
  cover_id: number | null;
};

const MAX_RECOMMENDATIONS = 12;

function goodreadsLink(title: string, author: string | null) {
  const query = encodeURIComponent(`${title} ${author ?? ""}`.trim());
  return `https://www.goodreads.com/search?q=${query}`;
}

function Cover({
  title,
  coverId,
  className,
}: {
  title: string;
  coverId: number | null;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (coverId == null || coverId <= 0 || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[#E8DDCC] p-2 text-center font-serif text-xs text-[#554536]`}
      >
        {title}
      </div>
    );
  }

  return (
    <img
      src={`https://covers.openlibrary.org/b/id/${coverId}-M.jpg`}
      alt={`Cover of ${title}`}
      referrerPolicy="no-referrer"
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

/* ---------- Shown to the survey owner on the detail page ---------- */

export function RecommendationsEditor({ surveyId }: { surveyId: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("survey_recommendations")
      .select("id, title, author, cover_id, position")
      .eq("survey_id", surveyId)
      .order("position", { ascending: true });

    if (loadError) {
      setError("Couldn't load recommendations: " + loadError.message);
      return;
    }

    setRecs((data ?? []) as Recommendation[]);
  }, [surveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function search() {
    const text = query.trim();
    if (!text) return;

    setSearching(true);
    setSearched(false);
    setError("");

    try {
      const params = new URLSearchParams({
        q: text,
        fields: "key,title,author_name,cover_i",
        limit: "8",
      });

      const response = await fetch(
        `https://openlibrary.org/search.json?${params.toString()}`
      );

      if (!response.ok) throw new Error("Search failed");

      const json: {
        docs?: {
          key: string;
          title?: string;
          author_name?: string[];
          cover_i?: number;
        }[];
      } = await response.json();

      setResults(
        (json.docs ?? [])
          .filter((doc) => doc.title)
          .map((doc) => ({
            key: doc.key,
            title: doc.title as string,
            author: doc.author_name?.[0] ?? null,
            cover_id: doc.cover_i ?? null,
          }))
      );
      setSearched(true);
    } catch {
      setError("Couldn't search right now. Please try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function addBook(result: SearchResult) {
    if (busy) return;

    if (recs.length >= MAX_RECOMMENDATIONS) {
      setError(`You can add up to ${MAX_RECOMMENDATIONS} books.`);
      return;
    }

    const alreadyAdded = recs.some(
      (rec) =>
        rec.title.toLowerCase() === result.title.toLowerCase() &&
        (rec.author ?? "").toLowerCase() ===
          (result.author ?? "").toLowerCase()
    );

    if (alreadyAdded) {
      setError("That book is already in your list.");
      return;
    }

    setBusy(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Please log in again.");
      setBusy(false);
      return;
    }

    const nextPosition =
      Math.max(-1, ...recs.map((rec) => rec.position)) + 1;

    const { data, error: insertError } = await supabase
      .from("survey_recommendations")
      .insert({
        survey_id: surveyId,
        owner_id: user.id,
        title: result.title,
        author: result.author,
        cover_id: result.cover_id,
        position: nextPosition,
      })
      .select("id, title, author, cover_id, position")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't add that book.");
      setBusy(false);
      return;
    }

    setRecs((current) => [...current, data as Recommendation]);
    setResults([]);
    setSearched(false);
    setQuery("");
    setBusy(false);
  }

  async function removeBook(rec: Recommendation) {
    if (busy) return;

    setBusy(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("survey_recommendations")
      .delete()
      .eq("id", rec.id)
      .eq("survey_id", surveyId);

    if (deleteError) {
      setError(deleteError.message);
      setBusy(false);
      return;
    }

    setRecs((current) => current.filter((item) => item.id !== rec.id));
    setBusy(false);
  }

  return (
    <section className="mb-8 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
      <h2 className="font-serif text-2xl">If you liked this, you&apos;ll like…</h2>
      <p className="mt-2 text-sm text-[#786956]">
        Search for books to recommend. They appear at the bottom of your
        survey with their covers.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Search by title or author..."
          className="w-full rounded-xl border border-[#DCCFBD] px-4 py-3 outline-none focus:border-[#8B6F47]"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching || !query.trim()}
          className="rounded-xl bg-[#6D5940] px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {searched && results.length === 0 && (
        <p className="mt-4 text-sm text-[#786956]">
          No books found. Try a different title or author.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((result) => (
            <li
              key={result.key}
              className="flex items-center gap-3 rounded-xl border border-[#EEE2D1] bg-[#FAF5ED] p-3"
            >
              <Cover
                title={result.title}
                coverId={result.cover_id}
                className="h-16 w-11 shrink-0 rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{result.title}</p>
                {result.author && (
                  <p className="truncate text-sm text-[#786956]">
                    {result.author}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void addBook(result)}
                disabled={busy}
                className="rounded-lg border border-[#DCCFBD] px-3 py-2 text-sm hover:bg-white disabled:opacity-50"
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <h3 className="mt-8 font-serif text-xl">
        Your recommendations ({recs.length})
      </h3>

      {recs.length === 0 ? (
        <p className="mt-2 text-sm italic text-[#786956]">
          No books added yet.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {recs.map((rec) => (
            <div key={rec.id} className="text-center">
              <Cover
                title={rec.title}
                coverId={rec.cover_id}
                className="mx-auto h-40 w-28 rounded-lg shadow"
              />
              <p className="mt-2 text-sm font-medium">{rec.title}</p>
              {rec.author && (
                <p className="text-xs text-[#786956]">{rec.author}</p>
              )}
              <button
                type="button"
                onClick={() => void removeBook(rec)}
                disabled={busy}
                className="mt-2 text-xs text-red-700 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Shown to people answering the survey ---------- */

export function RecommendationsList({ surveyId }: { surveyId: string }) {
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("survey_recommendations")
        .select("id, title, author, cover_id, position")
        .eq("survey_id", surveyId)
        .order("position", { ascending: true });

      if (!cancelled && !error) {
        setRecs((data ?? []) as Recommendation[]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  if (recs.length === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border border-[#E5D8C5] bg-white/80 p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-[#8B6F47]">
        More to read
      </p>
      <h2 className="mt-2 font-serif text-2xl">
        If you liked this, you&apos;ll like…
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {recs.map((rec) => (
          <div key={rec.id} className="text-center">
            <Cover
              title={rec.title}
              coverId={rec.cover_id}
              className="mx-auto h-44 w-30 rounded-lg shadow-md"
            />
            <p className="mt-3 font-serif text-base">{rec.title}</p>
            {rec.author && (
              <p className="text-sm text-[#786956]">{rec.author}</p>
            )}
            <a
              href={goodreadsLink(rec.title, rec.author)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-[#8B6F47] hover:underline"
            >
              View on Goodreads ↗
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
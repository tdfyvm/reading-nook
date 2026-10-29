
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FormatsRead } from "@/components/Formats";

type Book = {
  id: string;
  title: string;
  author: string;
  status: string;
  genre: string | null;
  rating: number | null;
  total_pages: number | null;
  cover_id: number | null;
  custom_cover_url: string |null;
  custom_cover_path: string | null;
};

type Reading = {
  id: string;
  book_id: string;
  start_date: string | null;
  end_date: string | null;
};

export default function StatsPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState(2026);
  const [currentYear, setCurrentYear] = useState(2026);
  
  const [readingGoal, setReadingGoal] = useState(30);
  const [goalInput, setGoalInput] = useState("30");
  const [editingGoal, setEditingGoal] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  
const saveReadingGoal = async () => {
  const parsedGoal = Number(goalInput);

  if (!Number.isInteger(parsedGoal) || parsedGoal < 1) {
    return;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  const user = sessionData.session?.user;

  if (sessionError || !user) {
    setError("Please log in again to save your reading goal.");
    return;
  }

  const { error: saveError } = await supabase
    .from("reading_goals")
    .upsert(
      {
        owner_id: user.id,
        year,
        goal: parsedGoal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,year" }
    );

  if (saveError) {
    setError(`Couldn't save your reading goal: ${saveError.message}`);
    return;
  }

  setReadingGoal(parsedGoal);
  setGoalInput(String(parsedGoal));
  setEditingGoal(false);
};


  
useEffect(() => {
  let cancelled = false;

  async function loadReadingGoal() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user || cancelled) return;

    const { data, error } = await supabase
      .from("reading_goals")
      .select("goal")
      .eq("owner_id", user.id)
      .eq("year", year)
      .maybeSingle();

    if (cancelled) return;

    if (error) {
      console.error("Couldn't load reading goal:", error.message);
      return;
    }

    const goal = data?.goal ?? 30;

    setReadingGoal(goal);
    setGoalInput(String(goal));
    setEditingGoal(false);
  }

  void loadReadingGoal();

  return () => {
    cancelled = true;
  };
}, [year]);



  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError("");

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const ownerId = sessionData.session.user.id;

      const [booksResult, readingsResult] = await Promise.all([
        supabase
          .from("books")
          .select("id, title, author, status, genre, rating, total_pages, cover_id, custom_cover_url, custom_cover_path")
          .eq("owner_id", ownerId),

        supabase
          .from("book_readings")
          .select("id, book_id, start_date, end_date")
          .eq("owner_id", ownerId),
      ]);

      if (cancelled) return;

      if (booksResult.error || readingsResult.error) {
        setError(
          booksResult.error?.message ??
            readingsResult.error?.message ??
            "Couldn't load your reading stats."
        );
        setLoading(false);
        return;
      }

      setBooks((booksResult.data ?? []) as Book[]);
      setReadings((readingsResult.data ?? []) as Reading[]);
      setLoading(false);
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const stats = useMemo(() => {
    const bookById = new Map(books.map((book) => [book.id, book]));

    // Each completed reading record represents one book completion.
    // If a book is reread, its additional completion is counted too.
    const completed = readings.filter(
      (reading) =>
        reading.end_date && bookById.has(reading.book_id)
    );

    const yearly = completed.filter(
      (reading) =>
        new Date(`${reading.end_date}T12:00:00`).getFullYear() === year
    );

    const monthly = Array.from({ length: 12 }, (_, index) => {
      const finishedThisMonth = yearly.filter(
        (reading) =>
          new Date(`${reading.end_date}T12:00:00`).getMonth() === index
      );

      const pages = finishedThisMonth.reduce((total, reading) => {
        return total + (bookById.get(reading.book_id)?.total_pages ?? 0);
      }, 0);

      return {
        label: new Date(2020, index, 1).toLocaleDateString("en", {
          month: "short",
        }),
        books: finishedThisMonth.length,
        pages,
      };
    });

    const yearlyPages = yearly.reduce((total, reading) => {
      return total + (bookById.get(reading.book_id)?.total_pages ?? 0);
    }, 0);

    const genres = new Map<string, number>();

    for (const reading of yearly) {
      const genre = bookById.get(reading.book_id)?.genre?.trim();
      if (genre) genres.set(genre, (genres.get(genre) ?? 0) + 1);
    }

    const topGenres = [...genres.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      booksFinished: yearly.length,
      differentBooks: new Set(yearly.map((reading) => reading.book_id)).size,
      pages: yearlyPages,
      monthly,
      topGenres,
      maxMonthlyBooks: Math.max(1, ...monthly.map((item) => item.books)),
      maxMonthlyPages: Math.max(1, ...monthly.map((item) => item.pages)),
    };
  }, [books, readings, year]);

  
  
  const ratingStats = useMemo(() => {
    const ratings = books
      .map((book) => book.rating)
      .filter(
        (rating): rating is number =>
          typeof rating === "number" && rating >= 1 && rating <= 5
      );

    const average =
      ratings.length > 0
        ? ratings.reduce((total, rating) => total + rating, 0) /
          ratings.length
        : 0;

    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: ratings.filter((rating) => rating === stars).length,
    }));

    return {
      average,
      total: ratings.length,
      distribution,
      maxCount: Math.max(1, ...distribution.map((item) => item.count)),
    };
  }, [books]);



  
  const challenge = useMemo(() => {
    const completedReadings = readings
      .filter((reading) => reading.end_date)
      .filter((reading) => {
        return (
          new Date(`${reading.end_date}T12:00:00`).getFullYear() === year
        );
      })
      .filter((reading) =>
        books.some((book) => book.id === reading.book_id)
      )
      .sort((a, b) => {
        return (
          new Date(`${a.end_date}T12:00:00`).getTime() -
          new Date(`${b.end_date}T12:00:00`).getTime()
        );
      });

    const booksRead = completedReadings.length;
    const goalReached = booksRead >= readingGoal;

    const reachedDate =
      goalReached && readingGoal > 0
        ? completedReadings[readingGoal - 1].end_date
        : null;

    const percentage =
      readingGoal > 0
        ? Math.min(100, Math.round((booksRead / readingGoal) * 100))
        : 0;

    return {
      booksRead,
      goalReached,
      reachedDate,
      percentage,
    };
  }, [readings, books, year, readingGoal]);

      useEffect(() => {
    if (challenge.goalReached) {
      setConfettiKey((key) => key + 1);
    }
  }, [challenge.goalReached, year]);

  
  const availableYears = useMemo(() => {
    const years = readings
      .filter((reading) => reading.end_date)
      .map((reading) =>
        new Date(`${reading.end_date}T12:00:00`).getFullYear()
      );

    return [...new Set([...years, currentYear])].sort(
      (a, b) => b - a
    );
  }, [readings, currentYear]);

  return (
    <main className="min-h-screen bg-[#F8F5EE] text-[#453B32]">
      <div className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-12">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-sm text-[#9B866A]">
              YOUR READING JOURNEY
            </p>
            <h1 className="font-serif text-4xl font-medium sm:text-5xl">
              Reading Stats
            </h1>
            <p className="mt-3 text-[#8C7D6A]">
              Every page is part of your story.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-[#D8CCBA] px-5 py-3 text-sm text-[#75634D] transition hover:bg-[#EEE6D9]"
          >
            ← Back to my bookshelf
          </Link>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Your year in books</h2>
            <p className="mt-1 text-sm text-[#8C7D6A]">
              Based on the dates you finished your books.
            </p>
          </div>

          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-xl border border-[#D8CCBA] bg-white px-4 py-3"
            aria-label="Choose year"
          >
            {availableYears.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[#E4D9C8] bg-white/70 p-10 text-center text-[#8C7D6A]">
            Gathering your reading stories…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-red-800">
            <p className="font-medium">Couldn't load your reading stats.</p>
            <p className="mt-2 break-words text-sm">{error}</p>
          </div>
        ) : (
          <>
          
<section className="relative mb-8 overflow-hidden rounded-3xl border border-[#E4D9C8] bg-gradient-to-br from-[#FFFDF7] via-[#F6EFE4] to-[#E7EBDD] p-6 sm:p-8">
  {challenge.goalReached && (
    <div
      key={confettiKey}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: 36 }, (_, index) => (
        <span
          key={index}
          className="reading-confetti absolute block h-2 w-2 rounded-sm"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${-10 - (index % 5) * 8}%`,
            backgroundColor: [
              "#CDAA88",
              "#9DAF91",
              "#D9A7A7",
              "#E8C96A",
              "#B8A5CC",
            ][index % 5],
            animationDelay: `${(index % 12) * 0.12}s`,
            transform: `rotate(${index * 29}deg)`,
          }}
        />
      ))}
    </div>
  )}

  <div className="relative">
    <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#8C7D6A]">
      {year} reading challenge
    </p>

    <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-3xl sm:text-4xl">
          {challenge.booksRead}{" "}
          <span className="text-[#9B866A]">/ {readingGoal} books</span>
        </h2>
        <p className="mt-2 text-sm text-[#75634D]">
          Every finished book brings you a little further.
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          setGoalInput(String(readingGoal));
          setEditingGoal(!editingGoal);
        }}
        className="rounded-full border border-[#CDBDA7] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
      >
        {editingGoal ? "Cancel" : "Edit goal"}
      </button>
    </div>

    {editingGoal && (
      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          saveReadingGoal();
        }}
      >
        <label className="text-sm text-[#75634D]">
          Your goal for {year}
          <input
            type="number"
            min="1"
            step="1"
            required
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            className="mt-1 block w-32 rounded-xl border border-[#D8CCBA] bg-white px-3 py-2 text-[#453B32]"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#6F8062] px-5 py-2 text-sm text-white transition hover:bg-[#586A4D]"
        >
          Save goal
        </button>
      </form>
    )}

    <div
      className="mt-7 h-4 overflow-hidden rounded-full bg-white/90 shadow-inner"
      role="progressbar"
      aria-label={`${year} reading challenge progress`}
      aria-valuemin={0}
      aria-valuemax={readingGoal}
      aria-valuenow={Math.min(challenge.booksRead, readingGoal)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#A8B99A] via-[#91A985] to-[#D4B18C] transition-all duration-700"
        style={{ width: `${challenge.percentage}%` }}
      />
    </div>

    <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#75634D]">
      <span>{challenge.percentage}% complete</span>
      <span>{challenge.booksRead} books counted</span>
    </div>

    {challenge.goalReached ? (
      <div className="mt-6 rounded-2xl border border-[#D9D7B9] bg-white/75 p-4">
        <p className="font-serif text-xl text-[#586A4D]">
          ✨ You did it! Goal reached! ✨
        </p>
        {challenge.reachedDate && (
          <p className="mt-1 text-sm text-[#75634D]">
            You reached your goal on{" "}
            {new Date(`${challenge.reachedDate}T12:00:00`).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "long", year: "numeric" }
            )}
            .
          </p>
        )}
        <p className="mt-2 text-sm text-[#75634D]">
          Keep reading — every extra book still counts!
        </p>
      </div>
    ) : (
      <p className="mt-5 text-sm text-[#75634D]">
        Only {readingGoal - challenge.booksRead} more{" "}
        {readingGoal - challenge.booksRead === 1 ? "book" : "books"} to reach
        your goal. You’ve got this! ☕
      </p>
    )}
  </div>
</section>

    
            <section className="mb-8 overflow-hidden rounded-3xl border border-[#E4D9C8] bg-gradient-to-br from-[#FFFDF7] via-[#FFFFFF] to-[#F2EBDD] p-6 shadow-sm sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#9B866A]">
                    Your personal book report
                  </p>
                  <h2 className="mt-2 font-serif text-2xl sm:text-3xl">
                    Your average rating
                  </h2>
                  <p className="mt-2 text-sm text-[#8C7D6A]">
                    A little glimpse into the books you loved.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E4D9C8] bg-white/80 px-5 py-4 text-center">
                  <p className="font-serif text-4xl text-[#5B4636]">
                    {ratingStats.total > 0
                      ? ratingStats.average.toFixed(1)
                      : "—"}
                    <span className="text-lg text-[#9B866A]"> / 5</span>
                  </p>
                  <div
                    className="mt-1 flex justify-center gap-1 text-xl"
                    aria-label={
                      ratingStats.total > 0
                        ? `Average rating ${ratingStats.average.toFixed(1)} out of 5`
                        : "No ratings yet"
                    }
                  >
                    {Array.from({ length: 5 }, (_, index) => {
                      const fill = Math.max(
                        0,
                        Math.min(1, ratingStats.average - index)
                      );

                      return (
                        <span
                          key={index}
                          className="relative inline-block"
                          style={{
                            color: "#E8E0D3",
                          }}
                        >
                          ★
                          <span
                            className="absolute inset-y-0 left-0 overflow-hidden"
                            style={{ width: `${fill * 100}%`, color: "#D4A94F" }}
                          >
                            ★
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-[#8C7D6A]">
                    {ratingStats.total}{" "}
                    {ratingStats.total === 1 ? "book rated" : "books rated"}
                  </p>
                </div>
              </div>

              <div className="mt-8 border-t border-[#E9E0D2] pt-6">
                <h3 className="mb-5 font-serif text-lg">
                  Your rating breakdown
                </h3>

                {ratingStats.total === 0 ? (
                  <p className="rounded-xl bg-white/70 p-4 text-sm text-[#8C7D6A]">
                    No ratings yet. Rate some books on your bookshelf and
                    your rating story will appear here. ✨
                  </p>
                ) : (
                  <div className="space-y-4">
                    {ratingStats.distribution.map(({ stars, count }) => (
                      <div
                        key={stars}
                        className="grid grid-cols-[auto_minmax(0,1fr)_2rem] items-center gap-3"
                      >
                        <div
                          className="flex items-center gap-1 whitespace-nowrap text-sm text-[#75634D]"
                          aria-label={`${stars} stars`}
                        >
                          <span>{stars}</span>
                          <span className="text-[#D4A94F]">★</span>
                        </div>

                        <div
                          className="h-3 overflow-hidden rounded-full bg-[#EEE6D9]"
                          role="progressbar"
                          aria-label={`${stars}-star ratings`}
                          aria-valuemin={0}
                          aria-valuemax={ratingStats.total}
                          aria-valuenow={count}
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#D9C18A] to-[#C49A46] transition-all duration-500"
                            style={{
                              width: `${(count / ratingStats.total) * 100}%`,
                            }}
                          />
                        </div>

                        <span className="text-right text-sm tabular-nums text-[#8C7D6A]">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>


            <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon="🌃"
                label="Books finished"
                value={stats.booksFinished}
              />
              <StatCard
                icon="⋆☕︎ ˖"
                label="Total authors read"
                value={
                    new Set(
                     readings
                        .filter((reading) => reading.end_date)
                        .filter((reading) => new Date(reading.end_date!).getFullYear() === year)
                        .map((reading) =>
                            books.find((book) => book.id === reading.book_id)?.author?.trim().toLowerCase()
                         )
                        .filter(Boolean)
                ).size}
              />
              <StatCard
                icon="🕮"
                label="Pages in finished books"
                value={stats.pages.toLocaleString()}
              />
            </section>

            <section className="mb-8 rounded-2xl border border-[#E4D9C8] bg-white/75 p-6 sm:p-8">
              <h2 className="font-serif text-2xl">Books finished each month</h2>
              <p className="mt-2 text-sm text-[#8C7D6A]">
                Books completed in each month of {year}.
              </p>

              <div className="mt-8 grid h-52 grid-cols-12 items-end gap-2 sm:gap-4">
                {stats.monthly.map((month) => (
                  <div
                    key={month.label}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-xs text-[#827462]">
                      {month.books || ""}
                    </span>
                    <div
                      title={`${month.books} books finished`}
                      className="w-full max-w-10 rounded-t-lg bg-[#9DAF91] transition-all"
                      style={{
                        height: `${
                          month.books > 0
                            ? Math.max(
                                6,
                                (month.books / stats.maxMonthlyBooks) * 100
                              )
                            : 0
                        }%`,
                      }}
                    />
                    <span className="text-[10px] text-[#827462] sm:text-xs">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-[#E4D9C8] bg-white/75 p-6 sm:p-8">
              <h2 className="font-serif text-2xl">Pages by month</h2>
              <p className="mt-2 text-sm text-[#8C7D6A]">
                Full page counts of books finished in each month of {year}.
              </p>

              <div className="mt-8 grid h-52 grid-cols-12 items-end gap-2 sm:gap-4">
                {stats.monthly.map((month) => (
                  <div
                    key={month.label}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-[10px] text-[#827462] sm:text-xs">
                      {month.pages ? month.pages.toLocaleString() : ""}
                    </span>
                    <div
                      title={`${month.pages.toLocaleString()} pages`}
                      className="w-full max-w-10 rounded-t-lg bg-[#CDAA88] transition-all"
                      style={{
                        height: `${
                          month.pages > 0
                            ? Math.max(
                                6,
                                (month.pages / stats.maxMonthlyPages) * 100
                              )
                            : 0
                        }%`,
                      }}
                    />
                    <span className="text-[10px] text-[#827462] sm:text-xs">
                      {month.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-[#E4D9C8] bg-white/75 p-6 sm:p-8">
              <h2 className="font-serif text-2xl">Month by month</h2>
              <div className="mt-5 overflow-x-auto">
                
<div className="space-y-4">
  {stats.monthly.map((month) => {
    const monthNumber = stats.monthly.findIndex(
      (item) => item.label === month.label
    );

    const finishedBooks = readings
      .filter((reading) => {
        if (!reading.end_date) return false;

        const date = new Date(reading.end_date);

        return (
          date.getFullYear() === year &&
          date.getMonth() === monthNumber
        );
      })
      .map((reading) =>
        books.find((book) => book.id === reading.book_id)
      )
      .filter((book) => book !== undefined);

    return (
      <div
        key={month.label}
        className="rounded-xl border border-[#E9E0D2] bg-white/60 p-4"
      >
        <h3 className="mb-3 font-medium text-[#5B4636]">
          {month.label}
        </h3>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {finishedBooks.length > 0 ? (
            finishedBooks.map((book, index) => {
              const coverUrl = book.custom_cover_url
                ? book.custom_cover_url
                : book.cover_id
                  ? `https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`
                  : null;

              return (
                <div
                  key={`${book.id}-${index}`}
                  title={`${book.title} by ${book.author}`}
                  className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-[#F0E9DF]"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={`Cover of ${book.title}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-1 text-center text-xs text-[#8C7D6A]">
                      {book.title}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[#8C7D6A]">
              No books finished this month.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#6F5B49]">
          <p>
            <span className="font-semibold">{month.books}</span>{" "}
            {month.books === 1 ? "book" : "books"} finished
          </p>
          <p>
            <span className="font-semibold">
              {month.pages.toLocaleString()}
            </span>{" "}
            pages read
          </p>
        </div>
      </div>
    );
  })}
</div>

              </div>
              <p className="mt-4 text-xs leading-5 text-[#8C7D6A]">
                Page totals use each book&apos;s full page count in the month
                it was finished. If a reread has its own completed reading
                record, its pages are counted again. These are estimates,
                not exact pages tracked.
              </p>
            </section>

            <FormatsRead key={'${books.length}-${editingBookId ?? "idle"}'} />

            <section className="rounded-2xl border border-[#E4D9C8] bg-white/75 p-6 sm:p-8">
  <h2 className="font-serif text-2xl text-[#493D32]">
    Genres you return to
  </h2>
  <p className="mt-2 text-sm text-[#8C7D6A]">
    Genres of books finished in {year}.
  </p>

  {stats.topGenres.length === 0 ? (
    <p className="mt-5 rounded-xl bg-[#F8F3EB] p-4 text-sm text-[#8C7D6A]">
      No finished books with genres recorded for this year yet.
    </p>
  ) : (
    (() => {
      const genres = stats.topGenres;
      const total = genres.reduce((sum, [, count]) => sum + count, 0);
      const max = Math.max(1, ...genres.map(([, count]) => count));
      const colors = [
        "#899B78",
        "#C98F9D",
        "#D7B46A",
        "#9AACC0",
        "#B7A6C9",
        "#CDAA88",
        "#91B7A8",
        "#D18F69",
      ];
      const radius = 66;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;

      return (
        <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row sm:gap-10">
          <div className="w-full max-w-[230px] shrink-0">
            <svg
              viewBox="0 0 180 180"
              role="img"
              aria-label={`Donut chart showing ${total} finished books by genre in ${year}`}
              className="mx-auto w-full"
            >
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="#EEE6D9"
                strokeWidth="19"
              />

              <g transform="rotate(-90 90 90)">
                {genres.map(([genre, count], index) => {
                  const length = (count / total) * circumference;
                  const segment = (
                    <circle
                      key={genre}
                      cx="90"
                      cy="90"
                      r={radius}
                      fill="none"
                      stroke={colors[index % colors.length]}
                      strokeWidth="19"
                      strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                    />
                  );

                  offset += length;
                  return segment;
                })}
              </g>

              <text
                x="90"
                y="85"
                textAnchor="middle"
                className="fill-[#493D32]"
                fontSize="31"
                fontWeight="600"
              >
                {total}
              </text>
              <text
                x="90"
                y="104"
                textAnchor="middle"
                className="fill-[#8C7D6A]"
                fontSize="10"
              >
                finished books
              </text>
            </svg>
          </div>

          <div className="w-full min-w-0 flex-1 space-y-4">
            {genres.map(([genre, count], index) => (
              <div key={genre}>
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: colors[index % colors.length],
                    }}
                  />
                  <span className="min-w-0 flex-1 text-sm text-[#493D32]">
                    {genre}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[#493D32]">
                    {count}
                  </span>
                  <span className="w-10 text-right text-xs text-[#8C7D6A]">
                    {Math.round((count / total) * 100)}%
                  </span>
                </div>

                <div className="ml-6 mt-2 h-1.5 overflow-hidden rounded-full bg-[#EEE6D9]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: colors[index % colors.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    })()
  )}
</section>
          </>
        )}

        <footer className="mt-10 text-center text-sm text-[#A29481]">
          Made with a little love and a lot of stories. ☕
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-[#E4D9C8] bg-white/75 p-6">
      <div className="text-2xl">{icon}</div>
      <p className="mt-4 text-sm text-[#8C7D6A]">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
    </div>
  );
}
